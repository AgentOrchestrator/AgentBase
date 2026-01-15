/**
 * AgentChatView
 *
 * Chat view component for AgentNode that uses the SDK-based chat.
 * Provides streaming conversation with Claude Code.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { marked } from 'marked';
import { useChatSession } from './nodes/AgentChatNode/hooks/useChatSession';
import type { AgentChatMessage, ContentBlock, ToolUseInfo } from './types/agent-node';
import type {
  AgentAction,
  AgentActionResponse,
  ClarifyingQuestionAction,
  ToolApprovalAction,
} from '@agent-orchestrator/shared';
import './AgentChatView.css';

// Tool icons by category
const TOOL_ICONS: Record<string, string> = {
  // File operations
  Read: '📄',
  Write: '✏️',
  Edit: '🔧',
  // Search operations
  Glob: '🔍',
  Grep: '🔎',
  // Shell operations
  Bash: '💻',
  // Web operations
  WebFetch: '🌐',
  WebSearch: '🔗',
  // Code intelligence
  LSP: '🧠',
  // Task management
  Task: '📋',
  TodoWrite: '✅',
  // Other
  AskUserQuestion: '❓',
  NotebookEdit: '📓',
  default: '🔧',
};

// Configure marked for tight spacing
marked.setOptions({
  gfm: true,
  breaks: false,
});

interface AgentChatViewProps {
  agentId: string;
  sessionId?: string;
  agentType: string;
  workspacePath?: string;
  initialMessages?: AgentChatMessage[];
  onMessagesChange: (messages: AgentChatMessage[]) => void;
  onSessionCreated?: (sessionId: string) => void;
  isSessionReady?: boolean;
  selected?: boolean;
  pendingActions?: AgentAction[];
  onActionResponse?: (response: AgentActionResponse) => Promise<void> | void;
}

export default function AgentChatView({
  agentId,
  sessionId,
  agentType,
  workspacePath,
  initialMessages = [],
  onMessagesChange,
  onSessionCreated,
  isSessionReady = true,
  selected = false,
  pendingActions = [],
  onActionResponse,
}: AgentChatViewProps) {
  const [messages, setMessages] = useState<AgentChatMessage[]>(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [actionAnswers, setActionAnswers] = useState<Record<string, Record<string, string>>>({});
  const [submittingActions, setSubmittingActions] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Toggle tool expansion
  const toggleToolExpanded = useCallback((toolId: string) => {
    setExpandedTools(prev => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  }, []);

  // Get tool icon
  const getToolIcon = (toolName: string): string => {
    return TOOL_ICONS[toolName] || TOOL_ICONS.default;
  };

  // Format tool input for display
  const formatToolInput = (toolName: string, input: Record<string, unknown>): string => {
    switch (toolName) {
      case 'Bash':
        return String(input.command || '');
      case 'Read':
        return String(input.file_path || input.filePath || '');
      case 'Write':
        return String(input.file_path || input.filePath || '');
      case 'Edit':
        return String(input.file_path || input.filePath || '');
      case 'Glob':
        return String(input.pattern || '');
      case 'Grep':
        return String(input.pattern || '');
      case 'WebFetch':
        return String(input.url || '');
      case 'WebSearch':
        return String(input.query || '');
      case 'LSP':
        return String(input.action || input.method || '');
      case 'Task':
        return String(input.description || '');
      case 'TodoWrite':
        const todos = input.todos as Array<{ content: string }> | undefined;
        return todos ? `${todos.length} items` : '';
      default:
        return Object.keys(input).slice(0, 2).join(', ');
    }
  };

  // Truncate result for display
  const truncateResult = (result: string, maxLength = 500): string => {
    if (result.length <= maxLength) return result;
    return result.substring(0, maxLength) + '\n... (truncated)';
  };

  const {
    sendMessage,
    isStreaming,
  } = useChatSession({
    agentType,
    sessionId,
    workspacePath,
    onMessagesUpdate: useCallback((newMessages: AgentChatMessage[]) => {
      setMessages(newMessages);
      onMessagesChange(newMessages);
    }, [onMessagesChange]),
    onSessionCreated: useCallback((newSessionId: string) => {
      onSessionCreated?.(newSessionId);
    }, [onSessionCreated]),
    onError: setError,
  });

  // Sync messages from props
  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages, messages.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      const timeoutId = setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [messages]);

  // Handle scroll events when node is selected
  // Only prevent canvas scrolling when node is selected (clicked)
  // This matches the behavior of other nodes like UserMessageNode and AssistantMessageNode
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !selected) return;

    const handleWheel = (e: WheelEvent) => {
      // Always prevent canvas scrolling when node is selected
      // This prevents the "snap" effect when reaching boundaries
      e.stopPropagation();
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [selected]);

  const handleSend = async () => {
    if (!isSessionReady || !inputValue.trim() || isStreaming) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setError(null);

    await sendMessage(userMessage);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const sortedActions = useMemo(() => {
    return [...pendingActions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [pendingActions]);

  const updateActionAnswer = useCallback((actionId: string, question: string, value: string) => {
    setActionAnswers((prev) => ({
      ...prev,
      [actionId]: {
        ...(prev[actionId] || {}),
        [question]: value,
      },
    }));
  }, []);

  const submitAction = useCallback(
    async (response: AgentActionResponse) => {
      if (!onActionResponse) {
        return;
      }

      setSubmittingActions((prev) => new Set(prev).add(response.actionId));
      try {
        await onActionResponse(response);
      } finally {
        setSubmittingActions((prev) => {
          const next = new Set(prev);
          next.delete(response.actionId);
          return next;
        });
      }
    },
    [onActionResponse]
  );

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

  // Render a tool use block
  const renderToolUse = (toolUse: ToolUseInfo, index: number) => {
    const isExpanded = expandedTools.has(toolUse.id);
    const icon = getToolIcon(toolUse.name);
    const summary = formatToolInput(toolUse.name, toolUse.input);

    return (
      <div key={toolUse.id || index} className="agent-chat-view-tool-use">
        <button
          className="agent-chat-view-tool-header"
          onClick={() => toggleToolExpanded(toolUse.id)}
          type="button"
        >
          <span className="agent-chat-view-tool-icon">{icon}</span>
          <span className="agent-chat-view-tool-name">{toolUse.name}</span>
          <span className="agent-chat-view-tool-summary">{summary}</span>
          <span className="agent-chat-view-tool-toggle">
            {isExpanded ? '▼' : '▶'}
          </span>
        </button>
        {isExpanded && (
          <div className="agent-chat-view-tool-details">
            <div className="agent-chat-view-tool-input">
              <div className="agent-chat-view-tool-label">INPUT</div>
              <pre>{JSON.stringify(toolUse.input, null, 2)}</pre>
            </div>
            {toolUse.result && (
              <div className="agent-chat-view-tool-result">
                <div className="agent-chat-view-tool-label">OUTPUT</div>
                <pre>{truncateResult(toolUse.result)}</pre>
              </div>
            )}
            {toolUse.error && (
              <div className="agent-chat-view-tool-error">
                <div className="agent-chat-view-tool-label">ERROR</div>
                <pre>{toolUse.error}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render thinking block
  const renderThinking = (thinking: string, index: number) => {
    return (
      <div key={`thinking-${index}`} className="agent-chat-view-thinking">
        <span className="agent-chat-view-thinking-label">Thinking</span>
        <span className="agent-chat-view-thinking-text">{thinking}</span>
      </div>
    );
  };

  // Render a content block
  const renderContentBlock = (block: ContentBlock, index: number) => {
    switch (block.type) {
      case 'text':
        if (!block.text) return null;
        const html = marked.parse(block.text) as string;
        return (
          <div
            key={`text-${index}`}
            className="agent-chat-view-assistant-text-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      case 'tool_use':
        if (!block.toolUse) return null;
        return renderToolUse(block.toolUse, index);
      case 'thinking':
        if (!block.thinking) return null;
        return renderThinking(block.thinking.thinking, index);
      default:
        return null;
    }
  };

  const renderUserMessage = (msg: AgentChatMessage) => {
    return (
      <div key={msg.id} className="agent-chat-view-user-message">
        <div className="agent-chat-view-user-content">
          {msg.content}
        </div>
      </div>
    );
  };

  const renderAssistantMessage = (msg: AgentChatMessage) => {
    const isLastMessage = msg === messages[messages.length - 1];
    const showCursor = isStreaming && isLastMessage && msg.role === 'assistant';

    // If we have content blocks, render them
    if (msg.contentBlocks && msg.contentBlocks.length > 0) {
      return (
        <div key={msg.id} className="agent-chat-view-assistant-message">
          <div className="agent-chat-view-assistant-content">
            {msg.contentBlocks.map((block, index) => renderContentBlock(block, index))}
            {showCursor && (
              <span className="agent-chat-view-cursor">▊</span>
            )}
          </div>
        </div>
      );
    }

    // Fallback to plain text content
    const html = marked.parse(msg.content) as string;
    return (
      <div key={msg.id} className="agent-chat-view-assistant-message">
        <div className="agent-chat-view-assistant-content">
          <div
            className="agent-chat-view-assistant-text-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          {showCursor && (
            <span className="agent-chat-view-cursor">▊</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="agent-chat-view">
      {/* Messages */}
      <div className="agent-chat-view-messages" ref={messagesContainerRef}>
        {messages.length === 0 && (
          <div className="agent-chat-view-empty">
            {isSessionReady
              ? 'Start a conversation with Claude Code'
              : 'Waiting for session to be ready...'}
          </div>
        )}
        {messages.map((msg) => {
          if (msg.role === 'user') {
            return renderUserMessage(msg);
          } else {
            return renderAssistantMessage(msg);
          }
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="agent-chat-view-error">
          {error}
        </div>
      )}

      {/* Actions */}
      {sortedActions.length > 0 && (
        <div className="agent-chat-view-action-pill">
          <div className="agent-chat-view-action-list">
            {sortedActions.map((action) => {
              if (action.type === 'clarifying_question') {
                const questionAction = action as ClarifyingQuestionAction;
                return (
                  <div key={action.id} className="agent-chat-view-action-card">
                    <div className="agent-chat-view-action-header">Clarifying question</div>
                    <div className="agent-chat-view-action-body">
                      {questionAction.questions.map((question) => (
                        <div key={question.question} className="agent-chat-view-question">
                          <div className="agent-chat-view-question-title">
                            {question.header ? `${question.header}: ` : ''}
                            {question.question}
                          </div>
                          <input
                            className="agent-chat-view-question-input"
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
                        className="agent-chat-view-action-submit"
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
                <div key={action.id} className="agent-chat-view-action-card">
                  <div className="agent-chat-view-action-header">Tool approval</div>
                  <div className="agent-chat-view-action-body">
                    <div className="agent-chat-view-action-summary">
                      <span className="agent-chat-view-action-tool">{approvalAction.toolName}</span>
                      {approvalAction.command && (
                        <span className="agent-chat-view-action-command">{approvalAction.command}</span>
                      )}
                      {approvalAction.filePath && (
                        <span className="agent-chat-view-action-path">{approvalAction.filePath}</span>
                      )}
                    </div>
                    <div className="agent-chat-view-action-buttons">
                      <button
                        className="agent-chat-view-action-approve"
                        type="button"
                        onClick={() => handleToolApproval(approvalAction, 'allow')}
                        disabled={submittingActions.has(action.id)}
                      >
                        Accept
                      </button>
                      <button
                        className="agent-chat-view-action-deny"
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
      )}

      {/* Input */}
      <div className="agent-chat-view-input-area">
        <div className="agent-chat-view-input-container">
          <textarea
            ref={inputRef}
            className="agent-chat-view-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a follow up..."
            disabled={!isSessionReady || isStreaming}
            rows={1}
          />
          <button
            className="agent-chat-view-send"
            onClick={handleSend}
            disabled={!isSessionReady || !inputValue.trim() || isStreaming}
            type="button"
            aria-label="Send"
          >
            <span className="agent-chat-view-send-icon">↑</span>
          </button>
        </div>
      </div>
    </div>
  );
}
