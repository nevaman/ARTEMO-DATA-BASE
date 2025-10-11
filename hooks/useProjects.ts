import { useState, useEffect } from 'react';
import { SupabaseApiService } from '../services/supabaseApi';
import { useAuthStore } from '../stores/authStore';
import { Logger } from '../utils/logger';
import { isSupabaseAvailable } from '../lib/supabase';
import { useConfirmDialog } from '../contexts/DialogContext';
import { useNotifications } from '../contexts/NotificationContext';
import type { Project, ApiResponse, ClientProfile } from '../types';

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { user } = useAuthStore();
  const api = SupabaseApiService.getInstance();
  const dialog = useConfirmDialog();
  const notifications = useNotifications();

  const fetchProjects = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    // Don't try to fetch if Supabase isn't available
    if (!isSupabaseAvailable()) {
      console.log('useProjects: Supabase not connected, using empty projects');
      setProjects([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.getProjects(user.id);
      if (response.success && response.data) {
        setProjects(response.data);
        Logger.info('Projects fetched successfully', {
          component: 'useProjects',
          projectCount: response.data.length,
          userId: user.id,
        });
      } else {
        // Don't show error for auth refresh issues
        if (response.error?.includes('session is not stable')) {
          console.log('useProjects: Session not stable, will retry automatically');
          setProjects([]);
        } else {
          setError(response.error || 'Failed to fetch projects');
        }
      }
    } catch (err) {
      console.log('useProjects: Error fetching projects:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      if (errorMessage.includes('session is not stable')) {
        console.log('useProjects: Session not stable, will retry automatically');
        setProjects([]);
      } else {
        setError('Network error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchProjects();
    } else {
      setLoading(false);
    }
  }, [user]);

  const createProject = async (name: string, color: string, clientProfile?: ClientProfile) => {
    if (!user) {
      notifications.error('You must be logged in to create a project.');
      return;
    }
    if (!isSupabaseAvailable()) {
      notifications.error('Cannot create project, connection not available.');
      return;
    }
    
    try {
      const response = await api.createProject({
        name,
        color,
        userId: user.id,
        clientProfileSnapshot: clientProfile,
      });

      if (response.success && response.data) {
        notifications.success('Project created successfully!');
        await fetchProjects();
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to create project');
      }
    } catch (error) {
      notifications.error(`Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  const deleteProject = async (projectId: string) => {
    const confirmed = await dialog.confirm({
      title: 'Delete Project',
      message: 'Are you sure you want to delete this project and all its associated chats? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    });

    if (!confirmed) return;

    if (!isSupabaseAvailable()) {
      notifications.error('Cannot delete project, connection not available.');
      return;
    }

    try {
      const response = await api.deleteProject(projectId);
      if (response.success) {
        notifications.success('Project deleted successfully.');
        await fetchProjects();
      } else {
        throw new Error(response.error || 'Failed to delete project');
      }
    } catch (error) {
      notifications.error(`Failed to delete project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const updateProject = async (projectId: string, updates: Partial<Project>) => {
    if (!isSupabaseAvailable()) {
      notifications.error('Cannot update project, connection not available.');
      return;
    }
    
    try {
      const response = await api.updateProject(projectId, updates);
      if (response.success && response.data) {
        notifications.success('Project updated successfully.');
        await fetchProjects();
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to update project');
      }
    } catch (error) {
      notifications.error(`Failed to update project: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  return {
    projects,
    loading,
    error,
    refetch: fetchProjects,
    createProject,
    deleteProject,
    updateProject,
  };
};