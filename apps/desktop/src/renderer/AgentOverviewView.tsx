import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import './AgentOverviewView.css';
import type { CodingAgentStatus, CodingAgentStatusInfo } from '../../types/coding-agent-status';
import type { EditorApp } from './main.d';
import type { AgentProgress, AgentTitle } from './types/agent-node';
import {
  getTodoListCompletionPercent,
  isPercentageProgress,
  isTodoListProgress,
} from './types/agent-node';

interface AgentOverviewViewProps {
  agentId: string;
  title: AgentTitle;
  summary: string | null;
  status: CodingAgentStatus;
  statusInfo?: CodingAgentStatusInfo;
  progress: AgentProgress | null;
  workspacePath?: string;
  sessionId?: string;
  onTitleChange?: (newTitle: string) => void;
  hideStatusIndicator?: boolean;
  /** Most recent user message from the session */
  mostRecentUserMessage?: string | null;
}

// Editor display names - commented out, will be used when editor menu feature is re-enabled
// const EDITOR_LABELS: Record<EditorApp, string> = {
//   vscode: 'VS Code',
//   cursor: 'Cursor',
//   zed: 'Zed',
//   sublime: 'Sublime Text',
//   atom: 'Atom',
//   webstorm: 'WebStorm',
//   finder: 'Finder',
// };

/**
 * Status display configuration
 */
const STATUS_CONFIG: Record<CodingAgentStatus, { label: string; color: string; icon: string }> = {
  idle: { label: 'Idle', color: '#888', icon: '○' },
  running: { label: 'Running', color: '#888', icon: '●' },
  thinking: { label: 'Thinking', color: '#888', icon: '◐' },
  streaming: { label: 'Streaming', color: '#888', icon: '◉' },
  executing_tool: { label: 'Executing', color: '#888', icon: '⚡' },
  awaiting_input: { label: 'Awaiting Input', color: '#888', icon: '?' },
  paused: { label: 'Paused', color: '#888', icon: '⏸' },
  completed: { label: 'Completed', color: '#d4d4d4', icon: '✓' },
  error: { label: 'Error', color: '#888', icon: '✕' },
};

/**
 * Status indicator component
 */
function StatusIndicator({
  status,
  statusInfo,
}: {
  status: CodingAgentStatus;
  statusInfo?: CodingAgentStatusInfo;
}) {
  const config = STATUS_CONFIG[status];
  const toolLabel = statusInfo?.toolName ? `: ${statusInfo.toolName}` : '';
  const subagentLabel = statusInfo?.subagentName ? ` (${statusInfo.subagentName})` : '';

  return (
    <div
      className="status-indicator"
      style={{ '--status-color': config.color } as React.CSSProperties}
    >
      <span className="status-icon">{config.icon}</span>
      <span className="status-label">
        {config.label}
        {toolLabel}
        {subagentLabel}
      </span>
    </div>
  );
}

/**
 * Progress display component
 */
