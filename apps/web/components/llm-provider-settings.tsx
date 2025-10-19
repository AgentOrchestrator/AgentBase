'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Star, StarOff, CheckCircle2 } from 'lucide-react';

interface LLMProvider {
  id: string;
  name: string;
  icon: React.ReactNode;
  placeholder: string;
}

const LLM_PROVIDERS: LLMProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
      </svg>
    ),
    placeholder: 'sk-...',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M14.903 1.869L22.726 22.13h-4.057L16.924 18H7.089l-1.746 4.13H1.274L9.097 1.87h5.806zm-.916 12.576L12.01 9.12l-1.978 5.324h4.955z"/>
      </svg>
    ),
    placeholder: 'sk-ant-...',
  },
  {
    id: 'google',
    name: 'Google AI',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
      </svg>
    ),
    placeholder: 'AI...',
  },
  {
    id: 'groq',
    name: 'Groq',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M2 12h2v2H2zm4 0h2v2H6zm4 0h2v2h-2zm4 0h2v2h-2zm4 0h2v2h-2zm4 0h2v2h-2zM2 6h2v2H2zm4 0h2v2H6zm4 0h2v2h-2zm4 0h2v2h-2zm4 0h2v2h-2zm4 0h2v2h-2zM2 18h2v2H2zm4 0h2v2H6zm4 0h2v2h-2zm4 0h2v2h-2zm4 0h2v2h-2zm4 0h2v2h-2z"/>
      </svg>
    ),
    placeholder: 'gsk_...',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22.5C6.201 22.5 1.5 17.799 1.5 12S6.201 1.5 12 1.5 22.5 6.201 22.5 12 17.799 22.5 12 22.5zm0-18.75c-4.556 0-8.25 3.694-8.25 8.25s3.694 8.25 8.25 8.25 8.25-3.694 8.25-8.25-3.694-8.25-8.25-8.25zm0 14.85c-3.644 0-6.6-2.956-6.6-6.6s2.956-6.6 6.6-6.6 6.6 2.956 6.6 6.6-2.956 6.6-6.6 6.6zm0-11.55c-2.733 0-4.95 2.217-4.95 4.95s2.217 4.95 4.95 4.95 4.95-2.217 4.95-4.95-2.217-4.95-4.95-4.95z"/>
      </svg>
    ),
    placeholder: 'http://localhost:11434',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18.5c-3.82-1.15-6.5-4.82-6.5-9V8.3l6.5-3.11 6.5 3.11V11.5c0 4.18-2.68 7.85-6.5 9z"/>
        <path d="M8 12l3 3 5-5-1.41-1.41L11 12.17 9.41 10.59z"/>
      </svg>
    ),
    placeholder: 'sk-or-...',
  },
];

interface SavedKey {
  id: string;
  provider: string;
  is_active: boolean;
  is_default: boolean;
}

export function LLMProviderSettings() {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [savedKeys, setSavedKeys] = useState<SavedKey[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);

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

  const handleSetDefault = async (provider: string) => {
    setSettingDefault(provider);
    try {
      const response = await fetch('/api/llm-keys/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });

      if (response.ok) {
        await fetchSavedKeys();
      } else {
        const error = await response.json();
        alert(`Failed to set default provider: ${error.error}`);
      }
    } catch (error) {
      console.error('Error setting default provider:', error);
      alert('Failed to set default provider');
    } finally {
      setSettingDefault(null);
    }
  };

  const isKeySaved = (provider: string) => {
    return savedKeys.some(key => key.provider === provider);
  };

  const isDefault = (provider: string) => {
    return savedKeys.some(key => key.provider === provider && key.is_default);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">LLM API Keys</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {savedKeys.length > 1 && (
              <span className="block mt-1">
                Click the star icon to set a provider as default.
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {LLM_PROVIDERS.map(provider => {
          const configured = isKeySaved(provider.id);
          const isDefaultProvider = isDefault(provider.id);

          return (
            <Card
              key={provider.id}
              className="p-4 bg-card border-border"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 text-foreground">
                      {provider.icon}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{provider.name}</h3>
                        {configured && (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-sm font-medium">Connected</span>
                          </div>
                        )}
                        {isDefaultProvider && (
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                            <Star className="h-4 w-4 fill-current" />
                            Default
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {configured && savedKeys.length > 1 && (
                    <button
                      onClick={() => handleSetDefault(provider.id)}
                      disabled={isDefaultProvider || settingDefault === provider.id}
                      className="p-2 rounded-lg transition-colors duration-200 flex items-center gap-2 bg-sidebar-accent/50 text-muted-foreground/70 hover:bg-sidebar-accent/80 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDefaultProvider ? (
                        <>
                          <Star className="h-4 w-4 fill-current text-yellow-500" />
                          <span className="text-sm font-medium">Default</span>
                        </>
                      ) : (
                        <>
                          <StarOff className="h-4 w-4" />
                          <span className="text-sm font-medium">Set Default</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      id={`key-${provider.id}`}
                      type="password"
                      placeholder={configured ? '••••••••••••••••' : provider.placeholder}
                      value={apiKeys[provider.id] || ''}
                      onChange={(e) =>
                        setApiKeys(prev => ({ ...prev, [provider.id]: e.target.value }))
                      }
                      className="flex-1"
                    />
                    <button
                      onClick={() => handleSaveKey(provider.id)}
                      disabled={!apiKeys[provider.id]?.trim() || saving === provider.id}
                      className="p-2 rounded-lg transition-colors duration-200 flex items-center gap-2 bg-sidebar-accent/50 text-muted-foreground/70 hover:bg-sidebar-accent/80 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="text-sm font-medium">
                        {saving === provider.id ? 'Saving...' : configured ? 'Update' : 'Save'}
                      </span>
                    </button>
                    {configured && (
                      <button
                        onClick={() => handleDeleteKey(provider.id)}
                        className="px-4 py-2 border border-border text-muted-foreground bg-card hover:border-red-600 hover:text-red-600 hover:bg-card rounded-md transition-colors duration-200 text-sm font-medium"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
