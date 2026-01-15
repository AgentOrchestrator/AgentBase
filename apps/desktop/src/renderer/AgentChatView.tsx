/**
 * AgentChatView
 *
 * Chat view component for AgentNode that uses the SDK-based chat.
 * Provides streaming conversation with Claude Code.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { marked } from 'marked';
import { useChatSession } from './nodes/AgentChatNode/hooks/useChatSession';
import type { AgentChatMessage } from './types/agent-node';
import type {
  AgentContentBlock,
  AgentWebSearchToolResultBlock,
  AgentWebSearchResultBlock,
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
}

type ToolUseDisplay = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  error?: string;
};

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
}: AgentChatViewProps) {
  const [messages, setMessages] = useState<AgentChatMessage[]>(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

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

  const normalizeToolName = (toolName: string): string =>
    toolName.replace(/[_\s-]/g, '').toLowerCase();

  // Get tool icon
  const getToolIcon = (toolName: string): string => {
    const normalized = normalizeToolName(toolName);
    switch (normalized) {
      case 'read':
        return TOOL_ICONS.Read;
      case 'write':
        return TOOL_ICONS.Write;
      case 'edit':
        return TOOL_ICONS.Edit;
      case 'glob':
        return TOOL_ICONS.Glob;
      case 'grep':
        return TOOL_ICONS.Grep;
      case 'bash':
        return TOOL_ICONS.Bash;
      case 'webfetch':
        return TOOL_ICONS.WebFetch;
      case 'websearch':
        return TOOL_ICONS.WebSearch;
      case 'lsp':
        return TOOL_ICONS.LSP;
      case 'task':
        return TOOL_ICONS.Task;
      case 'todowrite':
        return TOOL_ICONS.TodoWrite;
      case 'askuserquestion':
        return TOOL_ICONS.AskUserQuestion;
      case 'notebookedit':
        return TOOL_ICONS.NotebookEdit;
      default:
        return TOOL_ICONS[toolName] || TOOL_ICONS.default;
    }
  };

  // Format tool input for display
  const formatToolInput = (toolName: string, input: Record<string, unknown>): string => {
    const normalized = normalizeToolName(toolName);
    switch (normalized) {
      case 'bash':
        return String(input.command || '');
      case 'read':
      case 'write':
      case 'edit':
        return String(input.file_path || input.filePath || '');
      case 'glob':
        return String(input.pattern || '');
      case 'grep':
        return String(input.pattern || input.query || '');
      case 'webfetch':
        return String(input.url || '');
      case 'websearch':
        return String(input.query || input.url || '');
      case 'lsp':
        return String(input.action || input.method || '');
      case 'task':
        return String(input.description || '');
      case 'todowrite': {
        const todos = input.todos as Array<{ content: string }> | undefined;
        return todos ? `${todos.length} items` : '';
      }
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
    agentId,
    agentType,
    sessionId,
    workspacePath,
    currentMessages: messages,
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

  // Render a tool use block
  const renderToolUse = (toolUse: ToolUseDisplay, index: number) => {
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

  const formatWebSearchResults = (results: AgentWebSearchResultBlock[]): string => {
    if (results.length === 0) return 'No results returned.';

    return results
      .map((result, idx) => {
        const age = result.pageAge ? ` (${result.pageAge})` : '';
        return `${idx + 1}. ${result.title}${age}\n${result.url}`;
      })
      .join('\n\n');
  };

  const renderWebSearchToolResult = (block: AgentWebSearchToolResultBlock, index: number) => {
    const content = block.content;
    const result = Array.isArray(content) ? formatWebSearchResults(content) : undefined;
    const error = Array.isArray(content)
      ? undefined
      : `Web search error: ${content.errorCode}`;

    return renderToolUse(
      {
        id: block.toolUseId,
        name: 'WebSearch',
        input: {},
        result,
        error,
      },
      index
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
  const renderContentBlock = (block: AgentContentBlock, index: number) => {
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
        return renderToolUse(block, index);
      case 'server_tool_use':
        return renderToolUse(block, index);
      case 'web_search_tool_result':
        return renderWebSearchToolResult(block, index);
      case 'thinking':
        return renderThinking(block.thinking, index);
      case 'redacted_thinking':
        return renderThinking('Thinking redacted', index);
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
