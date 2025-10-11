import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { AuthService } from '../services/auth';
import { useNotifications } from '../contexts/NotificationContext';
import { ArrowLeftIcon, SettingsIcon, UserIcon, BellIcon, EyeIcon, EyeOffIcon, BriefcaseIcon } from './Icons';
import { ClientProfilesSettings } from './ClientProfilesSettings';

interface SettingsViewProps {
  onBack: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onBack }) => {
  const notifications = useNotifications();
  const { profile, updateProfile } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  
  // Profile settings
  const [profileData, setProfileData] = useState({
    fullName: profile?.full_name || '',
    organization: profile?.organization || '',
  });

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState({
    emailUpdates: true,
    toolRecommendations: true,
    weeklyDigest: false,
    marketingEmails: false,
  });

  // Privacy settings
  const [privacy, setPrivacy] = useState({
    profileVisibility: 'private',
    shareUsageData: false,
    allowAnalytics: true,
  });

  const authService = AuthService.getInstance();

  const handleSaveProfile = async () => {
    setIsLoading(true);
    
    try {
      // In a real implementation, you'd call an API to update the profile
      updateProfile({
        full_name: profileData.fullName,
        organization: profileData.organization,
      });
      
      notifications.success('Profile updated successfully!', 'Profile Saved');
    } catch (error) {
      notifications.error('Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    setIsLoading(true);
    
    try {
      // Save notification preferences
      updateProfile({
        preferences: {
          ...profile?.preferences,
          notifications,
        },
      });
      
      notifications.success('Notification preferences saved!', 'Preferences Updated');
    } catch (error) {
      notifications.error('Failed to save preferences. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePrivacy = async () => {
    setIsLoading(true);
    
    try {
      // Save privacy settings
      updateProfile({
        preferences: {
          ...profile?.preferences,
          privacy,
        },
      });
      
      notifications.success('Privacy settings updated!', 'Privacy Updated');
    } catch (error) {
      notifications.error('Failed to update privacy settings. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: <UserIcon className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <BellIcon className="w-4 h-4" /> },
    { id: 'privacy', label: 'Privacy', icon: <EyeIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={onBack} 
          className="flex items-center gap-2 text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back
        </button>
        <div className="h-6 w-px bg-light-border dark:border-dark-border"></div>
        <div className="flex items-center gap-3">
          <SettingsIcon className="w-6 h-6 text-primary-accent" />
          <h2 className="font-serif text-3xl font-bold text-light-text-primary dark:text-dark-text-primary">
            Settings
          </h2>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:w-64 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-accent text-text-on-accent'
                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-component dark:hover:bg-dark-bg-component hover:text-light-text-primary dark:hover:text-dark-text-primary'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-lg p-6">
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-4">
                    Profile Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={profileData.fullName}
                        onChange={(e) => setProfileData(prev => ({ ...prev, fullName: e.target.value }))}
                        className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                        Organization
                      </label>
                      <input
                        type="text"
                        value={profileData.organization}
                        onChange={(e) => setProfileData(prev => ({ ...prev, organization: e.target.value }))}
                        className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
                        placeholder="Enter your organization (optional)"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={profile?.id || 'Not available'}
                        disabled
                        className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-sidebar dark:bg-dark-bg-sidebar text-light-text-tertiary dark:text-dark-text-tertiary"
                      />
                      <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary mt-1">
                        Email cannot be changed. Contact support if you need to update your email.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                        Role
                      </label>
                      <input
                        type="text"
                        value={profile?.role === 'admin' ? 'Administrator' : 'User'}
                        disabled
                        className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-sidebar dark:bg-dark-bg-sidebar text-light-text-tertiary dark:text-dark-text-tertiary"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end mt-6">
                    <button
                      onClick={handleSaveProfile}
                      disabled={isLoading}
                      className="px-6 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isLoading && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-text-on-accent"></div>
                      )}
                      {isLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-4">
                    Notification Preferences
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-light-border dark:border-dark-border rounded-md">
                      <div>
                        <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary">
                          Email Updates
                        </h4>
                        <p className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary">
                          Receive important updates about your account and new features
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationSettings.emailUpdates}
                          onChange={(e) => setNotificationSettings(prev => ({ ...prev, emailUpdates: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-accent/20 dark:peer-focus:ring-primary-accent/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-accent"></div>
                      </label>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 border border-light-border dark:border-dark-border rounded-md">
                      <div>
                        <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary">
                          Tool Recommendations
                        </h4>
                        <p className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary">
                          Get personalized tool suggestions based on your usage
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationSettings.toolRecommendations}
                          onChange={(e) => setNotificationSettings(prev => ({ ...prev, toolRecommendations: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-accent/20 dark:peer-focus:ring-primary-accent/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-accent"></div>
                      </label>
                    </div>

                  </div>
                  <div className="flex justify-end mt-6">
                    <button
                      onClick={handleSaveNotifications}
                      disabled={isLoading}
                      className="px-6 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isLoading && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-text-on-accent"></div>
                      )}
                      {isLoading ? 'Saving...' : 'Save Preferences'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-4">
                    Privacy & Data
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-light-border dark:border-dark-border rounded-md">
                      <div>
                        <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary">
                          Share Usage Data
                        </h4>
                        <p className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary">
                          Help improve Artemo by sharing anonymous usage statistics
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={privacy.shareUsageData}
                          onChange={(e) => setPrivacy(prev => ({ ...prev, shareUsageData: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-accent/20 dark:peer-focus:ring-primary-accent/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-accent"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-light-border dark:border-dark-border rounded-md">
                      <div>
                        <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary">
                          Analytics & Tracking
                        </h4>
                        <p className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary">
                          Allow analytics to help us improve your experience
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={privacy.allowAnalytics}
                          onChange={(e) => setPrivacy(prev => ({ ...prev, allowAnalytics: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-accent/20 dark:peer-focus:ring-primary-accent/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-accent"></div>
                      </label>
                    </div>
                  </div>
                  <div className="flex justify-end mt-6">
                    <button
                      onClick={handleSavePrivacy}
                      disabled={isLoading}
                      className="px-6 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isLoading && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-text-on-accent"></div>
                      )}
                      {isLoading ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};