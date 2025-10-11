import React, { useState, useEffect } from 'react';
import { SupabaseApiService } from '../services/supabaseApi';
import { useConfirmDialog } from '../contexts/DialogContext';
import { useNotifications } from '../contexts/NotificationContext';
import { PlusIcon, EditIcon, TrashIcon, BellIcon } from './Icons';

interface Announcement {
  id: string;
  title: string;
  content: string;
  active: boolean;
  showOnLogin: boolean;
  createdAt: string;
  createdBy?: string;
}

export const AdminAnnouncements: React.FC = () => {
  const dialog = useConfirmDialog();
  const notifications = useNotifications();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    active: true,
    showOnLogin: false,
  });

  const api = SupabaseApiService.getInstance();

  // Fetch announcements on component mount
  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('AdminAnnouncements: Fetching announcements from API');
      const response = await api.getAnnouncements();
      if (response.success && response.data) {
        console.log('AdminAnnouncements: Announcements fetched successfully:', response.data.length);
        setAnnouncements(response.data);
      } else {
        console.error('AdminAnnouncements: Failed to fetch announcements:', response.error);
        setError(response.error || 'Failed to fetch announcements');
      }
    } catch (err) {
      console.error('AdminAnnouncements: Network error:', err);
      setError('Network error occurred');
      console.error('Failed to fetch announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingAnnouncement(null);
    setFormData({ title: '', content: '', active: true, showOnLogin: false });
    setModalOpen(true);
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      active: announcement.active,
      showOnLogin: announcement.showOnLogin,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      notifications.error('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    
    try {
      if (editingAnnouncement) {
        // Update existing announcement
        console.log('AdminAnnouncements: Updating announcement:', editingAnnouncement.id);
        const response = await api.updateAnnouncement(editingAnnouncement.id, formData);
        if (response.success && response.data) {
          setAnnouncements(prev => prev.map(ann => 
            ann.id === editingAnnouncement.id ? response.data! : ann
          ));
          console.log('AdminAnnouncements: Announcement updated successfully');
        } else {
          throw new Error(response.error || 'Failed to update announcement');
        }
      } else {
        // Create new announcement
        console.log('AdminAnnouncements: Creating new announcement');
        const response = await api.createAnnouncement(formData);
        if (response.success && response.data) {
          setAnnouncements(prev => [response.data!, ...prev]);
          console.log('AdminAnnouncements: Announcement created successfully');
        } else {
          throw new Error(response.error || 'Failed to create announcement');
        }
      }
      setModalOpen(false);
      notifications.success(
        `Announcement "${formData.title}" ${editingAnnouncement ? 'updated' : 'created'} successfully`,
        editingAnnouncement ? 'Announcement Updated' : 'Announcement Created'
      );
    } catch (error) {
      console.error('Failed to save announcement:', error);
      notifications.error('Failed to save announcement. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await dialog.confirm({
      title: 'Delete Announcement',
      message: 'Are you sure you want to delete this announcement?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger'
    });

    if (confirmed) {
      try {
        console.log('AdminAnnouncements: Deleting announcement:', id);
        const response = await api.deleteAnnouncement(id);
        if (response.success) {
          setAnnouncements(prev => prev.filter(ann => ann.id !== id));
          console.log('AdminAnnouncements: Announcement deleted successfully');
          notifications.success('Announcement deleted successfully', 'Announcement Deleted');
        } else {
          throw new Error(response.error || 'Failed to delete announcement');
        }
      } catch (error) {
        console.error('Failed to delete announcement:', error);
        notifications.error('Failed to delete announcement. Please try again.');
      }
    }
  };

  const toggleActive = async (id: string) => {
    const announcement = announcements.find(a => a.id === id);
    if (!announcement) return;

    try {
      const response = await api.updateAnnouncement(id, { 
        active: !announcement.active 
      });
      
      if (response.success && response.data) {
        setAnnouncements(prev => prev.map(ann => 
          ann.id === id ? response.data! : ann
        ));
        notifications.success(`Announcement ${!announcement.active ? 'activated' : 'deactivated'} successfully`);
      } else {
        throw new Error(response.error || 'Failed to update announcement');
      }
    } catch (error) {
      console.error('Failed to toggle announcement status:', error);
      notifications.error('Failed to update announcement. Please try again.');
    }
  };

  const toggleShowOnLogin = async (id: string) => {
    const announcement = announcements.find(a => a.id === id);
    if (!announcement) return;

    try {
      const response = await api.updateAnnouncement(id, { 
        showOnLogin: !announcement.showOnLogin 
      });
      
      if (response.success && response.data) {
        setAnnouncements(prev => prev.map(ann => 
          ann.id === id ? response.data! : ann
        ));
        notifications.success(`Login popup ${!announcement.showOnLogin ? 'enabled' : 'disabled'} successfully`);
      } else {
        throw new Error(response.error || 'Failed to update announcement');
      }
    } catch (error) {
      console.error('Failed to toggle login popup:', error);
      notifications.error('Failed to update announcement. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-accent mx-auto mb-4"></div>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">Loading announcements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
            Announcements
          </h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            Manage announcements and login popups for users
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity"
        >
          <PlusIcon className="w-4 h-4" />
          Add Announcement
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-800 dark:text-red-200">Error: {error}</p>
          <button 
            onClick={fetchAnnouncements}
            className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      <div className="bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-light-bg-sidebar dark:bg-dark-bg-sidebar">
              <tr>
                <th className="text-left p-4 font-medium text-light-text-primary dark:text-dark-text-primary">Announcement</th>
                <th className="text-left p-4 font-medium text-light-text-primary dark:text-dark-text-primary">Status</th>
                <th className="text-left p-4 font-medium text-light-text-primary dark:text-dark-text-primary">Login Popup</th>
                <th className="text-left p-4 font-medium text-light-text-primary dark:text-dark-text-primary">Created</th>
                <th className="text-left p-4 font-medium text-light-text-primary dark:text-dark-text-primary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {announcements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
                    {loading ? 'Loading announcements...' : 'No announcements created yet. Click "Add Announcement" to create your first announcement.'}
                  </td>
                </tr>
              ) : (
                announcements.map((announcement) => (
                  <tr key={announcement.id} className="border-t border-light-border dark:border-dark-border">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <BellIcon className="w-5 h-5 text-primary-accent" />
                        <div>
                          <div className="font-medium text-light-text-primary dark:text-dark-text-primary">
                            {announcement.title}
                          </div>
                          <p className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary line-clamp-2">
                            {announcement.content}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => toggleActive(announcement.id)}
                        className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                          announcement.active 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
                        }`}
                      >
                        {announcement.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => toggleShowOnLogin(announcement.id)}
                        className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                          announcement.showOnLogin 
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-900/50'
                        }`}
                      >
                        {announcement.showOnLogin ? 'Enabled' : 'Disabled'}
                      </button>
                    </td>
                    <td className="p-4">
                      <span className="text-light-text-secondary dark:text-dark-text-secondary text-sm">
                        {new Date(announcement.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(announcement)}
                          className="p-2 text-light-text-tertiary dark:text-dark-text-tertiary hover:text-primary-accent hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page rounded-md transition-colors"
                        >
                          <EditIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(announcement.id)}
                          className="p-2 text-light-text-tertiary dark:text-dark-text-tertiary hover:text-red-500 hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page rounded-md transition-colors"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-light-bg-component dark:bg-dark-bg-component rounded-lg shadow-lg w-full max-w-2xl">
            <div className="p-6 border-b border-light-border dark:border-dark-border">
              <h3 className="font-serif text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                {editingAnnouncement ? 'Edit Announcement' : 'Create Announcement'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
                  placeholder="Announcement title"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                  Content *
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  rows={6}
                  className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none resize-vertical"
                  placeholder="Announcement content (supports markdown)"
                  required
                />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                    className="h-4 w-4 text-primary-accent focus:ring-primary-accent border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">Active</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.showOnLogin}
                    onChange={(e) => setFormData(prev => ({ ...prev, showOnLogin: e.target.checked }))}
                    className="h-4 w-4 text-primary-accent focus:ring-primary-accent border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">Show as login popup</span>
                </label>
              </div>
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
                disabled={isSaving || !formData.title.trim() || !formData.content.trim()}
                className="px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-text-on-accent"></div>
                )}
                {isSaving ? 'Saving...' : (editingAnnouncement ? 'Update' : 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};