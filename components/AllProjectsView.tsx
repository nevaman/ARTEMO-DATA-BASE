
import React, { useState, useEffect, useRef } from 'react';
import type { Project } from '../types';
import { PlusIcon, FolderIcon, MoreHorizontalIcon, EditIcon, TrashIcon } from './Icons';

const ActionMenu: React.FC<{ onRename: () => void; onDelete: () => void; }> = ({ onRename, onDelete }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
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
            <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); setIsOpen(!isOpen); }} className="p-1 rounded-full text-light-text-tertiary dark:text-dark-text-tertiary hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page">
                <MoreHorizontalIcon className="w-4 h-4" />
            </button>
            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-32 bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-md shadow-lg z-10 py-1">
                    <button onClick={(e) => { e.stopPropagation(); onRename(); setIsOpen(false); }} className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page">
                        <EditIcon className="w-3.5 h-3.5" /> Rename
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); setIsOpen(false); }} className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm text-red-600 dark:text-red-500 hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page">
                        <TrashIcon className="w-3.5 h-3.5" /> Delete
                    </button>
                </div>
            )}
        </div>
    );
};


const ProjectCard: React.FC<{ 
    project: Project,
    onOpenRenameModal: (project: Project) => void;
    onDeleteProject: (projectId: string) => void;
    onViewProjectDetail: (project: Project) => void;
}> = ({ project, onOpenRenameModal, onDeleteProject, onViewProjectDetail }) => {
    return (
        <div
            onClick={() => onViewProjectDetail(project)}
            className="group relative bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border p-5 rounded-md no-underline flex flex-col gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:hover:shadow-2xl cursor-pointer"
        >
             <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <ActionMenu 
                    onRename={() => onOpenRenameModal(project)}
                    onDelete={() => onDeleteProject(project.id)}
                />
            </div>
            <div 
                className="w-6 h-6 rounded-md flex items-center justify-center"
                style={{ backgroundColor: project.color }}
            >
                <FolderIcon className="w-4 h-4 text-white" />
            </div>
            <span className="font-serif flex-grow font-bold text-light-text-primary dark:text-dark-text-primary text-lg pr-4">{project.name}</span>
            <div className="mt-auto pt-3">
                <div 
                    className="inline-block w-3 h-3 rounded-full border border-white/20"
                    style={{ backgroundColor: project.color }}
                    title="Project color"
                />
            </div>
        </div>
    );
};

import { useNotifications } from '../contexts/NotificationContext';

const ProjectCardSkeleton: React.FC = () => (
    <div className="bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border p-5 rounded-md flex flex-col gap-3 animate-pulse">
        <div className="w-6 h-6 rounded-md bg-light-bg-sidebar dark:bg-dark-bg-page"></div>
        <div className="h-6 w-3/4 bg-light-bg-sidebar dark:bg-dark-bg-page rounded-md"></div>
        <div className="mt-auto pt-3">
            <div className="w-3 h-3 rounded-full bg-light-bg-sidebar dark:bg-dark-bg-page"></div>
        </div>
    </div>
);

const AllProjectsSkeleton: React.FC = () => (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto w-full">
        <div className="flex justify-between items-center mb-8 animate-pulse">
            <div className="h-9 w-48 bg-light-bg-sidebar dark:bg-dark-bg-component rounded-md"></div>
            <div className="h-11 w-36 bg-light-bg-sidebar dark:bg-dark-bg-component rounded-md"></div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {[...Array(6)].map((_, i) => <ProjectCardSkeleton key={i} />)}
        </div>
    </div>
);

interface AllProjectsViewProps {
    projects: Project[];
    loading: boolean;
    onNewProject: () => void;
    onUpdateProject: (projectId: string, updates: Partial<Project>) => Promise<any>;
    onDeleteProject: (projectId: string) => void;
    onViewProjectDetail: (project: Project) => void;
}

export const AllProjectsView: React.FC<AllProjectsViewProps> = ({ projects, loading, onNewProject, onUpdateProject, onDeleteProject, onViewProjectDetail }) => {
    const [projectToRename, setProjectToRename] = useState<Project | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const notifications = useNotifications();

    const handleOpenRenameModal = (project: Project) => {
        setProjectToRename(project);
        setRenameValue(project.name);
    };

    const handleRenameProject = async () => {
        if (projectToRename && renameValue.trim()) {
            try {
                await onUpdateProject(projectToRename.id, { name: renameValue.trim() });
                // The notification for success is already in the useProjects hook
                setProjectToRename(null);
                setRenameValue('');
            } catch (error) {
                // The notification for error is already in the useProjects hook
                // We could add more specific handling here if needed
            }
        }
    };

    if (loading) {
        return <AllProjectsSkeleton />;
    }

    return (
        <div className="p-4 lg:p-6 max-w-5xl mx-auto w-full">
            <div className="flex justify-between items-center mb-8">
                <h2 className="font-serif text-3xl font-bold text-light-text-primary dark:text-dark-text-primary">All Projects</h2>
                <button
                    onClick={onNewProject}
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-sm border-none text-base font-medium cursor-pointer bg-primary-accent text-text-on-accent hover:opacity-85 transition-opacity"
                >
                    <PlusIcon className="w-4 h-4" />
                    <span>New Project</span>
                </button>
            </div>
            {projects.length > 0 ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                    {projects.map(project => (
                        <ProjectCard 
                            key={project.id} 
                            project={project}
                            onOpenRenameModal={handleOpenRenameModal}
                            onDeleteProject={onDeleteProject}
                            onViewProjectDetail={onViewProjectDetail}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-light-bg-sidebar dark:bg-dark-bg-component rounded-lg border border-light-border dark:border-dark-border">
                    <FolderIcon className="w-12 h-12 text-light-text-tertiary dark:text-dark-text-tertiary mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">No projects yet</h3>
                    <p className="text-light-text-tertiary dark:text-dark-text-tertiary mt-1">Click "New Project" to get started.</p>
                </div>
            )}

            {/* Rename Modal */}
            {projectToRename && (
                <div className="fixed inset-0 bg-black/40 dark:bg-black/50 z-[1001] flex items-center justify-center p-4" onClick={() => setProjectToRename(null)}>
                    <div className="bg-light-bg-component dark:bg-dark-bg-component rounded-lg shadow-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-light-border dark:border-dark-border flex justify-between items-center">
                            <h3 className="font-serif text-lg font-bold text-light-text-primary dark:text-dark-text-primary">Rename Project</h3>
                            <button onClick={() => setProjectToRename(null)} className="text-light-text-tertiary dark:text-dark-text-tertiary hover:text-light-text-primary dark:hover:text-dark-text-primary">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-4">
                            <label htmlFor="rename-input" className="block font-medium text-light-text-primary dark:text-dark-text-primary mb-2">Project Name</label>
                            <input
                                id="rename-input"
                                type="text"
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                className="w-full p-2.5 bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-sm text-light-text-primary dark:text-dark-text-primary focus:border-primary-accent focus:ring-2 focus:ring-primary-accent/20 outline-none"
                                onKeyDown={e => e.key === 'Enter' && handleRenameProject()}
                                autoFocus
                            />
                        </div>
                        <div className="p-4 border-t border-light-border dark:border-dark-border flex justify-end gap-3">
                            <button onClick={() => setProjectToRename(null)} className="px-4 py-2 rounded-sm bg-light-bg-sidebar dark:bg-dark-bg-component border border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary hover:opacity-85">Cancel</button>
                            <button onClick={handleRenameProject} className="px-4 py-2 rounded-sm bg-primary-accent text-text-on-accent hover:opacity-85">Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
