/**
 * ActionPill Presentation Component
 *
 * Pure UI component that renders the action pill and its content.
 * All state and business logic comes from props.
 */

import type {
  AgentAction,
  ClarifyingQuestionAction,
  ToolApprovalAction,
  ToolApprovalDecision,
} from '@agent-orchestrator/shared';
import type { PillAnimationState } from './store';

const DEFAULT_LABEL = 'Actions pending';

export interface ActionPillPresentationProps {
  // Data
  actions: AgentAction[];
  actionAnswers: Record<string, Record<string, string>>;
  submittingActions: Set<string>;

  // UI state
  isExpanded: boolean;
  animationState: PillAnimationState;
  shouldHighlightPill: boolean;

  // Callbacks
  onToggle: () => void;
  onCollapse: () => void;
  onUpdateAnswer: (actionId: string, question: string, value: string) => void;
  onSubmitClarifying: (action: ClarifyingQuestionAction) => void;
  onToolApproval: (action: ToolApprovalAction, decision: ToolApprovalDecision) => void;
}

export function ActionPillPresentation({
  actions,
  actionAnswers,
  submittingActions,
  isExpanded,
  animationState,
  shouldHighlightPill,
  onToggle,
  onCollapse,
  onUpdateAnswer,
  onSubmitClarifying,
  onToolApproval,
}: ActionPillPresentationProps) {
  const { isSquare, showContent, isContentVisible, isTextVisible } = animationState;
  const hasActions = actions.length > 0;

  const label = hasActions
    ? actions.length === 1
      ? '1 action pending'
      : `${actions.length} actions pending`
    : "You're all clear";

  return (
    <div
      onClick={!isSquare ? onToggle : undefined}
      className={`issues-pill action-pill ${!isSquare ? 'cursor-pointer' : 'cursor-default'} ${
        isExpanded ? 'expanded' : ''
      } ${isSquare ? 'square' : ''} ${shouldHighlightPill ? 'has-new-actions' : ''}`}
      style={{
        borderRadius: isSquare ? '24px' : '20px',
      }}
    >
      {!isSquare ? (
        <div className={`pill-text ${isTextVisible ? 'visible' : ''}`}>
          {label || DEFAULT_LABEL}
        </div>
      ) : showContent ? (
        <div className="pill-content-wrapper" onClick={(event) => event.stopPropagation()}>
          <div
            className={`collapse-nozzle ${isContentVisible ? 'visible' : ''}`}
            onClick={onCollapse}
            title="Collapse actions"
          />
          <div className={`action-pill-list ${isContentVisible ? 'visible' : ''}`}>
            {!hasActions && (
              <div className="action-pill-card">
                <div className="action-pill-agent-label">No pending actions</div>
              </div>
            )}
            {actions.map((action, index) => {
              const agentLabel = action.agentId
                ? action.agentId
                : action.agentType
                  ? action.agentType
                  : 'Unknown agent';

              // Highlight the topmost action (index 0)
              const isTopmost = index === 0 && isExpanded;

              if (action.type === 'clarifying_question') {
                const questionAction = action as ClarifyingQuestionAction;
                return (
                  <div
                    key={action.id}
                    className={`action-pill-card ${isTopmost ? 'highlighted' : ''}`}
                  >
                    <div className="action-pill-agent-label">{agentLabel}</div>
                    <div className="action-pill-card-body">
                      {questionAction.questions.map((question) => (
                        <div key={question.question} className="action-pill-question">
                          <div className="action-pill-question-title">
                            {question.header ? `${question.header}: ` : ''}
                            {question.question}
                          </div>
                          <input
                            className="action-pill-question-input"
                            type="text"
                            value={actionAnswers[action.id]?.[question.question] || ''}
                            onChange={(event) =>
                              onUpdateAnswer(action.id, question.question, event.target.value)
                            }
                            placeholder="Enter your response..."
                          />
                        </div>
                      ))}
                      <button
                        className="action-pill-submit"
                        type="button"
                        onClick={() => onSubmitClarifying(questionAction)}
                        disabled={submittingActions.has(action.id)}
                      >
                        Submit response
                      </button>
                    </div>
                  </div>
                );
              }

              const approvalAction = action as ToolApprovalAction;
              return (
                <div
                  key={action.id}
                  className={`action-pill-card ${isTopmost ? 'highlighted' : ''}`}
                >
                  <div className="action-pill-agent-label">{agentLabel}</div>
                  <div className="action-pill-card-body">
                    <div className="action-pill-summary">
                      <span className="action-pill-tool">{approvalAction.toolName}</span>
                      {approvalAction.command && (
                        <span className="action-pill-command">{approvalAction.command}</span>
                      )}
                      {approvalAction.filePath && (
                        <span className="action-pill-path">{approvalAction.filePath}</span>
                      )}
                      {approvalAction.input && Object.keys(approvalAction.input).length > 0 && (
                        <pre className="action-pill-input">
                          {JSON.stringify(approvalAction.input, null, 2)}
                        </pre>
                      )}
                    </div>
                    <div className="action-pill-buttons">
                      <button
                        className="action-pill-approve"
                        type="button"
                        onClick={() => onToolApproval(approvalAction, 'allow')}
                        disabled={submittingActions.has(action.id)}
                      >
                        Accept
                      </button>
                      {approvalAction.terminalId && (
                        <button
                          className="action-pill-approve-all"
                          type="button"
                          onClick={() => onToolApproval(approvalAction, 'allow_all')}
                          disabled={submittingActions.has(action.id)}
                        >
                          Accept all
                        </button>
                      )}
                      <button
                        className="action-pill-deny"
                        type="button"
                        onClick={() => onToolApproval(approvalAction, 'deny')}
                        disabled={submittingActions.has(action.id)}
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
