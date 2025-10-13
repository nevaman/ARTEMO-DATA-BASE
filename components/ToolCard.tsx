import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DynamicTool } from '../types';
import { useCategories } from '../hooks/useCategories';
import { useUIStore } from '../stores/uiStore';
import { useAuthStore } from '../stores/authStore';
import { 
    StarIcon, 
    LockIcon,
    BoxIcon, 
    SettingsIcon, 
    EditIcon, 
    MailIcon, 
    FileTextIcon, 
    MicIcon, 
    ActivityIcon, 
    UsersIcon 
} from './Icons';

interface ToolCardProps {
    tool: DynamicTool;
}

export const ToolCard: React.FC<ToolCardProps> = ({ tool }) => {
    const navigate = useNavigate();
    const { categories } = useCategories();
    const { profile, isPro, isAdmin } = useAuthStore();
    const { favoriteTools, toggleFavorite, setToolForActivation, showProUpgradeModal, setShowProUpgradeModal } = useUIStore();
    const [categoryIcon, setCategoryIcon] = useState<{ name: string; color: string } | null>(null);
    
    const isFavorite = favoriteTools.includes(tool.id);
    const isProTool = tool.is_pro;
    const canAccess = !isProTool || isPro || isAdmin;
    const viewerRole = profile?.role ?? 'user';
    
    // Update category icon when categories change
    const updateCategoryIcon = useCallback(() => {
        const toolCategory = categories.find(cat => cat.name === tool.category);
        if (toolCategory) {
            setCategoryIcon({
                name: toolCategory.iconName || 'Settings',
                color: toolCategory.iconColor || 'text-blue-600'
            });
        } else {
            setCategoryIcon({ name: 'Settings', color: 'text-blue-600' });
        }
    }, [categories, tool.category]);

    useEffect(() => {
        updateCategoryIcon();
    }, [updateCategoryIcon]);

    // Handle category updates from admin panel
    const handleCategoryUpdate = useCallback((event: CustomEvent) => {
        const { updatedCategory } = event.detail;
        if (updatedCategory.name === tool.category) {
            setCategoryIcon({
                name: updatedCategory.iconName || 'Settings',
                color: updatedCategory.iconColor || 'text-blue-600'
            });
        }
    }, [tool.category]);

    useEffect(() => {
        const handleCategoryUpdateWrapper = (event: Event) => {
            handleCategoryUpdate(event as CustomEvent);
        };
        
        window.addEventListener('categoryUpdated', handleCategoryUpdateWrapper);
        return () => {
            window.removeEventListener('categoryUpdated', handleCategoryUpdateWrapper);
        };
    }, [handleCategoryUpdate]);
    
    // Get the appropriate icon component
    const getCategoryIcon = () => {
        if (!categoryIcon?.name) {
            return BoxIcon;
        }
        
        // Map icon names to actual icon components
        const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
            'Settings': SettingsIcon,
            'Box': BoxIcon,
            'Edit': EditIcon,
            'Mail': MailIcon,
            'File': FileTextIcon,
            'Mic': MicIcon,
            'Activity': ActivityIcon,
            'Users': UsersIcon,
        };
        
        return iconMap[categoryIcon.name] || BoxIcon;
    };
    
    const CategoryIcon = getCategoryIcon();
    const iconColor = categoryIcon?.color || 'text-primary-accent';
    
    const handleToolClick = () => {
        if (canAccess) {
            setToolForActivation(tool);
        } else {
            setShowProUpgradeModal(true);
        }
    };
    
    const handleFavoriteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        toggleFavorite(tool.id);
    };

    return (
        <a
            href="#"
            onClick={(e) => { e.preventDefault(); handleToolClick(); }}
            className="group relative bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border p-5 rounded-md no-underline flex flex-col gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:hover:shadow-2xl"
            title={tool.description}
        >
            <button
                onClick={handleFavoriteClick}
                className="absolute top-2 right-2 p-1 text-light-text-tertiary dark:text-dark-text-tertiary rounded-full hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page opacity-0 group-hover:opacity-100 transition-opacity z-10"
                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
                <StarIcon className={`w-5 h-5 ${isFavorite ? 'text-yellow-500' : ''}`} isFilled={isFavorite} />
            </button>
            <CategoryIcon className={`w-6 h-6 ${iconColor}`} />
            <span className="font-serif flex-grow font-bold text-light-text-primary dark:text-dark-text-primary text-lg pr-4">{tool.title}</span>
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-light-text-tertiary dark:text-dark-text-tertiary bg-light-bg-sidebar dark:bg-dark-bg-component py-1 px-2 rounded-sm self-start">{tool.category}</span>
                {tool.featured && (
                    <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 py-1 px-2 rounded-sm">Featured</span>
                )}
                {isProTool && (
                  <span className="text-xs font-bold text-accent-dark-blue dark:text-accent-light-blue bg-accent-light-blue/50 dark:bg-accent-dark-blue/20 py-1 px-2 rounded-sm">
                    PRO
                  </span>
                )}
            </div>
            {!canAccess && viewerRole === 'user' && (
                <div className="absolute inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                    <LockIcon className="w-8 h-8 text-white" />
                </div>
            )}
        </a>
    );
};