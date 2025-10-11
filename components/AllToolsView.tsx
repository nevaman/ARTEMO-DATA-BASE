import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { DynamicTool } from '../types';
import { useTools } from '../hooks/useTools';
import { useCategories } from '../hooks/useCategories';
import { useUIStore } from '../stores/uiStore';
import { ToolCard } from './ToolCard';
import { ChevronDownIcon, SearchIcon, BoxIcon, SettingsIcon, EditIcon, MailIcon, FileTextIcon, MicIcon, ActivityIcon, UsersIcon } from './Icons';

interface AllToolsViewProps {
    // No props needed - component manages its own state via URL
}

const CollapsibleCategory: React.FC<{
    category: string;
    tools: DynamicTool[];
    categories: any[];
}> = ({ category, tools, categories }) => {
    const [isOpen, setIsOpen] = useState(true);

    // Get category icon from admin settings
    const getCategoryIcon = () => {
        const categoryData = categories.find(cat => cat.name === category);
        if (!categoryData?.iconName) {
            return { icon: BoxIcon, color: 'text-primary-accent' };
        }
        
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
        
        return {
            icon: iconMap[categoryData.iconName] || BoxIcon,
            color: categoryData.iconColor || 'text-primary-accent'
        };
    };

    const { icon: CategoryIcon, color: iconColor } = getCategoryIcon();

    return (
        <div className="mb-6">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center py-3 px-4 bg-light-bg-sidebar dark:bg-dark-bg-component rounded-md transition-colors hover:bg-light-border dark:hover:bg-dark-border/20"
            >
                <div className="flex items-center gap-3">
                    <CategoryIcon className={`w-5 h-5 ${iconColor}`} />
                    <h3 className="font-serif text-xl font-bold text-light-text-primary dark:text-dark-text-primary">{category}</h3>
                </div>
                <ChevronDownIcon className={`w-5 h-5 text-light-text-secondary dark:text-dark-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tools.map(tool => (
                        <ToolCard key={tool.id} tool={tool} />
                    ))}
                </div>
            )}
        </div>
    );
};

export const AllToolsView: React.FC<AllToolsViewProps> = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const searchTerm = searchParams.get('search') || '';
    const categoryFilter = searchParams.get('category') || '';
    
    const { tools, loading, error } = useTools();
    const { categories, allCategories } = useCategories();

    const handleSearchChange = (value: string) => {
        const newParams = new URLSearchParams(searchParams);
        if (value.trim()) {
            newParams.set('search', value);
        } else {
            newParams.delete('search');
        }
        setSearchParams(newParams);
    };

    const filteredTools = useMemo(() => {
        if (!searchTerm.trim()) return tools;
        let filtered = tools;
        
        if (categoryFilter) {
            filtered = tools.filter(tool => tool.category === categoryFilter);
        }
        
        const searchLower = searchTerm.toLowerCase();
        return filtered.filter(tool => 
            tool.title.toLowerCase().includes(searchLower) ||
            tool.description.toLowerCase().includes(searchLower) ||
            tool.category.toLowerCase().includes(searchLower)
        );
    }, [tools, searchTerm, categoryFilter]);

    const groupedTools = useMemo(() => {
        let toolsToGroup = categoryFilter 
            ? tools.filter(tool => tool.category === categoryFilter)
            : filteredTools;
            
        const groups: Record<string, DynamicTool[]> = {};
        for (const tool of toolsToGroup) {
            if (!groups[tool.category]) {
                groups[tool.category] = [];
            }
            groups[tool.category]!.push(tool);
        }
        return groups;
    }, [tools, filteredTools, categoryFilter]);
    
    const orderedCategories = Object.keys(groupedTools).filter(cat => groupedTools[cat] && groupedTools[cat]!.length > 0);

    if (loading) {
        return (
            <div className="p-4 lg:p-6 max-w-5xl mx-auto w-full">
                <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-accent mx-auto mb-4"></div>
                        <p className="text-light-text-secondary dark:text-dark-text-secondary">Loading tools...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 lg:p-6 max-w-5xl mx-auto w-full">
                <div className="flex items-center justify-center py-20">
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
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-6 max-w-5xl mx-auto w-full">
            <div className="flex justify-between items-center mb-8">
                <h2 className="font-serif text-3xl font-bold text-light-text-primary dark:text-dark-text-primary">
                    {categoryFilter ? categoryFilter + ' Tools' : 'All Tools'}
                </h2>
                {!categoryFilter && (
                    <div className="relative w-80">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-light-text-tertiary dark:text-dark-text-tertiary" />
                        <input
                            type="text"
                            placeholder="Search tools..."
                            value={searchTerm}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm rounded-sm border border-light-border dark:border-dark-border bg-light-bg-component dark:bg-dark-bg-component text-light-text-secondary dark:text-dark-text-secondary focus:ring-2 focus:ring-primary-accent focus:outline-none"
                        />
                    </div>
                )}
            </div>
            
            {tools.length === 0 ? (
                <div className="text-center py-20 bg-light-bg-sidebar dark:bg-dark-bg-component rounded-lg border border-light-border dark:border-dark-border">
                    <BoxIcon className="w-12 h-12 text-light-text-tertiary dark:text-dark-text-tertiary mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">No tools available</h3>
                    <p className="text-light-text-tertiary dark:text-dark-text-tertiary mt-1">
                        {categories.length === 0 
                            ? 'Create categories and tools in the admin panel to get started.'
                            : 'Create tools in the admin panel to get started.'
                        }
                    </p>
                </div>
            ) : ((searchTerm.trim() && filteredTools.length === 0) || (categoryFilter && orderedCategories.length === 0)) ? (
                <div className="text-center py-12 text-light-text-tertiary dark:text-dark-text-tertiary">
                    <h3 className="text-lg font-semibold">No results found</h3>
                    <p>{categoryFilter ? 'No tools in this category yet.' : 'Try a different search term or check back later for new tools.'}</p>
                </div>
            ) : (
                <div>
                    {orderedCategories.map(category => (
                        <CollapsibleCategory
                            key={category}
                            category={category}
                            tools={groupedTools[category]!}
                            categories={allCategories}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};