import { useConfirmDialog } from '../contexts/DialogContext';

/**
 * Enhanced confirmation dialog hook with additional convenience methods
 */
export function useConfirmationDialog() {
  const dialog = useConfirmDialog();

  const confirmDelete = async (itemName: string, itemType: string = 'item') => {
    return dialog.confirm({
      title: `Delete ${itemType}`,
      message: `Are you sure you want to delete "${itemName}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger'
    });
  };

  const confirmDestructiveAction = async (
    action: string, 
    itemName: string, 
    description?: string
  ) => {
    return dialog.confirm({
      title: `${action}`,
      message: `Are you sure you want to ${action.toLowerCase()} "${itemName}"?${description ? ` ${description}` : ''} This action cannot be undone.`,
      confirmText: action,
      cancelText: 'Cancel',
      variant: 'danger'
    });
  };

  const confirmStatusChange = async (
    itemName: string, 
    currentStatus: string, 
    newStatus: string
  ) => {
    return dialog.confirm({
      title: `Change Status`,
      message: `Are you sure you want to change "${itemName}" from ${currentStatus} to ${newStatus}?`,
      confirmText: `Change to ${newStatus}`,
      cancelText: 'Cancel',
      variant: 'warning'
    });
  };

  const confirmRoleChange = async (
    userName: string, 
    currentRole: string, 
    newRole: string
  ) => {
    return dialog.confirm({
      title: `Change User Role`,
      message: `Are you sure you want to ${newRole === 'admin' ? 'promote' : 'demote'} "${userName}" ${newRole === 'admin' ? 'to admin' : 'to regular user'}? ${newRole === 'admin' ? 'They will gain administrative privileges.' : 'They will lose administrative privileges.'}`,
      confirmText: newRole === 'admin' ? 'Promote to Admin' : 'Demote to User',
      cancelText: 'Cancel',
      variant: newRole === 'user' ? 'danger' : 'warning'
    });
  };

  return {
    ...dialog,
    confirmDelete,
    confirmDestructiveAction,
    confirmStatusChange,
    confirmRoleChange,
  };
}