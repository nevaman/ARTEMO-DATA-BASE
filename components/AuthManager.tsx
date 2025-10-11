import React, { useEffect } from 'react';
import { useAuthSession } from '../hooks/useAuthSession';

interface AuthManagerProps {
  children: React.ReactNode;
  onAuthStateChange?: (isAuthenticated: boolean) => void;
}

export const AuthManager: React.FC<AuthManagerProps> = ({ children, onAuthStateChange }) => {
  const { isAuthenticated, sessionStatus, isInitializing } = useAuthSession({
    enablePeriodicValidation: true,
    enableFocusRecovery: true,
  });

  useEffect(() => {
    if (onAuthStateChange) {
      onAuthStateChange(isAuthenticated);
    }
  }, [isAuthenticated, onAuthStateChange]);

  if (isInitializing || sessionStatus === 'loading') {
    return (
      <div className="min-h-screen bg-light-bg-page dark:bg-dark-bg-page flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-accent mx-auto mb-4"></div>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            Loading application...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};