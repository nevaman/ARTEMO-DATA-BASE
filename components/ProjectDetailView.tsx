import React, { useState, useEffect } from 'react';
import type { Project, ChatHistoryItem } from '../types';
import { useTools } from '../hooks/useTools';
import { useChatHistory } from '../hooks/useChatHistory';
import { SupabaseApiService } from '../services/supabaseApi';
import { VectorSearchService } from '../services/vectorSearchService';
import { useAuthStore } from '../stores/authStore';
import { useConfirmationDialog } from '../hooks/useConfirmationDialog';
import { useNotifications } from '../contexts/NotificationContext';
import { ArrowLeftIcon, MessageSquareIcon, FolderIcon, BriefcaseIcon, PlusIcon, ChevronDownIcon, SearchIcon, MoreHorizontalIcon, EditIcon, TrashIcon } from './Icons';

interface ProjectDetailViewProps {
  project: Project;
  onBack: () => void;
  onViewChatDetail: (chatItem: ChatHistoryItem) => void;
  onStartNewChat: (projectId: string, toolId: string) => void;
}

const ProjectChatActionMenu: React.FC<{
  chatItem: ChatHistoryItem;
  onRename: () => void;
  onDelete: () => void;
  onRemoveFromProject: () => void;
}> = ({ chatItem, onRename, onDelete, onRemoveFromProject }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={(e) => { 
          e.stopPropagation(); 
          e.preventDefault(); 
          setIsOpen(!isOpen); 
        }} 
        className="p-1 rounded-full text-light-text-tertiary dark:text-dark-text-tertiary hover:bg-light-bg-page dark:hover:bg-dark-bg-page opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <MoreHorizontalIcon className="w-4 h-4" />
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
          
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              onRemoveFromProject();
              setIsOpen(false); 
            }} 
            className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page"
          >
            <FolderIcon className="w-3.5 h-3.5" /> Remove from Project
          </button>
          
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
  );
};
const ToolRecommendationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  project: Project;
}> = ({ isOpen, onClose, projectId, project }) => {
  const { tools } = useTools();
  const [prompt, setPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendedTool, setRecommendedTool] = useState<any>(null);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [tokensSaved, setTokensSaved] = useState<number>(0);
  const [useVectorSearch, setUseVectorSearch] = useState(true);
  const api = SupabaseApiService.getInstance();
  const vectorService = VectorSearchService.getInstance();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [prompt]);

  const handleUseRecommendedTool = () => {
    // Store project context for automatic association
    sessionStorage.setItem('activeProjectId', projectId);
    if (project.clientProfileSnapshot) {
      sessionStorage.setItem('activeClientProfile', JSON.stringify(project.clientProfileSnapshot));
      
      // Also immediately update the global store
      const { setActiveClientProfileId } = useAuthStore.getState();
      setActiveClientProfileId(project.clientProfileSnapshot.id);
    }
    
    // Dispatch event to trigger tool activation
    window.dispatchEvent(new CustomEvent('recommendedToolSelected', {
      detail: { tool: recommendedTool, projectId }
    }));
    
    sessionStorage.setItem('selectedProjectId', projectId);
    onClose();
  };
  const analyzePromptAndRecommendTool = async (userPrompt: string) => {
    if (!userPrompt.trim() || tools.length === 0) return;
    
    setIsAnalyzing(true);
    setRecommendedTool(null);
    setAnalysisResult('');
    setTokensSaved(0);
    
    try {
      if (useVectorSearch) {
        // Use optimized vector search approach
        const response = await vectorService.getOptimizedToolRecommendation(userPrompt);
        
        if (response.success && response.data) {
          const { recommendedTool: foundTool, analysis, tokensSaved: saved } = response.data;
          
          if (foundTool) {
            setRecommendedTool(foundTool);
            setAnalysisResult(analysis);
            setTokensSaved(saved);
          } else {
            setAnalysisResult(analysis);
          }
        } else {
          // Vector search failed, try legacy search as fallback
          console.warn('Vector search failed in project modal, attempting legacy search:', response.error);
          setUseVectorSearch(false);
          
          // Fall through to legacy search
          await performLegacySearch(userPrompt);
        }
      } else {
        // Use legacy search
        await performLegacySearch(userPrompt);
      }
    } catch (error) {
      console.error('Failed to analyze prompt:', error);
      setAnalysisResult('Unable to analyze your request at the moment. Please try selecting a tool manually from the categories below, or try again in a few minutes.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const performLegacySearch = async (userPrompt: string) => {
    try {
      const systemPrompt = `You are an AI assistant that analyzes user requests and recommends the most appropriate copywriting tool from a list of available tools.

Available tools:
${tools.map(tool => `- **${tool.title}** (${tool.category}): ${tool.description}`).join('\n')}

User request: "${userPrompt}"

Please analyze the user's request thoroughly and:
1. Identify the specific type of content they want to create
2. Consider the target audience, tone, and purpose implied in their request
3. Match their needs against both the tool titles AND detailed descriptions above
4. Recommend the MOST APPROPRIATE tool that best fits their specific requirements
5. Explain why this tool is the perfect match, referencing specific capabilities from the tool's description
6. Provide actionable insights about their content creation goal

Respond in this format:
RECOMMENDED_TOOL: [exact tool title from the list]
ANALYSIS: [detailed analysis explaining why this tool matches their needs, what specific capabilities make it ideal, and how it will help them achieve their content goals]`;

      const response = await api.sendChatMessage('tool-recommendation', [
        { id: '1', sender: 'user', text: systemPrompt }
      ]);
      
      if (response.success && response.data) {
        const responseText = response.data;
        
        const toolMatch = responseText.match(/RECOMMENDED_TOOL:\s*(.+?)(?:\n|$)/);
        const analysisMatch = responseText.match(/ANALYSIS:\s*([\s\S]+)/);
        
        if (toolMatch && analysisMatch) {
          const recommendedToolTitle = toolMatch[1].trim();
          const analysis = analysisMatch[1].trim();
          
          const foundTool = tools.find(tool => 
            tool.title.toLowerCase() === recommendedToolTitle.toLowerCase() ||
            tool.title.includes(recommendedToolTitle) ||
            recommendedToolTitle.includes(tool.title)
          );
          
          if (foundTool) {
            setRecommendedTool(foundTool);
            setAnalysisResult(analysis);
          } else {
            setAnalysisResult(responseText);
          }
        } else {
          setAnalysisResult(responseText);
        }
      } else {
        throw new Error(response.error || 'AI service temporarily unavailable');
      }
    } catch (error: any) {
      console.error('Legacy search failed:', error);
      setAnalysisResult('AI recommendation service is temporarily unavailable. Please browse our tool categories below to find the right tool for your needs, or try again in a few minutes.');
    }
  };

  const handleSendPrompt = () => {
    if (prompt.trim()) {
      analyzePromptAndRecommendTool(prompt.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendPrompt();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-light-bg-component dark:bg-dark-bg-component rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-light-border dark:border-dark-border flex justify-between items-center">
          <h3 className="font-serif text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
            AI Tool Recommendation
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-light-text-tertiary dark:text-dark-text-tertiary hover:text-light-text-primary dark:hover:text-dark-text-primary hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page rounded-md transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto">
          <div>
            <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
              Tell me what you want to create and I'll recommend the perfect tool for this project.
            </p>
            <div className="flex flex-col sm:flex-row items-start text-left bg-light-bg-sidebar dark:bg-dark-bg-page border border-light-border dark:border-dark-border rounded-md p-1 sm:pl-4">
              <span className="text-base sm:text-lg text-primary-accent font-medium pt-3 flex-shrink-0 px-3 sm:px-0">I want to create a&nbsp;</span>
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                className="prompt-input flex-grow border-none outline-none bg-transparent p-3 text-base sm:text-lg text-light-text-primary dark:text-dark-text-primary font-medium resize-none leading-normal max-h-60 w-full"
                placeholder="persuasive email for a new product launch"
              />
              <button 
                onClick={handleSendPrompt}
                disabled={isAnalyzing || !prompt.trim()}
                className="bg-primary-accent text-text-on-accent border-none rounded-sm m-1 p-2.5 cursor-pointer flex items-center justify-center transition-opacity self-end sm:self-end flex-shrink-0 hover:opacity-85 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-text-on-accent"></div>
                ) : (
                  <SearchIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
          
          {/* AI Analysis Results */}
          {(isAnalyzing || recommendedTool || analysisResult) && (
            <div className="bg-light-bg-sidebar dark:bg-dark-bg-page border border-light-border dark:border-dark-border rounded-lg p-6">
              {isAnalyzing ? (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-accent mx-auto mb-4"></div>
                  <p className="text-light-text-secondary dark:text-dark-text-secondary">
                    Analyzing your request and finding the perfect tool...
                  </p>
                </div>
              ) : (
                <div>
                  <h4 className="font-serif text-lg font-bold text-light-text-primary dark:text-dark-text-primary mb-4">
                    AI Recommendation
                  </h4>
                  
                  {recommendedTool ? (
                    <div className="space-y-4">
                      <div className="bg-primary-accent/10 border border-primary-accent/20 rounded-lg p-4">
                        {tokensSaved > 0 && (
                          <div className="mb-3 text-xs text-green-600 dark:text-green-400 font-medium">
                            ⚡ Optimized search saved ~{tokensSaved} tokens
                          </div>
                        )}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-primary-accent/20 rounded-lg flex items-center justify-center">
                            <SearchIcon className="w-5 h-5 text-primary-accent" />
                          </div>
                          <div>
                            <h5 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                              Recommended: {recommendedTool.title}
                            </h5>
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                              {recommendedTool.category}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleUseRecommendedTool}
                          className="w-full bg-primary-accent text-text-on-accent py-2 px-4 rounded-md hover:opacity-85 transition-opacity"
                        >
                          Use {recommendedTool.title}
                        </button>
                      </div>
                      {useVectorSearch && tokensSaved > 0 && (
                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-blue-800 dark:text-blue-200">
                              🎯 Vector search found relevant tools efficiently
                            </span>
                            <button
                              onClick={() => setUseVectorSearch(false)}
                              className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
                            >
                              Try legacy search
                            </button>
                          </div>
                        </div>
                      )}
                      {!useVectorSearch && (
                        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-yellow-800 dark:text-yellow-200">
                              ⚠️ Using legacy search (higher token usage)
                            </span>
                            <button
                              onClick={() => setUseVectorSearch(true)}
                              className="text-yellow-600 dark:text-yellow-400 hover:underline text-xs"
                            >
                              Switch to vector search
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : analysisResult ? (
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">
                      {analysisResult}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ClientProfilePill: React.FC<{
  clientProfile: any;
  projectColor: string;
}> = ({ clientProfile, projectColor }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const pillRef = React.useRef<HTMLDivElement>(null);

  const handleMouseEnter = (e: React.MouseEvent) => {
    setShowTooltip(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  return (
    <>
      <div
        ref={pillRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full border transition-all duration-200 hover:shadow-sm cursor-help"
        style={{ 
          borderColor: projectColor,
          color: projectColor,
          backgroundColor: 'transparent'
        }}
      >
        <BriefcaseIcon className="w-3 h-3" />
        <span>{clientProfile.name}</span>
      </div>
      
      {/* Tooltip */}
      {showTooltip && (
        <div
          className="fixed z-[1000] bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-lg shadow-xl p-4 max-w-sm transform -translate-x-1/2 -translate-y-full transition-all duration-200"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
          }}
        >
          <div className="space-y-2">
            <h5 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
              {clientProfile.name}
            </h5>
            <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary space-y-1">
              <p><span className="font-medium">Audience:</span> {clientProfile.audience}</p>
              <p><span className="font-medium">Language:</span> {clientProfile.language}</p>
              <p><span className="font-medium">Tone:</span> {clientProfile.tone}</p>
              {clientProfile.sample && (
                <p><span className="font-medium">Sample:</span> "{clientProfile.sample}"</p>
              )}
            </div>
          </div>
          {/* Arrow */}
          <div 
            className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-light-bg-component dark:border-t-dark-bg-component"
          />
        </div>
      )}
    </>
  );
};

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({ 
  project, 
  onBack, 
  onViewChatDetail,
  onStartNewChat
}) => {
  const confirmDialog = useConfirmationDialog();
  const notifications = useNotifications();
  const [projectChats, setProjectChats] = useState<ChatHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRecommendationModal, setShowRecommendationModal] = useState(false);
  const [itemToRename, setItemToRename] = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  
  const { user } = useAuthStore();
  const { updateChatSession, deleteChat } = useChatHistory();
  const api = SupabaseApiService.getInstance();

  useEffect(() => {
    const fetchProjectChats = async () => {
      if (!user) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const response = await api.getChatSessionsByProjectId(project.id, user.id);
        if (response.success && response.data) {
          setProjectChats(response.data);
        } else {
          // Don't show error for empty projects - this is normal
          if (response.error && !response.error.includes('No data')) {
            setError(response.error);
          } else {
            setProjectChats([]);
          }
        }
      } catch (err) {
        console.error('Error fetching project chats:', err);
        // Don't show error for network issues when Supabase isn't configured
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        if (!errorMessage.includes('Failed to fetch') && !errorMessage.includes('TypeError')) {
          setError('Network error occurred');
        } else {
          setProjectChats([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProjectChats();
  }, [project.id, user, api]);

  const handleRename = async (chatId: string, newName: string) => {
    if (!newName.trim()) return;
    
    try {
      await updateChatSession(chatId, { title: newName.trim() });
      // Update local state
      setProjectChats(prev => prev.map(chat => 
        chat.id === chatId ? { ...chat, toolTitle: newName.trim() } : chat
      ));
      setItemToRename(null);
      setRenameValue('');
      notifications.success(`Chat renamed to "${newName.trim()}" successfully`, 'Chat Renamed');
    } catch (error) {
      console.error('Failed to rename chat:', error);
      notifications.error('Failed to rename chat. Please try again.');
    }
  };

  const handleDelete = async (chatId: string) => {
    const chat = projectChats.find(c => c.id === chatId);
    if (!chat) return;

    const confirmed = await confirmDialog.confirmDelete(chat.toolTitle, 'chat');
    if (!confirmed) return;

    try {
      deleteChat(chatId);
      // Remove from local state
      setProjectChats(prev => prev.filter(chat => chat.id !== chatId));
      notifications.success(`Chat "${chat.toolTitle}" deleted successfully`, 'Chat Deleted');
    } catch (error) {
      console.error('Failed to delete chat:', error);
      notifications.error('Failed to delete chat. Please try again.');
    }
  };

  const handleRemoveFromProject = async (chatId: string) => {
    const chat = projectChats.find(c => c.id === chatId);
    if (!chat) return;

    const confirmed = await confirmDialog.confirm({
      title: 'Remove from Project',
      message: `Are you sure you want to remove "${chat.toolTitle}" from this project?`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      variant: 'warning'
    });

    if (!confirmed) return;

    try {
      await updateChatSession(chatId, { projectId: null });
      // Remove from local state
      setProjectChats(prev => prev.filter(chat => chat.id !== chatId));
      notifications.success(`Chat "${chat.toolTitle}" removed from project successfully`, 'Chat Removed');
    } catch (error) {
      console.error('Failed to remove chat from project:', error);
      notifications.error('Failed to remove chat from project. Please try again.');
    }
  };

  const openRenameModal = (chat: ChatHistoryItem) => {
    setItemToRename({ id: chat.id, name: chat.toolTitle });
    setRenameValue(chat.toolTitle);
  };
  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto w-full">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={onBack} 
          className="flex items-center gap-2 text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back
        </button>
        <div className="h-6 w-px bg-light-border dark:border-dark-border"></div>
        <div className="flex items-center gap-3">
          <div 
            className="flex items-center justify-center w-16 h-16 rounded-xl border-2"
            style={{ borderColor: project.color }}
          >
            <FolderIcon className="w-8 h-8" style={{ color: project.color }} />
          </div>
          <div className="flex-grow">
            <h2 className="font-serif text-3xl font-bold text-light-text-primary dark:text-dark-text-primary mb-3">
              {project.name}
            </h2>
            {project.clientProfileSnapshot && (
              <div className="mb-3">
                <ClientProfilePill 
                  clientProfile={project.clientProfileSnapshot}
                  projectColor={project.color}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-serif text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
            Chat Sessions ({projectChats.length})
          </h3>
          <button
            onClick={() => setShowRecommendationModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity"
          >
            <SearchIcon className="w-4 h-4" />
            Start New Tool
          </button>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-accent mx-auto mb-4"></div>
              <p className="text-light-text-secondary dark:text-dark-text-secondary">Loading chats...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-600 dark:text-red-400">
            <p>Error: {error}</p>
          </div>
        ) : projectChats.length > 0 ? (
          <div className="space-y-3">
            {projectChats.map((chat) => (
              <div
                key={chat.id}
                className="group relative w-full text-left p-4 bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-md hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page transition-colors cursor-pointer"
                onClick={() => onViewChatDetail(chat)}
              >
                <div className="flex items-start gap-3">
                  <MessageSquareIcon className="w-5 h-5 text-primary-accent flex-shrink-0 mt-0.5" />
                  <div className="flex-grow min-w-0 pr-8">
                    <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary truncate">
                      {chat.toolTitle}
                    </h4>
                    <p className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary truncate mt-1">
                      "{chat.messages.find(m => m.sender === 'user')?.text || 'No messages'}"
                    </p>
                    <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary mt-1">
                      {new Date(chat.timestamp).toLocaleDateString()} at {new Date(chat.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="absolute top-3 right-3">
                    <ProjectChatActionMenu
                      chatItem={chat}
                      onRename={() => openRenameModal(chat)}
                      onDelete={() => handleDelete(chat.id)}
                      onRemoveFromProject={() => handleRemoveFromProject(chat.id)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-light-bg-sidebar dark:bg-dark-bg-component rounded-lg border border-light-border dark:border-dark-border">
            <MessageSquareIcon className="w-12 h-12 text-light-text-tertiary dark:text-dark-text-tertiary mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">No chat sessions yet</h3>
            <p className="text-light-text-tertiary dark:text-dark-text-tertiary mt-1">
              Start using tools and associate them with this project to see chat sessions here.
            </p>
          </div>
        )}
      </div>

      {/* Rename Modal */}
      {itemToRename && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/50 z-[1001] flex items-center justify-center p-4" onClick={() => setItemToRename(null)}>
          <div className="bg-light-bg-component dark:bg-dark-bg-component rounded-lg shadow-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-light-border dark:border-dark-border flex justify-between items-center">
              <h3 className="font-serif text-lg font-bold text-light-text-primary dark:text-dark-text-primary">Rename Chat</h3>
              <button onClick={() => setItemToRename(null)} className="text-light-text-tertiary dark:text-dark-text-tertiary hover:text-light-text-primary dark:hover:text-dark-text-primary">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <label htmlFor="rename-input" className="block font-medium text-light-text-primary dark:text-dark-text-primary mb-2">Chat Name</label>
              <input
                id="rename-input"
                type="text"
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                className="w-full p-2.5 bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-sm text-light-text-primary dark:text-dark-text-primary focus:border-primary-accent focus:ring-2 focus:ring-primary-accent/20 outline-none"
                onKeyDown={e => e.key === 'Enter' && handleRename(itemToRename.id, renameValue)}
                autoFocus
              />
            </div>
            <div className="p-4 border-t border-light-border dark:border-dark-border flex justify-end gap-3">
              <button onClick={() => setItemToRename(null)} className="px-4 py-2 rounded-sm bg-light-bg-sidebar dark:bg-dark-bg-component border border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary hover:opacity-85">Cancel</button>
              <button onClick={() => handleRename(itemToRename.id, renameValue)} className="px-4 py-2 rounded-sm bg-primary-accent text-text-on-accent hover:opacity-85">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Tool Recommendation Modal */}
      <ToolRecommendationModal
        isOpen={showRecommendationModal}
        onClose={() => setShowRecommendationModal(false)}
        projectId={project.id}
        project={project}
      />
    </div>
  );
};