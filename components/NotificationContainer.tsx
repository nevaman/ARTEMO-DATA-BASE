import React from 'react';
import { NotificationToast } from './NotificationToast';
import type { NotificationToastProps } from './NotificationToast';

interface NotificationContainerProps {
  notifications: Array<Omit<NotificationToastProps, 'onDismiss'>>;
  onDismiss: (id: string) => void;
}

export const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notifications,
  onDismiss
}) => {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-3 pointer-events-none">
      {notifications.map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <NotificationToast
            {...notification}
            onDismiss={onDismiss}
          />
        </div>
      ))}
    </div>
  );
};