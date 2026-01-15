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
 * - Providers for session tracking (used by ForkService)
 *
 * @example
 * ```typescript
 * import {
 *   createEventRegistry,
 *   createPermissionHandler,
 *   PERMISSION_PRESETS,
 *   ClaudeCodeAdapter,
 *   createSessionProvider,
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
 * // Create session provider for ForkService
 * const sessionProvider = createSessionProvider(registry);
 *
 * // Parse terminal output and emit events
 * const adapter = new ClaudeCodeAdapter();
 * const events = adapter.parseTerminalOutput(terminalOutput);
 * for (const event of events) {
 *   await registry.emit(event);
 * }
 * ```
 */

// Core types
export * from './types.js';

// Event registry
export * from './registry.js';

// Permission policies
export * from './policy.js';

// Event handlers
export * from './handlers/index.js';

// Agent adapters
export * from './adapters/index.js';

// Providers (session tracking)
export * from './providers/index.js';
