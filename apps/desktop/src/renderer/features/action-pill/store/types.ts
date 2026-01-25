/**
 * ActionPill Store Types
 *
 * Defines the shape of the ActionPill Zustand store.
 */

import type { AgentAction } from '@agent-orchestrator/shared';

/**
 * UI animation state for the pill expansion
 */
export interface PillAnimationState {
  /** Whether the pill is in square (expanded container) mode */
  isSquare: boolean;
  /** Whether the content container should be rendered */
  showContent: boolean;
  /** Whether the content is visible (for fade-in animation) */
  isContentVisible: boolean;
  /** Whether the collapsed pill text is visible */
  isTextVisible: boolean;
}

/**
 * ActionPill store state and actions
 */
export interface ActionPillState {
  // Core state
  actions: AgentAction[];

  // UI state
  isExpanded: boolean;
  hasNewActions: boolean;
  animationState: PillAnimationState;

  // Form state for clarifying questions
  actionAnswers: Record<string, Record<string, string>>;
  submittingActions: Set<string>;

  // Derived state exposed for Canvas.tsx
  highlightedAgentId: string | null;

  // Actions - Core
  addAction: (action: AgentAction) => void;
  removeAction: (actionId: string) => void;
  clearAgent: (agentId: string) => void;
  clearAll: () => void;

  // Actions - UI
  expand: () => void;
  collapse: () => void;
  markActionsViewed: () => void;

  // Actions - Form
  updateActionAnswer: (actionId: string, question: string, value: string) => void;
  clearActionAnswers: (actionId: string) => void;
  setSubmitting: (actionId: string, isSubmitting: boolean) => void;
}
