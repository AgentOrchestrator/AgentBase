/**
 * Permission Policy - Per-project configurable permission rules
 *
 * Allows projects to define custom permission policies for coding agents,
 * controlling which tools and commands are auto-approved, denied, or require user confirmation.
 */

import type { PermissionPayload } from './types.js';

// =============================================================================
// POLICY TYPES
// =============================================================================

/**
 * A single permission rule with pattern matching
 */
export interface PermissionRule {
  /** Glob or regex pattern to match */
  pattern: string;

  /** Action to take when pattern matches */
  action: 'allow' | 'deny' | 'ask';

  /** Optional human-readable reason for this rule */
  reason?: string;
}

/**
 * Per-project permission policy configuration
 */
export interface PermissionPolicy {
  /** Optional policy name for identification */
  name?: string;

  /** Tool-level permission rules */
  tools?: {
    /** Tools that are always allowed */
    allowed?: string[];
    /** Tools that are always denied */
    denied?: string[];
  };

  /** Command-level rules (for Bash/shell tools) */
  commands?: {
    /** Command patterns that are allowed */
    allowed?: PermissionRule[];
    /** Command patterns that are denied */
    denied?: PermissionRule[];
  };

  /** Path-level rules (for file operations) */
  paths?: {
    /** Glob patterns for paths that can be written to */
    writable?: string[];
    /** Glob patterns for paths that require confirmation */
    protected?: string[];
  };

  /** Default action when no rule matches */
  defaultAction?: 'allow' | 'deny' | 'ask';
}

// =============================================================================
// BUILT-IN PRESETS
// =============================================================================

/**
 * Pre-configured permission policy presets
 */
export const PERMISSION_PRESETS = {
  /** Allow all operations by default */
  permissive: {
    name: 'permissive',
    defaultAction: 'allow' as const,
  },

  /** Deny all operations by default */
  restrictive: {
    name: 'restrictive',
    defaultAction: 'deny' as const,
  },

  /** Ask for all operations (most interactive) */
  interactive: {
    name: 'interactive',
    defaultAction: 'ask' as const,
  },

  /** Only allow read operations */
  readOnly: {
    name: 'readOnly',
    tools: {
      allowed: ['Read', 'Glob', 'Grep', 'LSP', 'WebFetch', 'WebSearch'],
      denied: ['Write', 'Edit', 'Bash', 'NotebookEdit'],
    },
    defaultAction: 'deny' as const,
  },

  /** Standard development workflow */
  development: {
    name: 'development',
    tools: {
      allowed: ['Read', 'Glob', 'Grep', 'LSP', 'WebFetch', 'WebSearch'],
    },
    commands: {
      allowed: [
        { pattern: 'git *', action: 'allow' as const, reason: 'Git operations are safe' },
        { pattern: 'npm run *', action: 'allow' as const, reason: 'NPM scripts' },
        { pattern: 'npm test*', action: 'allow' as const, reason: 'Running tests' },
        { pattern: 'npm install*', action: 'ask' as const, reason: 'Installing dependencies' },
        { pattern: 'ls *', action: 'allow' as const, reason: 'Listing files' },
        { pattern: 'cat *', action: 'allow' as const, reason: 'Reading files' },
      ],
      denied: [
        { pattern: 'rm -rf *', action: 'deny' as const, reason: 'Dangerous recursive delete' },
        { pattern: 'sudo *', action: 'deny' as const, reason: 'Elevated permissions' },
      ],
    },
    defaultAction: 'ask' as const,
  },
} as const;

// =============================================================================
// SAFE/DANGEROUS COMMAND PATTERNS
// =============================================================================

/**
 * Commands that are generally safe to auto-approve
 */
export const SAFE_COMMAND_PATTERNS: RegExp[] = [
  // Git read operations
  /^git\s+(status|diff|log|show|branch|remote|fetch|stash\s+list)/,
  // File listing and reading
  /^ls(\s|$)/,
  /^cat\s/,
  /^head\s/,
  /^tail\s/,
  /^wc\s/,
  // Search operations
  /^grep\s/,
  /^rg\s/,
  /^find\s.*-type\s+[fd]/,
  /^find\s.*-name\s/,
  // Info commands
  /^pwd$/,
  /^whoami$/,
  /^date$/,
  /^echo\s/,
  /^which\s/,
  /^type\s/,
  // Package info (not install)
  /^npm\s+(list|ls|outdated|info|view|search)/,
  /^yarn\s+(list|info|why)/,
  /^pnpm\s+(list|ls)/,
];

/**
 * Commands that should always be denied or require explicit confirmation
 */
export const DANGEROUS_COMMAND_PATTERNS: RegExp[] = [
  // Destructive file operations
  /rm\s+(-[rfv]+\s+)*[/~]/,
  /rm\s+-rf\s/,
  // Elevated permissions
  /^sudo\s/,
  /^su\s/,
  /^doas\s/,
  // System modifications
  /chmod\s+777/,
  /chown\s.*root/,
  // Direct device access
  />\s*\/dev\/sd/,
  /mkfs\./,
  /dd\s+if=/,
  /fdisk/,
  // Network/security sensitive
  /curl\s.*\|\s*bash/,
  /wget\s.*\|\s*bash/,
  /eval\s/,
  // Git force operations
  /git\s+push\s+.*--force/,
  /git\s+reset\s+--hard/,
  // Process manipulation
  /kill\s+-9/,
  /killall/,
  /pkill/,
];

