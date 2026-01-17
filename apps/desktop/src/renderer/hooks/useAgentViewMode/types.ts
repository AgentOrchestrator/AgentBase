/**
 * useAgentViewMode Types
 *
 * Type definitions for the agent view mode management hook.
 * This hook coordinates terminal/chat view switching to avoid
 * Claude Code session conflicts.
 */

import type { IAgentService, ITerminalService } from '../../context/node-services';
import type { AgentNodeView } from '../../types/agent-node';

/**
 * Input parameters for useAgentViewMode hook
 */
export interface UseAgentViewModeInput {
  /**
   * Terminal service for lifecycle management.
   * Obtained from useTerminalService() context hook.
   */
  terminalService: ITerminalService;

  /**
   * Agent service for REPL lifecycle management.
   * Used to gracefully exit REPL before switching to chat.
   */
  agentService: IAgentService;

  /**
   * Initial view to display.
   * @default 'overview'
   */
  initialView?: AgentNodeView;

  /**
   * Callback when view changes.
   * Called after view state is updated and any lifecycle operations complete.
   */
  onViewChange?: (view: AgentNodeView) => void;
}

/**
 * Return value from useAgentViewMode hook
 */
export interface UseAgentViewModeReturn {
  /** Current active view */
  activeView: AgentNodeView;

  /**
   * Set the active view.
   * Handles terminal lifecycle coordination:
   * - terminal → chat: destroys terminal PTY (releases session)
   * - chat → terminal: terminal recreated on mount
   */
  setActiveView: (view: AgentNodeView) => Promise<void>;

  /** Convenience: is terminal the active view? */
  isTerminalActive: boolean;

  /** Convenience: is chat the active view? */
  isChatActive: boolean;

  /** Is a view transition in progress? */
  isTransitioning: boolean;
}
