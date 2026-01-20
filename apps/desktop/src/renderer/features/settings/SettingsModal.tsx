/**
 * Settings Modal Feature Component
 *
 * Displays the application settings including:
 * - User gradient preview card
 * - Theme selection
 * - Linear integration settings
 * - Text Level Fork toggle
 */
import { Dithering, MeshGradient } from '@paper-design/shaders-react';
import { useCallback, useMemo } from 'react';
import type { UseAutoForkReturn, UseLinearReturn } from '../../hooks';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  githubUsername: string | null;
  theme: 'dark' | 'light' | 'light-web';
  onThemeChange: (theme: 'dark' | 'light' | 'light-web') => void;
  linear: UseLinearReturn;
  autoForkState: UseAutoForkReturn;
}

export function SettingsModal({
  isOpen,
  onClose,
  githubUsername,
  theme,
  onThemeChange,
  linear,
  autoForkState,
}: SettingsModalProps) {
  const selectedGradient = useGradientForUsername(githubUsername);
  const overlayTextColor = useOverlayTextColor(selectedGradient.overlayColor);

  if (!isOpen) return null;

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <SettingsModalHeader onClose={onClose} />
        <div className="settings-modal-content">
          <GradientPreviewSection
            username={githubUsername}
            gradient={selectedGradient}
            overlayTextColor={overlayTextColor}
          />
          <ThemeSection theme={theme} onThemeChange={onThemeChange} />
          <LinearIntegrationSection linear={linear} />
          <TextLevelForkSection autoForkState={autoForkState} />
        </div>
      </div>
    </div>
  );
}

function SettingsModalHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="settings-modal-header">
      <h2>Settings</h2>
      <button className="settings-close-button" onClick={onClose}>
        ✕
      </button>
    </div>
  );
}

interface GradientPreviewSectionProps {
  username: string | null;
  gradient: GradientConfig;
  overlayTextColor: string;
}

