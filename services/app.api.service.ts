import { supabase, handleSupabaseError } from '../lib/supabase';
import { waitForStableSession } from '../lib/supabase';
import { Logger } from '../utils/logger';
import type { 
    DynamicTool, 
    AdminCategory, 
    ToolsApiResponse, 
    CategoriesApiResponse, 
    ApiResponse,
    Message,
    ChatHistoryItem,
    Project,
    Announcement,
    ClientProfile
} from '../types';

export class AppApiService {
    private static instance: AppApiService;
    
    static getInstance(): AppApiService {
        if (!AppApiService.instance) {
            AppApiService.instance = new AppApiService();
        }
        return AppApiService.instance;
    }

    checkSupabaseConnection(): boolean {
        const isConnected = !!supabase;
        console.log('AppApiService: Connection check:', isConnected);
        return isConnected;
    }

    // ==================== TOOLS API ====================
    async getTools(): Promise<ToolsApiResponse> {
        if (!this.checkSupabaseConnection()) {
            console.log('AppApiService: Not connected, returning empty tools');
            return { success: true, data: [] };
        }

        const isStable = await waitForStableSession(5000);
        if (!isStable) {
            console.log('AppApiService: Session not stable, returning empty tools');
            return { success: true, data: [] };
        }

        try {
            console.log('AppApiService: Fetching tools from database');
            const { data, error } = await supabase
                .from('tool_catalog')
                .select(`
                    *,
                    category:categories(*),
                    questions:tool_questions(*)
                `)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            const tools: DynamicTool[] = (data || []).map(tool => ({
                id: tool.id,
                title: tool.title,
                category: tool.category?.name || 'Other',
                description: tool.description,
                active: tool.active,
                featured: tool.featured,
                is_pro: tool.is_pro ?? false,
                primaryModel: '',
                fallbackModels: [],
                promptInstructions: '',
                questions: (tool.questions || [])
                    .sort((a: any, b: any) => a.question_order - b.question_order)
                    .map((q: any) => ({
                        id: q.id,
                        label: q.label,
                        type: q.type,
                        placeholder: q.placeholder,
                        required: q.required,
                        order: q.question_order,
                        options: q.options,
                    })),
            }));

            console.log('AppApiService: Tools fetched successfully:', tools.length);
            return { success: true, data: tools };
        } catch (error: any) {
            console.log('AppApiService: Error fetching tools:', error);
            return { success: false, error: 'Failed to fetch tools from database' };
        }
    }

    // ==================== CATEGORIES API ====================
    async getCategories(): Promise<CategoriesApiResponse> {
        if (!this.checkSupabaseConnection()) {
            console.log('AppApiService: Not connected, returning empty categories');
            return { success: true, data: [] };
        }

        const isStable = await waitForStableSession(5000);
        if (!isStable) {
            console.log('AppApiService: Session not stable, returning empty categories');
            return { success: true, data: [] };
        }

        try {
            console.log('AppApiService: Fetching categories from database');
            const { data, error } = await supabase
                .from('categories')
                .select('id, name, display_order, active, icon_name, icon_color')
                .order('display_order', { ascending: true });

            if (error) {
                throw error;
            }

            const categories: AdminCategory[] = (data || []).map(cat => ({
                id: cat.id,
                name: cat.name,
                displayOrder: cat.display_order,
                active: cat.active,
                iconName: cat.icon_name || 'Settings',
                iconColor: cat.icon_color || 'text-blue-600',
            }));

            return { success: true, data: categories };
        } catch (error: any) {
            console.log('AppApiService: Error fetching categories:', error);
            return { success: false, error: 'Failed to fetch categories' };
        }
    }

