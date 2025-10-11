import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { DynamicTool, Message, ChatHistoryItem, Project, ChatSession, ClientProfile } from '../types';
import { SupabaseApiService } from '../services/supabaseApi';
import { StorageService } from '../services/storageService';
import { useAuthStore } from '../stores/authStore';
import { Logger } from '../utils/logger';
import * as Icons from './Icons';
import { ChatMessage } from './ChatMessage';
import { EditorPanel, cleanText } from './EditorPanel';
import { ClientProfileSelector } from './ClientProfileSelector';
import { 
    prefillQuestionsFromClientProfile, 
    generateContextWelcomeMessage, 
    generateAllPrefilledMessage 
} from '../utils/clientProfileHelper';

const EMPTY_PROFILES: ClientProfile[] = [];

interface ToolInterfaceViewProps {
    tool: DynamicTool;
    existingChatSession?: ChatHistoryItem;
    onBack: () => void;
    projects: Project[];
    onNewProject: () => void;
    onStartNewConversation?: () => void; // Function to start fresh conversation
}

const ProjectSelector: React.FC<{
    projects: Project[];
    selectedProjectId: string | null;
    onSelectProject: (id: string) => void;
    onNewProject: () => void;
}> = ({ projects, selectedProjectId, onSelectProject, onNewProject }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const selectedProject = projects.find(p => p.id === selectedProjectId);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (id: string) => {
        onSelectProject(id);
        setIsOpen(false);
    };

    const handleNewProject = () => {
        onNewProject();
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-md border border-light-border dark:border-dark-border bg-light-bg-component dark:bg-dark-bg-component text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page"
            >
                <Icons.FolderIcon className="w-4 h-4" />
                <span className="truncate max-w-[150px]">{selectedProject?.name || 'Add chat to project'}</span>
                <Icons.ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-md shadow-lg z-20">
                    <div className="p-2 max-h-60 overflow-y-auto">
                        {projects.map(project => (
                            <a
                                href="#"
                                key={project.id}
                                onClick={(e) => { e.preventDefault(); handleSelect(project.id); }}
                                className={`flex items-center gap-3 w-full text-left px-3 py-2 text-sm rounded-sm ${selectedProjectId === project.id ? 'bg-primary-accent/20 text-light-text-primary dark:text-dark-text-primary' : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page'}`}
                            >
                                <Icons.FolderIcon className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate">{project.name}</span>
                                {selectedProjectId === project.id && <Icons.CheckIcon className="w-4 h-4 ml-auto text-primary-accent" />}
                            </a>
                        ))}
                    </div>
                    <div className="p-2 border-t border-light-border dark:border-dark-border">
                         <a
                            href="#"
                            onClick={(e) => { e.preventDefault(); handleNewProject(); }}
                            className="flex items-center gap-3 w-full text-left px-3 py-2 text-sm rounded-sm text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page"
                        >
                            <Icons.PlusIcon className="w-4 h-4" />
                            <span>Create new project</span>
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
};

export const ToolInterfaceView: React.FC<ToolInterfaceViewProps> = ({ 
    tool, 
    existingChatSession, 
    onBack, 
    projects, 
    onNewProject,
    onStartNewConversation // NEW: Receive function to start fresh conversation
}) => {
    // SIMPLIFIED STATE: Only manage current conversation state, no persistence
    const [messages, setMessages] = useState<Message[]>(() => {
        // Initialize from existing session if provided, otherwise start fresh
        return existingChatSession?.messages || [];
    });
    
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() => {
        // Calculate from existing messages if resuming
        if (existingChatSession?.messages) {
            const userMessages = existingChatSession.messages.filter(m => m.sender === 'user');
            return userMessages.length;
        }
        return 0;
    });
    
    const [answers, setAnswers] = useState<string[]>(() => {
        // Extract answers from existing messages if resuming
        if (existingChatSession?.messages) {
            return existingChatSession.messages
                .filter(m => m.sender === 'user')
                .map(m => m.text);
        }
        return [];
    });
    
    const [isComplete, setIsComplete] = useState(() => {
        // Determine if conversation is complete based on existing messages
        if (existingChatSession?.messages && existingChatSession.messages.length > 0) {
            const userMessages = existingChatSession.messages.filter(m => m.sender === 'user');
            return userMessages.length >= tool.questions.length || tool.questions.length === 0;
        }
        return false;
    });
    
    const [isThinking, setIsThinking] = useState(false);
    const [attachedFile, setAttachedFile] = useState<File | null>(null);

    // --- FIX: Removed redundant knowledgeBaseId state ---
    // const [knowledgeBaseId, setKnowledgeBaseId] = useState<string | null>(null);
    
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => {
        // Initialize from existing session, session storage (project context), or first project
        const sessionProjectId = sessionStorage.getItem('activeProjectId');
        return existingChatSession?.projectId || sessionProjectId || projects[0]?.id || null;
    });
    
    const [conversationMode, setConversationMode] = useState<'structured' | 'freeform'>(() => {
        // Determine mode based on existing conversation state
        if (existingChatSession?.messages && existingChatSession.messages.length > 0) {
            const userMessages = existingChatSession.messages.filter(m => m.sender === 'user');
            return userMessages.length >= tool.questions.length || tool.questions.length === 0 ? 'freeform' : 'structured';
        }
        return 'structured';
    });
    
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editorContent, setEditorContent] = useState('');
    const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
    const [isProcessingRequest, setIsProcessingRequest] = useState(false);
    
    const { getActiveClientProfile, setActiveClientProfileId } = useAuthStore();
    const clientProfiles = useAuthStore(state => state.profile?.preferences?.clientProfiles || EMPTY_PROFILES);

    const [selectedClientProfile, setSelectedClientProfile] = useState<ClientProfile | null>(() => {
        if (existingChatSession?.clientProfileId) {
            const resumedProfile = clientProfiles.find(p => p.id === existingChatSession.clientProfileId);
            if (resumedProfile) {
                Logger.info('STATE INIT: Resuming with client profile from chat session', {
                    component: 'ToolInterfaceView',
                    profileId: resumedProfile.id,
                    profileName: resumedProfile.name,
                    chatSessionId: existingChatSession.id
                });
                return resumedProfile;
            }
        }

        const globalActiveProfile = getActiveClientProfile();
        if (globalActiveProfile) {
            Logger.info('STATE INIT: Using global active client profile', {
                component: 'ToolInterfaceView',
                profileId: globalActiveProfile.id,
                profileName: globalActiveProfile.name
            });
            return globalActiveProfile;
        }

        Logger.info('STATE INIT: No client profile selected', {
            component: 'ToolInterfaceView'
        });
        return null;
    });
    
    useEffect(() => {
        const cleanup = () => {
            sessionStorage.removeItem('activeProjectId');
            sessionStorage.removeItem('activeClientProfile');
        };
        
        const timer = setTimeout(cleanup, 1000);
        return () => clearTimeout(timer);
    }, []);
    
    const { user } = useAuthStore();
    const api = SupabaseApiService.getInstance();
    const storageService = StorageService.getInstance();
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    const chatSessionId = existingChatSession?.id;
    
    const sortedQuestions = useMemo(() => 
        [...tool.questions].sort((a, b) => a.order - b.order), 
        [tool.questions]
    );

    useEffect(() => {
        if (messages.length > 0 || existingChatSession?.messages.length > 0) {
            Logger.info('GUARD: Skipping initialization - conversation already in progress', {
                component: 'ToolInterfaceView',
                toolId: tool.id,
                messageCount: messages.length,
                isExistingSession: !!existingChatSession,
                existingMessageCount: existingChatSession?.messages.length || 0
            });
            return;
        }
        
        Logger.info('INITIALIZATION: Starting fresh conversation with generic welcome', {
            component: 'ToolInterfaceView',
            toolId: tool.id,
            toolTitle: tool.title,
            questionCount: sortedQuestions.length,
            isNewChat: !existingChatSession,
            hasExistingMessages: !!existingChatSession?.messages.length
        });
        
        setIsThinking(true);
        
        setTimeout(() => {
            const firstQuestion = sortedQuestions[0];
            const welcomeMessage = firstQuestion 
                ? `Hello! I'm ready to help you with ${tool.title}. ${firstQuestion.label}`
                : `Hello! I'm ready to help you with ${tool.title}. How can I assist you today?`;
            
            setMessages([{
                id: 'init-message',
                sender: 'ai',
                text: welcomeMessage
            }]);
            
            if (sortedQuestions.length === 0) {
                setConversationMode('freeform');
                setIsComplete(true);
            }
            
            setIsThinking(false);
        }, 1000);
    }, [tool.id, sortedQuestions.length]);

    const handleClientProfileSelection = (profile: ClientProfile | null) => {
        Logger.info('PREFILL: Client profile selection triggered', {
            component: 'ToolInterfaceView',
            toolId: tool.id,
            profileId: profile?.id || null,
            profileName: profile?.name || 'None',
            currentMessageCount: messages.length,
            currentQuestionIndex,
            conversationMode,
            canPrefill: messages.length <= 1 && sortedQuestions.length > 0 && !!profile
        });
        
        if (messages.length <= 1 && sortedQuestions.length > 0 && profile) {
            Logger.info('PREFILL: Running prefill logic for selected profile', {
                component: 'ToolInterfaceView',
                toolId: tool.id,
                profileId: profile.id,
                profileName: profile.name,
                questionCount: sortedQuestions.length,
                currentMessageCount: messages.length,
                willReplacePreviousMessages: messages.length > 0
            });
            
            Logger.info('PREFILL: About to call prefillQuestionsFromClientProfile', {
                component: 'ToolInterfaceView',
                toolId: tool.id,
                profileId: profile.id,
                profileName: profile.name,
                questionCount: sortedQuestions.length,
                questions: sortedQuestions.map(q => ({ 
                    label: q.label.substring(0, 50) + (q.label.length > 50 ? '...' : ''), 
                    type: q.type, 
                    order: q.order 
                }))
            });
            
            const prefillResult = prefillQuestionsFromClientProfile(sortedQuestions, profile);
            
            Logger.info('PREFILL: prefillQuestionsFromClientProfile completed', {
                component: 'ToolInterfaceView',
                toolId: tool.id,
                profileId: profile.id,
                profileName: profile.name,
                hasPrefilledData: prefillResult.hasPrefilledData,
                prefilledCount: prefillResult.preFilledAnswers.length,
                nextQuestionIndex: prefillResult.nextQuestionIndex,
                prefilledQuestions: prefillResult.preFilledQuestions.map(q => q.substring(0, 30) + (q.length > 30 ? '...' : '')),
                prefilledAnswers: prefillResult.preFilledAnswers.map(a => a.substring(0, 30) + (a.length > 30 ? '...' : ''))
            });
            
            if (prefillResult.hasPrefilledData) {
                Logger.info('PREFILL: Creating context-aware welcome message', {
                    component: 'ToolInterfaceView',
                    toolId: tool.id,
                    profileId: profile.id,
                    prefilledCount: prefillResult.preFilledAnswers.length,
                    totalQuestions: sortedQuestions.length
                });
                
                const contextMessage = generateContextWelcomeMessage(
                    tool.title,
                    profile.name,
                    prefillResult.preFilledQuestions,
                    prefillResult.preFilledAnswers
                );
                
                setAnswers(prefillResult.preFilledAnswers);
                setCurrentQuestionIndex(prefillResult.nextQuestionIndex);
                
                let newMessages: Message[] = [{
                    id: 'context-message',
                    sender: 'ai',
                    text: contextMessage
                }];
                
                if (prefillResult.nextQuestionIndex < sortedQuestions.length) {
                    Logger.info('PREFILL: Partial prefill - asking next question', {
                        component: 'ToolInterfaceView',
                        toolId: tool.id,
                        nextQuestionIndex: prefillResult.nextQuestionIndex,
                        nextQuestionLabel: sortedQuestions[prefillResult.nextQuestionIndex]?.label
                    });
                    
                    const nextQuestion = sortedQuestions[prefillResult.nextQuestionIndex];
                    newMessages.push({
                        id: 'next-question',
                        sender: 'ai',
                        text: nextQuestion.label
                    });
                } else {
                    Logger.info('PREFILL: Complete prefill - entering freeform mode', {
                        component: 'ToolInterfaceView',
                        toolId: tool.id,
                        allQuestionsAnswered: true
                    });
                    
                    setConversationMode('freeform');
                    setIsComplete(true);
                    
                    const allPrefilledMessage = generateAllPrefilledMessage(
                        tool.title,
                        profile.name
                    );
                    
                    newMessages.push({
                        id: 'ready-message',
                        sender: 'ai',
                        text: allPrefilledMessage
                    });
                }
                
                setMessages(newMessages);
                
                Logger.info('PREFILL: Prefill completed successfully', {
                    component: 'ToolInterfaceView',
                    toolId: tool.id,
                    profileId: profile.id,
                    profileName: profile.name,
                    finalMessageCount: newMessages.length,
                    finalQuestionIndex: prefillResult.nextQuestionIndex,
                    newConversationMode: prefillResult.nextQuestionIndex >= sortedQuestions.length ? 'freeform' : 'structured',
                    replacedPreviousMessages: true
                });
            } else {
                Logger.info('PREFILL: No prefillable data found in profile', {
                    component: 'ToolInterfaceView',
                    toolId: tool.id,
                    profileId: profile.id,
                    profileName: profile.name,
                    questionCount: sortedQuestions.length,
                    reason: 'No matching fields found between questions and profile data'
                });
            }
        } else {
            Logger.info('PREFILL: Skipping prefill logic', {
                component: 'ToolInterfaceView',
                toolId: tool.id,
                profileId: profile?.id || null,
                profileName: profile?.name || 'None',
                currentMessageCount: messages.length,
                questionCount: sortedQuestions.length,
                reason: messages.length > 1 ? 'Chat already in progress' : 
                        sortedQuestions.length === 0 ? 'Tool has no questions' : 
                        !profile ? 'No profile selected' : 'Unknown'
            });
        }
    };

    const handleProfileSelectionAndUpdate = (profile: ClientProfile | null) => {
        Logger.info('HANDLER: Profile selection triggered - updating both local and global state', {
            component: 'ToolInterfaceView',
            toolId: tool.id,
            newProfileId: profile?.id || null,
            newProfileName: profile?.name || 'None',
            previousProfileId: selectedClientProfile?.id || null,
            previousProfileName: selectedClientProfile?.name || 'None',
            currentMessageCount: messages.length,
            willTriggerPrefill: messages.length <= 1 && sortedQuestions.length > 0 && !!profile
        });

        setActiveClientProfileId(profile?.id || null);
        setSelectedClientProfile(profile);
        handleClientProfileSelection(profile);

        Logger.info('HANDLER: Profile selection complete - both states synchronized', {
            component: 'ToolInterfaceView',
            localProfileId: profile?.id || null,
            globalProfileId: profile?.id || null
        });
    };
    
    useEffect(() => {
        if (messagesEndRef.current && messages.length > 0) {
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'end'
                });
            }, 100);
        }
    }, [messages]);

    const [sessionId, setSessionId] = useState<string | null>(() => existingChatSession?.id || null);

    useEffect(() => {
        const autoSave = async () => {
            if (!user || !messages.length || isThinking) return;

            const hasUserMessage = messages.some(m => m.sender === 'user');
            const hasAiMessage = messages.some(m => m.sender === 'ai');

            if (!hasUserMessage || !hasAiMessage) return;

            try {
                if (sessionId) {
                    // Update existing session
                    const result = await api.updateChatSession(sessionId, {
                        messages,
                        projectId: currentProjectId || undefined,
                        clientProfileId: selectedClientProfile?.id || null
                    });

                    if (result.success) {
                        Logger.info('Chat auto-saved successfully', {
                            component: 'ToolInterfaceView',
                            toolId: tool.id,
                            messageCount: messages.length,
                            projectId: currentProjectId
                        });
                    }
                } else {
                    // Create new session
                    const firstUserMessage = messages.find(m => m.sender === 'user');
                    const title = firstUserMessage?.text.substring(0, 50) || tool.title;

                    const result = await api.saveChatSession({
                        userId: user.id,
                        toolId: tool.id,
                        title,
                        messages,
                        projectId: currentProjectId || undefined,
                        clientProfileId: selectedClientProfile?.id || null
                    });

                    if (result.success && result.data) {
                        setSessionId(result.data.id);
                        Logger.info('New chat session created', {
                            component: 'ToolInterfaceView',
                            toolId: tool.id,
                            sessionId: result.data.id,
                            messageCount: messages.length
                        });
                    }
                }
            } catch (error) {
                Logger.error({
                    message: 'Failed to auto-save chat',
                    code: 'CHAT_AUTO_SAVE_ERROR',
                    details: error instanceof Error ? error.message : 'Unknown auto-save error',
                    timestamp: new Date().toISOString(),
                    correlationId: Logger.getCorrelationId(),
                    component: 'ToolInterfaceView',
                    severity: 'warn',
                }, {
                    toolId: tool.id,
                    messageCount: messages.length,
                });
            }
        };

        const timeoutId = setTimeout(autoSave, 2000);
        return () => clearTimeout(timeoutId);
    }, [messages, user, api, tool.id, currentProjectId, isThinking, sessionId, selectedClientProfile]);

    const handleSendMessage = async (text: string) => {
        Logger.userAction('send_chat_message', {
            component: 'ToolInterfaceView',
            toolId: tool.id,
            toolTitle: tool.title,
            messageLength: text.length,
            hasAttachment: !!attachedFile,
            questionIndex: currentQuestionIndex,
            conversationMode,
        });

        setIsProcessingRequest(true);
        let knowledgeBaseFileId: string | undefined = undefined;

        if (attachedFile && user) {
            try {
                const uploadResponse = await storageService.uploadKnowledgeBaseFile(attachedFile, user.id);

                if (uploadResponse.success && uploadResponse.data?.fileId) {
                    Logger.info('Knowledge base file uploaded successfully', {
                        component: 'ToolInterfaceView',
                        fileId: uploadResponse.data.fileId,
                        fileName: attachedFile.name
                    });
                    knowledgeBaseFileId = uploadResponse.data.fileId;

                    const systemMessage: Message = {
                        id: `system-${Date.now()}`,
                        sender: 'system',
                        text: `Knowledge base file "${attachedFile.name}" has been processed and added to the conversation context.`
                    };
                    setMessages(prev => [...prev, systemMessage]);

                } else {
                    Logger.warn('File upload may have succeeded but no file ID was returned', {
                        component: 'ToolInterfaceView',
                        response: uploadResponse
                    });
                }
            } catch (error: any) {
                Logger.error({
                    message: 'Failed to process knowledge base file',
                    code: 'FILE_PROCESSING_ERROR',
                    details: error instanceof Error ? error.message : 'Unknown file error',
                    timestamp: new Date().toISOString(),
                    correlationId: Logger.getCorrelationId(),
                    component: 'ToolInterfaceView',
                    severity: 'warn',
                }, {
                    fileName: attachedFile.name,
                    fileSize: attachedFile.size,
                });
            }
        }

        const userMessage: Message = {
            id: crypto.randomUUID(),
            sender: 'user',
            text,
            file: attachedFile ? { name: attachedFile.name, size: attachedFile.size } : undefined
        };
        setMessages(prev => [...prev, userMessage]);
        setAttachedFile(null);

        const newAnswers = [...answers, text];
        setAnswers(newAnswers);
        setCurrentQuestionIndex(prev => prev + 1);

        setIsThinking(true);
        setIsProcessingRequest(false);

        try {
            if (conversationMode === 'structured' && currentQuestionIndex + 1 < sortedQuestions.length) {
                setTimeout(() => {
                    const nextQuestion = sortedQuestions[currentQuestionIndex + 1];
                    const aiQuestion: Message = {
                        id: crypto.randomUUID(),
                        sender: 'ai',
                        text: nextQuestion.label
                    };
                    setMessages(prev => [...prev, aiQuestion]);
                    setIsThinking(false);
                }, 800);
            } else {
                if (conversationMode === 'structured' && !isComplete) {
                    setConversationMode('freeform');
                    setIsComplete(true);
                }

                const allMessages = [...messages, userMessage];

                const activeProfile = getActiveClientProfile();

                const response = await api.sendChatMessage(
                    tool.id,
                    allMessages,
                    knowledgeBaseFileId,
                    activeProfile || undefined
                );

                if (response.success && response.data) {
                    const finalAiResponse: Message = {
                        id: crypto.randomUUID(),
                        sender: 'ai',
                        text: response.data
                    };

                    setStreamingMessageId(finalAiResponse.id);
                    setMessages(prev => [...prev, finalAiResponse]);

                    Logger.info(`Chat response generated successfully (${conversationMode} mode)`, {
                        component: 'ToolInterfaceView',
                        toolId: tool.id,
                        conversationMode,
                        responseLength: response.data.length,
                        hadKnowledgeBase: !!knowledgeBaseFileId
                    });
                } else {
                    Logger.error({
                        message: response.error || 'AI response generation failed',
                        code: 'CHAT_AI_RESPONSE_ERROR',
                        timestamp: new Date().toISOString(),
                        correlationId: Logger.getCorrelationId(),
                        component: 'ToolInterfaceView',
                        severity: 'error',
                    }, {
                        toolId: tool.id,
                        questionIndex: currentQuestionIndex,
                    });

                    const errorMessage: Message = {
                        id: crypto.randomUUID(),
                        sender: 'ai',
                        text: 'I apologize, but I encountered an error generating your response. Please try again or contact support if the issue persists.'
                    };
                    setMessages(prev => [...prev, errorMessage]);
                }

                setIsThinking(false);
            }
        } catch (error: any) {
            console.error('Error sending message:', error);

            Logger.error({
                message: 'Unexpected error in chat flow',
                code: 'CHAT_FLOW_ERROR',
                details: error instanceof Error ? error.message : 'Unknown chat error',
                timestamp: new Date().toISOString(),
                correlationId: Logger.getCorrelationId(),
                component: 'ToolInterfaceView',
                severity: 'error',
            }, {
                toolId: tool.id,
                questionIndex: currentQuestionIndex,
                hasAttachment: !!attachedFile,
            });

            const errorMessage: Message = {
                id: crypto.randomUUID(),
                sender: 'ai',
                text: 'I apologize, but I encountered an error. Please try again.'
            };
            setMessages(prev => [...prev, errorMessage]);
            setIsThinking(false);
        }
    };

    const handleStreamComplete = () => {
        setStreamingMessageId(null);
    };

    const handleAddToEditor = (text: string) => {
        const cleanedText = cleanText(text);
        setEditorContent(prev => {
            const separator = prev.trim() ? '\n\n' : '';
            return prev + separator + cleanedText;
        });
        setIsEditorOpen(true);
    };

    return (
        <div className="h-full flex flex-col relative bg-light-bg-page dark:bg-[#212121]">
            <button
                onClick={() => setIsEditorOpen(true)}
                className="fixed top-1/2 right-0 -translate-y-1/2 bg-primary-accent text-text-on-accent px-3 py-6 rounded-l-lg shadow-lg hover:opacity-85 transition-all duration-200 z-50 flex flex-col items-center gap-2 text-sm font-medium"
                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
            >
                <span className="text-lg">✍️</span>
                <span>Editor</span>
            </button>

            <header className="flex-shrink-0 grid grid-cols-3 items-center gap-4 p-4 border-b border-light-border dark:border-gray-600 bg-light-bg-component/90 dark:bg-[rgba(33,33,33,0.9)] backdrop-blur-sm sticky top-0 z-10">
                <div className="justify-self-start flex items-center gap-4">
                    <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white">
                        <Icons.ArrowLeftIcon className="w-4 h-4" />
                        Back
                    </button>
                    <div className="h-6 w-px bg-light-border dark:bg-gray-600"></div>
                    <ProjectSelector
                        projects={projects}
                        selectedProjectId={currentProjectId}
                        onSelectProject={setCurrentProjectId}
                        onNewProject={onNewProject}
                    />
                    <ClientProfileSelector
                        selectedProfileId={selectedClientProfile?.id || null}
                        onSelectProfile={handleProfileSelectionAndUpdate}
                        className="min-w-[200px]"
                        label=""
                    />
                </div>
                <div className="justify-self-center">
                    <h2 className="font-serif text-xl font-bold text-light-text-primary dark:text-white truncate">{tool.title}</h2>
                </div>
                <div className="justify-self-end">
                    {onStartNewConversation && (
                        <button
                            onClick={() => onStartNewConversation(tool)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity"
                            title="Start a fresh conversation with this tool"
                        >
                            <Icons.PlusIcon className="w-4 h-4" />
                            New Conversation
                        </button>
                    )}
                </div>
            </header>

            <div className="flex-grow overflow-y-auto">
                <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-8">
                    {messages.map(msg => (
                        <div key={msg.id} className="mb-8 last:mb-4">
                            <ChatMessage 
                                message={msg}
                                onAddToEditor={handleAddToEditor}
                                isStreaming={streamingMessageId === msg.id}
                                onStreamComplete={handleStreamComplete}
                            />
                        </div>
                    ))}
                    {isThinking && <ThinkingIndicator conversationMode={conversationMode} isProcessingRequest={isProcessingRequest} />}
                    <div ref={messagesEndRef} className="h-1" />
                </div>
            </div>

            <div className="flex-shrink-0 p-4 bg-light-bg-component dark:bg-[#212121] border-t border-light-border dark:border-gray-600">
                <div className="max-w-3xl mx-auto">
                    {conversationMode === 'structured' && !isComplete && (
                        <p className="text-center text-sm text-light-text-tertiary dark:text-gray-400 mb-3">
                            Question {currentQuestionIndex + 1} of {sortedQuestions.length}
                        </p>
                    )}
                    <ChatInput 
                        onSendMessage={handleSendMessage} 
                        disabled={isThinking}
                        attachedFile={attachedFile}
                        setAttachedFile={setAttachedFile}
                        placeholder={isThinking ? "" : (conversationMode === 'freeform' ? "Ask for revisions, improvements, or continue the conversation..." : "Type your answer here...")}
                        isProcessingRequest={isProcessingRequest}
                    />
                    {conversationMode === 'freeform' && (
                        <p className="text-center text-xs text-light-text-tertiary dark:text-gray-400 mt-2 opacity-70">
                            Continue the conversation - ask for revisions, improvements, or new requests
                        </p>
                    )}
                </div>
            </div>

            <EditorPanel
                isOpen={isEditorOpen}
                onClose={() => setIsEditorOpen(false)}
                content={editorContent}
                onContentChange={setEditorContent}
            />
        </div>
    );
};

