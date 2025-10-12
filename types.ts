// A generic structure for API responses throughout the app
export type ApiResponse<T> = { success: true; data: T } | { success: false; error:string };

// Represents a single question within a dynamic tool's structured conversation
export interface ToolQuestion {
  id: string;
  label: string;
  type: string; // e.g., 'text', 'textarea', 'select'
  placeholder?: string;
  required: boolean;
  order: number;
  options?: string[]; // For 'select' type questions
}

// The main interface for a dynamic tool
export interface DynamicTool {
  id: string;
  title: string;
  category: string;
  description: string;
  active: boolean;
  featured: boolean;
  is_pro: boolean;
  primaryModel: string;
  fallbackModels: string[];
  promptInstructions?: string | null;
  knowledgeBaseFileId?: string | null;
  questions: ToolQuestion[];
}

// Specific API response types for tools and categories
export type ToolsApiResponse = ApiResponse<DynamicTool[]>;
export type CategoriesApiResponse = ApiResponse<AdminCategory[]>;

// Represents a single message in a chat conversation
export interface Message {
  id: string;
  sender: 'user' | 'ai' | 'system';
  text: string;
  file?: { name: string; size: number };
  timestamp?: number;
}

// Represents a saved chat session in the user's history
export interface ChatHistoryItem {
  id: string;
  toolId: string;
  toolTitle: string;
  messages: Message[];
  timestamp: number;
  projectId?: string | null;
  projectName?: string;
  clientProfileId?: string | null;
}

// Represents a user-created project for organizing chat sessions
export interface Project {
  id: string;
  name: string;
  color?: string;
  tags?: string[];
  clientProfileSnapshot?: any;
}

// Represents a client profile with pre-fillable data
export interface ClientProfile {
  id: string;
  name: string;
  data: Record<string, any>;
}

// Represents a tool category, primarily for admin use
export interface AdminCategory {
  id: string;
  name: string;
  displayOrder: number;
  active: boolean;
  iconName?: string;
  iconColor?: string;
}

// --- ADDED THIS LINE ---
// This defines the ToolCategory type used in AppLayout.tsx
export type ToolCategory = string;

// Represents a system-wide announcement
export interface Announcement {
  id: string;
  title: string;
  content: string;
  active: boolean;
  showOnLogin: boolean;
  createdAt: string;
  createdBy: string;
}

// Represents the structure of a user's profile and preferences
export interface UserProfile {
    id: string;
    email: string;
    role: 'user' | 'pro' | 'admin';
    username?: string;
    preferences?: {
        clientProfiles?: ClientProfile[];
        activeClientProfileId?: string | null;
    };
}