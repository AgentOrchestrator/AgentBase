'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LLMProvider {
  id: string;
  name: string;
  icon: string;
  placeholder: string;
}

const LLM_PROVIDERS: LLMProvider[] = [
  { id: 'openai', name: 'OpenAI', icon: '🤖', placeholder: 'sk-...' },
  { id: 'anthropic', name: 'Anthropic', icon: '🧠', placeholder: 'sk-ant-...' },
  { id: 'google', name: 'Google AI', icon: '🔮', placeholder: 'AI...' },
  { id: 'groq', name: 'Groq', icon: '⚡', placeholder: 'gsk_...' },
  { id: 'ollama', name: 'Ollama', icon: '🦙', placeholder: 'http://localhost:11434' },
  { id: 'openrouter', name: 'OpenRouter', icon: '🌐', placeholder: 'sk-or-...' },
];

interface SavedKey {
  id: string;
  provider: string;
  is_active: boolean;
}

interface LLMSettingsDialogProps {
  onClose: () => void;
}

export function LLMSettingsDialog({ onClose }: LLMSettingsDialogProps) {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [savedKeys, setSavedKeys] = useState<SavedKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchSavedKeys();
  }, []);

  const fetchSavedKeys = async () => {
    try {
      const response = await fetch('/api/llm-keys');
      if (response.ok) {
        const data = await response.json();
        setSavedKeys(data.keys || []);
      }
    } catch (error) {
      console.error('Error fetching saved keys:', error);
    }
  };

  const handleSaveKey = async (provider: string) => {
    const apiKey = apiKeys[provider];
    if (!apiKey || !apiKey.trim()) {
      return;
    }

    setSaving(provider);
    try {
      const response = await fetch('/api/llm-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, api_key: apiKey }),
      });

      if (response.ok) {
        await fetchSavedKeys();
        // Clear the input after saving
        setApiKeys(prev => ({ ...prev, [provider]: '' }));
      } else {
        const error = await response.json();
        alert(`Failed to save API key: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving API key:', error);
      alert('Failed to save API key');
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteKey = async (provider: string) => {
    if (!confirm(`Are you sure you want to delete your ${provider} API key?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/llm-keys?provider=${provider}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchSavedKeys();
      } else {
        const error = await response.json();
        alert(`Failed to delete API key: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting API key:', error);
      alert('Failed to delete API key');
    }
  };

  const isKeySaved = (provider: string) => {
    return savedKeys.some(key => key.provider === provider);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--background)] rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-4">
        <div className="sticky top-0 bg-[var(--background)] border-b border-[var(--border)] p-6 flex justify-between items-center">
          <h2 className="text-xl font-semibold">LLM API Keys</h2>
          <button
            onClick={onClose}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-sm text-[var(--muted-foreground)]">
            Configure your API keys for different LLM providers. Keys are stored securely and encrypted.
          </p>

          {LLM_PROVIDERS.map(provider => (
            <div
              key={provider.id}
              className="border border-[var(--border)] rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{provider.icon}</span>
                  <div>
                    <h3 className="font-medium">{provider.name}</h3>
                    {isKeySaved(provider.id) && (
                      <p className="text-xs text-green-600 dark:text-green-400">
                        ✓ API key configured
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`key-${provider.id}`}>API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id={`key-${provider.id}`}
                    type="password"
                    placeholder={provider.placeholder}
                    value={apiKeys[provider.id] || ''}
                    onChange={(e) =>
                      setApiKeys(prev => ({ ...prev, [provider.id]: e.target.value }))
                    }
                    className="flex-1"
                  />
                  <Button
                    onClick={() => handleSaveKey(provider.id)}
                    disabled={!apiKeys[provider.id]?.trim() || saving === provider.id}
                    className="whitespace-nowrap"
                  >
                    {saving === provider.id ? 'Saving...' : 'Save'}
                  </Button>
                  {isKeySaved(provider.id) && (
                    <Button
                      variant="outline"
                      onClick={() => handleDeleteKey(provider.id)}
                      className="whitespace-nowrap"
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 bg-[var(--background)] border-t border-[var(--border)] p-6">
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