const ChatInput: React.FC<{
    onSendMessage: (text: string) => Promise<void>;
    disabled: boolean;
    attachedFile: File | null;
    setAttachedFile: (file: File | null) => void;
    placeholder?: string;
    isProcessingRequest?: boolean;
}> = ({ onSendMessage, disabled, attachedFile, setAttachedFile, placeholder = "Type your message here...", isProcessingRequest = false }) => {
    const [text, setText] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const storageService = StorageService.getInstance();

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [text]);
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            const file = event.target.files[0];
            const validation = storageService.validateFile(file);
            
            if (!validation.isValid) {
                Logger.error({
                    message: validation.error || 'File validation failed',
                    code: 'FILE_VALIDATION_ERROR',
                    timestamp: new Date().toISOString(),
                    correlationId: Logger.getCorrelationId(),
                    component: 'ChatInput',
                    severity: 'warn',
                }, {
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: file.type,
                });
                
                alert(validation.error);
                return;
            }
            
            setAttachedFile(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((text.trim() || attachedFile) && !disabled) {
            const payload = text.trim();
            setText('');
            onSendMessage(payload);
        }
    };
    
    return (
        <form onSubmit={handleSubmit} className="relative">
             <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden"
                accept=".pdf,.docx,.doc,.txt,.md"
            />
            <div className="flex flex-col text-left bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-lg p-2 shadow-sm dark:shadow-2xl">
                 <div className="flex items-end">
                    <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 mr-2"
                        title="Attach Knowledge Base file (PDF, DOCX, TXT, MD)"
                    >
                       <Icons.PaperclipIcon className="w-5 h-5 text-light-text-tertiary dark:text-dark-text-tertiary" />
                    </button>
                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey && !disabled) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                        }}
                        rows={1}
                        placeholder={disabled ? "" : placeholder}
                        className="prompt-input w-full border-none outline-none bg-transparent p-2 text-base text-light-text-primary dark:text-dark-text-primary font-medium resize-none leading-normal max-h-48 overflow-y-auto"
                        disabled={disabled}
                    />
                    <button type="submit" className="bg-primary-accent text-text-on-accent border-none rounded-md p-3 cursor-pointer flex items-center justify-center transition-opacity self-end flex-shrink-0 hover:opacity-85 disabled:opacity-50 disabled:cursor-not-allowed" disabled={(!text.trim() && !attachedFile) || disabled}>
                        <Icons.SendIcon className="w-5 h-5" />
                    </button>
                </div>
                 {attachedFile && (
                    <div className="flex items-center gap-2 p-2 mt-2 ml-12 border-t border-light-border dark:border-dark-border">
                        <Icons.FileTextIcon className="w-4 h-4 text-light-text-tertiary"/>
                        <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{attachedFile.name}</span>
                        <button type="button" onClick={() => setAttachedFile(null)} className="ml-auto p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10">
                            <Icons.XIcon className="w-4 h-4 text-light-text-tertiary"/>
                        </button>
                    </div>
                )}
            </div>
        </form>
    );
};

const ThinkingIndicator: React.FC<{ 
    conversationMode: 'structured' | 'freeform';
    isProcessingRequest?: boolean;
}> = ({ conversationMode, isProcessingRequest = false }) => (
    <div className="flex items-start gap-3">
        <Icons.ArtemoIcon className="w-8 h-8 flex-shrink-0" />
        <div className="p-4 rounded-lg bg-light-bg-component dark:bg-dark-bg-component mt-1 border border-primary-accent/20">
            <div className="flex items-center space-x-3 mb-3">
                <div className="flex space-x-1">
                    <div className="w-2.5 h-2.5 bg-primary-accent rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2.5 h-2.5 bg-primary-accent rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2.5 h-2.5 bg-primary-accent rounded-full animate-bounce"></div>
                </div>
                <div className="w-8 h-1 bg-gradient-to-r from-primary-accent via-primary-accent/50 to-transparent rounded-full animate-pulse"></div>
            </div>
            <p className="text-sm font-medium text-primary-accent">
                {isProcessingRequest 
                    ? 'Artemo is processing your request...'
                    : conversationMode === 'structured' 
                        ? 'Artemo is crafting your content...' 
                        : 'Artemo is thinking...'
                }
            </p>
        </div>
    </div>
);