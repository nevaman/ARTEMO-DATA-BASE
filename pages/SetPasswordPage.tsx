import React, { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuthStore } from '../stores/authStore';

const MIN_PASSWORD_LENGTH = 8;

type InviteStatus = 'initializing' | 'ready' | 'submitting' | 'success' | 'error';

interface InviteMetadata {
  type: string | null;
  error: string | null;
  errorDescription: string | null;
}

export const SetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const notifications = useNotifications();
  const storeIsAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [status, setStatus] = useState<InviteStatus>('initializing');
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inviteDetails, setInviteDetails] = useState<InviteMetadata>({
    type: null,
    error: null,
    errorDescription: null,
  });
  const [hasInviteContext, setHasInviteContext] = useState(false);

  const hasInviteHash = useMemo(() => Boolean(location.hash), [location.hash]);
  const derivedInviteType = inviteDetails.type ?? (location.hash.includes('type=invite') ? 'invite' : null);
  const isInviteLink = hasInviteContext || derivedInviteType === 'invite';

  useEffect(() => {
    const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;

    if (!hash) {
      setInviteDetails({ type: null, error: null, errorDescription: null });
      return;
    }

    const params = new URLSearchParams(hash);
    const type = params.get('type');
    if (type === 'invite') {
      setHasInviteContext(true);
    }

    setInviteDetails({
      type,
      error: params.get('error'),
      errorDescription: params.get('error_description'),
    });
  }, [location.key, location.hash]);

  useEffect(() => {
    if (!supabase) {
      setStatus('error');
      setErrorMessage('Supabase is not configured for this environment. Please connect to Supabase before using invite links.');
      return;
    }

    let isMounted = true;
    let sessionTimeout: number | undefined;

    const bootstrapSession = async () => {
      setStatus((current) => (current === 'success' ? current : 'initializing'));
      setErrorMessage(null);

      try {
        const { data, error } = await supabase.auth.getSession();

        if (!isMounted) {
          return;
        }

        if (error) {
          setStatus('error');
          setErrorMessage(error.message ?? 'We could not validate your invite link. Please request a new invitation.');
          return;
        }

        if (data?.session?.user) {
          setSessionUser(data.session.user);
          setStatus('ready');
          setErrorMessage(null);
        } else {
          sessionTimeout = window.setTimeout(() => {
            if (!isMounted) {
              return;
            }

            setStatus((current) => (current === 'success' ? current : 'error'));
            setErrorMessage('We could not validate your invite session. The link may have expired. Request a new invitation to continue.');
          }, 4000);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'We could not validate your invite link.';
        setStatus('error');
        setErrorMessage(message);
      }
    };

    bootstrapSession();

    const { data: authSubscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) {
        return;
      }

      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session?.user) {
        if (event === 'INITIAL_SESSION') {
          setHasInviteContext(true);
        }

        if (sessionTimeout) {
          clearTimeout(sessionTimeout);
          sessionTimeout = undefined;
        }

        setSessionUser(session.user);
        setStatus('ready');
        setErrorMessage(null);
      }

      if (event === 'SIGNED_OUT' || (!session && (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED'))) {
        setSessionUser(null);
        setStatus((current) => (current === 'success' ? current : 'error'));
        setErrorMessage('Your invite session is no longer active. Request a new link from your administrator.');
      }
    });

    return () => {
      isMounted = false;
      authSubscription.subscription.unsubscribe();
      if (sessionTimeout) {
        clearTimeout(sessionTimeout);
      }
    };
  }, [location.key, supabase]);

  useEffect(() => {
    if (inviteDetails.error) {
      setStatus('error');
      setErrorMessage(inviteDetails.errorDescription ?? 'This invite link is no longer valid. Request a new invitation.');
    }
  }, [inviteDetails.error, inviteDetails.errorDescription]);

  useEffect(() => {
    if (storeIsAuthenticated && !isInviteLink && status !== 'success' && status !== 'error') {
      setStatus('error');
      setErrorMessage('You are already signed in. Visit your account settings to update your password.');
    }
  }, [storeIsAuthenticated, isInviteLink, status]);

  useEffect(() => {
    let redirectTimer: number | undefined;

    if (status === 'success') {
      redirectTimer = window.setTimeout(() => {
        navigate('/', { replace: true });
      }, 2000);
    }

    return () => {
      if (redirectTimer) {
        clearTimeout(redirectTimer);
      }
    };
  }, [status, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase) {
      setErrorMessage('Supabase is not configured. Unable to set your password.');
      return;
    }

    if (!sessionUser) {
      setErrorMessage('No active invite session was detected. Request a new invite link and try again.');
      setStatus('error');
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please confirm your new password.');
      return;
    }

    try {
      setStatus('submitting');
      setErrorMessage(null);

      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      notifications.success(
        'Your password has been saved. Redirecting you to the dashboard...',
        'Password updated'
      );

      setStatus('success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'We could not update your password. Please try again.';
      notifications.error(message, 'Password update failed');
      setErrorMessage(message);
      setStatus('ready');
    }
  };

  const isSubmitting = status === 'submitting';
  const isReady = status === 'ready' && !!sessionUser && isInviteLink;
  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const canSubmit = isReady && !isSubmitting && !passwordTooShort && !passwordsMismatch && password.length >= MIN_PASSWORD_LENGTH;

  if (!supabase) {
    return (
      <div className="min-h-screen bg-light-bg-page dark:bg-dark-bg-page flex items-center justify-center p-4">
        <div className="bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-lg shadow-lg w-full max-w-md p-8">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">Supabase Not Configured</h1>
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              Connect your Supabase project before sending invite links. Once Supabase is configured, re-open your invitation to finish setting your password.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity"
            >
              Return to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light-bg-page dark:bg-dark-bg-page flex items-center justify-center p-4">
      <div className="bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-lg shadow-lg w-full max-w-md p-8">
        <div className="text-center mb-6 space-y-2">
          <h1 className="font-serif text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
            Set your password
          </h1>
          {sessionUser?.email ? (
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              Completing setup for <span className="font-medium text-light-text-primary dark:text-dark-text-primary">{sessionUser.email}</span>
            </p>
          ) : (
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              {isInviteLink
                ? 'We are validating your invitation. Hang tight for a moment.'
                : 'Use the invitation link from your email to set your initial password.'}
            </p>
          )}
        </div>

        {status === 'initializing' && (
          <div className="flex flex-col items-center space-y-4 py-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-accent"></div>
            <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm">
              Checking your invitation details...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-6">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-800 dark:text-red-200">
                {errorMessage ?? 'We were unable to complete your invitation. The link may be invalid or expired.'}
              </p>
            </div>
            <div className="space-y-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">
              {!hasInviteHash && (
                <p>Open the invitation email again and ensure you click the full link provided.</p>
              )}
              <p>If the issue persists, ask your administrator to send you a new invitation.</p>
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity"
              >
                Return to login
              </button>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4 text-center">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
              <p className="text-sm text-green-800 dark:text-green-200">
                Password updated successfully! Redirecting you to the dashboard...
              </p>
            </div>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
              If you are not redirected automatically, use the button below to continue.
            </p>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity"
            >
              Go to dashboard
            </button>
          </div>
        )}

        {(status === 'ready' || status === 'submitting') && sessionUser && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label htmlFor="password" className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                New password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
                  placeholder="Create a strong password"
                  disabled={isSubmitting}
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-3 flex items-center text-sm text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {passwordTooShort && (
                <p className="text-xs text-red-600 dark:text-red-300">Password must be at least {MIN_PASSWORD_LENGTH} characters long.</p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="confirm-password" className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                Confirm password
              </label>
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
                placeholder="Re-enter your password"
                disabled={isSubmitting}
                autoComplete="new-password"
              />
              {passwordsMismatch && (
                <p className="text-xs text-red-600 dark:text-red-300">Passwords do not match.</p>
              )}
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-800 dark:text-red-200">{errorMessage}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3 px-4 bg-primary-accent text-text-on-accent rounded-md font-medium hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving password...' : 'Save password'}
            </button>

            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary text-center">
              After setting your password you will be redirected to Artemo automatically.
            </p>
          </form>
        )}

        {storeIsAuthenticated && !isInviteLink && status !== 'success' && (
          <div className="mt-6 text-center text-sm text-light-text-secondary dark:text-dark-text-secondary">
            <p>You are already signed in. If you meant to update your password, visit your account settings instead.</p>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="mt-3 px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity"
            >
              Go to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SetPasswordPage;
