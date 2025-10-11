import { AppApiService } from './app.api.service';
import { AdminApiService } from './admin.api.service';
import type { 
    DynamicTool, 
    AdminCategory, 
    ToolsApiResponse, 
    CategoriesApiResponse, 
    ApiResponse,
    Message,
    ChatHistoryItem,
    Project,
    AdminToolQuestion,
    Announcement,
    User,
    ClientProfile
} from '../types';

/**
 * Legacy SupabaseApiService - Delegates to focused service classes
 * @deprecated Use AppApiService or AdminApiService directly
 */
export class SupabaseApiService {
    private static instance: SupabaseApiService;
    private appService: AppApiService;
    private adminService: AdminApiService;
    
    static getInstance(): SupabaseApiService {
        if (!SupabaseApiService.instance) {
            SupabaseApiService.instance = new SupabaseApiService();
        }
        return SupabaseApiService.instance;
    }

    constructor() {
        this.appService = AppApiService.getInstance();
        this.adminService = AdminApiService.getInstance();
    }

    checkSupabaseConnection(): boolean {
        return this.appService.checkSupabaseConnection();
    }

    // ==================== TOOLS API ====================
    async getTools(): Promise<ToolsApiResponse> {
        return this.appService.getTools();
    }

    async getAllTools(): Promise<ToolsApiResponse> {
        return this.adminService.getAllTools();
    }

    async createTool(toolData: Omit<DynamicTool, 'id'>): Promise<ApiResponse<DynamicTool>> {
        return this.adminService.createTool(toolData);
    }

    async updateTool(id: string, updates: Partial<DynamicTool>): Promise<ApiResponse<DynamicTool>> {
        return this.adminService.updateTool(id, updates);
    }

    async deleteTool(id: string): Promise<ApiResponse<void>> {
        return this.adminService.deleteTool(id);
    }

    // ==================== CATEGORIES API ====================
    async getCategories(): Promise<CategoriesApiResponse> {
        return this.appService.getCategories();
    }

    async createCategory(categoryData: Omit<AdminCategory, 'id'>): Promise<ApiResponse<AdminCategory>> {
        return this.adminService.createCategory(categoryData);
    }

    async updateCategory(id: string, updates: Partial<AdminCategory>): Promise<ApiResponse<AdminCategory>> {
        return this.adminService.updateCategory(id, updates);
    }

    async deleteCategory(id: string): Promise<ApiResponse<void>> {
        return this.adminService.deleteCategory(id);
    }

    // ==================== AI CHAT API ====================
    async sendChatMessage(toolId: string, messages: Message[], knowledgeBaseId?: string | null, clientProfile?: ClientProfile): Promise<ApiResponse<string>> {
        return this.appService.sendChatMessage(toolId, messages, knowledgeBaseId, clientProfile);
    }

    // ==================== PROJECTS API ====================
    async getProjects(userId: string): Promise<ApiResponse<Project[]>> {
        return this.appService.getProjects(userId);
    }

    async createProject(projectData: { name: string; color: string; userId: string; clientProfileSnapshot?: ClientProfile }): Promise<ApiResponse<Project>> {
        return this.appService.createProject(projectData);
    }

    async updateProject(projectId: string, updates: Partial<Project>): Promise<ApiResponse<Project>> {
        return this.appService.updateProject(projectId, updates);
    }

    async deleteProject(projectId: string): Promise<ApiResponse<void>> {
        return this.appService.deleteProject(projectId);
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
        return this.appService.saveChatSession(sessionData);
    }

    async getChatSessions(userId: string): Promise<ApiResponse<ChatHistoryItem[]>> {
        return this.appService.getChatSessions(userId);
    }

    async getChatSessionsByProjectId(projectId: string, userId: string): Promise<ApiResponse<ChatHistoryItem[]>> {
        return this.appService.getChatSessionsByProjectId(projectId, userId);
    }

