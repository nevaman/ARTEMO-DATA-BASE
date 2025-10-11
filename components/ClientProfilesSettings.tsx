import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useConfirmDialog } from '../contexts/DialogContext';
import { useNotifications } from '../contexts/NotificationContext';
import type { ClientProfile } from '../types';
import { PlusIcon, EditIcon, TrashIcon, BriefcaseIcon, CheckIcon } from './Icons';

export const ClientProfilesSettings: React.FC = () => {
  const notifications = useNotifications();
  const { profile, saveClientProfile, deleteClientProfile, setDefaultClientProfile, getClientProfiles, getDefaultClientProfile } = useAuthStore();
  const dialog = useConfirmDialog();
  
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ClientProfile | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    audience: '',
    language: '',
    tone: '',
    sample: '',
  });

  const clientProfiles = getClientProfiles();
  const defaultProfile = getDefaultClientProfile();

  const handleCreate = () => {
    setEditingProfile(null);
    setFormData({ name: '', audience: '', language: '', tone: '', sample: '' });
    setMessage(null);
    setModalOpen(true);
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
    setMessage(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.audience.trim() || !formData.language.trim() || !formData.tone.trim()) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    setIsSaving(true);
    setMessage(null);
    
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
      setModalOpen(false);
    } catch (error) {
      console.error('Failed to save client profile:', error);
      notifications.error('Failed to save client profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (profileId: string) => {
    const confirmed = await dialog.confirm({
      title: 'Delete Client Profile',
      message: 'Are you sure you want to delete this client profile? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger'
    });

    if (confirmed) {
      try {
        await deleteClientProfile(profileId);
        const profile = clientProfiles.find(p => p.id === profileId);
        notifications.success(
          `Client profile "${profile?.name || 'Unknown'}" deleted successfully`, 
          'Profile Deleted'
        );
      } catch (error) {
        console.error('Failed to delete client profile:', error);
        notifications.error('Failed to delete client profile. Please try again.');
      }
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-2">
            Profiles
          </h3>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            Save profile information to automatically personalize AI responses and project context
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity"
        >
          <PlusIcon className="w-4 h-4" />
          Add Profile
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-md border ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {clientProfiles.length > 0 ? (
        <div className="space-y-4">
          {clientProfiles.map((clientProfile) => (
            <div
              key={clientProfile.id}
              className="bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-lg p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-grow">
                  <div className="w-12 h-12 bg-primary-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <BriefcaseIcon className="w-6 h-6 text-primary-accent" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                        {clientProfile.name}
                      </h4>
                      {defaultProfile?.id === clientProfile.id && (
                        <span className="px-2 py-1 bg-primary-accent/20 text-primary-accent text-xs font-medium rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="font-medium text-light-text-secondary dark:text-dark-text-secondary">Audience:</span>
                        <p className="text-light-text-tertiary dark:text-dark-text-tertiary">{clientProfile.audience}</p>
                      </div>
                      <div>
                        <span className="font-medium text-light-text-secondary dark:text-dark-text-secondary">Language:</span>
                        <p className="text-light-text-tertiary dark:text-dark-text-tertiary">{clientProfile.language}</p>
                      </div>
                      <div>
                        <span className="font-medium text-light-text-secondary dark:text-dark-text-secondary">Tone:</span>
                        <p className="text-light-text-tertiary dark:text-dark-text-tertiary">{clientProfile.tone}</p>
                      </div>
                      <div className="md:col-span-2">
                        <span className="font-medium text-light-text-secondary dark:text-dark-text-secondary">Sample:</span>
                        <p className="text-light-text-tertiary dark:text-dark-text-tertiary italic">
                          "{clientProfile.sample}"
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {defaultProfile?.id !== clientProfile.id ? (
                    <button
                      onClick={() => handleSetDefault(clientProfile.id)}
                      className="px-3 py-1 text-xs font-medium text-primary-accent border border-primary-accent rounded-md hover:bg-primary-accent/10 transition-colors"
                    >
                      Set Default
                    </button>
                  ) : (
                    <button
                      onClick={handleClearDefault}
                      className="px-3 py-1 text-xs font-medium text-light-text-tertiary dark:text-dark-text-tertiary border border-light-border dark:border-dark-border rounded-md hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page transition-colors"
                    >
                      Clear Default
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(clientProfile)}
                    className="p-2 text-light-text-tertiary dark:text-dark-text-tertiary hover:text-primary-accent hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page rounded-md transition-colors"
                  >
                    <EditIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(clientProfile.id)}
                    className="p-2 text-light-text-tertiary dark:text-dark-text-tertiary hover:text-red-500 hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page rounded-md transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-light-bg-sidebar dark:bg-dark-bg-component rounded-lg border border-light-border dark:border-dark-border">
          <BriefcaseIcon className="w-12 h-12 text-light-text-tertiary dark:text-dark-text-tertiary mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">No profiles yet</h3>
          <p className="text-light-text-tertiary dark:text-dark-text-tertiary mt-1 mb-4">
            Create profiles to personalize AI responses and project context
          </p>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity"
          >
            Create Your First Profile
          </button>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-light-bg-component dark:bg-dark-bg-component rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-light-border dark:border-dark-border">
              <h3 className="font-serif text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                {editingProfile ? 'Edit Profile' : 'Create Profile'}
              </h3>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                    Language *
                  </label>
                  <input
                    type="text"
                    value={formData.language}
                    onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                    className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
                    placeholder="e.g., English, Spanish, French"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                    Tone *
                  </label>
                  <input
                    type="text"
                    value={formData.tone}
                    onChange={(e) => setFormData(prev => ({ ...prev, tone: e.target.value }))}
                    className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
                    placeholder="e.g., Professional, Casual, Witty"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                  Writing Sample
                </label>
                <textarea
                  value={formData.sample}
                  onChange={(e) => setFormData(prev => ({ ...prev, sample: e.target.value }))}
                  rows={4}
                  className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none resize-vertical"
                  placeholder="Paste a short sample of the client's preferred writing style to help AI match their voice..."
                />
                <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary mt-1">
                  Optional: Provide a sample to help AI match the client's writing style
                </p>
              </div>

              {message && (
                <div className={`p-3 rounded-md border ${
                  message.type === 'success' 
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                }`}>
                  {message.text}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-light-border dark:border-dark-border flex justify-end gap-3">
              <button
                onClick={() => setModalOpen(false)}
                disabled={isSaving}
                className="px-4 py-2 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !formData.name.trim() || !formData.audience.trim() || !formData.language.trim() || !formData.tone.trim()}
                className="px-6 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-text-on-accent"></div>
                )}
                {isSaving ? 'Saving...' : (editingProfile ? 'Update Profile' : 'Create Profile')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};