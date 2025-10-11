import React, { useState } from 'react';
import { AuthService } from '../services/auth';
import { Logger } from '../utils/logger';
import { useNotifications } from '../contexts/NotificationContext';
import type { AuthError } from '../types';

interface LoginFormProps {
  onSuccess: () => void;
  onToggleMode: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onToggleMode }) => {
  const notifications = useNotifications();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authService = AuthService.getInstance();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError(null);

    Logger.userAction('login_attempt', {
      component: 'LoginForm',
      email: email.substring(0, 3) + '***', // Sanitized email for logging
    });

    try {
      const result = await authService.signIn(email, password);
      
      if (!result.user || !result.session) {
        throw new Error('Login succeeded but no session data returned');
      }

      console.log('Login successful:', result.user.id);
      
      Logger.userAction('login_success', {
        component: 'LoginForm',
        userId: result.user?.id,
      });

      // The auth listener will handle state updates
      onSuccess();
      notifications.success('Welcome back! You have been signed in successfully.', 'Login Successful');
    } catch (authError: any) {
      console.error('Login error:', authError);
      
      // Handle both structured errors and generic errors
      const errorMessage = authError.message || 'Login failed. Please try again.';
      setError(errorMessage);
      
      // Also show as notification for better UX
      notifications.error(errorMessage, 'Login Failed');
      
      Logger.error({
        message: errorMessage,
        code: authError.code || 'AUTH_LOGIN_ERROR',
        details: authError.details || authError.toString(),
        timestamp: new Date().toISOString(),
        correlationId: Logger.getCorrelationId(),
        component: 'LoginForm', // Override component to be more specific
        severity: 'error',
      }, {
        formEmail: email.substring(0, 3) + '***',
        passwordLength: password.length,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-light-bg-page dark:bg-dark-bg-page flex items-center justify-center p-4">
      <div className="bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-lg shadow-lg w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="font-serif text-2xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
            Welcome Back
          </h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            Sign in to your Artemo account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
              placeholder="your@email.com"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
              placeholder="Enter your password"
              required
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="w-full py-3 px-4 bg-primary-accent text-text-on-accent rounded-md font-medium hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={onToggleMode}
            className="text-sm text-primary-accent hover:underline"
            disabled={isLoading}
          >
            Don't have an account? Sign up
          </button>
        </div>

      </div>
    </div>
  );
};