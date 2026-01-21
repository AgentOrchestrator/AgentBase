/**
 * Shared utility functions for chat history loaders
 * These are commonly used across multiple loader implementations
 */

/**
 * Normalize timestamp to ISO 8601 format
 * Handles Unix timestamps (milliseconds), Unix timestamps (seconds), and ISO strings
 *
 * @param timestamp - The timestamp to normalize (string, number, or undefined)
 * @returns ISO 8601 formatted string
 */
export function normalizeTimestamp(timestamp: string | number | undefined): string {
  if (!timestamp) {
    return new Date().toISOString();
  }

  // If it's already a string, check if it's ISO format or a numeric string
  if (typeof timestamp === 'string') {
    // Check if it's a numeric string (Unix timestamp)
    const numericTimestamp = parseInt(timestamp, 10);
    if (!Number.isNaN(numericTimestamp) && numericTimestamp > 0) {
      timestamp = numericTimestamp;
    } else {
      // Try parsing as ISO string
      const date = new Date(timestamp);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
      return new Date().toISOString();
    }
  }

  // Handle numeric timestamps
  if (typeof timestamp === 'number') {
    // If timestamp is in milliseconds (> year 2000 in seconds = 946684800000 ms)
    if (timestamp > 946684800000) {
      return new Date(timestamp).toISOString();
    }
    // If timestamp is in seconds (> year 2000 in seconds)
    if (timestamp > 946684800) {
      return new Date(timestamp * 1000).toISOString();
    }
  }

  return new Date().toISOString();
}

/**
 * Extract project name from a folder or file path
 * Handles both local and remote paths, extracting the project directory name
 *
 * Strategy:
 * 1. Clean up URI schemes (file://, vscode-remote://)
 * 2. Find common project root indicators (Developer, projects, home, etc.)
 * 3. Extract the directory name after the root indicator
 * 4. Fallback: Use the last directory segment (not filename)
 *
 * @param folderPath - The path to extract project name from
 * @returns The extracted project name or undefined
 */
export function extractProjectNameFromPath(folderPath: string): string | undefined {
  // Remove URI scheme if present (file://, vscode-remote://, etc.)
  let cleanPath = folderPath;

  // Handle file:// URIs
  if (cleanPath.startsWith('file://')) {
    cleanPath = cleanPath.replace('file://', '');
  }

  // Handle vscode-remote URIs (e.g., vscode-remote://ssh-remote%2Bserver/path)
  if (cleanPath.startsWith('vscode-remote://')) {
    const match = cleanPath.match(/vscode-remote:\/\/[^/]+(.+)/);
    if (match?.[1]) {
      cleanPath = match[1];
    }
  }

  // Decode URL encoding (e.g., %2B -> +)
  try {
    cleanPath = decodeURIComponent(cleanPath);
  } catch {
    // If decoding fails, use as-is
  }

  // Split by / and filter empty segments
  const parts = cleanPath.split('/').filter((p) => p.trim() !== '');
  if (parts.length === 0) {
    return;
  }

  // Common project root indicators (in priority order)
  const rootIndicators = ['Developer', 'projects', 'workspace', 'repos', 'code', 'work'];

  // Try to find a root indicator and get the directory after it
  for (const indicator of rootIndicators) {
    const index = parts.indexOf(indicator);
    if (index >= 0 && index + 1 < parts.length) {
      // Return the first directory after the root indicator
      return parts[index + 1];
    }
  }

  // Special case for 'home' - skip username and get the next directory
  // e.g., /home/username/project -> project
  const homeIndex = parts.indexOf('home');
  if (homeIndex >= 0 && homeIndex + 2 < parts.length) {
    return parts[homeIndex + 2]; // Skip 'home' and username
  }

  // Fallback: Assume the path might be pointing to a file
  // Go up until we find what looks like a project root
  const lastPart = parts[parts.length - 1];
  if (!lastPart) {
    return;
  }

  const hasExtension = lastPart.includes('.');

  if (hasExtension && parts.length > 1) {
    // It's likely a file, use the parent directory
    return parts[parts.length - 2];
  }

  // Otherwise use the last segment (it's likely a directory)
  return lastPart;
}

/**
 * Simple string hash function (djb2 algorithm)
 * Browser-compatible alternative to crypto.createHash
 */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  // Convert to unsigned 32-bit integer, then to hex
  const hex1 = (hash >>> 0).toString(16).padStart(8, '0');
  // Create a second hash with different seed for more entropy
  let hash2 = 0;
  for (let i = 0; i < str.length; i++) {
    hash2 = (hash2 << 5) - hash2 + str.charCodeAt(i);
    hash2 = hash2 & hash2;
  }
  const hex2 = (hash2 >>> 0).toString(16).padStart(8, '0');
  // Combine and extend to 32 chars
  const combined = hex1 + hex2;
  return (combined + combined).substring(0, 32);
}

/**
 * Generate a deterministic UUID from an input string
 * Uses a simple hash formatted as UUID v4
 *
 * Useful for creating stable IDs from conversation identifiers
 * that don't have their own UUID
 *
 * @param input - The string to hash into a UUID
 * @returns A UUID v4 formatted string
 */
export function generateDeterministicUUID(input: string): string {
  const hash = simpleHash(input);
  // Format as UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(13, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
}

/**
 * Get the user's home directory path
 * Works cross-platform
 *
 * @returns The home directory path
 */
export function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || '';
}

/**
 * Check if a file exists
 * Synchronous check for use in loader availability checks
 *
 * @param filePath - Path to check
 * @returns true if file exists
 */
export function fileExists(filePath: string): boolean {
  try {
    const fs = require('node:fs');
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Platform-specific paths for IDE data directories
 */
export const IDE_DATA_PATHS = {
  /**
   * Get Claude Code projects directory
   */
  claudeCode: (): string => {
    const home = getHomeDir();
    return `${home}/.claude/projects`;
  },

  /**
   * Get Cursor global storage path (platform-specific)
   */
  cursor: (): string => {
    const home = getHomeDir();
    if (process.platform === 'darwin') {
      return `${home}/Library/Application Support/Cursor/User/globalStorage`;
    } else if (process.platform === 'win32') {
      return `${process.env.APPDATA}/Cursor/User/globalStorage`;
    }
    return `${home}/.config/Cursor/User/globalStorage`;
  },

  /**
   * Get VSCode global storage path (platform-specific)
   */
  vscode: (): string => {
    const home = getHomeDir();
    if (process.platform === 'darwin') {
      return `${home}/Library/Application Support/Code/User/globalStorage`;
    } else if (process.platform === 'win32') {
      return `${process.env.APPDATA}/Code/User/globalStorage`;
    }
    return `${home}/.config/Code/User/globalStorage`;
  },

  /**
   * Get CodeX sessions directory
   */
  codex: (): string => {
    const home = getHomeDir();
    return `${home}/.codex/sessions`;
  },

  /**
   * Get Factory sessions directory
   */
  factory: (): string => {
    const home = getHomeDir();
    return `${home}/.factory/sessions`;
  },

  /**
   * Get Windsurf global storage path (platform-specific)
   * Windsurf is Codeium's AI IDE, similar structure to VSCode/Cursor
   */
  windsurf: (): string => {
    const home = getHomeDir();
    if (process.platform === 'darwin') {
      return `${home}/Library/Application Support/Windsurf/User/globalStorage`;
    } else if (process.platform === 'win32') {
      return `${process.env.APPDATA}/Windsurf/User/globalStorage`;
    }
    return `${home}/.config/Windsurf/User/globalStorage`;
  },
};
