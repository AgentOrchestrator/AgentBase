/**
 * SessionPickerModal
 *
 * Modal to browse and select from available conversation sessions.
 */

import { useCallback, useEffect, useState } from 'react';
import type { CodingAgentAPI } from '../../main/services/coding-agent';
import './SessionPickerModal.css';

// Types from CodingAgent
interface SessionSummary {
  id: string;
  agentType: string;
  createdAt: string;
  updatedAt: string;
  timestamp: string;
  projectPath?: string;
  projectName?: string;
  messageCount: number;
  firstUserMessage?: string;
  lastAssistantMessage?: string;
  toolCallCount?: number;
  hasThinking?: boolean;
}

interface SessionPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (session: SessionSummary) => void;
}

function SessionPickerModal({ isOpen, onClose, onSelect }: SessionPickerModalProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch sessions when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchSessions = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const codingAgentAPI = (window as unknown as { codingAgentAPI?: CodingAgentAPI })
          .codingAgentAPI;
        if (!codingAgentAPI) {
          setError('Coding agent API not available');
          return;
        }

        const summaries = await codingAgentAPI.listSessionSummaries('claude_code', {
          lookbackDays: 30,
        });
        setSessions(summaries);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sessions');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
  }, [isOpen]);

  // Filter sessions by search term
  const filteredSessions = sessions.filter((session) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      session.projectName?.toLowerCase().includes(term) ||
      session.projectPath?.toLowerCase().includes(term) ||
      session.firstUserMessage?.toLowerCase().includes(term) ||
      session.id.toLowerCase().includes(term)
    );
  });

  // Format relative time
  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleSelect = useCallback(
    (session: SessionSummary) => {
      onSelect(session);
      onClose();
    },
    [onSelect, onClose]
  );

  if (!isOpen) return null;

  return (
    <div className="session-picker-overlay" onClick={onClose}>
      <div className="session-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="session-picker-header">
          <h2>Load Conversation</h2>
          <button className="session-picker-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="session-picker-search">
          <input
            type="text"
            placeholder="Search by project or message..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="session-picker-content">
          {isLoading && <div className="session-picker-loading">Loading sessions...</div>}

          {error && <div className="session-picker-error">{error}</div>}

          {!isLoading && !error && filteredSessions.length === 0 && (
            <div className="session-picker-empty">
              {searchTerm ? 'No sessions match your search' : 'No sessions found'}
            </div>
          )}

          {!isLoading &&
            !error &&
            filteredSessions.map((session) => (
              <div
                key={session.id}
                className="session-picker-item"
                onClick={() => handleSelect(session)}
              >
                <div className="session-picker-item-header">
                  <span className="session-picker-item-project">
                    {session.projectName || 'Unknown Project'}
                  </span>
                  <span className="session-picker-item-time">
                    {formatRelativeTime(session.timestamp)}
                  </span>
                </div>
                <div className="session-picker-item-preview">
                  {session.firstUserMessage || 'No messages'}
                </div>
                <div className="session-picker-item-meta">
                  <span>{session.messageCount} messages</span>
                  {session.toolCallCount !== undefined && session.toolCallCount > 0 && (
                    <span>{session.toolCallCount} tool calls</span>
                  )}
                  {session.hasThinking && <span>Has thinking</span>}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export default SessionPickerModal;
