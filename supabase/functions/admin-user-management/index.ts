import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedStaticHosts = new Set([
  'https.bolt.new',
  'https.stackblitz.com',
  'main.artemo.ai',
  'artemo.vercel.app',
]);

const dynamicOriginPatterns = [
  /\.local-credentialless\.webcontainer-api\.io$/,
  /\.w-credentialless-staticblitz\.com$/,
];

function resolveAllowedOrigin(originHeader: string | null): string | null {
  if (!originHeader) {
    return null;
  }

  try {
    const originUrl = new URL(originHeader);
    if (originUrl.protocol !== 'https:') {
      return null;
    }

    if (allowedStaticHosts.has(originUrl.host)) {
      return originUrl.origin;
    }

    if (dynamicOriginPatterns.some((pattern) => pattern.test(originUrl.host))) {
      return originUrl.origin;
    }
  } catch (_error) {
    return null;
  }

  return null;
}

function createCorsHeaders(originHeader: string | null) {
  const allowedOrigin = resolveAllowedOrigin(originHeader);

  return {
    'Access-Control-Allow-Origin': allowedOrigin ?? 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

Deno.serve(async (req: Request) => {
  console.log('Admin user management function called:', req.method);
  const originHeader = req.headers.get('origin');
  const corsHeaders = createCorsHeaders(originHeader);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('CRITICAL: Missing Supabase environment variables in Edge Function.');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const requestBody = await req.json();
    const action = requestBody.action?.toString().trim();
    const userId = requestBody.userId;
    const reason = requestBody.reason;
    console.log(`Processing action: "${action}" for user: ${userId}`);

    // --- Admin Verification (Your existing code is correct) ---
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !requestingUser) {
      throw new Error('Invalid authorization token');
    }
    const { data: adminProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', requestingUser.id)
      .single();
    if (profileError || adminProfile?.role !== 'admin') {
      throw new Error('Admin privileges required');
    }
    console.log(`Admin verification passed for ${requestingUser.email}.`);
    // --- End Admin Verification ---

    switch (action) {
      case 'delete_user':
        console.log(`[delete_user] Starting full deletion process for user: ${userId}`);

        // Step 1: Delete from usage_analytics
        console.log(`[delete_user] Deleting usage analytics for user: ${userId}`);
        const { error: usageError } = await supabase
          .from('usage_analytics')
          .delete()
          .eq('user_id', userId);
        if (usageError) {
          console.error('[delete_user] Error deleting usage analytics:', usageError);
        }

        // Step 2: Delete from chat_history
        console.log(`[delete_user] Deleting chat history for user: ${userId}`);
        const { error: chatError } = await supabase
          .from('chat_history')
          .delete()
          .eq('user_id', userId);
        if (chatError) {
          console.error('[delete_user] Error deleting chat history:', chatError);
        }

        // Step 3: Delete from projects
        console.log(`[delete_user] Deleting projects for user: ${userId}`);
        const { error: projectsError } = await supabase
          .from('projects')
          .delete()
          .eq('user_id', userId);
        if (projectsError) {
          console.error('[delete_user] Error deleting projects:', projectsError);
        }

        // Step 4: Delete from user_tool_activations
        console.log(`[delete_user] Deleting user tool activations for user: ${userId}`);
        const { error: activationsError } = await supabase
          .from('user_tool_activations')
          .delete()
          .eq('user_id', userId);
        if (activationsError) {
          console.error('[delete_user] Error deleting tool activations:', activationsError);
        }

        // Step 5: Log the deletion to audit table before deleting profile
        console.log(`[delete_user] Logging deletion to audit table`);
        await supabase.from('user_management_audit').insert({
          target_user_id: userId,
          admin_user_id: requestingUser.id,
          action_type: 'delete',
          reason: reason || 'User deleted by admin',
        });

        // Step 6: Delete from user_profiles
        console.log(`[delete_user] Deleting user profile for user: ${userId}`);
        const { error: profileError } = await supabase
          .from('user_profiles')
          .delete()
          .eq('id', userId);
        if (profileError) {
          console.error('[delete_user] Error deleting user profile:', profileError);
          throw new Error(`Database error deleting user: ${profileError.message}`);
        }

        // Step 7: Delete from Supabase Auth (final step)
        console.log(`[delete_user] Deleting user from Auth system: ${userId}`);
        const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);

        if (deleteAuthError) {
            console.error('[delete_user] CRITICAL: Failed to delete user from AUTH system.', deleteAuthError);
            throw new Error(`Auth Deletion Failed: ${deleteAuthError.message}`);
        }
        console.log(`[delete_user] Successfully deleted user from AUTH system: ${userId}`);
        break;

      case 'ban_user':
        console.log(`[ban_user] Attempting to ban user in Auth system: ${userId}`);
        const { error: banError } = await supabase.auth.admin.updateUserById(userId, {
          ban_duration: 'none',
        });

        if (banError) {
          console.error('[ban_user] CRITICAL: Failed to ban user in AUTH system.', banError);
          throw new Error(`Auth Ban Failed: ${banError.message}`);
        }
        console.log(`[ban_user] Successfully banned user in Auth system: ${userId}`);

        console.log(`[ban_user] Updating profile status to inactive for user: ${userId}`);
        await supabase.from('user_profiles').update({ active: false }).eq('id', userId);
        
        await supabase.from('user_management_audit').insert({
            target_user_id: userId,
            admin_user_id: requestingUser.id,
            action_type: 'status_change',
            new_value: { active: false },
            reason: reason || 'User disabled by admin',
        });
        break;

      case 'unban_user':
        console.log(`[unban_user] Attempting to unban user in Auth system: ${userId}`);
        const { error: unbanError } = await supabase.auth.admin.updateUserById(userId, {
          ban_duration: '0',
        });

        if (unbanError) {
          console.error('[unban_user] CRITICAL: Failed to unban user in AUTH system.', unbanError);
          throw new Error(`Auth Unban Failed: ${unbanError.message}`);
        }
        console.log(`[unban_user] Successfully unbanned user in Auth system: ${userId}`);

        console.log(`[unban_user] Updating profile status to active for user: ${userId}`);
        await supabase.from('user_profiles').update({ active: true }).eq('id', userId);

        await supabase.from('user_management_audit').insert({
            target_user_id: userId,
            admin_user_id: requestingUser.id,
            action_type: 'status_change',
            new_value: { active: true },
            reason: reason || 'User enabled by admin',
        });
        break;

      case 'update_role':
        console.log(`[update_role] Updating role for user: ${userId} to ${reason}`);
        
        // Get current user data for audit trail
        const { data: currentUser, error: getCurrentError } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', userId)
          .single();
        
        if (getCurrentError) {
          console.error('[update_role] Error fetching current user:', getCurrentError);
          throw new Error(`Failed to fetch current user data: ${getCurrentError.message}`);
        }
        
        // Update the user's role
        const { error: updateRoleError } = await supabase
          .from('user_profiles')
          .update({ 
            role: reason, // reason parameter contains the new role
            status_updated_by: requestingUser.id,
            status_updated_at: new Date().toISOString()
          })
          .eq('id', userId);
        
        if (updateRoleError) {
          console.error('[update_role] Error updating user role:', updateRoleError);
          throw new Error(`Failed to update user role: ${updateRoleError.message}`);
        }
        
        // Log the role change to audit table
        await supabase.from('user_management_audit').insert({
          target_user_id: userId,
          admin_user_id: requestingUser.id,
          action_type: 'role_change',
          old_value: { role: currentUser.role },
          new_value: { role: reason },
          reason: `Role changed from ${currentUser.role} to ${reason} by admin`,
        });
        
        console.log(`[update_role] Successfully updated user role from ${currentUser.role} to ${reason}`);
        break;

      default:
        throw new Error(`Invalid action received: ${action}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: `Action '${action}' completed successfully.` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('--- Top-Level Edge Function Error ---', {
      message: error.message,
      stack: error.stack,
    });
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});