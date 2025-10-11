import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { AuthService } from '../services/auth';
import { isSupabaseAvailable } from '../lib/supabase';
import { Logger } from '../utils/logger';

interface UseAuthSessionOptions {
  enablePeriodicValidation?: boolean;
  enableFocusRecovery?: boolean;
  validationIntervalMs?: number;
}

interface UseAuthSessionReturn {
  isAuthenticated: boolean;
  sessionStatus: 'loading' | 'authenticated' | 'unauthenticated' | 'refreshing';
  isInitializing: boolean;
  user: any;
  session: any;
  profile: any;
}

export function useAuthSession(options: UseAuthSessionOptions = {}): UseAuthSessionReturn {
  const {
    enablePeriodicValidation = true,
    enableFocusRecovery = true,
    validationIntervalMs = 30000,
  } = options;

  const { isAuthenticated, sessionStatus, user, session, profile } = useAuthStore();
  const [isInitializing, setIsInitializing] = useState(true);
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshGuardRef = useRef(false);
  const authSubscriptionRef = useRef<any>(null);

  useEffect(() => {
    Logger.setCorrelationId();
    Logger.setSessionId(crypto.randomUUID());

    console.log('🔧 AUTH: useAuthSession hook initialized', {
      timestamp: new Date().toISOString(),
      enablePeriodicValidation,
      enableFocusRecovery,
      validationIntervalMs,
    });

    Logger.info('Authentication session hook initialized', {
      component: 'useAuthSession',
      version: '1.0.0',
      environment: import.meta.env.MODE || 'development',
    });

    if (!isSupabaseAvailable()) {
      console.log('🔧 AUTH: Supabase not available, skipping auth setup');
      setIsInitializing(false);
      return;
    }

    const initAuth = async () => {
      console.log('🔧 AUTH: Initializing authentication');

      const authService = AuthService.getInstance();

      authSubscriptionRef.current = authService.setupAuthListener({
        onAuthError: (error) => {
          console.log('🔧 AUTH: Auth error detected, clearing state', error);
          Logger.error({
            message: 'Authentication error detected',
            code: 'AUTH_STATE_ERROR',
            details: error.message,
            timestamp: new Date().toISOString(),
            correlationId: Logger.getCorrelationId(),
            component: 'useAuthSession',
            severity: 'error',
          });

          useAuthStore.getState().clearAuth();
        },
        onSessionExpired: () => {
          console.log('🔧 AUTH: Session expired, clearing state');
          Logger.warn('User session expired', {
            component: 'useAuthSession',
            userId: useAuthStore.getState().user?.id,
          });

          useAuthStore.getState().clearAuth();
        }
      });

      const session = await authService.getCurrentSession();
      if (session?.user) {
        console.log('🔧 AUTH: Found existing session, setting auth state');
        useAuthStore.getState().setAuth(session.user, session);

        const profile = await authService.getUserProfile(session.user.id);
        if (profile) {
          useAuthStore.getState().setProfile(profile);
        }
      }

      setIsInitializing(false);
    };

    initAuth();

    if (enablePeriodicValidation) {
      const startSessionValidation = () => {
        if (sessionCheckIntervalRef.current) {
          clearInterval(sessionCheckIntervalRef.current);
        }

        const interval = setInterval(async () => {
          const currentState = useAuthStore.getState();

          if (currentState.isAuthenticated && currentState.session && isSupabaseAvailable() && !isRefreshGuardRef.current) {
            console.log('🔧 AUTH: Periodic session validation check');

            try {
              const needsRefresh = currentState.session.expires_at &&
                currentState.session.expires_at < (Date.now() / 1000) + 300;

              if (needsRefresh) {
                console.log('🔧 AUTH: Session needs refresh, attempting refresh');
                isRefreshGuardRef.current = true;

                const authService = AuthService.getInstance();
                const refreshSuccess = await authService.tryRefreshWithTimeout(10000);

                if (!refreshSuccess) {
                  console.log('🔧 AUTH: Session refresh failed, clearing auth');
                  useAuthStore.getState().clearAuth();
                }

                isRefreshGuardRef.current = false;
              }
            } catch (error) {
              console.log('🔧 AUTH: Session validation error:', error);

              const errorMessage = error instanceof Error ? error.message : '';
              if (!isRefreshGuardRef.current && (errorMessage.includes('Invalid JWT') ||
                  errorMessage.includes('JWT expired') ||
                  errorMessage.includes('Invalid token'))) {
                Logger.warn('Session validation failed with auth error', {
                  component: 'useAuthSession',
                  error: errorMessage,
                  userId: currentState.user?.id,
                });

                useAuthStore.getState().clearAuth();
              }
            }
          }
        }, validationIntervalMs);

        sessionCheckIntervalRef.current = interval;
      };

      setTimeout(startSessionValidation, 5000);
    }

    if (enableFocusRecovery) {
      const handlePageFocus = async () => {
        console.log('🔧 AUTH: Page focus gained, checking session validity');

        setTimeout(async () => {
          console.log('🔧 AUTH: Delayed session check after focus');

          if (!isRefreshGuardRef.current) {
            const currentState = useAuthStore.getState();
            if (currentState.isAuthenticated && currentState.session && isSupabaseAvailable()) {
              const needsRefresh = currentState.session.expires_at &&
                currentState.session.expires_at < (Date.now() / 1000) + 60;

              if (needsRefresh) {
                console.log('🔧 AUTH: Session needs refresh on focus, attempting refresh');
                isRefreshGuardRef.current = true;

                const authService = AuthService.getInstance();
                const refreshSuccess = await authService.tryRefreshWithTimeout(10000);

                if (!refreshSuccess) {
                  console.log('🔧 AUTH: Session refresh failed on focus, clearing auth');
                  useAuthStore.getState().clearAuth();
                }

                isRefreshGuardRef.current = false;
              } else {
                console.log('🔧 AUTH: Stored session still valid on focus');
              }
            }
          }
        }, 100);
      };

      const handleVisibilityChange = () => {
        console.log('🔧 AUTH: Page visibility changed', {
          hidden: document.hidden,
          visibilityState: document.visibilityState,
          timestamp: new Date().toISOString(),
          currentAuthState: useAuthStore.getState().isAuthenticated,
          userId: useAuthStore.getState().user?.id
        });

        if (!document.hidden) {
          handlePageFocus();
        }
      };

      const handleFocus = () => {
        console.log('🔧 AUTH: Window focus gained', {
          timestamp: new Date().toISOString(),
          currentAuthState: useAuthStore.getState().isAuthenticated,
          userId: useAuthStore.getState().user?.id
        });
        handlePageFocus();
      };

      const handleBlur = () => {
        console.log('🔧 AUTH: Window focus lost', {
          timestamp: new Date().toISOString(),
          currentAuthState: useAuthStore.getState().isAuthenticated,
          userId: useAuthStore.getState().user?.id
        });
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleFocus);
      window.addEventListener('blur', handleBlur);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('blur', handleBlur);
      };
    }

    return () => {
      console.log('🔧 AUTH: useAuthSession cleanup', {
        timestamp: new Date().toISOString()
      });

      authSubscriptionRef.current?.data?.subscription?.unsubscribe();

      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }

      isRefreshGuardRef.current = false;
    };
  }, [enablePeriodicValidation, enableFocusRecovery, validationIntervalMs]);

  return {
    isAuthenticated,
    sessionStatus,
    isInitializing,
    user,
    session,
    profile,
  };
}
