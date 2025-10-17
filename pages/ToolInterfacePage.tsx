import React, { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTools } from '../hooks/useTools';
import { useProjects } from '../hooks/useProjects';
import { useUIStore } from '../stores/uiStore';
import { useAuthStore } from '../stores/authStore';
import { ToolInterfaceView } from '../components/ToolInterfaceView';
import { useNotifications } from '../contexts/NotificationContext';

import { BriefcaseIcon, LockIcon } from '../components/Icons';

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
  const { openModal, setShowProUpgradeModal } = useUIStore();
  const { isPro, isAdmin } = useAuthStore();

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

  const isProTool = tool?.is_pro || false;
  const canAccess = !isProTool || isPro || isAdmin;

  useEffect(() => {
    if (tool && !canAccess) {
      setShowProUpgradeModal(true);
      navigate('/tools', { replace: true });
    }
  }, [tool, canAccess, navigate, setShowProUpgradeModal]);

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

  if (!canAccess) {
    return (
      <div className="p-4 lg:p-6 max-w-5xl mx-auto w-full">
        <div className="text-center py-20">
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-br from-purple-100 to-fuchsia-100 dark:from-purple-900/30 dark:to-fuchsia-900/30 mb-6">
            <LockIcon className="h-10 w-10 text-purple-600 dark:text-purple-400" />
          </div>
          <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary mb-4">
            Pro Tool Access Required
          </h2>
          <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6 max-w-md mx-auto">
            This tool is exclusive to Pro members. Upgrade your account to access this and all other Pro tools.
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => navigate('/tools')}
              className="px-4 py-2 border border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary rounded-md hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-component"
            >
              Back to All Tools
            </button>
            <button
              onClick={() => setShowProUpgradeModal(true)}
              className="px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85"
            >
              Contact Support
            </button>
          </div>
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