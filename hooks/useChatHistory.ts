import { useState, useEffect } from 'react';
import { SupabaseApiService } from '../services/supabaseApi';
import { useAuthStore } from '../stores/authStore';
import { Logger } from '../utils/logger';
import { isSupabaseAvailable } from '../lib/supabase';
import { useConfirmDialog } from '../contexts/DialogContext';
import { useNotifications } from '../contexts/NotificationContext';
import type { ChatHistoryItem, ApiResponse } from '../types';

export const useChatHistory = () => {
  const dialog = useConfirmDialog();
  const notifications = useNotifications();
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { user } = useAuthStore();
  const api = SupabaseApiService.getInstance();

  const fetchChatHistory = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    // Don't try to fetch if Supabase isn't available
    if (!isSupabaseAvailable()) {
      console.log('useChatHistory: Supabase not connected, using empty chat history');
      setChatHistory([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.getChatSessions(user.id);
      if (response.success && response.data) {
        setChatHistory(response.data);
        Logger.info('Chat history fetched successfully', {
          component: 'useChatHistory',
          sessionCount: response.data.length,
          userId: user.id,
        });
      } else {
        // Don't show error for auth refresh issues
        if (response.error?.includes('session is not stable')) {
          console.log('useChatHistory: Session not stable, will retry automatically');
          setChatHistory([]);
        } else {
          setError(response.error || 'Failed to fetch chat history');
        }
      }
    } catch (err) {
      console.log('useChatHistory: Error fetching chat history:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      if (errorMessage.includes('session is not stable')) {
        console.log('useChatHistory: Session not stable, will retry automatically');
        setChatHistory([]);
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('TypeError')) {
        console.log('useChatHistory: Network connectivity issue - Supabase may not be configured');
        setChatHistory([]);
      } else {
        setError('Network error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchChatHistory();
    } else {
      setLoading(false);
    }
  }, [user]);

  const saveChatSession = async (sessionData: {
    id?: string;
    toolId: string;
    title: string;
    messages: any[];
    projectId?: string;
  }): Promise<ApiResponse<ChatHistoryItem>> => {
    if (!user) throw new Error('User not authenticated');
    if (!isSupabaseAvailable()) throw new Error('Supabase not connected');
    
    try {
      let response;
      if (sessionData.id) {
        // Update existing session
        response = await api.updateChatSession(sessionData.id, {
          title: sessionData.title,
          messages: sessionData.messages,
          projectId: sessionData.projectId,
        });
      } else {
        // Create new session
        response = await api.saveChatSession({
          userId: user.id,
          toolId: sessionData.toolId,
          projectId: sessionData.projectId,
          title: sessionData.title,
          messages: sessionData.messages,
        });
      }
      
      if (response.success) {
        await fetchChatHistory();
      } else {
        throw new Error(response.error || 'Failed to save chat session');
      }

      return response;
    } catch (error) {
      console.error('useChatHistory: Error in saveChatSession:', error);
      notifications.error(`Failed to save chat session: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  const clearHistory = async () => {
    if (!user) return;

    const confirmed = await dialog.confirm({
      title: 'Clear All History',
      message: 'Are you sure you want to delete ALL chat history? This action cannot be undone.',
      confirmText: 'Delete All',
      cancelText: 'Cancel',
      variant: 'danger'
    });

    if (confirmed && isSupabaseAvailable()) {
      try {
        const response = await api.deleteAllChatSessions(user.id)
        if (response.success) {
          notifications.success('Chat history cleared successfully.');
          await fetchChatHistory();
        } else {
          throw new Error(response.error || 'Failed to clear history');
        }
      } catch (error) {
        console.error('Failed to clear all chat history:', error);
        notifications.error(`Failed to clear history: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  const deleteChat = async (chatId: string) => {
    if (!isSupabaseAvailable()) {
      notifications.error('Cannot delete chat, connection not available.');
      return;
    }
    
    const chatToDelete = chatHistory.find(chat => chat.id === chatId);
    const confirmed = await dialog.confirm({
      title: 'Delete Chat',
      message: `Are you sure you want to delete the chat "${chatToDelete?.toolTitle ?? 'this chat'}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      const response = await api.deleteChatSession(chatId);
      if (response.success) {
        notifications.success('Chat deleted successfully.');
        await fetchChatHistory();
      } else {
        throw new Error(response.error || 'Failed to delete chat session');
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
      notifications.error(`Failed to delete chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const updateChatSession = async (chatId: string, updates: { title?: string; projectId?: string }) => {
    if (!isSupabaseAvailable()) {
      notifications.error('Cannot update chat, connection not available.');
      return { success: false, error: 'Supabase not connected' };
    }
    
    try {
      const response = await api.updateChatSession(chatId, updates);

      if (response.success) {
        notifications.success('Chat updated successfully.');
        await fetchChatHistory();
      } else {
        throw new Error(response.error || 'Failed to update chat session');
      }
      return response;
    } catch (error) {
      console.error('useChatHistory: Exception during chat session update:', error);
      notifications.error(`Failed to update chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  const addChatToProject = async (chatId: string, projectId: string) => {
    if (!isSupabaseAvailable()) {
      notifications.error('Cannot add to project, connection not available.');
      return { success: false, error: 'Supabase not connected' };
    }
    
    try {
      const response = await api.updateChatSession(chatId, { projectId });
      if (response.success) {
        notifications.success('Chat added to project.');
        await fetchChatHistory();
        return { success: true, data: response.data };
      } else {
        throw new Error(response.error || 'Failed to add chat to project');
      }
    } catch (error) {
      notifications.error(`Failed to add chat to project: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };

  return {
    chatHistory,
    loading,
    error,
    refetch: fetchChatHistory,
    saveChatSession,
    clearHistory,
    deleteChat,
    updateChatSession,
    addChatToProject,
  };
};