// =============================================================================
// POLICY EVALUATION
// =============================================================================

/**
 * Check if a command matches any pattern in a list
 */
function matchesPattern(command: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(command));
}

/**
 * Check if a command matches a rule pattern (supports glob-like patterns)
 */
function matchesRule(command: string, rule: PermissionRule): boolean {
  // Convert glob-like pattern to regex
  const regexPattern = rule.pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
    .replace(/\*/g, '.*') // Convert * to .*
    .replace(/\?/g, '.'); // Convert ? to .

  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return regex.test(command);
}

/**
 * Evaluate a permission request against a policy
 *
 * @param policy - The permission policy to evaluate against
 * @param payload - The permission request payload
 * @returns 'allow', 'deny', or 'ask'
 */
export function evaluatePermission(
  policy: PermissionPolicy,
  payload: PermissionPayload
): 'allow' | 'deny' | 'ask' {
  const { toolName, command } = payload;

  // 1. Check tool-level rules first
  if (policy.tools) {
    if (policy.tools.denied?.includes(toolName)) {
      return 'deny';
    }
    if (policy.tools.allowed?.includes(toolName)) {
      // Tool is allowed, but still check command rules if it's a shell tool
      if (!command || !['Bash', 'shell'].includes(toolName)) {
        return 'allow';
      }
    }
  }

  // 2. Check command-level rules (for shell commands)
  if (command && policy.commands) {
    // Check denied patterns first (deny takes precedence)
    if (policy.commands.denied) {
      for (const rule of policy.commands.denied) {
        if (matchesRule(command, rule)) {
          return 'deny';
        }
      }
    }

    // Check allowed patterns
    if (policy.commands.allowed) {
      for (const rule of policy.commands.allowed) {
        if (matchesRule(command, rule)) {
          return rule.action;
        }
      }
    }
  }

  // 3. Check built-in dangerous command patterns
  if (command && matchesPattern(command, DANGEROUS_COMMAND_PATTERNS)) {
    return 'deny';
  }

  // 4. Check built-in safe command patterns (if default is not 'deny')
  if (
    command &&
    policy.defaultAction !== 'deny' &&
    matchesPattern(command, SAFE_COMMAND_PATTERNS)
  ) {
    return 'allow';
  }

  // 5. Check path-level rules (for file operations)
  if (payload.filePath && policy.paths) {
    // Check protected paths first
    if (policy.paths.protected) {
      for (const pattern of policy.paths.protected) {
        if (matchesGlob(payload.filePath, pattern)) {
          return 'ask';
        }
      }
    }

    // Check writable paths
    if (policy.paths.writable) {
      for (const pattern of policy.paths.writable) {
        if (matchesGlob(payload.filePath, pattern)) {
          return 'allow';
        }
      }
    }
  }

  // 6. Return default action
  return policy.defaultAction ?? 'ask';
}

/**
 * Simple glob pattern matching
 */
function matchesGlob(path: string, pattern: string): boolean {
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<GLOBSTAR>>>/g, '.*');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

// =============================================================================
// POLICY LOADING
// =============================================================================

/**
 * Default policy config filename
 */
export const POLICY_CONFIG_FILENAME = '.agent-base/permissions.json';

/**
 * Load a permission policy from a workspace
 *
 * Looks for .agent-base/permissions.json in the workspace root.
 * Falls back to 'interactive' preset if not found.
 *
 * @param workspacePath - Path to the workspace root
 * @returns Loaded or default permission policy
 */
export async function loadPermissionPolicy(_workspacePath: string): Promise<PermissionPolicy> {
  // This is a placeholder - actual file loading would be done in the consumer
  // (e.g., desktop app) since we don't want to add fs dependencies to shared

  // For now, return the interactive preset as default
  return { ...PERMISSION_PRESETS.interactive };
}

/**
 * Merge multiple policies (later policies override earlier ones)
 */
export function mergePolicies(...policies: PermissionPolicy[]): PermissionPolicy {
  const merged: PermissionPolicy = {
    tools: { allowed: [], denied: [] },
    commands: { allowed: [], denied: [] },
    paths: { writable: [], protected: [] },
  };

  for (const policy of policies) {
    if (policy.name) {
      merged.name = policy.name;
    }

    if (policy.tools) {
      if (policy.tools.allowed) {
        merged.tools!.allowed = [
          ...new Set([...(merged.tools?.allowed ?? []), ...policy.tools.allowed]),
        ];
      }
      if (policy.tools.denied) {
        merged.tools!.denied = [
          ...new Set([...(merged.tools?.denied ?? []), ...policy.tools.denied]),
        ];
      }
    }

    if (policy.commands) {
      if (policy.commands.allowed) {
        merged.commands!.allowed = [
          ...(merged.commands?.allowed ?? []),
          ...policy.commands.allowed,
        ];
      }
      if (policy.commands.denied) {
        merged.commands!.denied = [...(merged.commands?.denied ?? []), ...policy.commands.denied];
      }
    }

    if (policy.paths) {
      if (policy.paths.writable) {
        merged.paths!.writable = [
          ...new Set([...(merged.paths?.writable ?? []), ...policy.paths.writable]),
        ];
      }
      if (policy.paths.protected) {
        merged.paths!.protected = [
          ...new Set([...(merged.paths?.protected ?? []), ...policy.paths.protected]),
        ];
      }
    }

    if (policy.defaultAction) {
      merged.defaultAction = policy.defaultAction;
    }
  }

  return merged;
}
