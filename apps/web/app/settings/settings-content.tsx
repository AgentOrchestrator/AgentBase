"use client";

import { useState } from "react";
import { User } from "@supabase/supabase-js";
import { CheckCircle2, ExternalLink, Unlink, Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { linkGithubAccount, unlinkGithubAccount } from "@/lib/auth";
import { useTheme } from "@/lib/theme-context";
import { LLMProviderSettings } from "@/components/llm-provider-settings";
import { AISummarySettings } from "@/components/ai-summary-settings";

interface SettingsContentProps {
  user: User;
  githubConnected: boolean;
  githubUsername: string | null;
}

export function SettingsContent({ user, githubConnected, githubUsername }: SettingsContentProps) {
  const { theme, deviceMode, setTheme, setDeviceMode } = useTheme();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleConnectGithub = async () => {
    setIsConnecting(true);
    setError(null);
    setSuccess(null);

    try {
      // Use Supabase's linkIdentity to link GitHub to the current user
      const result = await linkGithubAccount();

      if (result.error) {
        setError(result.error.message);
        setIsConnecting(false);
      }
      // If successful, user will be redirected to GitHub OAuth flow
    } catch (err) {
      setError("Failed to connect to GitHub. Please try again.");
      setIsConnecting(false);
    }
  };

  const handleUnlinkGithub = async () => {
    setIsUnlinking(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await unlinkGithubAccount();

      if (result.error) {
        setError(result.error.message);
      } else {
        setSuccess("GitHub account unlinked successfully. Refreshing...");
        // Refresh the page after a short delay to update the UI
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (err) {
      setError("Failed to unlink GitHub account. Please try again.");
    } finally {
      setIsUnlinking(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-background">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings & Members</h1>
          <p className="text-muted-foreground mt-2">
            Manage your account settings and team members
          </p>
        </div>

        {/* Account Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Account</h2>

          <Card className="p-6 bg-card border-border">
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">Email</h3>
                </div>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>

              {user.user_metadata?.display_name && (
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 text-foreground">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">Display Name</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{user.user_metadata.display_name}</p>
                  </div>
                </div>
              )}

              {user.user_metadata?.name && (
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 text-foreground">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">Name</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{user.user_metadata.name}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* AI Summary Settings Section */}
        <AISummarySettings />

        {/* Theme Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Theme</h2>

          <Card className="p-6 bg-card border-border">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground">Appearance</h3>
                <p className="text-sm text-muted-foreground">
                  Choose between light and dark mode
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setDeviceMode(false);
                    setTheme('light');
                  }}
                  className={`p-2 rounded-lg transition-colors duration-200 flex items-center gap-2 ${
                    theme === 'light' && !deviceMode
                      ? 'bg-sidebar-accent text-muted-foreground'
                      : 'bg-sidebar-accent/50 text-muted-foreground/70 hover:bg-sidebar-accent/80'
                  }`}
                  aria-label="Switch to light mode"
                >
                  <Sun className="h-4 w-4" />
                  <span className="text-sm font-medium">Light</span>
                </button>
                <button
                  onClick={() => {
                    setDeviceMode(false);
                    setTheme('dark');
                  }}
                  className={`p-2 rounded-lg transition-colors duration-200 flex items-center gap-2 ${
                    theme === 'dark' && !deviceMode
                      ? 'bg-sidebar-accent text-muted-foreground'
                      : 'bg-sidebar-accent/50 text-muted-foreground/70 hover:bg-sidebar-accent/80'
                  }`}
                  aria-label="Switch to dark mode"
                >
                  <Moon className="h-4 w-4" />
                  <span className="text-sm font-medium">Dark</span>
                </button>
                <button
                  onClick={() => setDeviceMode(!deviceMode)}
                  className={`p-2 rounded-lg transition-colors duration-200 flex items-center gap-2 ${
                    deviceMode
                      ? 'bg-sidebar-accent text-muted-foreground'
                      : 'bg-sidebar-accent/50 text-muted-foreground/70 hover:bg-sidebar-accent/80'
                  }`}
                  aria-label="Toggle device theme mode"
                >
                  <Monitor className="h-4 w-4" />
                  <span className="text-sm font-medium">Device</span>
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* LLM Provider Settings Section */}
        <LLMProviderSettings />

        {/* Integrations Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Integrations</h2>

          <Card className="p-6 bg-card border-border">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 30 30" 
                  width="32" 
                  height="32"
                  className="text-foreground"
                  fill="currentColor"
                >
                  <path d="M15,3C8.373,3,3,8.373,3,15c0,5.623,3.872,10.328,9.092,11.63C12.036,26.468,12,26.28,12,26.047v-2.051 c-0.487,0-1.303,0-1.508,0c-0.821,0-1.551-0.353-1.905-1.009c-0.393-0.729-0.461-1.844-1.435-2.526 c-0.289-0.227-0.069-0.486,0.264-0.451c0.615,0.174,1.125,0.596,1.605,1.222c0.478,0.627,0.703,0.769,1.596,0.769 c0.433,0,1.081-0.025,1.691-0.121c0.328-0.833,0.895-1.6,1.588-1.962c-3.996-0.411-5.903-2.399-5.903-5.098 c0-1.162,0.495-2.286,1.336-3.233C9.053,10.647,8.706,8.73,9.435,8c1.798,0,2.885,1.166,3.146,1.481C13.477,9.174,14.461,9,15.495,9 c1.036,0,2.024,0.174,2.922,0.483C18.675,9.17,19.763,8,21.565,8c0.732,0.731,0.381,2.656,0.102,3.594 c0.836,0.945,1.328,2.066,1.328,3.226c0,2.697-1.904,4.684-5.894,5.097C18.199,20.49,19,22.1,19,23.313v2.734 c0,0.104-0.023,0.179-0.035,0.268C23.641,24.676,27,20.236,27,15C27,8.373,21.627,3,15,3z"/>
                </svg>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">GitHub</h3>
                    {githubConnected && (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm font-medium">Connected</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {githubConnected
                      ? `Connected as ${githubUsername || "GitHub user"}`
                      : "Connect your GitHub account to enable additional features"}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                {githubConnected ? (
                  <Button
                    variant="outline"
                    onClick={handleUnlinkGithub}
                    disabled={isUnlinking}
                    className="gap-2 border-border text-muted-foreground bg-card hover:border-red-600 hover:text-red-600 hover:bg-card"
                  >
                    <Unlink className="h-4 w-4" />
                    {isUnlinking ? "Unlinking..." : "Unlink"}
                  </Button>
                ) : (
                  <Button
                    onClick={handleConnectGithub}
                    disabled={isConnecting}
                    className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 border-border"
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 30 30" 
                      width="16" 
                      height="16"
                      fill="currentColor"
                    >
                      <path d="M15,3C8.373,3,3,8.373,3,15c0,5.623,3.872,10.328,9.092,11.63C12.036,26.468,12,26.28,12,26.047v-2.051 c-0.487,0-1.303,0-1.508,0c-0.821,0-1.551-0.353-1.905-1.009c-0.393-0.729-0.461-1.844-1.435-2.526 c-0.289-0.227-0.069-0.486,0.264-0.451c0.615,0.174,1.125,0.596,1.605,1.222c0.478,0.627,0.703,0.769,1.596,0.769 c0.433,0,1.081-0.025,1.691-0.121c0.328-0.833,0.895-1.6,1.588-1.962c-3.996-0.411-5.903-2.399-5.903-5.098 c0-1.162,0.495-2.286,1.336-3.233C9.053,10.647,8.706,8.73,9.435,8c1.798,0,2.885,1.166,3.146,1.481C13.477,9.174,14.461,9,15.495,9 c1.036,0,2.024,0.174,2.922,0.483C18.675,9.17,19.763,8,21.565,8c0.732,0.731,0.381,2.656,0.102,3.594 c0.836,0.945,1.328,2.066,1.328,3.226c0,2.697-1.904,4.684-5.894,5.097C18.199,20.49,19,22.1,19,23.313v2.734 c0,0.104-0.023,0.179-0.035,0.268C23.641,24.676,27,20.236,27,15C27,8.373,21.627,3,15,3z"/>
                    </svg>
                    {isConnecting ? "Connecting..." : "Connect GitHub"}
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {success && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-600">{success}</p>
              </div>
            )}
          </Card>

        </div>

        {/* Members Section (Placeholder) */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Team Members</h2>

          <Card className="p-6 bg-card border-border">
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Team member management coming soon</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
