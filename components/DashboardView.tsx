import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DynamicTool } from '../types';
import { useTools } from '../hooks/useTools';
import { useUIStore } from '../stores/uiStore';
import { useAuthStore } from '../stores/authStore';
import { VectorSearchService, type SimilarTool } from '../services/vectorSearchService';
import { ToolCard } from './ToolCard';
import { SendIcon, XIcon } from './Icons';
import { VectorSearchStatus } from './VectorSearchStatus';

interface DashboardViewProps {
    // No props needed - component manages its own state
}

export const DashboardView: React.FC<DashboardViewProps> = () => {
    const navigate = useNavigate();
    const [prompt, setPrompt] = useState('persuasive email for a new product launch');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [recommendedTool, setRecommendedTool] = useState<DynamicTool | null>(null);
    const [analysisResult, setAnalysisResult] = useState<string>('');
    const [tokensSaved, setTokensSaved] = useState<number>(0);
    const [similarTools, setSimilarTools] = useState<SimilarTool[]>([]);
    const [recommendationSource, setRecommendationSource] = useState<'local' | 'supabase' | null>(null);
    const [provenance, setProvenance] = useState('');
    const { tools, featuredTools, loading, error, dataSource } = useTools();
    const { setToolForActivation, setShowProUpgradeModal } = useUIStore();
    const { isPro, isAdmin } = useAuthStore();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);
    const vectorService = VectorSearchService.getInstance();
    const datasetLabel = dataSource === 'supabase' ? 'Supabase catalogue' : 'Local static catalogue';

    // Listen for recommended tool selection from project detail view
    useEffect(() => {
        const handleRecommendedToolSelected = (event: CustomEvent) => {
            const { tool } = event.detail;
            setRecommendedTool(tool);
            setAnalysisResult('This tool was recommended based on your project requirements.');
            // Clear the hash
            window.location.hash = '';
        };
        
        window.addEventListener('recommendedToolSelected', handleRecommendedToolSelected as EventListener);
        return () => {
            window.removeEventListener('recommendedToolSelected', handleRecommendedToolSelected as EventListener);
        };
    }, []);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [prompt]);

    // ✨ STEP 3: CREATE WATCHER & SCROLL
    useEffect(() => {
        if (resultsRef.current && (recommendedTool || analysisResult)) {
            resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [recommendedTool, analysisResult]);

    const analyzePromptAndRecommendTool = async (userPrompt: string) => {
        if (!userPrompt.trim()) {
            setAnalysisResult('Please tell us what you want to create so we can recommend a tool.');
            return;
        }

        setIsAnalyzing(true);
        setRecommendedTool(null);
        setAnalysisResult('');
        setTokensSaved(0);
        setSimilarTools([]);
        setRecommendationSource(null);
        setProvenance('');

        // Clear any existing conversation state when starting fresh analysis
        try {
            const keys = Object.keys(localStorage);
            const conversationKeys = keys.filter(key => key.startsWith('conversation-'));
            conversationKeys.forEach(key => {
                localStorage.removeItem(key);
            });
            console.log('Cleared existing conversation states for fresh analysis');
        } catch (error) {
            console.error('Failed to clear conversation states:', error);
        }
        
        try {
            const response = await vectorService.getOptimizedToolRecommendation(userPrompt);

            if (response.success && response.data) {
                const { recommendedTool: foundTool, analysis, tokensSaved: saved, similarTools: related, source, provenance: provenanceLabel } = response.data;

                setTokensSaved(saved ?? 0);
                setAnalysisResult(analysis);
                setSimilarTools(related ?? []);
                setRecommendationSource(source);
                setProvenance(provenanceLabel ?? '');

                if (foundTool) {
                    setRecommendedTool(foundTool);
                } else {
                    setRecommendedTool(null);
                }
            } else {
                setAnalysisResult(response.error || 'AI recommendation service is temporarily unavailable.');
                setRecommendationSource(null);
            }
        } catch (error) {
            console.error('Failed to analyze prompt:', error);
            setAnalysisResult('AI recommendation service is temporarily unavailable. Please browse our tool catalogue or try again later.');
            setRecommendationSource(null);
        } finally {
            setIsAnalyzing(false);
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
    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-accent mx-auto mb-4"></div>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">Loading tools...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <p className="text-red-600 dark:text-red-400 mb-4">Error loading tools: {error}</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-col h-full">
                {/* Hero Section */}
                <section className="relative flex flex-col items-center justify-center flex-grow p-4 sm:p-6 bg-light-bg-sidebar dark:bg-dark-bg-page min-h-[60vh] sm:min-h-[70vh]">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,255,179,0.1),transparent_70%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(0,255,179,0.08),transparent_70%)]"></div>
                    <div className="relative w-full max-w-4xl text-center px-2">
                        <h1 className="font-serif text-2xl sm:text-3xl lg:text-5xl font-bold text-light-text-primary dark:text-dark-text-primary mb-6 sm:mb-8 leading-tight">What do you want to create today?</h1>
                        <div className="flex flex-col sm:flex-row items-start text-left bg-light-bg-component dark:bg-black/20 border border-light-border dark:border-white/20 rounded-md p-1 sm:pl-4 shadow-lg">
                            <span className="text-base sm:text-lg text-primary-accent font-medium pt-3 flex-shrink-0 px-3 sm:px-0">I want to create a&nbsp;</span>
                            <textarea
                                ref={textareaRef}
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
                                    <SendIcon className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                        <p className="mt-4 text-xs sm:text-sm text-light-text-tertiary dark:text-dark-text-tertiary max-w-2xl mx-auto px-2">
                            <span className="font-semibold">Tip:</span> The more details you provide, the better the result. For example: <span className="italic">"a witty tweet about the challenges of remote work"</span>
                        </p>
                    </div>
                    
                    {/* AI Analysis Results - Integrated into Hero Section */}
                    {(isAnalyzing || recommendedTool || analysisResult) && (
                        <div className="relative w-full max-w-4xl mx-auto px-2 mt-8">
                            <div className="bg-light-bg-component/95 dark:bg-black/40 border border-light-border/50 dark:border-white/20 rounded-lg p-6 shadow-lg backdrop-blur-sm">
                                {isAnalyzing ? (
                                    <div className="text-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-accent mx-auto mb-4"></div>
                                        <p className="text-light-text-secondary dark:text-dark-text-secondary">
                                            Analyzing your request and finding the perfect tool...
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <h3 className="font-serif text-xl font-bold text-light-text-primary dark:text-dark-text-primary mb-4">
                                            AI Recommendation
                                        </h3>

                                        {analysisResult && (
                                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4 whitespace-pre-line">
                                                {analysisResult}
                                            </p>
                                        )}

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
                                                            <SendIcon className="w-5 h-5 text-primary-accent" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                                                                Recommended: {recommendedTool.title}
                                                            </h4>
                                                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                                                {recommendedTool.category}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">
                                                        {recommendedTool.description}
                                                    </p>
                                                    <button
                                                        onClick={() => {
                                                            const isProTool = recommendedTool.is_pro;
                                                            const canAccess = !isProTool || isPro || isAdmin;

                                                            if (canAccess) {
                                                                setToolForActivation(recommendedTool);
                                                            } else {
                                                                setShowProUpgradeModal(true);
                                                            }
                                                        }}
                                                        className="w-full px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity font-medium"
                                                    >
                                                        Use This Tool
                                                    </button>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </section>

                {/* Content Below Hero */}
                <div className="p-3 sm:p-4 lg:p-6 pb-6 sm:pb-8 bg-light-bg-page dark:bg-dark-bg-page space-y-8">
                    <div className="max-w-4xl mx-auto px-2">
                        <h2 className="font-serif text-xl sm:text-2xl font-bold text-light-text-primary dark:text-dark-text-primary mb-4 sm:mb-5">Featured Tools</h2>
                        {featuredTools.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                {featuredTools.map(tool => (
                                    <ToolCard key={tool.id} tool={tool} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-light-text-tertiary dark:text-dark-text-tertiary">
                                <p>No featured tools available at the moment.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <InfoBanner />
        </>
    );
};

const InfoBanner: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [dontShowAgain, setDontShowAgain] = useState(false);

    useEffect(() => {
        try {
            const dismissed = localStorage.getItem('infoBannerDismissed');
            if (!dismissed) {
                const timer = setTimeout(() => {
                    setIsOpen(true);
                    setIsMounted(true);
                }, 500);
                return () => clearTimeout(timer);
            }
        } catch (error) {
            console.error("Could not access localStorage", error);
        }
    }, []);

    const handleClose = () => {
        setIsOpen(false);
        if (dontShowAgain) {
            try {
                localStorage.setItem('infoBannerDismissed', 'true');
            } catch (error) {
                console.error("Could not access localStorage", error);
            }
        }
    };

    if (!isMounted) return null;

    return (
        <>
            <div className={`fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-[1000] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={handleClose}></div>
            <div className={`fixed top-0 right-0 h-full w-full max-w-sm bg-light-bg-component dark:bg-dark-bg-component border-l border-light-border dark:border-dark-border shadow-2xl z-[1001] p-6 flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex justify-between items-center mb-6">
                    <h4 className="font-serif text-lg sm:text-xl font-bold text-light-text-primary dark:text-dark-text-primary">Start Here</h4>
                    <button onClick={handleClose} className="p-1 rounded-full text-light-text-tertiary dark:text-dark-text-tertiary hover:bg-black/10 dark:hover:bg-white/10">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>
                <div className="flex-grow overflow-y-auto -mr-3 pr-5 space-y-3 text-sm sm:text-base text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                    <p>Read the <a href="#" className="text-primary-accent font-medium hover:underline">Artemo User Guide</a>. It's updated frequently, so check it often.</p>
                    <p>Use our tools to create amazing copy for your business or clients. Find all tools in the left-hand navigation bar or in the All Tools section below.</p>
                    <p>Join our <a href="#" className="text-primary-accent font-medium hover:underline">community</a> to discuss and get help from hundreds of Artemo users who are making money and growing their businesses daily.</p>
                    <div>
                        <h5 className="font-semibold text-light-text-primary dark:text-dark-text-primary mt-4 mb-2 uppercase tracking-wider text-sm">IMPORTANT NOTICE</h5>
                        <p>For questions, contact support at <a href="mailto:hello@artemo.ai" className="text-primary-accent font-medium hover:underline">hello@artemo.ai</a>.</p>
                    </div>
                </div>
                <div className="flex-shrink-0 pt-6 border-t border-light-border dark:border-dark-border">
                       <label className="flex items-center gap-3 cursor-pointer text-base font-medium text-light-text-primary dark:text-dark-text-primary bg-primary-accent/10 p-3 rounded-md border border-primary-accent/30">
                            <input
                                type="checkbox" 
                                checked={dontShowAgain}
                                onChange={(e) => setDontShowAgain(e.target.checked)}
                                className="h-5 w-5 rounded border-primary-accent/50 dark:border-primary-accent/50 bg-light-bg-component dark:bg-dark-bg-component text-primary-accent focus:ring-primary-accent focus:ring-2"
                            />
                            Don't show this again
                        </label>
                </div>
            </div>
        </>
    );
};