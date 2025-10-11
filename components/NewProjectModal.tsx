



import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import type { ToolCategory } from '../types';
import type { ClientProfile } from '../types';
import { XIcon } from './Icons';
import { ClientProfileSelector } from './ClientProfileSelector';

interface NewProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (projectName: string, color: string, clientProfile?: ClientProfile) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose, onCreate }) => {
    const [projectName, setProjectName] = useState('');
    const [selectedColor, setSelectedColor] = useState('#008F6B');
    const [selectedClientProfile, setSelectedClientProfile] = useState<ClientProfile | null>(null);
    
    const { getDefaultClientProfile } = useAuthStore();

    const colorOptions = [
        { name: 'Teal', value: '#008F6B' },
        { name: 'Blue', value: '#3B82F6' },
        { name: 'Purple', value: '#8B5CF6' },
        { name: 'Pink', value: '#EC4899' },
        { name: 'Red', value: '#EF4444' },
        { name: 'Orange', value: '#F97316' },
        { name: 'Yellow', value: '#EAB308' },
        { name: 'Green', value: '#22C55E' },
        { name: 'Indigo', value: '#6366F1' },
        { name: 'Gray', value: '#6B7280' },
        { name: 'Emerald', value: '#10B981' },
        { name: 'Cyan', value: '#06B6D4' },
    ];

    // Set default client profile when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setSelectedClientProfile(null);
        }
    }, [isOpen]);

    const handleCreate = () => {
        onCreate(projectName || `Untitled Project`, selectedColor, selectedClientProfile || undefined);
        setProjectName('');
        setSelectedColor('#008F6B');
        setSelectedClientProfile(null);
    };

    const handleClose = () => {
        setProjectName('');
        setSelectedColor('#008F6B');
        setSelectedClientProfile(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/40 dark:bg-black/50 z-[1000] flex items-center justify-center p-4 transition-opacity"
            onClick={handleClose}
        >
            <div
                className="bg-light-bg-component dark:bg-dark-bg-component rounded-lg shadow-lg w-full max-w-lg transition-transform transform scale-100"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 lg:p-6 border-b border-light-border dark:border-dark-border flex justify-between items-center">
                    <h3 className="font-serif text-xl font-bold text-light-text-primary dark:text-dark-text-primary">Create New Project</h3>
                    <button onClick={handleClose} className="text-light-text-tertiary dark:text-dark-text-tertiary hover:text-light-text-primary dark:hover:text-dark-text-primary">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-6">
                    <div className="mb-6">
                        <label htmlFor="project-name-input" className="block font-medium text-light-text-primary dark:text-dark-text-primary mb-2 text-base">Project Name</label>
                        <input
                            type="text"
                            id="project-name-input"
                            value={projectName}
                            onChange={e => setProjectName(e.target.value)}
                            className="w-full p-2.5 bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-sm text-light-text-primary dark:text-dark-text-primary text-base focus:border-primary-accent focus:ring-2 focus:ring-primary-accent/20 outline-none"
                            placeholder="e.g., Q4 Email Campaign"
                        />
                    </div>
                    <div>
                        <label className="block font-medium text-light-text-primary dark:text-dark-text-primary mb-2 text-base">Project Color</label>
                        <div className="grid grid-cols-6 gap-2">
                            {colorOptions.map(color => (
                                <button
                                    key={color.value}
                                    type="button"
                                    onClick={() => setSelectedColor(color.value)}
                                    className={`relative w-8 h-8 rounded-md border-2 transition-all duration-200 hover:scale-110 ${
                                        selectedColor === color.value 
                                            ? 'border-gray-800 dark:border-white shadow-lg' 
                                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                                    }`}
                                    style={{ backgroundColor: color.value }}
                                    title={color.name}
                                >
                                    {selectedColor === color.value && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <svg className="w-4 h-4 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="mt-6">
                        <ClientProfileSelector
                            selectedProfileId={selectedClientProfile?.id || null}
                            onSelectProfile={setSelectedClientProfile}
                            label="Associate with Profile"
                        />
                        <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary mt-1">
                            Optional: Link this project to a specific profile for context
                        </p>
                    </div>
                </div>
                <div className="p-4 lg:p-6 border-t border-light-border dark:border-dark-border flex justify-end gap-3">
                    <button onClick={handleClose} className="px-5 py-2 rounded-sm text-base font-medium bg-light-bg-sidebar dark:bg-dark-bg-component border border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary hover:opacity-85">Cancel</button>
                    <button onClick={handleCreate} className="px-5 py-2 rounded-sm text-base font-medium bg-primary-accent text-text-on-accent hover:opacity-85">Create Project</button>
                </div>
            </div>
        </div>
    );
};