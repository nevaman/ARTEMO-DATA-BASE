// layouts/AppLayout.tsx

import React from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Sidebar } from '../components/Sidebar';
import { NewProjectModal } from '../components/NewProjectModal';
import { ToolActivationModal } from '../components/ToolActivationModal';
import { ChatSearchModal } from '../components/ChatSearchModal';
import { MainContent } from '../components/MainContent';
import { useCategories } from '../hooks/useCategories';
import { useProjects } from '../hooks/useProjects';
import { useChatHistory } from '../hooks/useChatHistory';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import type { DynamicTool, ClientProfile, ToolCategory } from '../types';
import { ArtemoFullLogo, MenuIcon, MoonIcon, SunIcon, HelpCircleIcon } from '../components/Icons';

const SidebarErrorFallback: React.FC = () => (
  <div className="w-[280px] bg-light-bg-sidebar dark:bg-dark-bg-sidebar border-r border-light-border dark:border-dark-border p-4 flex items-center justify-center">
    <div className="text-center">
      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">
        Sidebar temporarily unavailable
      </p>
      <button 
        onClick={() => window.location.reload()} 
        className="text-xs text-primary-accent hover:underline"
      >
        Reload page
      </button>
    </div>
  </div>
);

const MobileHeader: React.FC = () => {
  const { toggleSidebar, theme, toggleTheme } = useUIStore();
  
  return (
    <header className="lg:hidden flex items-center justify-between p-3 border-b border-light-border dark:border-dark-border bg-light-bg-page dark:bg-dark-bg-page">
      <button onClick={toggleSidebar} className="p-1">
        <MenuIcon className="w-6 h-6 text-light-text-primary dark:text-dark-text-primary" />
      </button>
      <Link to="/" className="flex items-center">
        <ArtemoFullLogo className="h-8" />
      </Link>
      <button onClick={toggleTheme} className="p-1 rounded-sm text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-component hover:text-light-text-primary dark:hover:text-dark-text-primary">
        {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
      </button>
    </header>
  );
};

const MainTopBar: React.FC = () => {
  const { theme, toggleTheme } = useUIStore();
  
  return (
    <header className="hidden lg:flex justify-end items-center py-3 px-6 border-b border-light-border dark:border-dark-border flex-shrink-0">
      <div className="flex items-center gap-4">
        <button className="flex items-center gap-2 p-1 rounded-sm text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-component hover:text-light-text-primary dark:hover:text-dark-text-primary font-medium">
          <HelpCircleIcon className="w-5 h-5" />
          <span>Help center</span>
        </button>
        <button onClick={toggleTheme} className="p-1 rounded-sm text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-component hover:text-light-text-primary dark:hover:text-dark-text-primary">
          {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
        </button>
      </div>
    </header>
  );
};

const RenameModal: React.FC = () => {
  const { itemToRename, setItemToRename } = useUIStore();
  const [name, setName] = React.useState('');
  const { updateProject } = useProjects();
  const { updateChatSession } = useChatHistory();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (itemToRename) {
      setName(itemToRename.name);
    }
  }, [itemToRename]);

  if (!itemToRename) return null;

  const handleRename = async () => {
    if (name.trim()) {
      try {
        if (itemToRename.type === 'project') {
          await updateProject(itemToRename.id, { name: name.trim() });
        } else if (itemToRename.type === 'chat') {
          await updateChatSession(itemToRename.id, { title: name.trim() });
        }
        setItemToRename(null);
      } catch (error) {
        console.error('Failed to rename:', error);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/50 z-[1000] flex items-center justify-center p-4" onClick={() => setItemToRename(null)}>
      <div className="bg-light-bg-component dark:bg-dark-bg-component rounded-lg shadow-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-4 lg:p-6 border-b border-light-border dark:border-dark-border flex justify-between items-center">
          <h3 className="font-serif text-xl font-bold text-light-text-primary dark:text-dark-text-primary">Rename {itemToRename.type === 'project' ? 'Project' : 'Chat'}</h3>
          <button onClick={() => setItemToRename(null)} className="text-light-text-tertiary dark:text-dark-text-tertiary hover:text-light-text-primary dark:hover:text-dark-text-primary">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">
          <label htmlFor="rename-input" className="block font-medium text-light-text-primary dark:text-dark-text-primary mb-2">Name</label>
          <input
            id="rename-input"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full p-2.5 bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-sm text-light-text-primary dark:text-dark-text-primary focus:border-primary-accent focus:ring-2 focus:ring-primary-accent/20 outline-none"
            onKeyDown={e => e.key === 'Enter' && handleRename()}
            autoFocus
          />
        </div>
        <div className="p-4 lg:p-6 border-t border-light-border dark:border-dark-border flex justify-end gap-3">
          <button onClick={() => setItemToRename(null)} className="px-5 py-2 rounded-sm bg-light-bg-sidebar dark:bg-dark-bg-component border border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary hover:opacity-85">Cancel</button>
          <button onClick={handleRename} className="px-5 py-2 rounded-sm bg-primary-accent text-text-on-accent hover:opacity-85">Save</button>
        </div>
      </div>
    </div>
  );
};

export const AppLayout: React.FC = () => {
  const { 
    isSidebarOpen, 
    toggleSidebar, 
    isModalOpen, 
    closeModal, 
    toolForActivation, 
    setToolForActivation,
    isChatSearchOpen,
    closeChatSearch
  } = useUIStore();
  const { categories } = useCategories();
  const { projects, createProject } = useProjects();
  const { chatHistory } = useChatHistory();
  const { profile } = useAuthStore();
  const navigate = useNavigate();

  const handleInitiateToolActivation = (tool: DynamicTool) => {
    setToolForActivation(tool);
  };

  const handleStartToolSession = (tool: DynamicTool) => {
    navigate(`/tools/${tool.id}`);
    setToolForActivation(null);
  };

  const handleCreateProject = async (projectName: string, color: string, clientProfile?: ClientProfile) => {
    try {
      await createProject(projectName || 'Untitled Project', color, clientProfile);
      closeModal();
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleSetDontShowAgain = (toolId: string, shouldAdd: boolean) => {
    try {
      const current = JSON.parse(localStorage.getItem('dontShowAgainToolIds') || '[]');
      const newSet = new Set(current);
      if (shouldAdd) {
        newSet.add(toolId);
      } else {
        newSet.delete(toolId);
      }
      localStorage.setItem('dontShowAgainToolIds', JSON.stringify(Array.from(newSet)));
    } catch (error) {
      console.error('Failed to update dont show again preference:', error);
    }
  };

  return (
    <>
      <div className={`page-overlay fixed inset-0 z-40 bg-black/40 dark:bg-black/50 transition-opacity lg:hidden ${isSidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`} onClick={toggleSidebar}></div>
      <div className="flex h-screen font-sans">
        <ErrorBoundary fallback={<SidebarErrorFallback />}>
          <Sidebar
            projects={projects}
            chatHistory={chatHistory}
            onInitiateToolActivation={handleInitiateToolActivation}
          />
        </ErrorBoundary>
        
        <main className="flex-grow flex flex-col bg-light-bg-page dark:bg-dark-bg-page">
          <MobileHeader />
          <MainTopBar />
          <div className="flex-grow overflow-y-auto">
            <Outlet />
          </div>
        </main>
      </div>
      
      {/* Admin Access Button - Only show for admins */}
      {profile?.role === 'admin' && (
        <button
          onClick={() => navigate('/admin')}
          className="fixed bottom-4 right-4 px-4 py-2 bg-red-600 text-white rounded-md shadow-lg hover:bg-red-700 transition-colors z-50 cursor-pointer"
        >
          Admin Panel
        </button>
      )}
      
      <NewProjectModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onCreate={handleCreateProject}
        categories={categories.map(cat => cat.name as ToolCategory)}
      />
      
      <ToolActivationModal
        tool={toolForActivation}
        onClose={() => setToolForActivation(null)}
        onStart={handleStartToolSession}
        onSetDontShowAgain={handleSetDontShowAgain}
      />
      
      <RenameModal />
      
      <ChatSearchModal
        isOpen={isChatSearchOpen}
        onClose={closeChatSearch}
        onSelectChat={(chat) => {
          navigate(`/chat/${chat.id}`);
          closeChatSearch();
        }}
        onResumeChat={(chat) => {
          navigate(`/tools/${chat.toolId}`, { state: { existingChatSession: chat } });
          closeChatSearch();
        }}
      />
    </>
  );
};