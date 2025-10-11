import { useState, useEffect } from 'react';
import { SupabaseApiService } from '../services/supabaseApi';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandler';
import { useConfirmDialog } from '../contexts/DialogContext';
import { useNotifications } from '../contexts/NotificationContext';
import type { DynamicTool, ToolsApiResponse } from '../types';

export const useTools = () => {
  const [tools, setTools] = useState<DynamicTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const api = SupabaseApiService.getInstance();
  const dialog = useConfirmDialog();
  const notifications = useNotifications();

  const fetchTools = async () => {

    try {
      setLoading(true);
      setError(null);
      
      const response = await ErrorHandler.withRetry(
        () => api.getAllTools(), // Changed to get ALL tools including inactive ones
        3,
        1000,
        { component: 'useTools', operation: 'fetchTools' }
      );
      
      if (response.success && response.data) {
        setTools(response.data);
      } else {
        const errorResponse = ErrorHandler.createError(
          'API_TOOLS_FETCH_ERROR',
          response.error || 'Failed to fetch tools',
          'useTools'
        );
        // Don't treat network errors or auth refresh errors as critical
        if (response.error?.includes('Failed to fetch') || 
            response.error?.includes('Network error') ||
            response.error?.includes('session is not stable')) {
          console.log('useTools: Network error, Supabase likely not configured');
          setTools([]);
        } else {
          ErrorHandler.handleError(errorResponse);
          setError(errorResponse.message);
        }
      }
    } catch (error: any) {
      // Handle network errors gracefully
      const errorMessage = error.message || 'Unknown error';
      if (errorMessage.includes('Failed to fetch') || 
          errorMessage.includes('TypeError') ||
          errorMessage.includes('session is not stable')) {
        console.log('useTools: Network error, Supabase likely not configured');
        setTools([]);
      } else {
        const errorResponse = ErrorHandler.handleError(error, {
          component: 'useTools',
          operation: 'fetchTools',
        });
        setError(errorResponse.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, [api]);

  const createTool = async (toolData: Omit<DynamicTool, 'id'>) => {
    try {
      const response = await api.createTool(toolData);
      if (response.success && response.data) {
        notifications.success('Tool created successfully!');
        await fetchTools();
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to create tool');
      }
    } catch (error) {
      notifications.error(`Failed to create tool: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  const updateTool = async (id: string, updates: Partial<DynamicTool>) => {
    try {
      const response = await api.updateTool(id, updates);
      if (response.success && response.data) {
        notifications.success('Tool updated successfully.');
        await fetchTools();
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to update tool');
      }
    } catch (error) {
      notifications.error(`Failed to update tool: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  const deleteTool = async (id: string) => {
    const confirmed = await dialog.confirm({
      title: 'Delete Tool',
      message: 'Are you sure you want to delete this tool? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      const response = await api.deleteTool(id);
      if (response.success) {
        notifications.success('Tool deleted successfully.');
        await fetchTools();
      } else {
        throw new Error(response.error || 'Failed to delete tool');
      }
    } catch (error) {
      notifications.error(`Failed to delete tool: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Computed values
  const activeTools = tools.filter(tool => tool.active);
  const featuredTools = tools.filter(tool => tool.active && tool.featured);
  const toolsByCategory = (category: string) => 
    activeTools.filter(tool => tool.category === category);

  return {
    tools: activeTools,
    allTools: tools,
    featuredTools,
    toolsByCategory,
    loading,
    error,
    refetch: fetchTools,
    createTool,
    updateTool,
    deleteTool
  };
};