'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';

interface UserPreferences {
  id: string;
  user_id: string;
  ai_summary_enabled: boolean;
  ai_title_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export function AISummarySettings() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingSummary, setUpdatingSummary] = useState(false);
  const [updatingTitle, setUpdatingTitle] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await fetch('/api/preferences');
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAISummary = async () => {
    if (!preferences || updatingSummary) return;

    const newValue = !preferences.ai_summary_enabled;
    setUpdatingSummary(true);

    try {
      const response = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_summary_enabled: newValue }),
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences);
      } else {
        const error = await response.json();
        alert(`Failed to update preferences: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
      alert('Failed to update preferences');
    } finally {
      setUpdatingSummary(false);
    }
  };

  const handleToggleAITitle = async () => {
    if (!preferences || updatingTitle) return;

    const newValue = !preferences.ai_title_enabled;
    setUpdatingTitle(true);

    try {
      const response = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_title_enabled: newValue }),
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences);
      } else {
        const error = await response.json();
        alert(`Failed to update preferences: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
      alert('Failed to update preferences');
    } finally {
      setUpdatingTitle(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">AI Features</h2>
        <Card className="p-6 bg-card border-border">
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">Loading preferences...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">AI Features</h2>

      <Card className="p-6 bg-card border-border">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground">Generate Session Summaries</h3>
            <p className="text-sm text-muted-foreground">
              Automatically generate summaries for your coding sessions.
            </p>
          </div>

          <button
            onClick={handleToggleAISummary}
            disabled={updatingSummary}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
              preferences?.ai_summary_enabled
                ? 'bg-primary'
                : 'bg-muted-foreground/30'
            }`}
            role="switch"
            aria-checked={preferences?.ai_summary_enabled}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                preferences?.ai_summary_enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

      </Card>

      <Card className="p-6 bg-card border-border">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground">Generate Session Titles</h3>
            <p className="text-sm text-muted-foreground">
              Automatically generate titles for your coding sessions.
            </p>
          </div>

          <button
            onClick={handleToggleAITitle}
            disabled={updatingTitle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
              preferences?.ai_title_enabled
                ? 'bg-primary'
                : 'bg-muted-foreground/30'
            }`}
            role="switch"
            aria-checked={preferences?.ai_title_enabled}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                preferences?.ai_title_enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

      </Card>
    </div>
  );
}
