import { supabase, isSupabaseAvailable } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { Logger } from '../utils/logger';
import type { ApiResponse } from '../types';

interface UserPreferences {
  dismissedAnnouncements: string[];
  notificationSettings: Record<string, boolean>;
  uiPreferences: Record<string, any>;
}

export class UserPreferencesService {
  private static instance: UserPreferencesService;
  
  static getInstance(): UserPreferencesService {
    if (!UserPreferencesService.instance) {
      UserPreferencesService.instance = new UserPreferencesService();
    }
    return UserPreferencesService.instance;
  }

  async getDismissedAnnouncements(userId: string): Promise<string[]> {
    if (!isSupabaseAvailable()) {
      // Fallback to localStorage when Supabase isn't available
      try {
        const dismissed = localStorage.getItem('dismissedAnnouncements');
        return dismissed ? JSON.parse(dismissed) : [];
      } catch {
        return [];
      }
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('preferences')
        .eq('id', userId)
        .single();

      if (error) {
        throw error;
      }

      return data?.preferences?.dismissedAnnouncements || [];
    } catch (error) {
      Logger.warn('Failed to fetch dismissed announcements from backend, using localStorage fallback', {
        component: 'UserPreferencesService',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Fallback to localStorage
      try {
        const dismissed = localStorage.getItem('dismissedAnnouncements');
        return dismissed ? JSON.parse(dismissed) : [];
      } catch {
        return [];
      }
    }
  }

  async saveDismissedAnnouncements(userId: string, dismissedIds: string[]): Promise<void> {
    // Always save to localStorage for immediate effect
    try {
      localStorage.setItem('dismissedAnnouncements', JSON.stringify(dismissedIds));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }

    // Also save to backend if available
    if (!isSupabaseAvailable()) {
      return;
    }

    try {
      // Get current preferences
      const { data: currentProfile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('preferences')
        .eq('id', userId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      // Update preferences with new dismissed announcements
      const updatedPreferences = {
        ...currentProfile?.preferences,
        dismissedAnnouncements: dismissedIds,
      };

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ preferences: updatedPreferences })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      Logger.info('Dismissed announcements saved to backend', {
        component: 'UserPreferencesService',
        userId,
        dismissedCount: dismissedIds.length,
      });
    } catch (error) {
      Logger.warn('Failed to save dismissed announcements to backend', {
        component: 'UserPreferencesService',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - localStorage fallback is sufficient
    }
  }

  async getUserPreferences(userId: string): Promise<UserPreferences> {
    const dismissedAnnouncements = await this.getDismissedAnnouncements(userId);
    
    return {
      dismissedAnnouncements,
      notificationSettings: {},
      uiPreferences: {},
    };
  }
}