import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AgentAction,
  AgentActionResponse,
  ClarifyingQuestionAction,
  ToolApprovalAction,
} from '@agent-orchestrator/shared';
import { agentActionStore } from '../stores';
import './ActionPill.css';

const DEFAULT_LABEL = 'Actions pending';

export function ActionPill() {
  const [actions, setActions] = useState<AgentAction[]>(() =>
    agentActionStore.getAllActions()
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSquare, setIsSquare] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [isContentVisible, setIsContentVisible] = useState(false);
  const [isTextVisible, setIsTextVisible] = useState(true);
  const [actionAnswers, setActionAnswers] = useState<Record<string, Record<string, string>>>({});
  const [submittingActions, setSubmittingActions] = useState<Set<string>>(new Set());

  useEffect(() => agentActionStore.subscribeAll(setActions), []);

  useEffect(() => {
    if (actions.length === 0) {
      setIsContentVisible(false);
      setShowContent(false);
      setIsSquare(false);
      setIsExpanded(false);
      setIsTextVisible(true);
    }
  }, [actions.length]);

  const sortedActions = useMemo(() => {
    return [...actions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [actions]);

  const hasActions = sortedActions.length > 0;

  const togglePill = useCallback(() => {
    if (!hasActions) {
      return;
    }
    if (!isExpanded) {
      setIsTextVisible(false);
      setIsExpanded(true);
      setIsSquare(true);
      setTimeout(() => {
        setShowContent(true);
        setTimeout(() => {
          setIsContentVisible(true);
        }, 100);
      }, 350);
    } else {
      setIsContentVisible(false);
      setShowContent(false);
      setIsSquare(false);
      setIsExpanded(false);
      setTimeout(() => {
        setIsTextVisible(true);
      }, 350);
    }
  }, [hasActions, isExpanded]);

  const collapsePill = useCallback(() => {
    setIsContentVisible(false);
    setShowContent(false);
    setTimeout(() => {
      setIsSquare(false);
      setIsExpanded(false);
      setTimeout(() => {
        setIsTextVisible(true);
      }, 350);
    }, 50);
  }, []);

  const updateActionAnswer = useCallback((actionId: string, question: string, value: string) => {
    setActionAnswers((prev) => ({
      ...prev,
      [actionId]: {
        ...(prev[actionId] || {}),
        [question]: value,
      },
    }));
  }, []);

  const submitAction = useCallback(async (response: AgentActionResponse) => {
    if (!window.codingAgentAPI?.respondToAction) {
      return;
    }

    setSubmittingActions((prev) => new Set(prev).add(response.actionId));
    try {
      await window.codingAgentAPI.respondToAction(response);
      agentActionStore.removeAction(response.actionId);
      setActionAnswers((prev) => {
        if (!prev[response.actionId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[response.actionId];
        return next;
      });
    } finally {
      setSubmittingActions((prev) => {
        const next = new Set(prev);
        next.delete(response.actionId);
        return next;
      });
    }
  }, []);

  const handleSubmitClarifying = useCallback(
    async (action: ClarifyingQuestionAction) => {
      const answers = actionAnswers[action.id] || {};
      const normalized: Record<string, string> = {};

      for (const question of action.questions) {
        const value = answers[question.question];
        if (value) {
          normalized[question.question] = value;
        }
      }

      await submitAction({
        actionId: action.id,
        type: 'clarifying_question',
        answers: normalized,
      });
    },
    [actionAnswers, submitAction]
  );

  const handleToolApproval = useCallback(
    async (action: ToolApprovalAction, decision: 'allow' | 'deny') => {
      await submitAction({
        actionId: action.id,
        type: 'tool_approval',
        decision,
      });
    },
    [submitAction]
  );

  const label = hasActions
    ? sortedActions.length === 1
      ? '1 action pending'
    : `${sortedActions.length} actions pending`
    : "You're all clear";

  return (
    <div
      onClick={!isSquare ? togglePill : undefined}
      className={`issues-pill action-pill ${!isSquare ? 'cursor-pointer' : 'cursor-default'} ${
        isExpanded ? 'expanded' : ''
      } ${isSquare ? 'square' : ''}`}
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
            onClick={collapsePill}
            title="Collapse actions"
          />
          <div className={`action-pill-list ${isContentVisible ? 'visible' : ''}`}>
            {!hasActions && (
              <div className="action-pill-card">
                <div className="action-pill-card-header">
                  <span>All clear</span>
                  <span className="action-pill-agent">No pending actions</span>
                </div>
              </div>
            )}
            {sortedActions.map((action) => {
              const agentLabel = action.agentId
                ? `Agent ${action.agentId}`
                : action.agentType
                ? `Agent ${action.agentType}`
                : 'Agent action';

              if (action.type === 'clarifying_question') {
                const questionAction = action as ClarifyingQuestionAction;
                return (
                  <div key={action.id} className="action-pill-card">
                    <div className="action-pill-card-header">
                      <span>Clarifying question</span>
                      <span className="action-pill-agent">{agentLabel}</span>
                    </div>
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
                              updateActionAnswer(action.id, question.question, event.target.value)
                            }
                            placeholder="Enter your response..."
                          />
                        </div>
                      ))}
                      <button
                        className="action-pill-submit"
                        type="button"
                        onClick={() => handleSubmitClarifying(questionAction)}
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
                <div key={action.id} className="action-pill-card">
                  <div className="action-pill-card-header">
                    <span>Tool approval</span>
                    <span className="action-pill-agent">{agentLabel}</span>
                  </div>
                  <div className="action-pill-card-body">
                    <div className="action-pill-summary">
                      <span className="action-pill-tool">{approvalAction.toolName}</span>
                      {approvalAction.command && (
                        <span className="action-pill-command">{approvalAction.command}</span>
                      )}
                      {approvalAction.filePath && (
                        <span className="action-pill-path">{approvalAction.filePath}</span>
                      )}
                    </div>
                    <div className="action-pill-buttons">
                      <button
                        className="action-pill-approve"
                        type="button"
                        onClick={() => handleToolApproval(approvalAction, 'allow')}
                        disabled={submittingActions.has(action.id)}
                      >
                        Accept
                      </button>
                      <button
                        className="action-pill-deny"
                        type="button"
                        onClick={() => handleToolApproval(approvalAction, 'deny')}
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
