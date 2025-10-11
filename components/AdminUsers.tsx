import React, { useState, useEffect } from 'react';
import { SupabaseApiService } from '../services/supabaseApi';
import { useConfirmationDialog } from '../hooks/useConfirmationDialog';
import { useNotifications } from '../contexts/NotificationContext';
import type { AdminUser, UserAuditLog } from '../types';
import { PlusIcon, EditIcon, TrashIcon, UsersIcon, UserPlusIcon, SearchIcon } from './Icons';

// Enhanced confirmation dialog component
const ConfirmationDialog: React.FC<{
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
  showReasonInput?: boolean;
  reason?: string;
  onReasonChange?: (reason: string) => void;
}> = ({ 
  isOpen, 
  title, 
  message, 
  confirmText, 
  cancelText, 
  onConfirm, 
  onCancel, 
  isDestructive = false,
  showReasonInput = false,
  reason = '',
  onReasonChange
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-light-bg-component dark:bg-dark-bg-component rounded-lg shadow-lg w-full max-w-md">
        <div className="p-6">
          <h3 className="font-serif text-lg font-bold text-light-text-primary dark:text-dark-text-primary mb-3">
            {title}
          </h3>
          <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
            {message}
          </p>
          {showReasonInput && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                Reason (optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => onReasonChange?.(e.target.value)}
                className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
                placeholder="Enter reason for this action..."
                rows={3}
              />
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 rounded-md font-medium transition-opacity ${
                isDestructive
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-primary-accent text-text-on-accent hover:opacity-85'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AdminUsers: React.FC = () => {
  const confirmDialog = useConfirmationDialog();
  const notifications = useNotifications();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'fullName' | 'email' | 'role' | 'active' | 'createdAt'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [isModalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    role: 'user' as 'user' | 'admin',
    active: true,
  });

  const api = SupabaseApiService.getInstance();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getUsers();
      if (response.success && response.data) {
        setUsers(response.data);
      } else {
        setError(response.error || 'Failed to fetch users');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: 'fullName' | 'email' | 'role' | 'active' | 'createdAt') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon: React.FC<{ field: 'fullName' | 'email' | 'role' | 'active' | 'createdAt' }> = ({ field }) => (
    <svg
      className={`w-3 h-3 inline ml-1 transition-colors ${
        sortField === field ? 'text-red-500' : 'text-light-text-tertiary dark:text-dark-text-tertiary'
      }`}
      fill="currentColor"
      viewBox="0 0 16 16"
      style={{ transform: sortField === field && sortDirection === 'desc' ? 'rotate(180deg)' : 'none' }}
    >
      <path d="M8 3l4 5H4z"/>
    </svg>
  );

  const filteredAndSortedUsers = users
    .filter(user => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        user.fullName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      let compareValue = 0;
      if (sortField === 'fullName') {
        compareValue = a.fullName.localeCompare(b.fullName);
      } else if (sortField === 'email') {
        compareValue = a.email.localeCompare(b.email);
      } else if (sortField === 'role') {
        compareValue = a.role.localeCompare(b.role);
      } else if (sortField === 'active') {
        compareValue = a.active === b.active ? 0 : a.active ? -1 : 1;
      } else if (sortField === 'createdAt') {
        compareValue = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortDirection === 'asc' ? compareValue : -compareValue;
    });

  const handleCreate = () => {
    setEditingUser(null);
    setFormData({ fullName: '', email: '', role: 'user', active: true });
    setModalOpen(true);
  };

  const handleEdit = (user: AdminUser) => {
    setEditingUser(user);
    setFormData({
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      active: user.active,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.fullName.trim() || !formData.email.trim()) {
      notifications.error('Please fill in all required fields');
      return;
    }

    try {
      if (editingUser) {
        // Update existing user role
        const response = await api.updateUserRole(editingUser.id, formData.role);
        if (response.success) {
          setUsers(prev => prev.map(user => 
            user.id === editingUser.id 
              ? { ...user, ...formData }
              : user
          ));
          notifications.success('User updated successfully');
        } else {
          throw new Error(response.error || 'Failed to update user');
        }
      } else {
        // Invite new user
        const response = await api.inviteUser(formData.email, formData.fullName, formData.role);
        if (response.success) {
          // Refresh users list
          await fetchUsers();
          notifications.success('User invitation sent successfully', 'Invitation Sent');
        } else {
          throw new Error(response.error || 'Failed to invite user');
        }
      }
      setModalOpen(false);
    } catch (error) {
      console.error('Failed to save user:', error);
      notifications.error('Failed to save user. Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;

    const confirmed = await confirmDialog.confirmDelete(user.fullName, 'user');
    if (!confirmed) return;
    
    setActionLoading(id);
    
    try {
      const response = await api.deleteUser(id, 'User deleted by admin');
      if (response.success) {
        setUsers(prev => prev.filter(user => user.id !== id));
        
        // Show detailed result message
        const resultData = response.data as any;
        if (resultData?.hasWarnings) {
          notifications.warning(
            `User deleted with warnings: ${resultData.message}. Some data cleanup may have failed.`,
            'Deletion Completed with Warnings'
          );
        } else {
          notifications.success('User and all associated data permanently deleted successfully.', 'User Deleted');
        }
      } else {
        throw new Error(response.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      notifications.error('Failed to delete user. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    
    const newStatus = user.active ? 'inactive' : 'active';
    const confirmed = await confirmDialog.confirmStatusChange(user.fullName, user.active ? 'active' : 'inactive', newStatus);
    if (!confirmed) return;
    
    setActionLoading(id);
    
    try {
      const response = await api.updateUserStatus(id, !user.active, 'Status updated by admin');
      if (response.success) {
        setUsers(prev => prev.map(user => 
          user.id === id ? { 
            ...user, 
            active: !user.active,
            status: !user.active ? 'active' : 'inactive'
          } : user
        ));
        notifications.success(`User ${!user.active ? 'enabled' : 'disabled'} successfully`);
      } else {
        throw new Error(response.error || 'Failed to update user status');
      }
    } catch (error) {
      console.error('Failed to toggle user status:', error);
      notifications.error(`Failed to ${!user.active ? 'enable' : 'disable'} user. Please try again.`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleChange = async (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;

    const newRole = user.role === 'admin' ? 'user' : 'admin';
    const confirmed = await confirmDialog.confirmRoleChange(user.fullName, user.role, newRole);
    if (!confirmed) return;
    
    setActionLoading(id);
    
    try {
      const response = await api.updateUserRole(id, newRole, 'Role updated by admin');
      if (response.success) {
        setUsers(prev => prev.map(u => 
          u.id === id ? { ...u, role: newRole } : u
        ));
        notifications.success(`User ${newRole === 'admin' ? 'promoted to admin' : 'demoted to user'} successfully`);
      } else {
        throw new Error(response.error || 'Failed to update user role');
      }
    } catch (error) {
      console.error('Failed to update user role:', error);
      notifications.error(`Failed to ${newRole === 'admin' ? 'promote' : 'demote'} user. Please try again.`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-accent mx-auto mb-4"></div>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
            Users
          </h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            Manage user accounts and permissions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <SearchIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-light-text-tertiary dark:text-dark-text-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="pl-10 pr-4 py-2 w-64 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary placeholder-light-text-tertiary dark:placeholder-dark-text-tertiary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
            />
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity"
          >
            <UserPlusIcon className="w-4 h-4" />
            Invite User
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-800 dark:text-red-200">Error: {error}</p>
        </div>
      )}

      <div className="bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-light-bg-sidebar dark:bg-dark-bg-sidebar">
              <tr>
                <th
                  className="text-left p-4 font-medium text-light-text-primary dark:text-dark-text-primary cursor-pointer hover:bg-light-bg-page dark:hover:bg-dark-bg-component"
                  onClick={() => handleSort('fullName')}
                >
                  User
                  <SortIcon field="fullName" />
                </th>
                <th
                  className="text-left p-4 font-medium text-light-text-primary dark:text-dark-text-primary cursor-pointer hover:bg-light-bg-page dark:hover:bg-dark-bg-component"
                  onClick={() => handleSort('role')}
                >
                  Role
                  <SortIcon field="role" />
                </th>
                <th
                  className="text-left p-4 font-medium text-light-text-primary dark:text-dark-text-primary cursor-pointer hover:bg-light-bg-page dark:hover:bg-dark-bg-component"
                  onClick={() => handleSort('active')}
                >
                  Status
                  <SortIcon field="active" />
                </th>
                <th
                  className="text-left p-4 font-medium text-light-text-primary dark:text-dark-text-primary cursor-pointer hover:bg-light-bg-page dark:hover:bg-dark-bg-component"
                  onClick={() => handleSort('createdAt')}
                >
                  Created
                  <SortIcon field="createdAt" />
                </th>
                <th className="text-left p-4 font-medium text-light-text-primary dark:text-dark-text-primary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
                    {searchQuery.trim() ? (
                      <>
                        No users found matching <span className="font-medium text-light-text-primary dark:text-dark-text-primary">"{searchQuery}"</span>
                      </>
                    ) : (
                      'No users found. Users will appear here when they register.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredAndSortedUsers.map((user) => (
                <tr key={user.id} className="border-t border-light-border dark:border-dark-border">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-accent text-text-on-accent flex items-center justify-center font-semibold text-sm">
                        {user.fullName.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-light-text-primary dark:text-dark-text-primary">
                          {user.fullName || 'Unknown User'}
                        </div>
                        <div className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.role === 'admin'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}>
                      {user.role === 'admin' ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.active 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {user.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-light-text-secondary dark:text-dark-text-secondary text-sm">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleStatus(user.id)}
                        disabled={actionLoading === user.id}
                        className="px-2 py-1 text-xs rounded-md bg-light-bg-sidebar dark:bg-dark-bg-page text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading === user.id ? 'Loading...' : (user.active ? 'Disable' : 'Enable')}
                      </button>
                      <button
                        onClick={() => handleRoleChange(user.id)}
                        disabled={actionLoading === user.id}
                        className="px-2 py-1 text-xs rounded-md bg-light-bg-sidebar dark:bg-dark-bg-page text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading === user.id ? 'Loading...' : (user.role === 'admin' ? 'Demote' : 'Promote')}
                      </button>
                      <button
                        onClick={() => handleEdit(user)}
                        disabled={actionLoading === user.id}
                        className="p-2 text-light-text-tertiary dark:text-dark-text-tertiary hover:text-primary-accent hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page rounded-md"
                      >
                        <EditIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        disabled={actionLoading === user.id}
                        className="p-2 text-light-text-tertiary dark:text-dark-text-tertiary hover:text-red-500 hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page rounded-md"
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
          <div className="bg-light-bg-component dark:bg-dark-bg-component rounded-lg shadow-lg w-full max-w-md">
            <div className="p-6 border-b border-light-border dark:border-dark-border">
              <h3 className="font-serif text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                {editingUser ? 'Edit User' : 'Invite User'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                  className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as 'user' | 'admin' }))}
                  className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                  className="h-4 w-4 text-primary-accent focus:ring-primary-accent border-gray-300 rounded"
                />
                <label htmlFor="active" className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                  Active
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-light-border dark:border-dark-border flex justify-end gap-3">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity"
              >
                {editingUser ? 'Update' : 'Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};