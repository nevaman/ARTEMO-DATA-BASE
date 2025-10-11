import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import type { ClientProfile } from '../types';
import { BriefcaseIcon, ChevronDownIcon, CheckIcon, PlusIcon } from './Icons';

interface ClientProfileSelectorProps {
  selectedProfileId: string | null;
  onSelectProfile: (profile: ClientProfile | null) => void;
  onCreateNew?: () => void;
  className?: string;
  label?: string;
  useGlobalState?: boolean;
}

export const ClientProfileSelector: React.FC<ClientProfileSelectorProps> = ({
  selectedProfileId,
  onSelectProfile,
  onCreateNew,
  className = '',
  label = 'Profile',
  useGlobalState = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
// Fetches the global state value 'activeClientProfileId'
const { 
  getClientProfiles, 
  activeClientProfileId, 
  setActiveClientProfileId 
} = useAuthStore();
const clientProfiles = getClientProfiles();
  
// Decides which ID to use based on the component's mode
const resolvedProfileId = useGlobalState ? activeClientProfileId : selectedProfileId;

// The display is now based on the CORRECT source of truth
const selectedProfile = resolvedProfileId
  ? clientProfiles.find(p => p.id === resolvedProfileId)
  : null;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

const handleSelect = (profile: ClientProfile | null) => {
  if (useGlobalState) {
    setActiveClientProfileId(profile?.id || null);
  } else if (onSelectProfile) { 
    // Now only calls onSelectProfile if it exists
    onSelectProfile(profile);
  }
  setIsOpen(false);
};

  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew();
    }
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
        {label}
      </label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page transition-colors"
      >
        <div className="flex items-center gap-2">
          <BriefcaseIcon className="w-4 h-4 text-light-text-tertiary dark:text-dark-text-tertiary" />
          <span className="truncate">
            {selectedProfile ? selectedProfile.name : 'None'}
          </span>
        </div>
        <ChevronDownIcon className={`w-4 h-4 text-light-text-tertiary dark:text-dark-text-tertiary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-md shadow-lg z-20 max-h-60 overflow-y-auto">
          <div className="p-2">
            {/* None option */}
            <button
              onClick={() => handleSelect(null)}
              className={`flex items-center justify-between w-full text-left px-3 py-2 text-sm rounded-sm transition-colors ${
                !selectedProfile 
                  ? 'bg-primary-accent/20 text-light-text-primary dark:text-dark-text-primary' 
                  : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page'
              }`}
            >
              <span>None</span>
              {!selectedProfile && <CheckIcon className="w-4 h-4 text-primary-accent" />}
            </button>
            
            {/* Existing profiles */}
            {clientProfiles.map(profile => (
              <button
                key={profile.id}
                onClick={() => handleSelect(profile)}
                className={`flex items-center justify-between w-full text-left px-3 py-2 text-sm rounded-sm transition-colors ${
                  selectedProfile?.id === profile.id 
                    ? 'bg-primary-accent/20 text-light-text-primary dark:text-dark-text-primary' 
                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page'
                }`}
              >
                <div className="flex items-center gap-2 flex-grow min-w-0">
                  <BriefcaseIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{profile.name}</span>
                </div>
                {selectedProfile?.id === profile.id && <CheckIcon className="w-4 h-4 text-primary-accent flex-shrink-0" />}
              </button>
            ))}
            
            {/* Create new option */}
            {onCreateNew && (
              <>
                <div className="h-px bg-light-border dark:border-dark-border my-2"></div>
                <button
                  onClick={handleCreateNew}
                  className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-primary-accent hover:bg-primary-accent/10 rounded-sm transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>Create new profile</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};