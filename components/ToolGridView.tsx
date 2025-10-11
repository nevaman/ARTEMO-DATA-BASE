
import React from 'react';
import type { DynamicTool } from '../types';
import { ToolCard } from './ToolCard';

interface ToolGridViewProps {
    title: string;
    tools: DynamicTool[];
    showNoResults?: boolean;
}

export const ToolGridView: React.FC<ToolGridViewProps> = ({ title, tools, showNoResults }) => {
    return (
        <div className="p-4 lg:p-6">
            <h2 className="font-serif text-2xl font-bold text-light-text-primary dark:text-dark-text-primary mb-5">{title}</h2>
            {showNoResults ? (
                 <div className="text-center py-12 text-light-text-tertiary dark:text-dark-text-tertiary">
                    <h3 className="text-lg font-semibold">No results found</h3>
                    <p>Try a different search term.</p>
                </div>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
                    {tools.map(tool => (
                        <ToolCard key={tool.id} tool={tool} />
                    ))}
                </div>
            )}
        </div>
    );
};