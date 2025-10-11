import React, { useState } from 'react';
import { isSupabaseAvailable } from '../lib/supabase';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { useAuthSession } from '../hooks/useAuthSession';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const { isAuthenticated, sessionStatus, isInitializing } = useAuthSession({
    enablePeriodicValidation: false,
    enableFocusRecovery: false,
  });
  const [isSignup, setIsSignup] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  if (isInitializing || sessionStatus === 'loading' || sessionStatus === 'refreshing') {
    return (
      <div className="min-h-screen bg-light-bg-page dark:bg-dark-bg-page flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-accent mx-auto mb-4"></div>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            {sessionStatus === 'refreshing' ? 'Refreshing session...' : 'Initializing authentication...'}
          </p>
        </div>
      </div>
    );
  }

  const handleAuthSuccess = () => {
    console.log('AuthWrapper: Auth success, reloading page');
    setAuthError(null);
  };

  const handleSwitchToSignup = () => {
    console.log('AuthWrapper: Switching to signup');
    setIsSignup(true);
  };

  const handleSwitchToLogin = () => {
    console.log('AuthWrapper: Switching to login');
    setIsSignup(false);
    setAuthError(null);
  };

  // Show Supabase connection prompt if not configured
  if (!isSupabaseAvailable()) {
    return (
      <div className="min-h-screen bg-light-bg-page dark:bg-dark-bg-page flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-light-bg-component dark:bg-dark-bg-component rounded-lg p-8 shadow-lg">
            <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary mb-4">
              Connect to Supabase
            </h2>
            <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6">
              To enable backend features like authentication, data storage, and AI integration, 
              please connect your Supabase project.
            </p>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4 mb-6">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Click the "Connect to Supabase" button in the top right corner of Bolt to get started.
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity"
            >
              Refresh After Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && sessionStatus === 'unauthenticated') {
    return (
      <>
        {authError && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 max-w-md">
            <p className="text-sm text-red-800 dark:text-red-200">{authError}</p>
            <button 
              onClick={() => setAuthError(null)}
              className="mt-2 text-xs text-red-600 dark:text-red-400 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}
        {isSignup ? (
          <SignupForm 
            onSuccess={handleAuthSuccess}
            onToggleMode={handleSwitchToLogin}
          />
        ) : (
          <LoginForm 
            onSuccess={handleAuthSuccess}
            onToggleMode={handleSwitchToSignup}
          />
        )}
      </>
    );
  }

  return <>{children}</>;
};