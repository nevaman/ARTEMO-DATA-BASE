import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { useNotifications } from '../contexts/NotificationContext';
import {
  ArrowLeftIcon,
  SettingsIcon,
  UserIcon,
  BellIcon,
  EyeIcon,
  LockIcon,
} from './Icons';

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
  });

  // Privacy settings
  const [privacy, setPrivacy] = useState({
    shareUsageData: false,
    allowAnalytics: true,
  });

  // Change Password state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const MIN_PASSWORD_LENGTH = 8;

  const handleSaveProfile = async () => {
    setIsLoading(true);
    try {
      updateProfile({
        full_name: profileData.fullName,
        organization: profileData.organization,
      });
      notifications.success('Profile updated successfully', 'Saved');
    } catch {
      notifications.error('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    setIsLoading(true);
    try {
      updateProfile({
        preferences: {
          ...profile?.preferences,
          notifications: notificationSettings,
        },
      });
      notifications.success('Notification preferences saved');
    } catch {
      notifications.error('Failed to save preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePrivacy = async () => {
    setIsLoading(true);
    try {
      updateProfile({
        preferences: {
          ...profile?.preferences,
          privacy,
        },
      });
      notifications.success('Privacy settings updated');
    } catch {
      notifications.error('Failed to update privacy settings');
    } finally {
      setIsLoading(false);
    }
  };

  // Change Password handler
  const handleChangePassword = async () => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      notifications.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (password !== confirmPassword) {
      notifications.error('Passwords do not match');
      return;
    }

    try {
      setIsLoading(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      notifications.success('Password changed successfully', 'Password Updated');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      notifications.error(err.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: <UserIcon className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <BellIcon className="w-4 h-4" /> },
    { id: 'privacy', label: 'Privacy', icon: <EyeIcon className="w-4 h-4" /> },
    { id: 'set-password', label: 'Change Password', icon: <LockIcon className="w-4 h-4" /> },
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
        <div className="lg:w-64 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
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

        <div className="flex-1">
          <div className="bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-lg p-6">
            {activeTab === 'profile' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Profile Information</h3>
                <input
                  className="w-full p-3 border rounded mb-4"
                  value={profileData.fullName}
                  onChange={(e) =>
                    setProfileData((p) => ({ ...p, fullName: e.target.value }))
                  }
                  placeholder="Full Name"
                />
                <input
                  className="w-full p-3 border rounded mb-4"
                  value={profileData.organization}
                  onChange={(e) =>
                    setProfileData((p) => ({ ...p, organization: e.target.value }))
                  }
                  placeholder="Organization"
                />
                <button
                  onClick={handleSaveProfile}
                  disabled={isLoading}
                  className="px-6 py-2 bg-primary-accent text-text-on-accent rounded-md"
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Notifications</h3>
                <label className="flex justify-between mb-4">
                  <span>Email Updates</span>
                  <input
                    type="checkbox"
                    checked={notificationSettings.emailUpdates}
                    onChange={(e) =>
                      setNotificationSettings((p) => ({
                        ...p,
                        emailUpdates: e.target.checked,
                      }))
                    }
                  />
                </label>
                <label className="flex justify-between mb-4">
                  <span>Tool Recommendations</span>
                  <input
                    type="checkbox"
                    checked={notificationSettings.toolRecommendations}
                    onChange={(e) =>
                      setNotificationSettings((p) => ({
                        ...p,
                        toolRecommendations: e.target.checked,
                      }))
                    }
                  />
                </label>
                <button
                  onClick={handleSaveNotifications}
                  disabled={isLoading}
                  className="px-6 py-2 bg-primary-accent text-text-on-accent rounded-md"
                >
                  {isLoading ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Privacy Settings</h3>
                <label className="flex justify-between mb-4">
                  <span>Share Usage Data</span>
                  <input
                    type="checkbox"
                    checked={privacy.shareUsageData}
                    onChange={(e) =>
                      setPrivacy((p) => ({ ...p, shareUsageData: e.target.checked }))
                    }
                  />
                </label>
                <label className="flex justify-between mb-4">
                  <span>Allow Analytics</span>
                  <input
                    type="checkbox"
                    checked={privacy.allowAnalytics}
                    onChange={(e) =>
                      setPrivacy((p) => ({ ...p, allowAnalytics: e.target.checked }))
                    }
                  />
                </label>
                <button
                  onClick={handleSavePrivacy}
                  disabled={isLoading}
                  className="px-6 py-2 bg-primary-accent text-text-on-accent rounded-md"
                >
                  {isLoading ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            )}

            {activeTab === 'set-password' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Change Password</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full p-3 border rounded-md"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-3 top-3 text-sm"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Confirm Password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full p-3 border rounded-md"
                    />
                  </div>

                  <button
                    onClick={handleChangePassword}
                    disabled={isLoading}
                    className="w-full py-3 bg-primary-accent text-text-on-accent rounded-md"
                  >
                    {isLoading ? 'Saving...' : 'Save Password'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
