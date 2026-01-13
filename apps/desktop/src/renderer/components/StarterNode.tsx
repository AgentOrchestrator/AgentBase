import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import './StarterNode.css';

interface StarterNodeData {
  placeholder?: string;
  workingDirectory?: string;
}

interface ConversationState {
  isGenerating: boolean;
  userMessage: string;
  assistantMessage: string;
  error: string | null;
}

// Type for the coding agent API exposed via preload
interface CodingAgentAPILocal {
  generate: (
    agentType: string,
    request: { prompt: string; workingDirectory?: string; systemPrompt?: string; timeout?: number }
  ) => Promise<{ content: string; messageId: string; timestamp: string; sessionId?: string; tokensUsed?: number }>;
  generateStreaming?: (
    agentType: string,
    request: { prompt: string; workingDirectory?: string; systemPrompt?: string; timeout?: number },
    onChunk: (chunk: string) => void
  ) => Promise<{ content: string; messageId: string; timestamp: string; sessionId?: string; tokensUsed?: number }>;
}

function StarterNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as StarterNodeData;
  const [inputValue, setInputValue] = useState('');
  const [conversationState, setConversationState] = useState<ConversationState>({
    isGenerating: false,
    userMessage: '',
    assistantMessage: '',
    error: null,
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const assistantContentRef = useRef<HTMLDivElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  // Auto-scroll assistant content
  useEffect(() => {
    if (assistantContentRef.current) {
      assistantContentRef.current.scrollTop = assistantContentRef.current.scrollHeight;
    }
  }, [conversationState.assistantMessage]);

  const handleSubmit = useCallback(async () => {
    const prompt = inputValue.trim();
    if (!prompt || conversationState.isGenerating) return;

    const startTime = Date.now();
    let chunksReceived = 0;
    let totalBytesReceived = 0;

    console.log('[StarterNode] Starting generation', {
      promptLength: prompt.length,
      promptPreview: prompt.slice(0, 100),
      workingDirectory: nodeData.workingDirectory,
    });

    // Check if coding agent API is available
    const codingAgentAPI = (window as unknown as { codingAgentAPI?: CodingAgentAPILocal }).codingAgentAPI;
    if (!codingAgentAPI) {
      console.error('[StarterNode] Coding agent API not available');
      setConversationState(prev => ({
        ...prev,
        error: 'Coding agent API not available',
      }));
      return;
    }

    console.log('[StarterNode] API available', {
      hasGenerateStreaming: !!codingAgentAPI.generateStreaming,
      hasGenerate: !!codingAgentAPI.generate,
    });

    // Start generation
    setConversationState({
      isGenerating: true,
      userMessage: prompt,
      assistantMessage: '',
      error: null,
    });
    setInputValue('');

    try {
      // Check if streaming is available, otherwise use regular generate
      if (codingAgentAPI.generateStreaming) {
        console.log('[StarterNode] Using streaming generation');
        await codingAgentAPI.generateStreaming(
          'claude_code',
          {
            prompt,
            workingDirectory: nodeData.workingDirectory,
          },
          (chunk: string) => {
            chunksReceived++;
            totalBytesReceived += chunk.length;

            if (chunksReceived === 1) {
              console.log('[StarterNode] First chunk received', {
                timeSinceStart: `${Date.now() - startTime}ms`,
                chunkLength: chunk.length,
              });
            } else if (chunksReceived % 10 === 0) {
              console.log('[StarterNode] Streaming progress', {
                chunksReceived,
                totalBytesReceived,
                timeSinceStart: `${Date.now() - startTime}ms`,
              });
            }

            setConversationState(prev => ({
              ...prev,
              assistantMessage: prev.assistantMessage + chunk,
            }));
          }
        );
      } else {
        console.log('[StarterNode] Using non-streaming generation');
        const response = await codingAgentAPI.generate('claude_code', {
          prompt,
          workingDirectory: nodeData.workingDirectory,
        });
        console.log('[StarterNode] Non-streaming response received', {
          contentLength: response.content.length,
          timeSinceStart: `${Date.now() - startTime}ms`,
        });
        setConversationState(prev => ({
          ...prev,
          assistantMessage: response.content,
        }));
      }

      const duration = Date.now() - startTime;
      console.log('[StarterNode] Generation complete', {
        durationMs: duration,
        chunksReceived,
        totalBytesReceived,
      });

      setConversationState(prev => ({
        ...prev,
        isGenerating: false,
      }));
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('[StarterNode] Generation error', {
        error: error instanceof Error ? error.message : String(error),
        durationMs: duration,
        chunksReceived,
        totalBytesReceived,
      });
      setConversationState(prev => ({
        ...prev,
        isGenerating: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }));
    }
  }, [inputValue, conversationState.isGenerating, nodeData.workingDirectory]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit on Enter (without Shift)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (selected) {
      e.stopPropagation();
    }
  }, [selected]);

  // Render input mode (initial state)
  if (!conversationState.userMessage) {
    return (
      <div className={`starter-node input-mode ${selected ? 'selected' : ''}`}>
        <Handle type="target" position={Position.Top} />

        <div className="starter-header">
          <span className="starter-icon">+</span>
          <span className="starter-label">New Conversation</span>
        </div>

        <textarea
          ref={textareaRef}
          className="starter-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={nodeData.placeholder || 'Ask Claude anything... (Enter to send)'}
          rows={3}
        />

        <div className="starter-footer">
          <span className="starter-hint">Press Enter to send, Shift+Enter for new line</span>
          <button
            className="starter-submit"
            onClick={handleSubmit}
            disabled={!inputValue.trim()}
          >
            Send
          </button>
        </div>

        <Handle type="source" position={Position.Bottom} />
      </div>
    );
  }

  // Render conversation mode (after submission)
  return (
    <div
      className={`starter-node conversation-mode ${selected ? 'selected' : ''}`}
      onWheel={handleWheel}
    >
      <Handle type="target" position={Position.Top} />

      {/* User message section */}
      <div className="conversation-user">
        <div className="conversation-header">
          <span className="conversation-label user-label">You</span>
        </div>
        <div className="conversation-content user-content">
          {conversationState.userMessage}
        </div>
      </div>

      {/* Divider */}
      <div className="conversation-divider" />

      {/* Assistant message section */}
      <div className="conversation-assistant">
        <div className="conversation-header">
          <span className="conversation-label assistant-label">Claude</span>
          {conversationState.isGenerating && (
            <span className="generating-indicator">
              <span className="dot">.</span>
              <span className="dot">.</span>
              <span className="dot">.</span>
            </span>
          )}
        </div>
        <div ref={assistantContentRef} className="conversation-content assistant-content">
          {conversationState.assistantMessage || (
            conversationState.isGenerating ? (
              <span className="waiting-text">Thinking...</span>
            ) : null
          )}
          {conversationState.error && (
            <div className="conversation-error">
              Error: {conversationState.error}
            </div>
          )}
        </div>
      </div>

      {/* Continue conversation input */}
      {!conversationState.isGenerating && conversationState.assistantMessage && (
        <div className="continue-section">
          <textarea
            ref={textareaRef}
            className="continue-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Continue the conversation..."
            rows={2}
          />
          <button
            className="continue-submit"
            onClick={handleSubmit}
            disabled={!inputValue.trim()}
          >
            Send
          </button>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default StarterNode;