function GradientPreviewSection({
  username,
  gradient,
  overlayTextColor,
}: GradientPreviewSectionProps) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  return (
    <div className="settings-section">
      <div className="settings-mesh-container">
        <div className="settings-mesh-preview" style={{ borderColor: gradient.overlayColor }}>
          {gradient.type === 'mesh' ? (
            <MeshGradient
              speed={gradient.speed}
              distortion={gradient.distortion}
              swirl={gradient.swirl}
              frame={gradient.frame}
              grainMixer={gradient.grainMixer}
              grainOverlay={gradient.grainOverlay}
              colors={gradient.colors}
              style={{
                width: '256px',
                height: '360px',
                opacity: 1,
                borderRadius: 0,
                transformOrigin: 'center center',
                rotate: gradient.rotate,
              }}
            />
          ) : (
            <Dithering
              speed={gradient.speed}
              shape={gradient.shape}
              type={gradient.ditherType}
              pxSize={gradient.pxSize}
              scale={gradient.scale}
              frame={gradient.frame}
              size={gradient.size}
              colorFront={gradient.colorFront}
              style={{
                width: '256px',
                height: '360px',
                borderRadius: 0,
                transformOrigin: 'center center',
                rotate: '0deg',
                backgroundColor: gradient.backgroundColor || undefined,
              }}
            />
          )}
          <div className="settings-mesh-overlay" style={{ backgroundColor: gradient.overlayColor }}>
            {username && (
              <>
                <div className="settings-mesh-username" style={{ color: overlayTextColor }}>
                  @{username}
                </div>
                <div className="settings-mesh-subtitle" style={{ color: overlayTextColor }}>
                  Agent Whisperer
                </div>
              </>
            )}
          </div>
        </div>
        <div className="settings-mesh-welcome">
          <div className="settings-mesh-welcome-title">Welcome back to Agent Base!</div>
          <div className="settings-mesh-shortcuts">
            <ShortcutItem label="New Agent" shortcut={`${modKey} T`} />
            <ShortcutItem label="New Terminal" shortcut={`${modKey} K V`} />
            <ShortcutItem label="New Claude Code Terminal" shortcut={`${modKey} K B`} />
            <ShortcutItem label="New Forked Agent" shortcut={`${modKey} G`} />
            <ShortcutItem label="Fork Existing Agent" shortcut={`${modKey} F`} />
            <ShortcutItem label="Node Drag Mode" shortcut={`Hold ${isMac ? '⌘' : 'Ctrl'}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ShortcutItem({ label, shortcut }: { label: string; shortcut: string }) {
  return (
    <div className="settings-mesh-shortcut-item">
      <span className="settings-mesh-shortcut-label">{label}</span>
      <span className="settings-mesh-shortcut-key">{shortcut}</span>
    </div>
  );
}

interface ThemeSectionProps {
  theme: 'dark' | 'light' | 'light-web';
  onThemeChange: (theme: 'dark' | 'light' | 'light-web') => void;
}

function ThemeSection({ theme, onThemeChange }: ThemeSectionProps) {
  return (
    <div className="settings-section">
      <div className="integration-header">
        <div className="integration-info">
          <span className="integration-name">Appearance</span>
        </div>
      </div>
      <div className="settings-item" style={{ padding: '12px 0', borderBottom: 'none' }}>
        <select
          className="theme-select"
          value={theme}
          onChange={(e) => onThemeChange(e.target.value as 'dark' | 'light' | 'light-web')}
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="light-web">Light (Web)</option>
        </select>
      </div>
    </div>
  );
}

interface LinearIntegrationSectionProps {
  linear: UseLinearReturn;
}

function LinearIntegrationSection({ linear }: LinearIntegrationSectionProps) {
  return (
    <div className="settings-section">
      <div className="integration-header">
        <div className="integration-info">
          <span className="integration-name">Linear Integration</span>
        </div>
      </div>
      <div className="integration-content">
        <input
          type="password"
          placeholder="Enter Linear API Key"
          value={linear.apiKey}
          onChange={(e) => linear.connect(e.target.value)}
          className="integration-input"
          disabled={linear.isConnected}
        />
        {linear.isConnected ? (
          <button onClick={linear.disconnect} className="integration-button disconnect">
            Disconnect
          </button>
        ) : (
          <button
            onClick={() => linear.connect(linear.apiKey)}
            className="integration-button connect"
            disabled={!linear.apiKey.trim()}
          >
            Connect
          </button>
        )}
      </div>
      <div className="integration-help">
        Get your API key from{' '}
        <a
          href="https://linear.app/settings/api"
          target="_blank"
          rel="noopener noreferrer"
          className="integration-link"
        >
          Linear Settings → API
        </a>
      </div>
    </div>
  );
}

interface TextLevelForkSectionProps {
  autoForkState: UseAutoForkReturn;
}

function TextLevelForkSection({ autoForkState }: TextLevelForkSectionProps) {
  return (
    <div className="settings-section">
      <div className="integration-header">
        <div className="integration-info">
          <span className="integration-name">Text Level Fork</span>
        </div>
      </div>
      <div className="settings-item" style={{ padding: '12px 0', borderBottom: 'none' }}>
        <label className="settings-toggle-label">
          <input
            type="checkbox"
            checked={autoForkState.autoFork}
            onChange={(e) => autoForkState.setAutoFork(e.target.checked)}
            className="settings-toggle"
          />
          <span className="settings-toggle-text">Text Level Fork</span>
        </label>
        <div className="settings-toggle-description" style={{ marginLeft: '0' }}>
          When enabled, highlighting text and clicking the plus button opens the fork dialog. When
          disabled, automatically creates a fork with a random name.
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Gradient Configuration Types and Hooks
// =============================================================================

type GradientConfig =
  | {
      type: 'mesh';
      speed: number;
      distortion: number;
      swirl: number;
      frame: number;
      grainMixer: number;
      grainOverlay: number;
      colors: string[];
      rotate: string;
      overlayColor: string;
    }
  | {
      type: 'dithering';
      speed: number;
      shape: 'swirl' | 'warp' | 'simplex' | 'dots' | 'wave' | 'ripple' | 'sphere';
      ditherType: '8x8' | 'random' | '2x2' | '4x4';
      pxSize: number;
      scale: number;
      frame: number;
      size: number;
      colorFront: string;
      overlayColor: string;
      backgroundColor?: string;
    };

function useGradientForUsername(username: string | null): GradientConfig {
  const getGradientForLetter = useCallback((letter: string | null): GradientConfig => {
    if (!letter) {
      return defaultMeshGradient(['#FFFFFF', '#0051FF'], '#0051FF', 3547980.561001969);
    }

    const upperLetter = letter.toUpperCase();

    // A, B
    if (upperLetter === 'A' || upperLetter === 'B') {
      return defaultMeshGradient(['#FFFFFF', '#0051FF'], '#0051FF', 3547980.561001969);
    }

    // C, D
    if (upperLetter === 'C' || upperLetter === 'D') {
      return defaultMeshGradient(['#FFE8AF', '#E54F0E'], '#E54F0E', 2555302.0330011887);
    }

    // E, F
    if (upperLetter === 'E' || upperLetter === 'F') {
      return defaultMeshGradient(['#FFFFFF', '#CD005F'], '#CD005F', 2449626.3160010916);
    }

    // G, H
    if (upperLetter === 'G' || upperLetter === 'H') {
      return defaultMeshGradient(['#000000', '#008A6D'], '#008A6D', 5438369.934008135);
    }

    // I, J
    if (upperLetter === 'I' || upperLetter === 'J') {
      return ditheringGradient('warp', '8x8', '#8DB735', 0.51, 246417.07600003193, 2.7);
    }

    // K, L
    if (upperLetter === 'K' || upperLetter === 'L') {
      return ditheringGradient('warp', 'random', '#FFFFFF', 0.66, 442221.90600008366, 2.6, 1.22);
    }

    // M, N
    if (upperLetter === 'M' || upperLetter === 'N') {
      return defaultMeshGradient(['#C5D2F8', '#4F0C28'], '#4F0C28', 3475477.906001939);
    }

    // O, P
    if (upperLetter === 'O' || upperLetter === 'P') {
      return defaultMeshGradient(['#282828', '#A8051A'], '#A8051A', 5438369.934008135);
    }

    // Q, R
    if (upperLetter === 'Q' || upperLetter === 'R') {
      return defaultMeshGradient(['#004D00', '#53F398'], '#53F398', 5219391.935008144);
    }

    // S, T
    if (upperLetter === 'S' || upperLetter === 'T') {
      return ditheringGradient(
        'dots',
        'random',
        '#485ACD',
        1.24,
        648655.0500000913,
        11.6,
        1,
        '#000000'
      );
    }

    // U, V, W
    if (upperLetter === 'U' || upperLetter === 'V' || upperLetter === 'W') {
      return defaultMeshGradient(['#DADABC', '#BCA145'], '#BCA145', 4558265.078004454);
    }

    // X, Y, Z
    if (upperLetter === 'X' || upperLetter === 'Y' || upperLetter === 'Z') {
      return ditheringGradient('warp', '8x8', '#FF00EA', 0.51, 396886.546000077, 2.7);
    }

    // Default fallback
    return defaultMeshGradient(['#FFFFFF', '#0051FF'], '#0051FF', 3547980.561001969);
  }, []);

  return useMemo(() => {
    if (!username) {
      return getGradientForLetter(null);
    }

    const firstChar = username.charAt(0);
    // If it's a number (0-9), map to first 10 letter pairs (A-T)
    if (/[0-9]/.test(firstChar)) {
      const num = parseInt(firstChar, 10);
      const letterPairs = ['A', 'C', 'E', 'G', 'I', 'K', 'M', 'O', 'Q', 'S'];
      return getGradientForLetter(letterPairs[num]);
    }

    return getGradientForLetter(firstChar);
  }, [username, getGradientForLetter]);
}

function defaultMeshGradient(
  colors: string[],
  overlayColor: string,
  frame: number
): GradientConfig {
  return {
    type: 'mesh',
    speed: 1.49,
    distortion: 0.58,
    swirl: 0.55,
    frame,
    grainMixer: 1,
    grainOverlay: 1,
    colors,
    rotate: '0deg',
    overlayColor,
  };
}

function ditheringGradient(
  shape: 'swirl' | 'warp' | 'simplex' | 'dots' | 'wave' | 'ripple' | 'sphere',
  ditherType: '8x8' | 'random' | '2x2' | '4x4',
  colorFront: string,
  scale: number,
  frame: number,
  size: number,
  speed = 0.9,
  backgroundColor?: string
): GradientConfig {
  return {
    type: 'dithering',
    speed,
    shape,
    ditherType,
    pxSize: 1.8,
    scale,
    frame,
    size,
    colorFront,
    overlayColor: colorFront,
    backgroundColor,
  };
}

function useOverlayTextColor(overlayColor: string): string {
  return useMemo(() => {
    // Remove # if present
    const hex = overlayColor.replace('#', '');
    // Convert to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  }, [overlayColor]);
}
