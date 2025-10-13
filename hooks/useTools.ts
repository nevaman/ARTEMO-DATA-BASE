import { useState, useEffect } from 'react';
import { SupabaseApiService } from '../services/supabaseApi';
import { ToolRepository, type ToolDataSource } from '../services/toolRepository';
import { Logger } from '../utils/logger';
import { useConfirmDialog } from '../contexts/DialogContext';
import { useNotifications } from '../contexts/NotificationContext';
import type { DynamicTool } from '../types';

export const useTools = () => {
  const [rawTools, setRawTools] = useState<DynamicTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<ToolDataSource>('static');

  const api = SupabaseApiService.getInstance();
  const repository = ToolRepository.getInstance();
  const dialog = useConfirmDialog();
  const notifications = useNotifications();

  const fetchTools = async (options: { allowStale?: boolean } = {}) => {
    try {
      setLoading(true);
      setError(null);

      const { tools, source } = await repository.getTools({ allowStale: options.allowStale ?? true });
      setRawTools(tools);
      setDataSource(source);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load tools';
      Logger.error({
        message: 'Tool repository failed to hydrate tools',
        code: 'TOOL_REPOSITORY_ERROR',
        details: errorMessage,
        component: 'useTools',
        severity: 'error',
      });
      setError(errorMessage);
      setRawTools([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, []);

  const createTool = async (toolData: Omit<DynamicTool, 'id'>) => {
    try {
      const response = await api.createTool(toolData);
      if (response.success && response.data) {
        notifications.success('Tool created successfully!');
        repository.invalidateCache();
        await fetchTools({ allowStale: false });
        return response.data;
      }

      throw new Error(response.error || 'Failed to create tool');
    } catch (err) {
      notifications.error(`Failed to create tool: ${err instanceof Error ? err.message : 'Unknown error'}`);
      throw err;
    }
  };

  const updateTool = async (id: string, updates: Partial<DynamicTool>) => {
    try {
      const response = await api.updateTool(id, updates);
      if (response.success && response.data) {
        notifications.success('Tool updated successfully.');
        repository.invalidateCache();
        await fetchTools({ allowStale: false });
        return response.data;
      }

      throw new Error(response.error || 'Failed to update tool');
    } catch (err) {
      notifications.error(`Failed to update tool: ${err instanceof Error ? err.message : 'Unknown error'}`);
      throw err;
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
        repository.invalidateCache();
        await fetchTools({ allowStale: false });
      } else {
        throw new Error(response.error || 'Failed to delete tool');
      }
    } catch (err) {
      notifications.error(`Failed to delete tool: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const activeTools = rawTools.filter(tool => tool.active);
  const featuredTools = rawTools.filter(tool => tool.active && tool.featured);
  const toolsByCategory = (category: string) => activeTools.filter(tool => tool.category === category);

  return {
    tools: activeTools,
    allTools: rawTools,
    featuredTools,
    toolsByCategory,
    loading,
    error,
    dataSource,
    refetch: (options?: { allowStale?: boolean }) => fetchTools(options),
    createTool,
    updateTool,
    deleteTool,
  };
};