    async updateChatSession(
        chatId: string, 
        updates: { title?: string; messages?: Message[]; projectId?: string; clientProfileId?: string | null } // <-- FIX APPLIED HERE
    ): Promise<ApiResponse<any>> {
        return this.appService.updateChatSession(chatId, updates);
    }

    async deleteChatSession(chatId: string): Promise<ApiResponse<void>> {
        return this.appService.deleteChatSession(chatId);
    }

    async deleteAllChatSessions(userId: string): Promise<ApiResponse<void>> {
        return this.appService.deleteAllChatSessions(userId);
    }

    // ==================== USER MANAGEMENT API ====================
    async getUsers(): Promise<ApiResponse<User[]>> {
        return this.adminService.getUsers();
    }

    async updateUserRole(userId: string, role: 'user' | 'admin', reason?: string): Promise<ApiResponse<void>> {
        return this.adminService.updateUserRole(userId, role, reason);
    }

    async updateUserStatus(userId: string, active: boolean, reason?: string): Promise<ApiResponse<void>> {
        return this.adminService.updateUserStatus(userId, active, reason);
    }

    async deleteUser(userId: string, reason?: string): Promise<ApiResponse<void>> {
        return this.adminService.deleteUser(userId, reason);
    }

    async inviteUser(email: string, name: string, role: 'user' | 'admin'): Promise<ApiResponse<void>> {
        return this.adminService.inviteUser(email, name, role);
    }

    async restoreUser(userId: string, reason?: string): Promise<ApiResponse<void>> {
        return this.adminService.restoreUser(userId, reason);
    }

    // ==================== AUDIT LOG API ====================
    async getUserAuditLog(userId: string): Promise<ApiResponse<any[]>> {
        return this.adminService.getUserAuditLog(userId);
    }

    async getAllAuditLogs(limit: number = 100): Promise<ApiResponse<any[]>> {
        return this.adminService.getAllAuditLogs(limit);
    }

    // ==================== ANNOUNCEMENTS API ====================
    async getAnnouncements(): Promise<ApiResponse<Announcement[]>> {
        return this.appService.getAnnouncements();
    }

    async createAnnouncement(announcementData: Omit<Announcement, 'id' | 'createdAt'>): Promise<ApiResponse<Announcement>> {
        return this.adminService.createAnnouncement(announcementData);
    }

    async updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<ApiResponse<Announcement>> {
        return this.adminService.updateAnnouncement(id, updates);
    }

    async deleteAnnouncement(id: string): Promise<ApiResponse<void>> {
        return this.adminService.deleteAnnouncement(id);
    }

    // ==================== ANALYTICS API ====================
    async getDashboardAnalytics(timeRange: string = '24h'): Promise<ApiResponse<any>> {
        return this.adminService.getDashboardAnalytics(timeRange);
    }

    async getAIUsageMetrics(timeRange: string = '24h'): Promise<ApiResponse<any>> {
        return this.adminService.getAIUsageMetrics(timeRange);
    }

    async getSystemHealthMetrics(): Promise<ApiResponse<any>> {
        return this.adminService.getSystemHealthMetrics();
    }

    async getUserEngagementMetrics(timeRange: string = '24h'): Promise<ApiResponse<any>> {
        return this.adminService.getUserEngagementMetrics(timeRange);
    }

    async getAdminActivityLog(limit: number = 50): Promise<ApiResponse<any>> {
        return this.adminService.getAdminActivityLog(limit);
    }

    // ==================== CLIENT PROFILES API ====================
    async saveClientProfile(userId: string, profile: ClientProfile): Promise<ApiResponse<ClientProfile>> {
        return this.appService.saveClientProfile(userId, profile);
    }

    async deleteClientProfile(userId: string, profileId: string): Promise<ApiResponse<void>> {
        return this.appService.deleteClientProfile(userId, profileId);
    }

    async updateDefaultClientProfile(userId: string, profileId: string | null): Promise<ApiResponse<void>> {
        return this.appService.updateDefaultClientProfile(userId, profileId);
    }
}