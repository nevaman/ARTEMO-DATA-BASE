import React, { useState } from 'react';
import { AuthService } from '../services/auth';
import { Logger } from '../utils/logger';
import { useNotifications } from '../contexts/NotificationContext';
import type { AuthError } from '../types';

interface SignupFormProps {
  onSuccess: () => void;
  onToggleMode: () => void;
}

export const SignupForm: React.FC<SignupFormProps> = ({ onSuccess, onToggleMode }) => {
  const notifications = useNotifications();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authService = AuthService.getInstance();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!email.trim() || !password.trim() || !fullName.trim()) {
      setError('All fields are required');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError(null);

    Logger.userAction('signup_attempt', {
      component: 'SignupForm',
      email: email.substring(0, 3) + '***',
    });

    try {
      const result = await authService.signUp(email, password, fullName);
      
      if (!result.user) {
        throw new Error('Signup succeeded but no user data returned');
      }

      console.log('Signup successful:', result.user.id);
      
      Logger.userAction('signup_success', {
        component: 'SignupForm',
        userId: result.user?.id,
      });

      // The auth listener will handle state updates
      onSuccess();
      notifications.success('Account created successfully! Welcome to Artemo AI Dashboard.', 'Account Created');
    } catch (authError: any) {
      console.error('Signup error:', authError);
      
      // Handle both structured errors and generic errors
      const errorMessage = authError.message || 'Signup failed. Please try again.';
      setError(errorMessage);
      
      // Also show as notification for better UX
      notifications.error(errorMessage, 'Signup Failed');
      
      Logger.error({
        message: errorMessage,
        code: authError.code || 'AUTH_SIGNUP_ERROR',
        details: authError.details || authError.toString(),
        timestamp: new Date().toISOString(),
        correlationId: Logger.getCorrelationId(),
        component: 'SignupForm',
        severity: 'error',
      }, {
        formEmail: email.substring(0, 3) + '***',
        fullName: fullName.substring(0, 3) + '***',
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
            Create Account
          </h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            Join Artemo AI Dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
              placeholder="Your full name"
              required
              disabled={isLoading}
            />
          </div>

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
              placeholder="Create a password"
              required
              disabled={isLoading}
              minLength={6}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !email || !password || !fullName}
            className="w-full py-3 px-4 bg-primary-accent text-text-on-accent rounded-md font-medium hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={onToggleMode}
            className="text-sm text-primary-accent hover:underline"
            disabled={isLoading}
          >
            Already have an account? Sign in
          </button>
        </div>
      </div>
    </div>
  );
};