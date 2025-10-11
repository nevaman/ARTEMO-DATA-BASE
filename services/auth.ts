import { supabase, handleSupabaseError, isSupabaseAvailable } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { Logger } from '../utils/logger';
import type { AuthError, ErrorResponse } from '../types';

// Helper function to create structured error responses
function createErrorResponse(
  message: string,
  code: string,
  details: string,
  severity: 'info' | 'warn' | 'error' | 'critical',
  correlationId: string
): ErrorResponse {
  return {
    message,
    code,
    details,
    timestamp: new Date().toISOString(),
    correlationId,
    component: 'AuthService',
    severity,
  };
}

// Enhanced logging for auth operations
class EdgeLogger {
  static info(message: string, correlationId: string, context?: Record<string, any>) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      correlationId,
      component: 'AuthService',
      context,
    }));
  }

  static error(message: string, correlationId: string, context?: Record<string, any>) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      correlationId,
      component: 'AuthService',
      context,
    }));
  }
}

export class AuthService {
  private static instance: AuthService;
  
  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private mapSupabaseAuthError(error: any, method: 'signin' | 'signup' | 'signout', email?: string): AuthError {
    const baseError: AuthError = {
      message: 'An authentication error occurred',
      code: 'AUTH_UNKNOWN_ERROR',
      timestamp: new Date().toISOString(),
      correlationId: Logger.getCorrelationId(),
      component: 'AuthService',
      severity: 'error',
      authProvider: 'supabase',
      authMethod: method,
      attemptedEmail: email,
      details: error.message || error.toString(),
    };

    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code || '';
    
    if (errorMessage.includes('invalid login credentials') || errorMessage.includes('invalid email or password')) {
      return {
        ...baseError,
        message: 'Invalid email or password. Please check your credentials and try again.',
        code: 'AUTH_INVALID_CREDENTIALS',
      };
    }
    
    if (errorMessage.includes('user already registered') || errorMessage.includes('already exists')) {
      return {
        ...baseError,
        message: 'An account with this email already exists. Please sign in instead.',
        code: 'AUTH_USER_EXISTS',
        severity: 'warn',
      };
    }
    
    if (errorMessage.includes('email not confirmed') || errorMessage.includes('confirm')) {
      return {
        ...baseError,
        message: 'Please confirm your email address before signing in.',
        code: 'AUTH_EMAIL_NOT_CONFIRMED',
        severity: 'warn',
      };
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return {
        ...baseError,
        message: 'Network connection error. Please check your internet connection and try again.',
        code: 'AUTH_NETWORK_ERROR',
      };
    }
    
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
      return {
        ...baseError,
        message: 'Too many login attempts. Please wait a moment before trying again.',
        code: 'AUTH_RATE_LIMIT',
        severity: 'warn',
      };
    }

    // Handle specific Supabase error codes
    if (errorCode === '42P17') {
      return {
        ...baseError,
        message: 'Database configuration error. Please contact support.',
        code: 'AUTH_DATABASE_CONFIG_ERROR',
        details: 'Infinite recursion detected in database policies',
      };
    }

    if (errorCode === '23505') {
      return {
        ...baseError,
        message: 'An account with this email already exists. Please sign in instead.',
        code: 'AUTH_USER_EXISTS',
        severity: 'warn',
      };
    }

    if (errorCode === '23503') {
      return {
        ...baseError,
        message: 'Account creation failed due to database constraints. Please try again.',
        code: 'AUTH_DATABASE_CONSTRAINT_ERROR',
      };
    }

    // Provide more specific error message based on available information
    const specificMessage = error.message || error.details || 'Unknown authentication error';

