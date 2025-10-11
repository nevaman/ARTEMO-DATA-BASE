import { createClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandler';
import { useAuthStore } from '../stores/authStore';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment on startup
const envValidation = ErrorHandler.validateEnvironment();
if (!envValidation.isValid) {
  console.error('Supabase environment validation failed:', envValidation.missingVars);
}

// Check if Supabase is properly configured - more strict validation
const isSupabaseConfigured = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'your_supabase_project_url' &&
  supabaseUrl !== 'https://your_supabase_project_url.supabase.co' &&
  supabaseAnonKey !== 'your_supabase_anon_key' &&
  supabaseUrl.includes('supabase.co') &&
  supabaseUrl.startsWith('https://') &&
  supabaseAnonKey.length > 20 // Basic validation for anon key length
);

if (!isSupabaseConfigured) {
  const error = {
    message: 'Supabase configuration missing or not set up',
    code: 'SUPABASE_CONFIG_ERROR',
    details: 'Please click "Connect to Supabase" button to set up your Supabase project',
    timestamp: new Date().toISOString(),
    component: 'SupabaseClient',
    severity: 'critical' as const,
  };
  
  Logger.critical(error);
  console.warn('Supabase not configured yet. Please connect to Supabase to enable backend features.');
}

// Only create client if properly configured - prevent any network calls
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'artemo-auth-token',
        debug: true,
        storage: {
          getItem: (key: string) => {
            try {
              const value = localStorage.getItem(key);
              console.log('🔧 STORAGE: Getting auth data', { key, hasValue: !!value });
              return value;
            } catch {
              console.log('🔧 STORAGE: Failed to get auth data', { key });
              return null;
            }
          },
          setItem: (key: string, value: string) => {
            try {
              console.log('🔧 STORAGE: Setting auth data', { key, valueLength: value.length });
              localStorage.setItem(key, value);
            } catch {
              console.log('🔧 STORAGE: Failed to set auth data', { key });
              // Ignore storage errors
            }
          },
          removeItem: (key: string) => {
            try {
              console.log('🔧 STORAGE: Removing auth data', { key });
              localStorage.removeItem(key);
            } catch {
              console.log('🔧 STORAGE: Failed to remove auth data', { key });
              // Ignore storage errors
            }
          }
        }
      },
      global: {
        headers: {
          'X-Client-Info': 'artemo-dashboard'
        }
      }
    })
  : null;


// Immediately log configuration status
console.log('Supabase Configuration Status:', {
  configured: isSupabaseConfigured,
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  urlValid: supabaseUrl?.includes('supabase.co'),
});

// Helper to check if Supabase is available
export const isSupabaseAvailable = () => {
  return supabase !== null;
};

// Wait for stable session utility
export const waitForStableSession = async (timeoutMs: number = 5000): Promise<boolean> => {
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const checkStability = () => {
      const authState = useAuthStore.getState();
      
      // If we're not refreshing and we're authenticated, we're stable
      if (authState.sessionStatus === 'authenticated' && authState.isAuthenticated) {
        resolve(true);
        return;
      }
      
      // If we're definitely unauthenticated, we're stable (but not authenticated)
      if (authState.sessionStatus === 'unauthenticated') {
        resolve(false);
        return;
      }
      
      // If we've exceeded timeout, resolve as unstable
      if (Date.now() - startTime > timeoutMs) {
        console.log('🔧 SUPABASE: Session stability timeout reached');
        resolve(false);
        return;
      }
      
      // If we're still loading or refreshing, check again in 100ms
      if (authState.sessionStatus === 'loading' || authState.sessionStatus === 'refreshing') {
        setTimeout(checkStability, 100);
        return;
      }
      
      // Unknown state, resolve as unstable
      resolve(false);
    };
    
    checkStability();
  });
};

// Safe wrapper for Supabase operations
export const withSupabase = async <T>(
  operation: () => Promise<T>,
  fallback: T
): Promise<T> => {
  if (!isSupabaseAvailable()) {
    console.log('🔧 SUPABASE: Not configured, using fallback for operation');
    return fallback;
  }
  
  // Wait for stable session before proceeding
  const isStable = await waitForStableSession(3000);
  if (!isStable) {
    console.log('🔧 SUPABASE: Session not stable, using fallback for operation');
    return fallback;
  }
  
  try {
    return await operation();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Check for auth-specific errors that should trigger logout
    if (errorMessage.includes('Invalid JWT') || 
        errorMessage.includes('JWT expired') || 
        errorMessage.includes('Invalid token') ||
        errorMessage.includes('Session expired')) {
      console.log('🔧 SUPABASE: Auth error detected, triggering logout');
      
      // Import auth store dynamically to avoid circular dependency
      import('../stores/authStore').then(({ useAuthStore }) => {
        const authState = useAuthStore.getState();
        // Only clear auth if we're not in a refresh state
        if (authState.sessionStatus !== 'refreshing') {
          useAuthStore.getState().clearAuth();
        }
      });
    }
    
    // Check for network/connection errors
    if (errorMessage.includes('Failed to fetch') || 
        errorMessage.includes('TypeError: Failed to fetch') || 
        error instanceof TypeError ||
        errorMessage.includes('Network request failed') ||
        errorMessage.includes('fetch is not defined')) {
      console.log('🔧 SUPABASE: Connection failed - likely not configured properly');
      return fallback;
    }
    
    console.log('🔧 SUPABASE: Operation failed, using fallback. Error:', errorMessage);
    
    // Log network errors differently
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('TypeError: Failed to fetch') || error instanceof TypeError) {
      console.log('🔧 SUPABASE: Network connectivity issue detected - Supabase may not be properly configured');
      // Don't log this as an error since it's expected when Supabase isn't configured
      return fallback;
    }
    
    return fallback;
  }
};

// Enhanced error handling for Supabase operations
export const handleSupabaseError = (error: any, operation: string, context?: Record<string, any>) => {
  return ErrorHandler.handleSupabaseError(error, operation, context);
};

// Type-safe database types (will be generated from schema)
export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          full_name: string | null;
          role: 'user' | 'admin';
          organization: string | null;
          avatar_url: string | null;
          preferences: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          role?: 'user' | 'admin';
          organization?: string | null;
          avatar_url?: string | null;
          preferences?: any;
        };
        Update: {
          full_name?: string | null;
          role?: 'user' | 'admin';
          organization?: string | null;
          avatar_url?: string | null;
          preferences?: any;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          display_order: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          slug: string;
          description?: string | null;
          display_order?: number;
          active?: boolean;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string | null;
          display_order?: number;
          active?: boolean;
        };
      };
      tools: {
        Row: {
          id: string;
          title: string;
          slug: string;
          description: string;
          category_id: string;
          active: boolean;
          featured: boolean;
          primary_model: string;
          fallback_models: string[];
          prompt_instructions: string;
          usage_count: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          title: string;
          slug: string;
          description: string;
          category_id: string;
          active?: boolean;
          featured?: boolean;
          primary_model?: string;
          fallback_models?: string[];
          prompt_instructions: string;
          created_by?: string | null;
        };
        Update: {
          title?: string;
          slug?: string;
          description?: string;
          category_id?: string;
          active?: boolean;
          featured?: boolean;
          primary_model?: string;
          fallback_models?: string[];
          prompt_instructions?: string;
        };
      };
    };
    Functions: {};
    Enums: {};
  };
};