import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTools } from '../hooks/useTools';
import { useProjects } from '../hooks/useProjects';
import { useUIStore } from '../stores/uiStore';
import { ToolInterfaceView } from '../components/ToolInterfaceView';
import { useNotifications } from '../contexts/NotificationContext';

import { BriefcaseIcon } from '../components/Icons';

const ToolInterfaceSkeleton: React.FC = () => (
  <div className="flex h-screen animate-pulse">
    <div className="w-96 bg-light-bg-sidebar dark:bg-dark-bg-sidebar p-4 space-y-4 border-r border-light-border dark:border-dark-border">
      <div className="h-8 w-3/4 bg-light-bg-component dark:bg-dark-bg-component rounded-md"></div>
      <div className="h-20 w-full bg-light-bg-component dark:bg-dark-bg-component rounded-md"></div>
      <div className="h-10 w-full bg-light-bg-component dark:bg-dark-bg-component rounded-md"></div>
      <div className="h-10 w-full bg-light-bg-component dark:bg-dark-bg-component rounded-md"></div>
    </div>
    <div className="flex-1 p-6 flex flex-col bg-light-bg-page dark:bg-dark-bg-page">
      <div className="flex-grow space-y-4">
        <div className="h-16 w-3/4 bg-light-bg-component dark:bg-dark-bg-component rounded-md self-start"></div>
        <div className="h-20 w-1/2 bg-light-bg-component dark:bg-dark-bg-component rounded-md self-end ml-auto"></div>
        <div className="h-12 w-2/3 bg-light-bg-component dark:bg-dark-bg-component rounded-md self-start"></div>
      </div>
      <div className="h-12 w-full bg-light-bg-component dark:bg-dark-bg-component rounded-md mt-4"></div>
    </div>
  </div>
);


export const ToolInterfacePage: React.FC = () => {
  const { toolId } = useParams<{ toolId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { tools, loading, error } = useTools();
  const { projects } = useProjects();
  const { openModal } = useUIStore();

  if (loading) {
    return <ToolInterfaceSkeleton />;
  }

  if (error) {
    return (
      <div className="p-4 lg:p-6 max-w-5xl mx-auto w-full">
        <div className="text-center py-20 text-red-600 dark:text-red-400">
          <h2 className="text-xl font-bold mb-4">Error Loading Tool</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const tool = tools.find(t => t.id === toolId);
  const existingChatSession = location.state?.existingChatSession;

  if (!tool) {
    return (
      <div className="p-4 lg:p-6 max-w-5xl mx-auto w-full">
        <div className="text-center py-20">
          <BriefcaseIcon className="w-16 h-16 text-light-text-tertiary dark:text-dark-text-tertiary mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary mb-4">
            Tool Not Found
          </h2>
          <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6">
            The tool you're looking for doesn't exist, is inactive, or has been deleted.
          </p>
          <button
            onClick={() => navigate('/tools')}
            className="px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85"
          >
            Back to All Tools
          </button>
        </div>
      </div>
    );
  }

  const handleStartNewConversation = () => {
    // Navigate to same tool but clear state to start fresh
    navigate(`/tools/${toolId}`, { replace: true, state: null });
  };

  return (
    <ToolInterfaceView
      tool={tool}
      existingChatSession={existingChatSession}
      onBack={() => navigate('/')}
      projects={projects}
      onNewProject={openModal}
      onStartNewConversation={handleStartNewConversation}
    />
  );
};