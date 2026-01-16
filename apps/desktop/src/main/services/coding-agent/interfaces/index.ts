export type { ICodingAgentProvider } from './ICodingAgentProvider';
export type { ISessionManager } from './ISessionManager';
export type { ISessionResumable } from './ISessionResumable';
export type { ISessionForkable } from './ISessionForkable';
export type { IProcessLifecycle } from './IProcessLifecycle';
export type { IChatHistoryProvider } from './IChatHistoryProvider';
export type { ISessionValidator } from './ISessionValidator';

/**
 * Combined interface for full-featured agents
 * Agents that support all capabilities can implement this.
 */
export interface IFullCodingAgent
  extends ICodingAgentProvider,
    ISessionManager,
    ISessionResumable,
    ISessionForkable,
    IProcessLifecycle {}

/**
 * Minimal interface for basic agents
 * At minimum, agents must support generation and lifecycle management.
 */
export interface IMinimalCodingAgent
  extends ICodingAgentProvider,
    IProcessLifecycle {}

// Re-export interface types for convenience
import type { ICodingAgentProvider } from './ICodingAgentProvider';
import type { ISessionManager } from './ISessionManager';
import type { ISessionResumable } from './ISessionResumable';
import type { ISessionForkable } from './ISessionForkable';
import type { IProcessLifecycle } from './IProcessLifecycle';
import type { IChatHistoryProvider } from './IChatHistoryProvider';
import type { ISessionValidator } from './ISessionValidator';