    // ==================== AI CHAT API ====================
    async sendChatMessage(toolId: string, messages: Message[], knowledgeBaseId?: string | null, clientProfile?: ClientProfile): Promise<ApiResponse<string>> {
        if (!this.checkSupabaseConnection()) {
            console.log('AppApiService: Supabase not connected, returning demo response');
            const demoResponse = `Thank you for trying out this tool! 

This is a demo response since the backend isn't fully connected yet. 

To get real AI-powered responses:
1. Click "Connect to Supabase" in the top right
2. Add your AI API keys (Claude/OpenAI) to the edge function
3. The system will then provide intelligent, contextual responses

Your input has been processed and this demonstrates the complete workflow!`;
            
            return { success: true, data: demoResponse };
        }

        const isStable = await waitForStableSession(5000);
        if (!isStable) {
            return { success: false, error: 'Authentication session is not stable. Please try again in a moment.' };
        }

        try {
            console.log('AppApiService: Sending chat message to edge function');
            const { data, error } = await supabase.functions.invoke('ai-chat', {
                body: { 
                    toolId, 
                    messages, 
                    knowledgeBaseId,
                    clientProfile,
                    correlationId: Logger.getCorrelationId(),
                },
                headers: {
                    'X-Correlation-ID': Logger.getCorrelationId(),
                },
            });

            if (error) {
                throw error;
            }

            if (!data?.response) {
                throw new Error('No response from AI service');
            }

            console.log('AppApiService: AI response received successfully');
            return { success: true, data: data.response };
        } catch (error: any) {
            console.log('AppApiService: AI chat error:', error);
            let userMessage = 'AI service temporarily unavailable. ';
            
            if (error.message?.includes('Function not found') || error.message?.includes('404')) {
                userMessage += 'The AI edge function needs to be deployed. Please contact your administrator.';
            } else if (error.message?.includes('API key') || error.message?.includes('unauthorized')) {
                userMessage += 'AI API keys need to be configured. Please contact your administrator.';
            } else {
                userMessage += 'Please try again in a moment or contact support if the issue persists.';
            }
            
            return { success: false, error: userMessage };
        }
    }

    // ==================== PROJECTS API ====================
    async getProjects(userId: string): Promise<ApiResponse<Project[]>> {
        if (!this.checkSupabaseConnection()) {
            console.log('AppApiService: Not connected, returning empty projects');
            return { success: true, data: [] };
        }

        const isStable = await waitForStableSession(5000);
        if (!isStable) {
            console.log('AppApiService: Session not stable, returning empty projects');
            return { success: true, data: [] };
        }

        try {
            console.log('AppApiService: Fetching projects for user:', userId);
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .eq('user_id', userId)
                .eq('archived', false)
                .order('updated_at', { ascending: false });

            if (error) {
                throw error;
            }

            const projects: Project[] = (data || []).map(p => ({
                id: p.id,
                name: p.name,
                color: p.color || '#008F6B',
                tags: p.tags || [],
                clientProfileSnapshot: p.client_profile_snapshot,
            }));

            return { success: true, data: projects };
        } catch (error: any) {
            console.log('AppApiService: Error fetching projects:', error);
            return { success: false, error: 'Failed to fetch projects' };
        }
    }

    async createProject(projectData: { name: string; tags: string[]; userId: string; clientProfileSnapshot?: ClientProfile }): Promise<ApiResponse<Project>> {
        if (!this.checkSupabaseConnection()) {
            return { success: false, error: 'Supabase not connected' };
        }

        try {
            const { data, error } = await supabase
                .from('projects')
                .insert({
                    name: projectData.name,
                    // @ts-ignore
                    color: projectData.color,
                    user_id: projectData.userId,
                    client_profile_snapshot: projectData.clientProfileSnapshot,
                })
                .select()
                .single();

            if (error) {
                throw error;
            }

            const project: Project = {
                id: data.id,
                name: data.name,
                color: data.color || '#008F6B',
                tags: data.tags || [],
                clientProfileSnapshot: data.client_profile_snapshot,
            };

            return { success: true, data: project };
        } catch (error: any) {
            const errorResponse = handleSupabaseError(error, 'createProject');
            return { success: false, error: errorResponse.message };
        }
    }

    async updateProject(projectId: string, updates: Partial<Project>): Promise<ApiResponse<Project>> {
        if (!this.checkSupabaseConnection()) {
            return { success: false, error: 'Supabase not connected' };
        }

        try {
            const { data, error } = await supabase
                .from('projects')
                .update({
                    name: updates.name,
                    color: updates.color,
                    client_profile_snapshot: updates.clientProfileSnapshot,
                })
                .eq('id', projectId)
                .select()
                .single();

            if (error) {
                throw error;
            }

            const project: Project = {
                id: data.id,
                name: data.name,
                color: data.color || '#008F6B',
                tags: data.tags || [],
                clientProfileSnapshot: data.client_profile_snapshot,
            };

            return { success: true, data: project };
        } catch (error: any) {
            const errorResponse = handleSupabaseError(error, 'updateProject', { projectId });
            return { success: false, error: errorResponse.message };
        }
    }

