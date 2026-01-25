/**
 * Linear Feature
 *
 * Contains Linear integration for issues and project management.
 */

// Re-export Linear types from the store for convenience
// Note: LinearIssue is not re-exported here to avoid conflict with canvas/hooks/useCanvasDrop
export type {
  LinearFilterState,
  LinearMilestone,
  LinearProject,
  LinearWorkflowState,
  MilestoneOption,
} from '../../stores/ILinearStore';
// Hooks
export {
  type UseLinearPanelInput,
  type UseLinearPanelReturn,
  type UseLinearReturn,
  useLinear,
  useLinearPanel,
} from './hooks';
