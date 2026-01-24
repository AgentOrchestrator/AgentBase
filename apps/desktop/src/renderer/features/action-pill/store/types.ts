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

  // Active agent cycling state
  activeActionIndex: number;

  // Form state for clarifying questions
  actionAnswers: Record<string, Record<string, string>>;
  submittingActions: Set<string>;

  // Dismissal state for visual feedback
  dismissingActions: Set<string>;

  // Derived state exposed for Canvas.tsx
  highlightedAgentId: string | null;

  // Actions - Core
  addAction: (action: AgentAction) => void;
  removeAction: (actionId: string) => void;
  clearAgent: (agentId: string) => void;

  // Actions - UI
  expand: () => void;
  collapse: () => void;
  markActionsViewed: () => void;

  // Actions - Cycling
  cycleActiveAgent: (direction: 'next' | 'prev') => void;

  // Actions - Form
  updateActionAnswer: (actionId: string, question: string, value: string) => void;
  clearActionAnswers: (actionId: string) => void;
  setSubmitting: (actionId: string, isSubmitting: boolean) => void;

  // Actions - Dismissal
  markDismissing: (actionId: string) => void;
  completeDismissal: (actionId: string) => void;
}