    async deleteProject(projectId: string): Promise<ApiResponse<void>> {
        if (!this.checkSupabaseConnection()) {
            return { success: false, error: 'Supabase not connected' };
        }

        try {
            const { error } = await supabase
                .from('projects')
                .update({ archived: true })
                .eq('id', projectId);

            if (error) {
                throw error;
            }

            return { success: true };
        } catch (error: any) {
            const errorResponse = handleSupabaseError(error, 'deleteProject', { projectId });
            return { success: false, error: errorResponse.message };
        }
    }

    // ==================== CHAT SESSIONS API ====================
    async saveChatSession(sessionData: {
        id?: string;
        userId: string;
        toolId: string;
        projectId?: string;
        title: string;
        messages: Message[];
        aiModel?: string;
    }): Promise<ApiResponse<ChatHistoryItem>> {
        console.log('🔍 DEBUG AppApiService: Received session data:', sessionData);
        
        if (!this.checkSupabaseConnection()) {
            const mockChatItem: ChatHistoryItem = {
                id: crypto.randomUUID(),
                toolId: sessionData.toolId,
                toolTitle: sessionData.title,
                messages: sessionData.messages,
                timestamp: Date.now(),
                projectId: sessionData.projectId,
            };
            return { success: true, data: mockChatItem };
        }

        try {
            const safeTitle = sessionData.title || 'Untitled Chat Session';
            
            if (sessionData.id) {
                // Update existing session
                const { data, error } = await supabase
                    .from('chat_sessions')
                    .update({
                        project_id: sessionData.projectId,
                        title: safeTitle,
                        session_data: { messages: sessionData.messages },
                        ai_model_used: sessionData.aiModel,
                    })
                    .eq('id', sessionData.id)
                    .select()
                    .single();

                if (error) throw error;

                const chatItem: ChatHistoryItem = {
                    id: data.id,
                    toolId: data.tool_id,
                    toolTitle: safeTitle,
                    messages: sessionData.messages,
                    timestamp: new Date(data.updated_at).getTime(),
                    projectId: data.project_id,
                };
                return { success: true, data: chatItem };
            } else {
                // Create new session
                const insertData = {
                    user_id: sessionData.userId,
                    tool_id: sessionData.toolId,
                    project_id: sessionData.projectId,
                    title: safeTitle,
                    session_data: { messages: sessionData.messages },
                    ai_model_used: sessionData.aiModel,
                    completed: true,
                };
                
                const { data, error } = await supabase
                    .from('chat_sessions')
                    .insert(insertData)
                    .select()
                    .single();

                if (error) throw error;

                const chatItem: ChatHistoryItem = {
                    id: data.id,
                    toolId: data.tool_id,
                    toolTitle: safeTitle,
                    messages: sessionData.messages,
                    timestamp: new Date(data.created_at).getTime(),
                    projectId: data.project_id,
                };
                return { success: true, data: chatItem };
            }
        } catch (error: any) {
            const errorResponse = handleSupabaseError(error, 'saveChatSession');
            return { success: false, error: errorResponse.message };
        }
    }

