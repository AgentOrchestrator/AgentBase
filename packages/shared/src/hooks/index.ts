/**
 * Agent Hooks Module
 *
 * A vendor-agnostic event system for coding agent hooks.
 *
 * This module provides:
 * - Unified event types that abstract away vendor-specific implementations
 * - EventRegistry for pub/sub event handling
 * - PermissionPolicy for per-project permission configuration
 * - Handlers for permission requests and other events
 * - Adapters to translate vendor events (Claude Code, Codex) to unified format
 *
 * @example
 * ```typescript
 * import {
 *   createEventRegistry,
 *   createPermissionHandler,
 *   PERMISSION_PRESETS,
 *   ClaudeCodeAdapter,
 * } from '@agent-orchestrator/shared';
 *
 * // Create event registry
 * const registry = createEventRegistry();
 *
 * // Register permission handler
 * registry.onPermissionRequest(createPermissionHandler({
 *   policy: PERMISSION_PRESETS.interactive,
 *   onAsk: async (payload) => {
 *     return await showPermissionDialog(payload);
 *   },
 * }));
 *
 * // Parse terminal output and emit events
 * const adapter = new ClaudeCodeAdapter();
 * const events = adapter.parseTerminalOutput(terminalOutput);
 * for (const event of events) {
 *   await registry.emit(event);
 * }
 * ```
 */

// Agent adapters
export * from './adapters/index.js';
// Event handlers
export * from './handlers/index.js';

// Permission policies
export * from './policy.js';
// Event registry
export * from './registry.js';
// Core types
export * from './types.js';
