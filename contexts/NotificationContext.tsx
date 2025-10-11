import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { NotificationContainer } from '../components/NotificationContainer';
import type { NotificationToastProps } from '../components/NotificationToast';

interface NotificationConfig {
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  message: string;
  duration?: number;
}

interface NotificationContextType {
  notify: (config: NotificationConfig) => void;
  success: (message: string, title?: string, duration?: number) => void;
  error: (message: string, title?: string, duration?: number) => void;
  info: (message: string, title?: string, duration?: number) => void;
  warning: (message: string, title?: string, duration?: number) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Array<Omit<NotificationToastProps, 'onDismiss'>>>([]);

  const addNotification = useCallback((config: NotificationConfig) => {
    const id = crypto.randomUUID();
    const notification = {
      id,
      ...config,
    };

    setNotifications(prev => [...prev, notification]);

    // Auto-dismiss after duration (if specified)
    if (config.duration !== 0) {
      const duration = config.duration || 5000;
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const notify = useCallback((config: NotificationConfig) => {
    return addNotification(config);
  }, [addNotification]);

  const success = useCallback((message: string, title?: string, duration?: number) => {
    return addNotification({ type: 'success', message, title, duration });
  }, [addNotification]);

  const error = useCallback((message: string, title?: string, duration?: number) => {
    return addNotification({ type: 'error', message, title, duration });
  }, [addNotification]);

  const info = useCallback((message: string, title?: string, duration?: number) => {
    return addNotification({ type: 'info', message, title, duration });
  }, [addNotification]);

  const warning = useCallback((message: string, title?: string, duration?: number) => {
    return addNotification({ type: 'warning', message, title, duration });
  }, [addNotification]);

  return (
    <NotificationContext.Provider value={{
      notify,
      success,
      error,
      info,
      warning,
      dismiss,
      dismissAll
    }}>
      {children}
      <NotificationContainer
        notifications={notifications}
        onDismiss={dismiss}
      />
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}