    async getChatSessions(userId: string): Promise<ApiResponse<ChatHistoryItem[]>> {
        if (!this.checkSupabaseConnection()) {
            return { success: true, data: [] };
        }

        try {
            const { data, error } = await supabase
                .from('chat_sessions')
                .select(`
                    *,
                    client_profile_id,
                    tool:tools(title),
                    project:projects(name)
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                throw error;
            }

            const chatHistory: ChatHistoryItem[] = (data || []).map(session => ({
                id: session.id,
                toolId: session.tool_id,
                toolTitle: session.title || session.tool?.title || 'Untitled Chat',
                messages: session.session_data?.messages || [],
                timestamp: new Date(session.created_at).getTime(),
                projectId: session.project_id,
                projectName: session.project?.name,
                clientProfileId: session.client_profile_id, // <-- FIX APPLIED HERE
            }));

            return { success: true, data: chatHistory };
        } catch (error: any) {
            const errorResponse = handleSupabaseError(error, 'getChatSessions', { userId });
            return { success: false, error: errorResponse.message };
        }
    }

    async getChatSessionsByProjectId(projectId: string, userId: string): Promise<ApiResponse<ChatHistoryItem[]>> {
        if (!this.checkSupabaseConnection()) {
            return { success: true, data: [] };
        }

        try {
            const { data, error } = await supabase
                .from('chat_sessions')
                .select(`
                    *,
                    tool:tools(title)
                `)
                .eq('project_id', projectId)
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            const chatHistory: ChatHistoryItem[] = (data || []).map(session => ({
                id: session.id,
                toolId: session.tool_id,
                toolTitle: session.title || session.tool?.title || 'Untitled Chat',
                messages: session.session_data?.messages || [],
                timestamp: new Date(session.created_at).getTime(),
                projectId: session.project_id,
            }));

            return { success: true, data: chatHistory };
        } catch (error: any) {
            const errorResponse = handleSupabaseError(error, 'getChatSessionsByProjectId', { projectId, userId });
            return { success: false, error: errorResponse.message };
        }
    }

    async updateChatSession(chatId: string, updates: { title?: string; messages?: Message[]; projectId?: string; clientProfileId?: string | null }): Promise<ApiResponse<any>> {
        console.log('🔍 DEBUG AppApiService: updateChatSession called with:', { chatId, updates });
        
        if (!this.checkSupabaseConnection()) {
            return { success: false, error: 'Supabase not connected' };
        }

        try {
            const updateData: any = {};
            
            if (updates.title !== undefined) {
                updateData.title = updates.title;
            }
            
            if (updates.messages !== undefined) {
                updateData.session_data = { messages: updates.messages };
            }
            
            if (updates.projectId !== undefined) {
                updateData.project_id = updates.projectId;
            }

            if (updates.clientProfileId !== undefined) { // <-- FIX APPLIED HERE
                updateData.client_profile_id = updates.clientProfileId;
            }

            console.log('🔍 DEBUG AppApiService: Final updateData:', updateData);

            const { data, error } = await supabase
                .from('chat_sessions')
                .update(updateData)
                .eq('id', chatId)
                .select(`
                    *,
                    tool:tools(title),
                    project:projects(name)
                `)
                .maybeSingle();

            if (error) {
                console.log('🔍 DEBUG AppApiService: Update error:', error);
                throw error;
            }

            if (!data) {
                console.log('🔍 DEBUG AppApiService: Chat session not found:', chatId);
                return { success: false, error: 'Chat session not found or has been deleted' };
            }

            const chatItem = {
                id: data.id,
                toolId: data.tool_id,
                toolTitle: data.title || data.tool?.title || 'Untitled Chat',
                messages: data.session_data?.messages || [],
                timestamp: new Date(data.updated_at).getTime(),
                projectId: data.project_id,
                projectName: data.project?.name,
            };

            console.log('🔍 DEBUG AppApiService: Update successful, transformed data:', chatItem);
            return { success: true, data: chatItem };
        } catch (error: any) {
            console.log('🔍 DEBUG AppApiService: Exception in updateChatSession:', error);
            const errorResponse = handleSupabaseError(error, 'updateChatSession', { chatId });
            return { success: false, error: errorResponse.message };
        }
    }

    async deleteChatSession(chatId: string): Promise<ApiResponse<void>> {
        if (!this.checkSupabaseConnection()) {
            return { success: false, error: 'Supabase not connected' };
        }

        try {
            const { error } = await supabase
                .from('chat_sessions')
                .delete()
                .eq('id', chatId);

            if (error) {
                throw error;
            }

            return { success: true };
        } catch (error: any) {
            const errorResponse = handleSupabaseError(error, 'deleteChatSession', { chatId });
            return { success: false, error: errorResponse.message };
        }
    }

    async deleteAllChatSessions(userId: string): Promise<ApiResponse<void>> {
        if (!this.checkSupabaseConnection()) {
            return { success: false, error: 'Supabase not connected' };
        }

        try {
            const { error } = await supabase
                .from('chat_sessions')
                .delete()
                .eq('user_id', userId);

            if (error) {
                throw error;
            }

            return { success: true };
        } catch (error: any) {
            const errorResponse = handleSupabaseError(error, 'deleteAllChatSessions', { userId });
            return { success: false, error: errorResponse.message };
        }
    }

    // ==================== ANNOUNCEMENTS API ====================
    async getAnnouncements(): Promise<ApiResponse<Announcement[]>> {
        if (!this.checkSupabaseConnection()) {
            console.log('🔧 API: Supabase not connected, returning empty announcements');
            return { success: true, data: [] };
        }

        try {
            console.log('🔧 API: Fetching announcements from database');
            const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .eq('active', true)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            const announcements: Announcement[] = (data || []).map(a => ({
                id: a.id,
                title: a.title,
                content: a.content,
                active: a.active,
                showOnLogin: a.show_on_login,
                createdAt: a.created_at,
                createdBy: a.created_by,
            }));

            console.log('🔧 API: Announcements fetched successfully:', announcements.length);
            return { success: true, data: announcements };
        } catch (error: any) {
            const errorMessage = error.message || '';
            if (errorMessage.includes('Failed to fetch') || 
                errorMessage.includes('TypeError: Failed to fetch') || 
                error instanceof TypeError) {
                console.log('🔧 API: Supabase connection failed for announcements - likely not configured');
                return { success: true, data: [] };
            }
            
            const errorResponse = handleSupabaseError(error, 'getAnnouncements');
            return { success: false, error: errorResponse.message };
        }
    }

    // ==================== CLIENT PROFILES API ====================
    async saveClientProfile(userId: string, profile: ClientProfile): Promise<ApiResponse<ClientProfile>> {
        if (!this.checkSupabaseConnection()) {
            return { success: false, error: 'Supabase not connected' };
        }

        try {
            const { data: currentProfile, error: fetchError } = await supabase
                .from('user_profiles')
                .select('preferences')
                .eq('id', userId)
                .single();

            if (fetchError) {
                throw fetchError;
            }

            const currentPreferences = currentProfile?.preferences || {};
            const currentClientProfiles = currentPreferences.clientProfiles || [];
            
            const existingIndex = currentClientProfiles.findIndex((p: ClientProfile) => p.id === profile.id);
            let updatedClientProfiles;
            
            if (existingIndex >= 0) {
                updatedClientProfiles = [...currentClientProfiles];
                updatedClientProfiles[existingIndex] = profile;
            } else {
                updatedClientProfiles = [...currentClientProfiles, profile];
            }

            const updatedPreferences = {
                ...currentPreferences,
                clientProfiles: updatedClientProfiles,
            };

            const { data, error } = await supabase
                .from('user_profiles')
                .update({ preferences: updatedPreferences })
                .eq('id', userId)
                .select()
                .single();

            if (error) {
                throw error;
            }

            return { success: true, data: profile };
        } catch (error: any) {
            const errorResponse = handleSupabaseError(error, 'saveClientProfile', { userId, profileId: profile.id });
            return { success: false, error: errorResponse.message };
        }
    }

    async deleteClientProfile(userId: string, profileId: string): Promise<ApiResponse<void>> {
        if (!this.checkSupabaseConnection()) {
            return { success: false, error: 'Supabase not connected' };
        }

        try {
            const { data: currentProfile, error: fetchError } = await supabase
                .from('user_profiles')
                .select('preferences, default_client_profile_id')
                .eq('id', userId)
                .single();

            if (fetchError) {
                throw fetchError;
            }

            const currentPreferences = currentProfile?.preferences || {};
            const currentClientProfiles = currentPreferences.clientProfiles || [];
            const updatedClientProfiles = currentClientProfiles.filter((p: ClientProfile) => p.id !== profileId);

            const updatedPreferences = {
                ...currentPreferences,
                clientProfiles: updatedClientProfiles,
            };

            const updateData: any = { preferences: updatedPreferences };
            
            if (currentProfile?.default_client_profile_id === profileId) {
                updateData.default_client_profile_id = null;
            }

            const { error } = await supabase
                .from('user_profiles')
                .update(updateData)
                .eq('id', userId);

            if (error) {
                throw error;
            }

            return { success: true };
        } catch (error: any) {
            const errorResponse = handleSupabaseError(error, 'deleteClientProfile', { userId, profileId });
            return { success: false, error: errorResponse.message };
        }
    }

    async updateDefaultClientProfile(userId: string, profileId: string | null): Promise<ApiResponse<void>> {
        if (!this.checkSupabaseConnection()) {
            return { success: false, error: 'Supabase not connected' };
        }

        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({ default_client_profile_id: profileId })
                .eq('id', userId);

            if (error) {
                throw error;
            }

            return { success: true };
        } catch (error: any) {
            const errorResponse = handleSupabaseError(error, 'updateDefaultClientProfile', { userId, profileId });
            return { success: false, error: errorResponse.message };
        }
    }

    // ==================== UTILITY METHODS ====================
    private generateSlug(text: string): string {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }
}