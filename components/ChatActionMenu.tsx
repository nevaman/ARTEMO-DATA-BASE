import React, { useState, useRef, useEffect } from 'react';
import { useProjects } from '../hooks/useProjects';
import { SupabaseApiService } from '../services/supabaseApi';
import { useAuthStore } from '../stores/authStore';
import type { ChatHistoryItem, Project } from '../types';
import { MoreHorizontalIcon, EditIcon, TrashIcon, FolderIcon, PlusIcon } from './Icons';

interface ChatActionMenuProps {
  chatItem: ChatHistoryItem;
  onRename: () => void;
  onDelete: () => void;
  onAddToProject: (projectId: string) => void;
}

const ProjectSelectionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelectProject: (projectId: string) => void;
  currentProjectId?: string;
  projects: Project[];
}> = ({ isOpen, onClose, onSelectProject, currentProjectId, projects = [] }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/50 z-[1001] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-light-bg-component dark:bg-dark-bg-component rounded-lg shadow-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-light-border dark:border-dark-border">
          <h3 className="font-serif text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
            Add Chat to Project
          </h3>
        </div>
        <div className="p-4 max-h-60 overflow-y-auto">
          {projects && projects.length > 0 ? (
            <div className="space-y-2">
              {projects.map(project => (
                <button
                  key={project.id}
                  onClick={() => {
                    onSelectProject(project.id);
                    onClose();
                  }}
                  className={`w-full text-left p-3 rounded-md border transition-colors ${
                    currentProjectId === project.id
                      ? 'border-primary-accent bg-primary-accent/10 text-light-text-primary dark:text-dark-text-primary'
                      : 'border-light-border dark:border-dark-border hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page text-light-text-secondary dark:text-dark-text-secondary'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FolderIcon className="w-4 h-4" />
                    <span className="font-medium">{project.name}</span>
                    {currentProjectId === project.id && (
                      <span className="text-xs text-primary-accent ml-auto">Current</span>
                    )}
                  </div>
                  {project.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {project.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs px-2 py-1 bg-light-bg-sidebar dark:bg-dark-bg-component rounded-full">
                          {tag}
                        </span>
                      ))}
                      {project.tags.length > 3 && (
                        <span className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
                          +{project.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-light-text-tertiary dark:text-dark-text-tertiary">
              <FolderIcon className="w-8 h-8 mx-auto mb-2" />
              <p>No projects available</p>
              <p className="text-sm">Create a project first</p>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-light-border dark:border-dark-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export const ChatActionMenu: React.FC<ChatActionMenuProps> = ({ 
  chatItem, 
  onRename, 
  onDelete, 
  onAddToProject 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const { projects } = useProjects();
  const { user } = useAuthStore();
  const api = SupabaseApiService.getInstance();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddToProject = async (projectId: string) => {
    if (!user) return;
    
    setIsUpdating(true);
    try {
      const response = await api.updateChatSession(chatItem.id, {
        projectId: projectId
      });
      
      if (response.success) {
        onAddToProject(projectId);
        console.log('Chat successfully added to project');
      } else {
        throw new Error(response.error || 'Failed to add chat to project');
      }
    } catch (error) {
      console.error('Failed to add chat to project:', error);
      alert('Failed to add chat to project. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveFromProject = async () => {
    if (!user) return;
    
    setIsUpdating(true);
    try {
      const response = await api.updateChatSession(chatItem.id, {
        projectId: null
      });
      
      if (response.success) {
        onAddToProject(''); // Clear project association
        console.log('Chat successfully removed from project');
      } else {
        throw new Error(response.error || 'Failed to remove chat from project');
      }
    } catch (error) {
      console.error('Failed to remove chat from project:', error);
      alert('Failed to remove chat from project. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            e.preventDefault(); 
            setIsOpen(!isOpen); 
          }} 
          className="p-1 rounded-full text-light-text-tertiary dark:text-dark-text-tertiary hover:bg-light-bg-page dark:hover:bg-dark-bg-page"
          disabled={isUpdating}
        >
          {isUpdating ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
          ) : (
            <MoreHorizontalIcon className="w-4 h-4" />
          )}
        </button>
        
        {isOpen && (
          <div className="absolute right-0 top-full mt-1 w-40 bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-md shadow-lg z-10 py-1">
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                onRename(); 
                setIsOpen(false); 
              }} 
              className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page"
            >
              <EditIcon className="w-3.5 h-3.5" /> Rename
            </button>
            
            {chatItem.projectId ? (
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  handleRemoveFromProject();
                  setIsOpen(false); 
                }} 
                className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page"
              >
                <FolderIcon className="w-3.5 h-3.5" /> Remove from Project
              </button>
            ) : (
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setIsProjectModalOpen(true);
                  setIsOpen(false); 
                }} 
                className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page"
              >
                <PlusIcon className="w-3.5 h-3.5" /> Add to Project
              </button>
            )}
            
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                onDelete(); 
                setIsOpen(false); 
              }} 
              className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm text-red-600 dark:text-red-500 hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page"
            >
              <TrashIcon className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        )}
      </div>

      <ProjectSelectionModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSelectProject={handleAddToProject}
        currentProjectId={chatItem.projectId}
        projects={projects}
      />
    </>
  );
};