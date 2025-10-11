import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useChatHistory } from '../hooks/useChatHistory';
import { ProjectDetailView } from '../components/ProjectDetailView';

import { FolderIcon } from '../components/Icons';

const ProjectDetailSkeleton: React.FC = () => (
  <div className="p-4 lg:p-6 max-w-5xl mx-auto w-full animate-pulse">
    <div className="flex items-center gap-4 mb-8">
      <div className="h-6 w-20 bg-light-bg-sidebar dark:bg-dark-bg-component rounded-md"></div>
    </div>
    <div className="flex items-center gap-3 mb-8">
      <div className="w-16 h-16 bg-light-bg-sidebar dark:bg-dark-bg-component rounded-xl"></div>
      <div className="flex-grow space-y-3">
        <div className="h-8 w-1/2 bg-light-bg-sidebar dark:bg-dark-bg-component rounded-md"></div>
        <div className="h-5 w-1/4 bg-light-bg-sidebar dark:bg-dark-bg-component rounded-md"></div>
      </div>
    </div>
    <div className="h-px bg-light-border dark:border-dark-border mb-6"></div>
    <div className="flex justify-between items-center mb-4">
      <div className="h-7 w-1/3 bg-light-bg-sidebar dark:bg-dark-bg-component rounded-md"></div>
      <div className="h-10 w-36 bg-light-bg-sidebar dark:bg-dark-bg-component rounded-md"></div>
    </div>
    <div className="space-y-3">
      <div className="h-20 w-full bg-light-bg-sidebar dark:bg-dark-bg-component rounded-md"></div>
      <div className="h-20 w-full bg-light-bg-sidebar dark:bg-dark-bg-component rounded-md"></div>
      <div className="h-20 w-full bg-light-bg-sidebar dark:bg-dark-bg-component rounded-md"></div>
    </div>
  </div>
);

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, loading, error } = useProjects();

  if (loading) {
    return <ProjectDetailSkeleton />;
  }

  if (error) {
    return (
      <div className="p-4 lg:p-6 max-w-5xl mx-auto w-full">
        <div className="text-center py-20 text-red-600 dark:text-red-400">
          <h2 className="text-xl font-bold mb-4">Error Loading Project</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const project = projects.find(p => p.id === id);

  if (!project) {
    return (
      <div className="p-4 lg:p-6 max-w-5xl mx-auto w-full">
        <div className="text-center py-20">
          <FolderIcon className="w-16 h-16 text-light-text-tertiary dark:text-dark-text-tertiary mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary mb-4">
            Project Not Found
          </h2>
          <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6">
            The project you're looking for doesn't exist or has been deleted.
          </p>
          <button
            onClick={() => navigate('/projects')}
            className="px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85"
          >
            Back to All Projects
          </button>
        </div>
      </div>
    );
  }

  const handleViewChatDetail = (chatItem: any) => {
    navigate(`/chat/${chatItem.id}`);
  };

  const handleStartNewChat = (projectId: string, toolId: string) => {
    navigate(`/tools/${toolId}`, { state: { projectId } });
  };

  return (
    <ProjectDetailView
      project={project}
      onBack={() => navigate('/projects')}
      onViewChatDetail={handleViewChatDetail}
      onStartNewChat={handleStartNewChat}
    />
  );
};