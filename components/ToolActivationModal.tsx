
import React, { useState } from 'react';
import { useCategories } from '../hooks/useCategories';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import type { DynamicTool } from '../types';
import * as Icons from './Icons';

interface ToolActivationModalProps {
    tool: DynamicTool | null;
    onClose: () => void;
    onStart: (tool: DynamicTool) => void;
    onSetDontShowAgain: (toolId: string, shouldAdd: boolean) => void;
}

export const ToolActivationModal: React.FC<ToolActivationModalProps> = ({ tool, onClose, onStart, onSetDontShowAgain }) => {
    const [dontShowAgain, setDontShowAgain] = useState(false);
    const { categories } = useCategories();
    const { isPro, isAdmin } = useAuthStore();
    const { setShowProUpgradeModal } = useUIStore();

    if (!tool) return null;

    const isProTool = tool.is_pro;
    const canAccess = !isProTool || isPro || isAdmin;

    // Get dynamic icon from category data
    const getCategoryIcon = () => {
        const categoryData = categories.find(cat => cat.name === tool.category);
        if (!categoryData?.iconName) {
            return Icons.BoxIcon;
        }
        
        // Map icon names to actual icon components
        const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
            'Settings': Icons.SettingsIcon,
            'Box': Icons.BoxIcon,
            'Edit': Icons.EditIcon,
            'Mail': Icons.MailIcon,
            'File': Icons.FileTextIcon,
            'Mic': Icons.MicIcon,
            'Activity': Icons.ActivityIcon,
            'Users': Icons.UsersIcon,
        };
        
        return iconMap[categoryData.iconName] || Icons.BoxIcon;
    };
    
    const Icon = getCategoryIcon();

    const handleStartClick = () => {
        if (!canAccess) {
            onClose();
            setShowProUpgradeModal(true);
            return;
        }

        if (dontShowAgain) {
            onSetDontShowAgain(tool.id, true);
        }
        onStart(tool);
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-md z-[1000] flex items-center justify-center p-4 transition-opacity animate-[fadeIn_0.2s_ease-out]"
            onClick={onClose}
        >
            <div
                className={`rounded-lg shadow-2xl w-full max-w-2xl transition-transform transform scale-100 animate-[scaleUp_0.2s_ease-out] text-center ${
                    isProTool
                    ? 'bg-gradient-to-br from-purple-50 via-fuchsia-50 to-indigo-50 dark:from-gray-900 dark:via-purple-900/40 dark:to-gray-900 border-2 border-purple-200 dark:border-purple-600/30'
                    : 'bg-light-bg-component dark:bg-dark-bg-component'
                }`}
                onClick={e => e.stopPropagation()}
            >
                <div className="p-8 lg:p-12">
                    <Icon className="w-16 h-16 text-primary-accent mx-auto mb-5" />
                    <h3 className="font-serif text-3xl font-bold text-light-text-primary dark:text-dark-text-primary mb-3">{tool.title}</h3>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6 text-lg leading-relaxed">{tool.description}</p>
                    <div className="mb-6">
                        <div className="flex items-center justify-center gap-4 text-sm text-light-text-tertiary dark:text-dark-text-tertiary">
                            {tool.questions.length > 0 && (
                                <span>{tool.questions.length} questions</span>
                            )}
                            {tool.featured && (
                                <span className="text-yellow-600 dark:text-yellow-400">• Featured</span>
                            )}
                            {isProTool && (
                                <span className="text-xs font-bold tracking-wider uppercase bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white py-1 px-2.5 rounded-full shadow-md">• Pro</span>
                            )}
                        </div>
                    </div>
                    <a href="#" className="text-primary-accent font-medium text-base hover:underline mb-8 inline-block">Watch tutorial</a>
                    
                    <button 
                        onClick={handleStartClick} 
                        className="w-full px-5 py-3 rounded-md text-lg font-medium bg-primary-accent text-text-on-accent hover:opacity-85 transition-opacity"
                    >
                        Start {tool.title}
                    </button>

                     <div className="mt-6 text-left">
                        <label className="flex items-center gap-2 cursor-pointer text-sm text-light-text-tertiary dark:text-dark-text-tertiary">
                            <input 
                                type="checkbox" 
                                checked={dontShowAgain}
                                onChange={(e) => setDontShowAgain(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 dark:bg-dark-bg-component text-primary-accent focus:ring-primary-accent"
                            />
                            Don't show this again for this tool
                        </label>
                    </div>
                </div>
                 <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full text-light-text-tertiary dark:text-dark-text-tertiary hover:bg-black/10 dark:hover:bg-white/10">
                    <Icons.XIcon className="w-6 h-6" />
                </button>
            </div>
             <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            `}</style>
        </div>
    );
};
