import React, { useState, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useConfirmationDialog } from '../hooks/useConfirmationDialog';
import { useNotifications } from '../contexts/NotificationContext';
import type { ClientProfile } from '../types';
import { PlusIcon, EditIcon, TrashIcon, BriefcaseIcon, CheckIcon, SearchIcon, StarIcon, XIcon } from './Icons';

export const ClientProfilesView: React.FC = () => {
  const confirmDialog = useConfirmationDialog();
  const notifications = useNotifications();
  const { profile, saveClientProfile, deleteClientProfile, setDefaultClientProfile, getClientProfiles, getDefaultClientProfile } = useAuthStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ClientProfile | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    audience: '',
    language: 'English',
    tone: '',
    sample: '',
  });

  const clientProfiles = getClientProfiles();
  const defaultProfile = getDefaultClientProfile();

  // Filter profiles based on search term
  const filteredProfiles = useMemo(() => {
    if (!searchTerm.trim()) return clientProfiles;
    const searchLower = searchTerm.toLowerCase();
    return clientProfiles.filter(profile => 
      profile.name.toLowerCase().includes(searchLower) ||
      profile.audience.toLowerCase().includes(searchLower) ||
      profile.tone.toLowerCase().includes(searchLower) ||
      profile.language.toLowerCase().includes(searchLower)
    );
  }, [clientProfiles, searchTerm]);

  const handleCreateNew = () => {
    setEditingProfile(null);
    setFormData({
      name: '',
      audience: '',
      language: 'English',
      tone: '',
      sample: '',
    });
    setIsPanelOpen(true);
  };

  const handleEdit = (clientProfile: ClientProfile) => {
    setEditingProfile(clientProfile);
    setFormData({
      name: clientProfile.name,
      audience: clientProfile.audience,
      language: clientProfile.language,
      tone: clientProfile.tone,
      sample: clientProfile.sample,
    });
    setIsPanelOpen(true);
  };

  const handleClosePanel = () => {
    setIsPanelOpen(false);
    setEditingProfile(null);
    setFormData({
      name: '',
      audience: '',
      language: 'English',
      tone: '',
      sample: '',
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.audience.trim() || !formData.language.trim() || !formData.tone.trim()) {
      notifications.error('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    
    try {
      const profileData: ClientProfile = {
        id: editingProfile?.id || crypto.randomUUID(),
        name: formData.name.trim(),
        audience: formData.audience.trim(),
        language: formData.language.trim(),
        tone: formData.tone.trim(),
        sample: formData.sample.trim(),
      };

      await saveClientProfile(profileData);
      
      notifications.success(
        `Client profile "${profileData.name}" ${editingProfile ? 'updated' : 'created'} successfully`,
        editingProfile ? 'Profile Updated' : 'Profile Created'
      );

      handleClosePanel();
    } catch (error) {
      console.error('Failed to save client profile:', error);
      notifications.error('Failed to save client profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (profileId: string) => {
    const profile = clientProfiles.find(p => p.id === profileId);
    if (!profile) return;

    const confirmed = await confirmDialog.confirmDelete(profile.name, 'client profile');
    if (!confirmed) return;

    try {
      await deleteClientProfile(profileId);
      notifications.success(`Client profile "${profile.name}" deleted successfully`, 'Profile Deleted');
    } catch (error) {
      console.error('Failed to delete client profile:', error);
      notifications.error('Failed to delete client profile. Please try again.');
    }
  };

  const handleSetDefault = async (profileId: string) => {
    const profile = clientProfiles.find(p => p.id === profileId);
    if (!profile) return;

    try {
      await setDefaultClientProfile(profileId);
      notifications.success(`"${profile.name}" set as default client profile`, 'Default Updated');
    } catch (error) {
      console.error('Failed to set default client profile:', error);
      notifications.error('Failed to update default profile. Please try again.');
    }
  };

  const handleClearDefault = async () => {
    try {
      await setDefaultClientProfile(null);
      notifications.success('Default client profile cleared', 'Default Cleared');
    } catch (error) {
      console.error('Failed to clear default client profile:', error);
      notifications.error('Failed to clear default profile. Please try again.');
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto w-full relative">
      {/* Backdrop for slide-in panel */}
      {isPanelOpen && (
        <div 
          className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={handleClosePanel}
        />
      )}

      {/* Page Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-primary-accent/20 to-primary-accent/10 rounded-xl border border-primary-accent/20">
            <BriefcaseIcon className="w-6 h-6 text-primary-accent" />
          </div>
          <div>
            <h2 className="font-serif text-3xl font-bold text-light-text-primary dark:text-dark-text-primary">
              Profiles
            </h2>
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              Manage different profiles to personalize AI responses for your projects
            </p>
          </div>
        </div>
        <button
          onClick={handleCreateNew}
          className="flex items-center gap-2 px-6 py-3 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity font-medium shadow-sm"
        >
          <PlusIcon className="w-5 h-5" />
          Create New Profile
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-light-text-tertiary dark:text-dark-text-tertiary" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search profiles..."
            className="w-full pl-10 pr-4 py-3 text-sm border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
          />
        </div>
      </div>

      {/* Data Table */}
      {filteredProfiles.length > 0 ? (
        <div className="bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-light-bg-sidebar dark:bg-dark-bg-sidebar">
                <tr>
                  <th className="text-left p-4 font-medium text-light-text-primary dark:text-dark-text-primary">
                    Client Name
                  </th>
                  <th className="text-left p-4 font-medium text-light-text-primary dark:text-dark-text-primary">
                    Target Audience
                  </th>
                  <th className="text-left p-4 font-medium text-light-text-primary dark:text-dark-text-primary">
                    Language
                  </th>
                  <th className="text-left p-4 font-medium text-light-text-primary dark:text-dark-text-primary">
                    Tone
                  </th>
                  <th className="text-left p-4 font-medium text-light-text-primary dark:text-dark-text-primary">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.map((clientProfile) => (
                  <tr 
                    key={clientProfile.id} 
                    className="border-t border-light-border dark:border-dark-border hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <BriefcaseIcon className="w-5 h-5 text-primary-accent" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                            {clientProfile.name}
                          </span>
                          {defaultProfile?.id === clientProfile.id && (
                            <StarIcon className="w-4 h-4 text-yellow-500" isFilled />
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-light-text-secondary dark:text-dark-text-secondary line-clamp-2 max-w-xs">
                        {clientProfile.audience}
                      </p>
                    </td>
                    <td className="p-4">
                      <span className="px-3 py-1 bg-light-bg-sidebar dark:bg-dark-bg-component rounded-full text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                        {clientProfile.language}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="px-3 py-1 bg-light-bg-sidebar dark:bg-dark-bg-component rounded-full text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                        {clientProfile.tone}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {defaultProfile?.id !== clientProfile.id && (
                          <button
                            onClick={() => handleSetDefault(clientProfile.id)}
                            className="p-2 text-light-text-tertiary dark:text-dark-text-tertiary hover:text-yellow-500 hover:bg-light-bg-page dark:hover:bg-dark-bg-component rounded-md transition-colors"
                            title="Set as default"
                          >
                            <StarIcon className="w-4 h-4" />
                          </button>
                        )}
                        {defaultProfile?.id === clientProfile.id && (
                          <button
                            onClick={handleClearDefault}
                            className="p-2 text-yellow-500 hover:text-light-text-tertiary dark:hover:text-dark-text-tertiary hover:bg-light-bg-page dark:hover:bg-dark-bg-component rounded-md transition-colors"
                            title="Clear default"
                          >
                            <StarIcon className="w-4 h-4" isFilled />
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(clientProfile)}
                          className="p-2 text-light-text-tertiary dark:text-dark-text-tertiary hover:text-primary-accent hover:bg-light-bg-page dark:hover:bg-dark-bg-component rounded-md transition-colors"
                          title="Edit profile"
                        >
                          <EditIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(clientProfile.id)}
                          className="p-2 text-light-text-tertiary dark:text-dark-text-tertiary hover:text-red-500 hover:bg-light-bg-page dark:hover:bg-dark-bg-component rounded-md transition-colors"
                          title="Delete profile"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : searchTerm.trim() ? (
        /* No Search Results */
        <div className="text-center py-20 bg-light-bg-component dark:bg-dark-bg-component rounded-lg border border-light-border dark:border-dark-border">
          <SearchIcon className="w-12 h-12 text-light-text-tertiary dark:text-dark-text-tertiary mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">No profiles found</h3>
          <p className="text-light-text-tertiary dark:text-dark-text-tertiary mt-1">
            No profiles match "{searchTerm}". Try different keywords.
          </p>
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-20 bg-light-bg-component dark:bg-dark-bg-component rounded-lg border border-light-border dark:border-dark-border">
          <div className="flex items-center justify-center w-24 h-24 bg-gradient-to-br from-primary-accent/20 to-primary-accent/10 rounded-2xl border border-primary-accent/20 mx-auto mb-6">
            <BriefcaseIcon className="w-12 h-12 text-primary-accent" />
          </div>
          <h3 className="font-serif text-xl font-bold text-light-text-primary dark:text-dark-text-primary mb-3">
            No profiles yet
          </h3>
          <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6 max-w-md mx-auto leading-relaxed">
            Create a profile to personalize AI responses for your target audience. Each profile helps AI understand unique voice and requirements.
          </p>
          <button
            onClick={handleCreateNew}
            className="px-6 py-3 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity font-medium"
          >
            Create Your First Profile
          </button>
        </div>
      )}

      {/* Slide-In Editing Panel */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-2xl bg-light-bg-component dark:bg-dark-bg-component border-l border-light-border dark:border-dark-border shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${
        isPanelOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Panel Header */}
        <div className="flex items-center justify-between p-6 border-b border-light-border dark:border-dark-border bg-light-bg-sidebar dark:bg-dark-bg-sidebar">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-accent/10 rounded-lg flex items-center justify-center">
              <BriefcaseIcon className="w-5 h-5 text-primary-accent" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                {editingProfile ? 'Edit Profile' : 'Create New Profile'}
              </h3>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                {editingProfile ? 'Update the profile information below' : 'Fill in the details to create a new client profile'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClosePanel}
            className="p-2 rounded-md text-light-text-tertiary dark:text-dark-text-tertiary hover:bg-light-bg-component dark:hover:bg-dark-bg-component transition-colors"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                  Profile Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
                  placeholder="e.g., Acme Corp, John Smith, Personal Brand"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                  Language *
                </label>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                  className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
                  required
                >
                  <option value="">Select language...</option>
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                  <option value="Italian">Italian</option>
                  <option value="Portuguese">Portuguese</option>
                  <option value="Dutch">Dutch</option>
                  <option value="Japanese">Japanese</option>
                  <option value="Chinese">Chinese</option>
                  <option value="Korean">Korean</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                Target Audience *
              </label>
              <textarea
                value={formData.audience}
                onChange={(e) => setFormData(prev => ({ ...prev, audience: e.target.value }))}
                rows={3}
                className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none resize-vertical"
                placeholder="e.g., Small business owners aged 25-45 who struggle with digital marketing"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                Tone & Voice *
              </label>
              <input
                type="text"
                value={formData.tone}
                onChange={(e) => setFormData(prev => ({ ...prev, tone: e.target.value }))}
                className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
                placeholder="e.g., Professional, Casual, Witty, Authoritative, Friendly"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                Writing Sample
              </label>
              <textarea
                value={formData.sample}
                onChange={(e) => setFormData(prev => ({ ...prev, sample: e.target.value }))}
                rows={5}
                className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none resize-vertical"
                placeholder="Paste a short sample of the client's preferred writing style to help AI match their voice..."
              />
              <p className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary mt-2">
                Optional: Provide a sample to help AI match the client's writing style and preferences
              </p>
            </div>

            {/* Default Profile Information */}
            {editingProfile && defaultProfile?.id === editingProfile.id && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <StarIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400" isFilled />
                  <span className="font-medium text-yellow-800 dark:text-yellow-200">
                    This is your default profile
                  </span>
                </div>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  This profile will be automatically selected for new projects and AI conversations.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Panel Footer */}
        <div className="p-6 border-t border-light-border dark:border-dark-border bg-light-bg-sidebar dark:bg-dark-bg-sidebar">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {editingProfile && defaultProfile?.id !== editingProfile.id && (
                <button
                  onClick={() => handleSetDefault(editingProfile.id)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-accent border border-primary-accent rounded-md hover:bg-primary-accent/10 transition-colors"
                >
                  <StarIcon className="w-4 h-4" />
                  Set as Default
                </button>
              )}
              {editingProfile && defaultProfile?.id === editingProfile.id && (
                <button
                  onClick={handleClearDefault}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-light-text-tertiary dark:text-dark-text-tertiary border border-light-border dark:border-dark-border rounded-md hover:bg-light-bg-page dark:hover:bg-dark-bg-component transition-colors"
                >
                  <StarIcon className="w-4 h-4" />
                  Clear Default
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleClosePanel}
                disabled={isSaving}
                className="px-6 py-2 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !formData.name.trim() || !formData.audience.trim() || !formData.language.trim() || !formData.tone.trim()}
                className="px-8 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
              >
                {isSaving && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-text-on-accent"></div>
                )}
                {isSaving ? 'Saving...' : (editingProfile ? 'Save Changes' : 'Create Profile')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};