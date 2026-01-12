/**
 * Supabase implementation of IUserPreferencesRepository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../database.types.js';
import type { IUserPreferencesRepository, UserPreferences } from '../../interfaces/repositories.js';

// Default preferences with required types (non-optional)
const DEFAULT_PREFERENCES = {
  aiSummaryEnabled: true,
  aiTitleEnabled: true,
  aiModelProvider: 'openai' as const,
  aiModelName: 'gpt-4o-mini' as const,
};

export class SupabaseUserPreferencesRepository implements IUserPreferencesRepository {
  constructor(
    private client: SupabaseClient<Database>,
    private userId: string
  ) {}

  async findByUserId(userId: string): Promise<UserPreferences> {
    try {
      const { data, error } = await this.client
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error(
          `[UserPreferencesRepository] Error fetching preferences for user ${userId}:`,
          error.message
        );
        return {
          userId,
          aiSummaryEnabled: DEFAULT_PREFERENCES.aiSummaryEnabled,
          aiTitleEnabled: DEFAULT_PREFERENCES.aiTitleEnabled,
          aiModelProvider: DEFAULT_PREFERENCES.aiModelProvider,
          aiModelName: DEFAULT_PREFERENCES.aiModelName,
        };
      }

      if (!data) {
        console.log(
          `[UserPreferencesRepository] No preferences found for user ${userId}, using defaults`
        );
        return {
          userId,
          aiSummaryEnabled: DEFAULT_PREFERENCES.aiSummaryEnabled,
          aiTitleEnabled: DEFAULT_PREFERENCES.aiTitleEnabled,
          aiModelProvider: DEFAULT_PREFERENCES.aiModelProvider,
          aiModelName: DEFAULT_PREFERENCES.aiModelName,
        };
      }

      const prefs: UserPreferences = {
        userId: data.user_id,
        aiSummaryEnabled: data.ai_summary_enabled ?? DEFAULT_PREFERENCES.aiSummaryEnabled,
        aiTitleEnabled: data.ai_title_enabled ?? DEFAULT_PREFERENCES.aiTitleEnabled,
      };

      // Only set optional properties if they have values (or fall back to defaults)
      const provider = data.ai_model_provider ?? DEFAULT_PREFERENCES.aiModelProvider;
      if (provider) {
        prefs.aiModelProvider = provider;
      }
      const modelName = data.ai_model_name ?? DEFAULT_PREFERENCES.aiModelName;
      if (modelName) {
        prefs.aiModelName = modelName;
      }

      return prefs;
    } catch (error) {
      console.error(
        `[UserPreferencesRepository] Unexpected error fetching preferences for user ${userId}:`,
        error
      );
      return {
          userId,
          aiSummaryEnabled: DEFAULT_PREFERENCES.aiSummaryEnabled,
          aiTitleEnabled: DEFAULT_PREFERENCES.aiTitleEnabled,
          aiModelProvider: DEFAULT_PREFERENCES.aiModelProvider,
          aiModelName: DEFAULT_PREFERENCES.aiModelName,
        };
    }
  }
}
