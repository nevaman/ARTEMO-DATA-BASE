import React, { useState } from 'react';
import { useCategories } from '../hooks/useCategories';
import { useConfirmationDialog } from '../hooks/useConfirmationDialog';
import { useNotifications } from '../contexts/NotificationContext';
import type { AdminCategory } from '../types';
import { PlusIcon, EditIcon, TrashIcon, SettingsIcon, BoxIcon, MailIcon, FileTextIcon, MicIcon, ActivityIcon, UsersIcon, SearchIcon } from './Icons';

const categoryIcons = [
  { name: 'Settings', icon: SettingsIcon, color: 'text-blue-600' },
  { name: 'Box', icon: BoxIcon, color: 'text-green-600' },
  { name: 'Edit', icon: EditIcon, color: 'text-purple-600' },
  { name: 'Mail', icon: MailIcon, color: 'text-red-600' },
  { name: 'File', icon: FileTextIcon, color: 'text-yellow-600' },
  { name: 'Mic', icon: MicIcon, color: 'text-pink-600' },
  { name: 'Activity', icon: ActivityIcon, color: 'text-indigo-600' },
  { name: 'Users', icon: UsersIcon, color: 'text-orange-600' },
];

export const AdminCategories: React.FC = () => {
  const confirmDialog = useConfirmationDialog();
  const notifications = useNotifications();
  const { allCategories, createCategory, updateCategory, deleteCategory, loading } = useCategories();
  
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    active: true, 
    iconName: 'Settings',
    iconColor: 'text-blue-600' 
  });
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'name' | 'displayOrder' | 'active'>('displayOrder');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleCreate = () => {
    setEditingCategory(null);
    setFormData({ name: '', active: true, icon: 'Settings', color: 'text-blue-600' });
    setSaveError(null);
    setModalOpen(true);
  };

  const handleEdit = (category: AdminCategory) => {
    setEditingCategory(category);
    setFormData({ 
      name: category.name, 
      active: category.active,
      iconName: category.iconName || 'Settings',
      iconColor: category.iconColor || 'text-blue-600'
    });
    setSaveError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setSaveError('Category name is required');
      return;
    }

    setSaveError(null);

    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: formData.name,
          active: formData.active,
          iconName: formData.iconName,
          iconColor: formData.iconColor,
        });
      } else {
        await createCategory({
          name: formData.name,
          displayOrder: allCategories.length + 1,
          active: formData.active,
          iconName: formData.iconName,
          iconColor: formData.iconColor,
        });
      }
      setModalOpen(false);
      notifications.success(
        `Category "${formData.name}" ${editingCategory ? 'updated' : 'created'} successfully`,
        editingCategory ? 'Category Updated' : 'Category Created'
      );
    } catch (error) {
      console.error('Failed to save category:', error);
      if (error && typeof error === 'object' && 'message' in error) {
        setSaveError(error.message as string);
      } else {
        setSaveError('Failed to save category. Please try again.');
      }
    }
  };

  const handleDelete = async (id: string) => {
    const category = allCategories.find(c => c.id === id);
    if (!category) return;

    const confirmed = await confirmDialog.confirmDelete(category.name, 'category');
    if (!confirmed) return;

    try {
      await deleteCategory(id);
      notifications.success(`Category "${category.name}" deleted successfully`, 'Category Deleted');
    } catch (error) {
      console.error('Failed to delete category:', error);
      notifications.error('Failed to delete category. Please try again.');
    }
  };

  const handleDragStart = (e: React.DragEvent, categoryId: string) => {
    setDraggedCategory(categoryId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetCategoryId: string) => {
    e.preventDefault();
    
    if (!draggedCategory || draggedCategory === targetCategoryId) {
      setDraggedCategory(null);
      return;
    }

    const sorted = [...allCategories].sort((a, b) => a.displayOrder - b.displayOrder);
    const draggedIndex = sorted.findIndex(cat => cat.id === draggedCategory);
    const targetIndex = sorted.findIndex(cat => cat.id === targetCategoryId);
    
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedCategory(null);
      return;
    }

    try {
      // Reorder the array
      const reordered = [...sorted];
      const [draggedItem] = reordered.splice(draggedIndex, 1);
      reordered.splice(targetIndex, 0, draggedItem);

      // Update display orders
      const updatePromises = reordered.map((category, index) => 
        updateCategory(category.id, { displayOrder: index + 1 })
      );

      await Promise.all(updatePromises);
      notifications.success('Categories reordered successfully');
    } catch (error) {
      console.error('Failed to reorder categories:', error);
      notifications.error('Failed to reorder categories. Please try again.');
    } finally {
      setDraggedCategory(null);
    }
  };

  const moveCategory = async (id: string, direction: 'up' | 'down') => {
    const sorted = [...allCategories].sort((a, b) => a.displayOrder - b.displayOrder);
    const index = sorted.findIndex(cat => cat.id === id);
    
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === sorted.length - 1)) {
      return;
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const categoryToMove = sorted[index];
    const categoryToSwap = sorted[newIndex];

    try {
      await updateCategory(categoryToMove.id, { displayOrder: categoryToSwap.displayOrder });
      await updateCategory(categoryToSwap.id, { displayOrder: categoryToMove.displayOrder });
      notifications.success('Category moved successfully');
    } catch (error) {
      console.error('Failed to reorder categories:', error);
      notifications.error('Failed to reorder categories. Please try again.');
    }
  };

  const getIconComponent = (iconName: string) => {
    const iconData = categoryIcons.find(i => i.name === iconName);
    return iconData || categoryIcons[0];
  };

  const handleSort = (field: 'name' | 'displayOrder' | 'active') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon: React.FC<{ field: 'name' | 'displayOrder' | 'active' }> = ({ field }) => (
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

  const filteredAndSortedCategories = allCategories
    .filter(category => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return category.name.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      let compareValue = 0;
      if (sortField === 'name') {
        compareValue = a.name.localeCompare(b.name);
      } else if (sortField === 'displayOrder') {
        compareValue = a.displayOrder - b.displayOrder;
      } else if (sortField === 'active') {
        compareValue = a.active === b.active ? 0 : a.active ? -1 : 1;
      }
      return sortDirection === 'asc' ? compareValue : -compareValue;
    });

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-accent mx-auto mb-4"></div>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">Loading categories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
            Categories
          </h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            Manage tool categories and their display order
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <SearchIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-light-text-tertiary dark:text-dark-text-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search categories..."
              className="pl-10 pr-4 py-2 w-64 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary placeholder-light-text-tertiary dark:placeholder-dark-text-tertiary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
            />
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity"
          >
            <PlusIcon className="w-4 h-4" />
            Add Category
          </button>
        </div>
      </div>

      <div className="bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-light-bg-sidebar dark:bg-dark-bg-sidebar">
              <tr>
                <th
                  className="text-left p-4 font-medium text-light-text-primary dark:text-dark-text-primary cursor-pointer hover:bg-light-bg-page dark:hover:bg-dark-bg-component"
                  onClick={() => handleSort('displayOrder')}
                >
                  Order
                  <SortIcon field="displayOrder" />
                </th>
                <th
                  className="text-left p-4 font-medium text-light-text-primary dark:text-dark-text-primary cursor-pointer hover:bg-light-bg-page dark:hover:bg-dark-bg-component"
                  onClick={() => handleSort('name')}
                >
                  Name
                  <SortIcon field="name" />
                </th>
                <th
                  className="text-left p-4 font-medium text-light-text-primary dark:text-dark-text-primary cursor-pointer hover:bg-light-bg-page dark:hover:bg-dark-bg-component"
                  onClick={() => handleSort('active')}
                >
                  Status
                  <SortIcon field="active" />
                </th>
                <th className="text-left p-4 font-medium text-light-text-primary dark:text-dark-text-primary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedCategories.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
                    {searchQuery.trim() ? (
                      <>
                        No categories found matching <span className="font-medium text-light-text-primary dark:text-dark-text-primary">"{searchQuery}"</span>
                      </>
                    ) : (
                      'No categories created yet. Click "Add Category" to create your first category.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredAndSortedCategories.map((category) => (
                <tr 
                  key={category.id} 
                  className={`border-t border-light-border dark:border-dark-border transition-colors ${
                    draggedCategory === category.id ? 'opacity-50' : 'hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page'
                  }`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, category.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, category.id)}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-light-text-primary dark:text-dark-text-primary font-medium">
                        {category.displayOrder}
                      </span>
                      <div className="flex flex-col">
                        <button
                          onClick={() => moveCategory(category.id, 'up')}
                          className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary hover:text-primary-accent p-1 rounded hover:bg-light-bg-page dark:hover:bg-dark-bg-component"
                          disabled={category.displayOrder === 1}
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveCategory(category.id, 'down')}
                          className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary hover:text-primary-accent p-1 rounded hover:bg-light-bg-page dark:hover:bg-dark-bg-component"
                          disabled={category.displayOrder === allCategories.length}
                        >
                          ↓
                        </button>
                      </div>
                      <div className="ml-2 text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
                        Drag to reorder
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {React.createElement(getIconComponent(category.iconName || 'Settings').icon, { 
                        className: `w-5 h-5 ${category.iconColor || 'text-blue-600'}` 
                      })}
                      <span className="font-medium text-light-text-primary dark:text-dark-text-primary">
                        {category.name}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      category.active 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {category.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(category)}
                        className="p-2 text-light-text-tertiary dark:text-dark-text-tertiary hover:text-primary-accent hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page rounded-md"
                        title="Edit category"
                      >
                        <EditIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(category.id)}
                        className="p-2 text-light-text-tertiary dark:text-dark-text-tertiary hover:text-red-500 hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page rounded-md"
                        title="Delete category"
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
                {editingCategory ? 'Edit Category' : 'Create Category'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
                  placeholder="Category name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                  Icon & Color
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {categoryIcons.map((iconData) => (
                    <button
                      key={iconData.name}
                      type="button"
                      onClick={() => setFormData(prev => ({ 
                        ...prev,
                        iconName: iconData.name,
                        iconColor: iconData.color
                      }))}
                      className={`p-3 border rounded-md flex flex-col items-center gap-1 transition-colors ${
                        formData.iconName === iconData.name
                          ? 'border-primary-accent bg-primary-accent/10'
                          : 'border-light-border dark:border-dark-border hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page'
                      }`}
                    >
                      {React.createElement(iconData.icon, { 
                        className: `w-5 h-5 ${iconData.color}` 
                      })}
                      <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        {iconData.name}
                      </span>
                    </button>
                  ))}
                </div>
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
              {saveError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
                </div>
              )}
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
                {editingCategory ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};