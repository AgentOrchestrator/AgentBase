/**
 * Agent Setup Module
 *
 * Provides utilities for setting up terminal-based agents with
 * hooks that communicate back to the orchestrator.
 *
 * Note: git-utils.ts is NOT exported here because it uses Node.js APIs
 * (execFileSync) that can't run in the browser. Import it directly in
 * main process code: import { resolveGitBranch } from './hooks/agent-setup/git-utils.js'
 */

export * from './claude-wrapper.js';
export * from './constants.js';
// git-utils.js is Node.js only - import directly in main process
export * from './notify-script.js';
export * from './terminal-env.js';