function ProgressDisplay({ progress }: { progress: AgentProgress }) {
  if (isPercentageProgress(progress)) {
    return (
      <div className="progress-percentage">
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${progress.value}%` }} />
        </div>
        <div className="progress-info">
          <span className="progress-value">{progress.value}%</span>
          {progress.label && <span className="progress-label">{progress.label}</span>}
        </div>
      </div>
    );
  }

  if (isTodoListProgress(progress)) {
    const completionPercent = getTodoListCompletionPercent(progress);
    return (
      <div className="progress-todolist">
        {progress.title && <div className="todolist-title">{progress.title}</div>}
        <div className="todolist-items">
          {progress.items.map((item) => (
            <div key={item.id} className={`todolist-item ${item.completed ? 'completed' : ''}`}>
              <input type="checkbox" className="todo-checkbox" checked={item.completed} readOnly />
              <span className="todo-content">{item.content}</span>
            </div>
          ))}
        </div>
        <div className="todolist-summary">
          {completionPercent}% complete ({progress.items.filter((i) => i.completed).length}/
          {progress.items.length})
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Agent Overview View
 *
 * Display-only component showing agent status, progress, and summary.
 * Delegates all business logic to parent via callbacks.
 */
export default function AgentOverviewView({
  title,
  summary,
  status,
  statusInfo,
  progress,
  workspacePath: _workspacePath,
  sessionId: _sessionId,
  onTitleChange,
  hideStatusIndicator = false,
  mostRecentUserMessage,
}: AgentOverviewViewProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title.value);
  const [showEditorMenu, setShowEditorMenu] = useState(false);
  const [availableEditors, setAvailableEditors] = useState<EditorApp[]>([]);
  const [isLoadingEditors, setIsLoadingEditors] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load available editors when menu opens
  useEffect(() => {
    if (showEditorMenu && availableEditors.length === 0 && !isLoadingEditors) {
      setIsLoadingEditors(true);
      window.shellAPI
        ?.getAvailableEditors()
        .then((editors) => {
          setAvailableEditors(editors);
        })
        .catch((error) => {
          console.error('Failed to get available editors:', error);
        })
        .finally(() => {
          setIsLoadingEditors(false);
        });
    }
  }, [showEditorMenu, availableEditors.length, isLoadingEditors]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowEditorMenu(false);
      }
    };

    if (showEditorMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showEditorMenu]);

  const handleTitleDoubleClick = useCallback(() => {
    setIsEditingTitle(true);
    setEditedTitle(title.value);
  }, [title.value]);

  const handleTitleBlur = useCallback(() => {
    setIsEditingTitle(false);
    if (editedTitle.trim() && editedTitle !== title.value) {
      onTitleChange?.(editedTitle.trim());
    }
  }, [editedTitle, title.value, onTitleChange]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleTitleBlur();
      } else if (e.key === 'Escape') {
        setEditedTitle(title.value);
        setIsEditingTitle(false);
      }
    },
    [handleTitleBlur, title.value]
  );

  // handleOpenWithEditor - commented out, will be used when editor menu feature is re-enabled
  // const handleOpenWithEditor = useCallback(async (editor: EditorApp) => {
  //   if (!workspacePath) return;
  //   try {
  //     await window.shellAPI?.openWithEditor(workspacePath, editor);
  //     setShowEditorMenu(false);
  //   } catch (error) {
  //     console.error('Failed to open with editor:', error);
  //   }
  // }, [workspacePath]);

  return (
    <div className="agent-overview">
      {/* Title Section */}
      <div className="overview-title-section">
        {isEditingTitle ? (
          <input
            type="text"
            className="overview-title-input"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            placeholder="Add Title"
          />
        ) : (
          <h2
            className={`overview-title ${!title.value || title.value.trim() === '' ? 'overview-title-placeholder' : ''}`}
            onDoubleClick={handleTitleDoubleClick}
            title="Double-click to edit"
          >
            {title.value && title.value.trim() !== '' ? title.value : 'Add Title'}
          </h2>
        )}
      </div>

      {/* Status Indicator - Hidden if moved to node header */}
      {!hideStatusIndicator && <StatusIndicator status={status} statusInfo={statusInfo} />}

      {/* Summary */}
      {summary && (
        <div className="overview-summary">
          <p className="overview-summary-text">{summary}</p>
        </div>
      )}

      {/* Most Recent User Message */}
      {mostRecentUserMessage && (
        <div className="overview-recent-message">
          <span className="overview-recent-message-label">Latest:</span>
          <p className="overview-recent-message-text">{mostRecentUserMessage}</p>
        </div>
      )}

      {/* Progress */}
      {progress && (
        <div className="overview-progress">
          <ProgressDisplay progress={progress} />
        </div>
      )}

      {/* Actions */}
      {/* {workspacePath && (
        <div className="overview-actions">
          <div className="open-with-container" ref={menuRef}>
            <button
              className="open-with-button"
              onClick={() => setShowEditorMenu(!showEditorMenu)}
            >
              <span className="button-icon">📂</span>
              Open With...
            </button>
            {showEditorMenu && (
              <div className="editor-menu">
                {isLoadingEditors ? (
                  <div className="editor-menu-loading">Loading...</div>
                ) : availableEditors.length === 0 ? (
                  <div className="editor-menu-empty">No editors found</div>
                ) : (
                  availableEditors.map((editor) => (
                    <button
                      key={editor}
                      className="editor-menu-item"
                      onClick={() => handleOpenWithEditor(editor)}
                    >
                      {EDITOR_LABELS[editor] || editor}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )} */}

      {/* Footer - Hidden */}
      {/* {sessionId && (
        <div className="overview-footer">
          <span className="agent-session-label">Session: {sessionId}</span>
        </div>
      )} */}
    </div>
  );
}
