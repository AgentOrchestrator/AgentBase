/**
 * Shared Type Definitions
 *
 * Re-exports all domain types for use across the monorepo.
 * Import from '@agent-orchestrator/shared' to access these types.
 */

// Coding Agent types (status, state, tool types)
export * from './coding-agent.js';

// Agent Node types (progress, title, node data)
export * from './agent-node.js';

// Attachment types (Linear issues, workspace metadata)
export * from './attachments.js';

// Worktree types (git worktree management)
export * from './worktree.js';

// Canvas types (React Flow nodes, edges, state)
export * from './canvas.js';

// Session types (identifiers, content, fork options)
export * from './session.js';

// Conversation types (Claude Code JSONL format)
export * from './conversation.js';

// Workspace types (recent workspaces)
export * from './workspace.js';