    return {
      ...baseError,
      message: `Authentication failed: ${specificMessage}. Please try again or contact support if the problem persists.`,
      code: 'AUTH_GENERIC_ERROR',
      details: `Original error: ${JSON.stringify({ code: errorCode, message: error.message, details: error.details })}`,
    };
  }

  private sanitizeEmail(email: string): string {
    const [local, domain] = email.split('@');
    return `${local.substring(0, 2)}***@${domain}`;
  }

  async signIn(email: string, password: string): Promise<{ user: any; session: any }> {
    if (!isSupabaseAvailable()) {
      throw new Error('Supabase not configured. Please connect to Supabase first.');
    }

    const startTime = performance.now();
    const correlationId = Logger.getCorrelationId();
    
    Logger.authAttempt('signin', email);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      if (!data.user || !data.session) {
        throw new Error('Authentication succeeded but no user data returned');
      }

      // Fetch user profile
      const profile = await this.getUserProfile(data.user.id);
      
      // Update auth store
      useAuthStore.getState().setAuth(data.user, data.session);
      useAuthStore.getState().setProfile(profile);

      const endTime = performance.now();
      Logger.performance('auth_signin', endTime - startTime, {
        success: true,
        userId: data.user.id,
        hasProfile: !!profile,
      });

      Logger.authSuccess('signin', data.user.id);
      
      return data;
    } catch (error: any) {
      const endTime = performance.now();
      const authError = this.mapSupabaseAuthError(error, 'signin', email);
      
      Logger.performance('auth_signin', endTime - startTime, {
        success: false,
        errorCode: authError.code,
      });
      
      Logger.authError(authError);
      throw authError;
    }
  }

  async signUp(email: string, password: string, fullName: string): Promise<{ user: any; session: any }> {
    if (!isSupabaseAvailable()) {
      const error = createErrorResponse(
        'Supabase not configured. Please connect to Supabase first.',
        'AUTH_SUPABASE_NOT_CONFIGURED',
        'Supabase connection is required for user registration',
        'error',
        Logger.getCorrelationId()
      );
      throw error;
    }

    const startTime = performance.now();
    const correlationId = Logger.getCorrelationId();
    
    Logger.authAttempt('signup', email);
    
    try {
      EdgeLogger.info('Starting user signup process', correlationId, {
        email: this.sanitizeEmail(email),
        fullName: fullName.substring(0, 3) + '***',
      });

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      });

      if (error) {
        EdgeLogger.error('Supabase auth signup failed', correlationId, {
          supabaseError: error,
          email: this.sanitizeEmail(email),
          errorCode: error.code,
          errorMessage: error.message,
        });
        throw error;
      }

      if (!data.user) {
        const profileError = createErrorResponse(
          'User creation succeeded but no user data returned',
          'AUTH_USER_DATA_MISSING',
          'Supabase auth.signUp returned success but data.user is null',
          'error',
          correlationId
        );
        throw profileError;
      }

      EdgeLogger.info('Supabase auth signup successful, creating profile', correlationId, {
        userId: data.user.id,
        email: this.sanitizeEmail(email),
      });

      // Profile creation is now handled automatically by database trigger
      // Wait a moment for the trigger to complete, then fetch the profile
      if (data.user) {
        setTimeout(async () => {
          try {
            const profile = await this.getUserProfile(data.user.id);
            if (profile) {
              useAuthStore.getState().setProfile(profile);
              EdgeLogger.info('User profile loaded after signup', correlationId, {
                userId: data.user.id,
                profileId: profile.id,
              });
            }
          } catch (profileError) {
            EdgeLogger.error('Failed to load user profile after signup', correlationId, {
              userId: data.user.id,
              error: profileError instanceof Error ? profileError.message : 'Unknown error',
            });
          }
        }, 1000);
      }

      const endTime = performance.now();
      Logger.performance('auth_signup', endTime - startTime, {
        success: true,
        userId: data.user?.id,
      });

      Logger.authSuccess('signup', data.user?.id);
      
      return data;
    } catch (error: any) {
      const endTime = performance.now();
      
      // Log the raw error for debugging
      EdgeLogger.error('Raw signup error details', correlationId, {
        errorType: typeof error,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
        fullError: error,
      });
      
      // Check if this is already a structured error (like AUTH_PROFILE_CREATE_ERROR)
      let authError;
      if (error.code && error.message && error.severity && error.component) {
        // This is already a properly formatted ErrorResponse, use it directly
        authError = error;
      } else {
        // This is a raw Supabase error, map it to a structured error
        authError = this.mapSupabaseAuthError(error, 'signup', email);
      }
      
      Logger.performance('auth_signup', endTime - startTime, {
        success: false,
        errorCode: authError.code,
      });
      
      Logger.authError(authError);
      throw authError;
    }
  }

  async signOut(): Promise<void> {
    if (!isSupabaseAvailable()) {
      // Just clear local state if Supabase isn't available
      useAuthStore.getState().clearAuth();
      return;
    }

    const startTime = performance.now();
    
    Logger.authAttempt('signout');
    
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      // Clear auth store
      useAuthStore.getState().clearAuth();

      const endTime = performance.now();
      Logger.performance('auth_signout', endTime - startTime, { success: true });

      Logger.authSuccess('signout');
    } catch (error: any) {
      const endTime = performance.now();
      const authError = this.mapSupabaseAuthError(error, 'signout');
      
      Logger.performance('auth_signout', endTime - startTime, {
        success: false,
        errorCode: authError.code,
      });
      
      Logger.authError(authError);
      throw authError;
    }
  }

  async getCurrentSession() {
    if (!isSupabaseAvailable()) {
      Logger.info('Supabase not available, skipping getCurrentSession', { component: 'AuthService' });
      console.log('🔧 AUTH DIAGNOSTIC: getCurrentSession - Supabase not available');
      return null;
    }

    try {
      console.log('🔧 AUTH DIAGNOSTIC: getCurrentSession - Making Supabase call', {
        timestamp: new Date().toISOString(),
        tabVisible: !document.hidden
      });
      
      const { data: { session }, error } = await supabase!.auth.getSession();
      
      if (error) {
        console.log('🔧 AUTH DIAGNOSTIC: getCurrentSession - Supabase error', {
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString()
        });
        return null;
      }
      
      console.log('🔧 AUTH DIAGNOSTIC: getCurrentSession - Session result', {
        hasSession: !!session,
        userId: session?.user?.id,
        sessionExpiry: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'N/A',
        isExpired: session?.expires_at ? session.expires_at < Date.now() / 1000 : 'N/A',
        timestamp: new Date().toISOString()
      });
      
      return session;
    } catch (error: any) {
      console.log('🔧 AUTH DIAGNOSTIC: getCurrentSession - Exception', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return null;
    }
  }

  async getCurrentUser() {
    if (!isSupabaseAvailable()) {
      console.log('AuthService: Supabase not available, skipping getCurrentUser');
      console.log('🔧 AUTH DIAGNOSTIC: getCurrentUser - Supabase not available');
      return null;
    }

    try {
      const { data: { user }, error } = await supabase!.auth.getUser();
      
      if (error) {
        throw error;
      }
      
      if (user) {
        Logger.setUserId(user.id);
      }
      
      return user;
    } catch (error: any) {
      // Don't log auth errors for getCurrentUser - this is expected when not authenticated
      return null;
    }
  }

  async getUserProfile(userId: string) {
    if (!isSupabaseAvailable()) {
      console.log('🔧 AUTH: Supabase not available, skipping getUserProfile');
      return null;
    }

    try {
      console.log('🔧 AUTH: Getting user profile from Supabase');
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) {
        throw error;
      }
      
      return data;
    } catch (error: any) {
      // Check if this is a connection error (expected when Supabase isn't configured)
      const errorMessage = error.message || '';
      if (errorMessage.includes('Failed to fetch') || 
          errorMessage.includes('TypeError: Failed to fetch') || 
          error instanceof TypeError) {
        console.log('🔧 AUTH: Supabase connection failed - likely not configured');
        return null;
      }
      
      // Only log unexpected errors
      Logger.error({
        message: 'Failed to fetch user profile',
        code: 'AUTH_PROFILE_FETCH_ERROR',
        details: error.message,
        timestamp: new Date().toISOString(),
        correlationId: Logger.getCorrelationId(),
        component: 'AuthService',
        severity: 'error',
      }, { userId });
      
      return null;
    }
  }

  async createUserProfile(userId: string, fullName: string, email: string) {
    if (!isSupabaseAvailable()) {
      const error = createErrorResponse(
        'Supabase not connected',
        'AUTH_SUPABASE_NOT_AVAILABLE',
        'Cannot create user profile without Supabase connection',
        'error',
        Logger.getCorrelationId()
      );
      throw error;
    }

    const correlationId = Logger.getCorrelationId();
    
    try {
      EdgeLogger.info('Creating user profile', correlationId, {
        userId,
        fullName: fullName.substring(0, 3) + '***',
      });

      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          full_name: fullName,
          role: 'user',
        })
        .select()
        .single();

      if (error) {
        EdgeLogger.error('Database insert failed for user profile', correlationId, {
          userId,
          supabaseError: error,
        });
        throw error;
      }

      Logger.info('User profile created', {
        component: 'AuthService',
        userId,
        fullName: fullName.substring(0, 3) + '***',
      });

      return data;
    } catch (error: any) {
      const profileError = createErrorResponse(
        'Failed to create user profile',
        'AUTH_PROFILE_CREATE_ERROR',
        error.message || 'Unknown database error',
        'error',
        correlationId
      );
      
      Logger.error(profileError, { 
        userId, 
        fullName: fullName.substring(0, 3) + '***',
        supabaseError: error,
      });
      
      throw profileError;
    }
  }

  async resetPassword(email: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase not connected');
    }

    Logger.authAttempt('resetPassword', email);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      
      if (error) {
        console.log('AuthService: Error resetting password:', error);
        throw error;
      }
      
      console.log('AuthService: Password reset email sent');
      Logger.info('Password reset email sent', {
        component: 'AuthService',
        attemptedEmail: email,
      });
    } catch (error: any) {
      console.log('AuthService: resetPassword failed:', error);
      const authError = this.mapSupabaseAuthError(error, 'signin', email);
      Logger.authError(authError);
      throw authError;
    }
  }

  // Set up auth state listener
  setupAuthListener(options?: {
    onAuthError?: (error: Error) => void;
    onSessionExpired?: () => void;
  }) {
    console.log('🔧 AUTH DIAGNOSTIC: setupAuthListener called');
    console.log('🔧 AUTH DIAGNOSTIC: Supabase available:', isSupabaseAvailable());
    
    if (!isSupabaseAvailable()) {
      console.log('🔧 AUTH DIAGNOSTIC: Supabase not available, returning mock subscription');
      // Return a mock subscription that does nothing
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              console.log('🔧 AUTH DIAGNOSTIC: Mock subscription unsubscribed');
            }
          }
        }
      };
    }

    console.log('🔧 AUTH DIAGNOSTIC: Setting up Supabase auth state listener');
    
    return supabase!.auth.onAuthStateChange(async (event, session) => {
      console.log('🔧 AUTH DIAGNOSTIC: Auth state change detected', {
        event,
        hasSession: !!session,
        userId: session?.user?.id,
        sessionExpiry: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'N/A',
        isSessionValid: session?.expires_at ? session.expires_at > Date.now() / 1000 : false,
        timestamp: new Date().toISOString(),
        tabVisible: !document.hidden,
        pageVisibility: document.visibilityState,
        currentAuthState: useAuthStore.getState().isAuthenticated,
        currentUserId: useAuthStore.getState().user?.id
      });

      Logger.info('Auth state changed', {
        component: 'AuthService',
        event,
        hasSession: !!session,
        userId: session?.user?.id,
      });

      const { setAuth, clearAuth, setSessionStatus, setProfile } = useAuthStore.getState();

      // Handle token refresh events more carefully
      if (event === 'TOKEN_REFRESHED') {
        if (!session) {
          console.log('🔧 AUTH DIAGNOSTIC: Token refresh failed or session temporarily null, setting refreshing state');
          setSessionStatus('refreshing');
          // Do NOT call clearAuth here - wait for subsequent events
          if (options?.onSessionExpired) {
            options.onSessionExpired();
          }
          return;
        } else {
          console.log('🔧 AUTH DIAGNOSTIC: Token refreshed successfully, updating session');
          setAuth(session.user, session);
        }
      }
      
      // Handle session expiry
      if (session && session.expires_at && session.expires_at < Date.now() / 1000) {
        console.log('🔧 AUTH DIAGNOSTIC: Token refresh failed, session lost');
        Logger.warn('Token refresh failed', {
          component: 'AuthService',
          event,
        });
        
        clearAuth();
        
        if (options?.onSessionExpired) {
          options.onSessionExpired();
        }
        return;
      }

      // Handle auth state changes
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('🔧 AUTH DIAGNOSTIC: User signed in, setting auth state');
        
        // Set auth state immediately
        setAuth(session.user, session);
        
        // Get profile asynchronously
        this.getUserProfile(session.user.id).then(profile => {
          if (profile) {
            setProfile(profile);
          }
        }).catch(error => {
          console.log('🔧 AUTH DIAGNOSTIC: Failed to load profile:', error);
        });
      } else if (event === 'SIGNED_OUT' || !session) {
        console.log('🔧 AUTH DIAGNOSTIC: User signed out or no session, clearing auth state');
        clearAuth();
      } else if (event === 'USER_UPDATED' && session?.user) {
        console.log('🔧 AUTH DIAGNOSTIC: User updated, refreshing profile');
        setAuth(session.user, session);
        
        // Refresh user profile
        this.getUserProfile(session.user.id).then(profile => {
          if (profile) {
            setProfile(profile);
          }
        }).catch(error => {
          console.log('🔧 AUTH DIAGNOSTIC: Failed to refresh profile:', error);
        });
      }
    });
  }

  async validateCurrentSession(): Promise<boolean> {
    if (!isSupabaseAvailable()) {
      return false;
    }

    try {
      const session = await this.getCurrentSession();
      
      if (!session) {
        return false;
      }
      
      // Check if session is expired
      if (session.expires_at && session.expires_at < Date.now() / 1000) {
        Logger.warn('Session validation failed - expired', {
          component: 'AuthService',
          expiresAt: session.expires_at,
          currentTime: Date.now() / 1000,
        });
        return false;
      }
      
      return true;
    } catch (error) {
      Logger.error({
        message: 'Session validation failed',
        code: 'AUTH_SESSION_VALIDATION_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        correlationId: Logger.getCorrelationId(),
        component: 'AuthService',
        severity: 'warn',
      });
      
      return false;
    }
  }

  async refreshSessionIfNeeded(): Promise<boolean> {
    if (!isSupabaseAvailable()) {
      return false;
    }

    try {
      const { data, error } = await supabase!.auth.refreshSession();
      
      if (error) {
        Logger.warn('Session refresh failed', {
          component: 'AuthService',
          error: error.message,
        });
        return false;
      }
      
      if (data.session && data.user) {
        Logger.info('Session refreshed successfully', {
          component: 'AuthService',
          userId: data.user.id,
        });
        
        useAuthStore.getState().setAuth(data.user, data.session);
        return true;
      }
      
      return false;
    } catch (error) {
      Logger.error({
        message: 'Session refresh error',
        code: 'AUTH_SESSION_REFRESH_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        correlationId: Logger.getCorrelationId(),
        component: 'AuthService',
        severity: 'error',
      });
      
      return false;
    }
  }

  async tryRefreshWithTimeout(timeoutMs: number = 10000): Promise<boolean> {
    const correlationId = Logger.getCorrelationId();
    
    Logger.info('Attempting session refresh with timeout', {
      component: 'AuthService',
      timeoutMs,
    });

    try {
      // Set refreshing state
      useAuthStore.getState().setSessionStatus('refreshing');
      
      // Create refresh promise with timeout
      const refreshPromise = Promise.race([
        this.refreshSessionIfNeeded(),
        new Promise<boolean>((_, reject) => 
          setTimeout(() => reject(new Error('Refresh timeout')), timeoutMs)
        )
      ]);

      // Store the promise for other components to wait on
      useAuthStore.getState().setRefreshPromise(refreshPromise);

      const success = await refreshPromise;
      
      if (success) {
        Logger.info('Session refresh completed successfully', {
          component: 'AuthService',
          correlationId,
        });
        return true;
      } else {
        Logger.warn('Session refresh failed', {
          component: 'AuthService',
          correlationId,
        });
        return false;
      }
    } catch (error) {
      Logger.error({
        message: 'Session refresh with timeout failed',
        code: 'AUTH_SESSION_REFRESH_TIMEOUT',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        correlationId,
        component: 'AuthService',
        severity: 'error',
      });
      return false;
    } finally {
      // Clear refresh promise
      useAuthStore.getState().setRefreshPromise(null);
    }
  }
}