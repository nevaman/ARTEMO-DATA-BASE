import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
 
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface InviteUserRequest {
  email: string;
  fullName: string;
  role: 'user' | 'admin';
}

serve(async (req: Request) => {
  console.log('Admin invite user function called:', req.method);

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
    // Initialize Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, fullName, role }: InviteUserRequest = await req.json();
    console.log('Processing user invitation for:', email, 'with role:', role);

    if (!email || !fullName || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, fullName, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !requestingUser) {
      console.error('Invalid authorization token:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if requesting user is admin
    const { data: adminProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', requestingUser.id)
      .single();

    if (profileError || adminProfile?.role !== 'admin') {
      console.error('Admin privileges required. User role:', adminProfile?.role);
      return new Response(
        JSON.stringify({ error: 'Admin privileges required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin verification passed. Sending invitation to:', email);

    // Use Supabase Auth Admin API to invite user (only available with service role key)
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { 
        full_name: fullName,
        role: role 
      },
      redirectTo: `${req.headers.get('origin') || 'http://localhost:3000'}/auth/callback`
    });

    if (inviteError) {
      console.error('Failed to send user invitation:', inviteError);
      
      // Provide specific error messages for common issues
      let errorMessage = 'Failed to send invitation';
      if (inviteError.message?.includes('already registered')) {
        errorMessage = 'A user with this email address already exists';
      } else if (inviteError.message?.includes('invalid email')) {
        errorMessage = 'Invalid email address provided';
      } else if (inviteError.message?.includes('rate limit')) {
        errorMessage = 'Too many invitations sent. Please wait before sending more';
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          details: inviteError.message 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User invitation sent successfully to ${email} by admin ${requestingUser.id}`);

    // Log the invitation in audit trail (optional)
    try {
      await supabase.from('user_management_audit').insert({
        target_user_id: inviteData.user?.id || null,
        admin_user_id: requestingUser.id,
        action_type: 'user_invited',
        new_value: { email, role, fullName },
        reason: `User invited by admin with role: ${role}`,
      });
    } catch (auditError) {
      console.error('Failed to log audit trail for invitation:', auditError);
      // Don't fail the operation for audit logging issues
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Invitation sent successfully to ${email}`,
        userId: inviteData.user?.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Admin invite user error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
