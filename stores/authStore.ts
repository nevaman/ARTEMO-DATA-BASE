import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Session } from '@supabase/supabase-js';
import { SupabaseApiService } from '../services/supabaseApi';
import { Logger } from '../utils/logger';
import type { ClientProfile } from '../types';

// Session status enum for better state management
export type SessionStatus = 'loading' | 'authenticated' | 'refreshing' | 'unauthenticated';

interface UserProfile {
  id: string;
  full_name: string | null;
  role: 'user' | 'admin';
  organization: string | null;
  avatar_url: string | null;
  preferences: {
    clientProfiles?: ClientProfile[];
    defaultClientProfileId?: string;
    dismissedAnnouncements?: string[];
    notificationSettings?: Record<string, boolean>;
    uiPreferences?: Record<string, any>;
  };
  default_client_profile_id?: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  sessionStatus: SessionStatus;
  refreshPromise: Promise<boolean> | null;
  activeClientProfileId: string | null;
  
  // Actions
  setAuth: (user: User | null, session: Session | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;
  setSessionStatus: (status: SessionStatus) => void;
  setRefreshPromise: (promise: Promise<boolean> | null) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  setActiveClientProfileId: (profileId: string | null) => void;
  getActiveClientProfile: () => ClientProfile | null;
  
  // Client Profile Actions
  saveClientProfile: (profile: ClientProfile) => Promise<void>;
  deleteClientProfile: (profileId: string) => Promise<void>;
  setDefaultClientProfile: (profileId: string | null) => Promise<void>;
  getClientProfiles: () => ClientProfile[];
  getDefaultClientProfile: () => ClientProfile | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      profile: null,
      isLoading: true,
      isAuthenticated: false,
      isAdmin: false,
      sessionStatus: 'loading',
      refreshPromise: null,
      activeClientProfileId: null,

      setAuth: (user, session) => {
        console.log('🔧 AUTH DIAGNOSTIC: AuthStore.setAuth called', {
          userId: user?.id,
          hasSession: !!session,
          sessionExpiry: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'N/A',
          isSessionValid: session?.expires_at ? session.expires_at > Date.now() / 1000 : false,
          timestamp: new Date().toISOString(),
          currentState: get().isAuthenticated,
          tabVisible: !document.hidden,
          pageVisibility: document.visibilityState
        });

        // Validate session before setting
        if (session && session.expires_at && session.expires_at < Date.now() / 1000) {
          console.log('🔧 AUTH DIAGNOSTIC: Attempted to set expired session, rejecting');
          Logger.warn('Attempted to set expired session', {
            component: 'AuthStore',
            expiresAt: session.expires_at,
            currentTime: Date.now() / 1000,
          });
          
          // Only clear if not in a refreshing state
          const currentState = get();
          if (currentState.sessionStatus !== 'refreshing') {
            set({
              user: null,
              session: null,
              isAuthenticated: false,
              isLoading: false,
              sessionStatus: 'unauthenticated',
              refreshPromise: null,
            });
          }
          return;
        }

        Logger.info('Auth state updated', {
          component: 'AuthStore',
          userId: user?.id,
          hasSession: !!session,
        });


        set({
          user,
          session,
          isAuthenticated: !!user && !!session,
          isLoading: false,
          sessionStatus: !!user && !!session ? 'authenticated' : 'unauthenticated',
          refreshPromise: null,
        });

        // Set user context for logging
        if (user) {
          Logger.setUserId(user.id);
        }
      },

      setProfile: (profile) => {
        console.log('🔧 AUTH DIAGNOSTIC: AuthStore.setProfile called', {
          userId: profile?.id,
          role: profile?.role,
          timestamp: new Date().toISOString()
        });

        Logger.info('User profile updated', {
          component: 'AuthStore',
          userId: profile?.id,
          role: profile?.role,
        });

        set({
          profile,
          isAdmin: profile?.role === 'admin',
        });
        
        // Initialize active client profile if none is set
        const currentState = get();
        if (profile && !currentState.activeClientProfileId) {
          const defaultProfile = profile.default_client_profile_id;
          if (defaultProfile) {
            set({ activeClientProfileId: defaultProfile });
          } else {
            const clientProfiles = profile.preferences?.clientProfiles || [];
            if (clientProfiles.length > 0) {
              set({ activeClientProfileId: clientProfiles[0].id });
            }
          }
        }
        
        // Force a re-render by updating the state
        if (profile?.role === 'admin' && !currentState.isAdmin) {
          console.log('Admin role detected, updating isAdmin flag');
        }
      },

      setLoading: (loading) => set({ isLoading: loading }),

      clearAuth: () => {
        console.log('🔧 AUTH DIAGNOSTIC: AuthStore.clearAuth called', {
          previousState: {
            isAuthenticated: get().isAuthenticated,
            userId: get().user?.id,
            hasProfile: !!get().profile
          },
          timestamp: new Date().toISOString(),
          tabVisible: !document.hidden,
          pageVisibility: document.visibilityState
        });

        Logger.info('Auth cleared', {
          component: 'AuthStore',
        });

        set({
          user: null,
          session: null,
          profile: null,
          isAuthenticated: false,
          isAdmin: false,
          sessionStatus: 'unauthenticated',
          refreshPromise: null,
        });

        Logger.setUserId('anonymous');
      },

      setSessionStatus: (status) => {
        console.log('🔧 AUTH DIAGNOSTIC: Setting session status to:', status);
        set({ sessionStatus: status });
      },

      setRefreshPromise: (promise) => {
        set({ refreshPromise: promise });
      },

      updateProfile: (updates) => {
        const currentProfile = get().profile;
        if (currentProfile) {
          const updatedProfile = { ...currentProfile, ...updates };
          set({ profile: updatedProfile });
          
          Logger.info('Profile updated locally', {
            component: 'AuthStore',
            userId: currentProfile.id,
            updates: Object.keys(updates),
          });
        }
      },

      setActiveClientProfileId: (profileId) => {
        set({ activeClientProfileId: profileId });
        
        Logger.info('Active client profile updated', {
          component: 'AuthStore',
          activeClientProfileId: profileId,
        });
      },

      getActiveClientProfile: () => {
        const { activeClientProfileId, profile } = get();
        const clientProfiles = profile?.preferences?.clientProfiles || [];
        
        // If we have an active profile ID, try to find it
        if (activeClientProfileId) {
          const activeProfile = clientProfiles.find(p => p.id === activeClientProfileId);
          if (activeProfile) {
            return activeProfile;
          }
        }
        
        // Fall back to default profile
        const defaultId = profile?.default_client_profile_id;
        if (defaultId) {
          const defaultProfile = clientProfiles.find(p => p.id === defaultId);
          if (defaultProfile) {
            return defaultProfile;
          }
        }
        
        // Fall back to first available profile
        return clientProfiles.length > 0 ? clientProfiles[0] : null;
      },
      // Client Profile Actions
      saveClientProfile: async (profile: ClientProfile) => {
        const { user } = get();
        if (!user) throw new Error('User not authenticated');

        const api = SupabaseApiService.getInstance();
        const response = await api.saveClientProfile(user.id, profile);
        
        if (response.success) {
          // Update local state
          const currentProfile = get().profile;
          if (currentProfile) {
            const currentClientProfiles = currentProfile.preferences?.clientProfiles || [];
            const existingIndex = currentClientProfiles.findIndex(p => p.id === profile.id);
            
            let updatedClientProfiles;
            if (existingIndex >= 0) {
              updatedClientProfiles = [...currentClientProfiles];
              updatedClientProfiles[existingIndex] = profile;
            } else {
              updatedClientProfiles = [...currentClientProfiles, profile];
            }

            set({
              profile: {
                ...currentProfile,
                preferences: {
                  ...currentProfile.preferences,
                  clientProfiles: updatedClientProfiles,
                }
              }
            });
          }
        } else {
          throw new Error(response.error || 'Failed to save client profile');
        }
      },

      deleteClientProfile: async (profileId: string) => {
        const { user } = get();
        if (!user) throw new Error('User not authenticated');

        const api = SupabaseApiService.getInstance();
        const response = await api.deleteClientProfile(user.id, profileId);
        
        if (response.success) {
          // Update local state
          const currentProfile = get().profile;
          const currentState = get();
          if (currentProfile) {
            const currentClientProfiles = currentProfile.preferences?.clientProfiles || [];
            const updatedClientProfiles = currentClientProfiles.filter(p => p.id !== profileId);

            set({
              profile: {
                ...currentProfile,
                preferences: {
                  ...currentProfile.preferences,
                  clientProfiles: updatedClientProfiles,
                },
                // Clear default if deleted profile was default
                default_client_profile_id: currentProfile.default_client_profile_id === profileId 
                  ? undefined 
                  : currentProfile.default_client_profile_id,
              }
            });
            
            // Update active client profile if the deleted one was active
            if (currentState.activeClientProfileId === profileId) {
              // Fall back to default or first available profile
              const defaultId = currentProfile.default_client_profile_id;
              if (defaultId && defaultId !== profileId) {
                set({ activeClientProfileId: defaultId });
              } else if (updatedClientProfiles.length > 0) {
                set({ activeClientProfileId: updatedClientProfiles[0].id });
              } else {
                set({ activeClientProfileId: null });
              }
            }
          }
        } else {
          throw new Error(response.error || 'Failed to delete client profile');
        }
      },

      setDefaultClientProfile: async (profileId: string | null) => {
        const { user } = get();
        if (!user) throw new Error('User not authenticated');

        const api = SupabaseApiService.getInstance();
        const response = await api.updateDefaultClientProfile(user.id, profileId);
        
        if (response.success) {
          // Update local state
          const currentProfile = get().profile;
          if (currentProfile) {
            set({
              profile: {
                ...currentProfile,
                default_client_profile_id: profileId || undefined,
              }
            });
          }
        } else {
          throw new Error(response.error || 'Failed to update default client profile');
        }
      },

      getClientProfiles: () => {
        const { profile } = get();
        return profile?.preferences?.clientProfiles || [];
      },

      getDefaultClientProfile: () => {
        const { profile } = get();
        const clientProfiles = profile?.preferences?.clientProfiles || [];
        const defaultId = profile?.default_client_profile_id;
        
        if (defaultId) {
          return clientProfiles.find(p => p.id === defaultId) || null;
        }
        
        return clientProfiles.length > 0 ? clientProfiles[0] : null;
      },
    }),
    {
      name: 'artemo-auth-storage',
      version: 1,
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        profile: state.profile,
        isAuthenticated: state.isAuthenticated,
        isAdmin: state.isAdmin,
        activeClientProfileId: state.activeClientProfileId,
      }),
      onRehydrateStorage: () => (state) => {
        console.log('🔧 AUTH DIAGNOSTIC: Zustand rehydrating auth state', {
          hasUser: !!state?.user,
          hasSession: !!state?.session,
          isAuthenticated: state?.isAuthenticated,
          timestamp: new Date().toISOString()
        });
        
        // Set loading to false after rehydration
        if (state) {
          state.isLoading = false;
        }
      },
    }
  )
);