import React, { useState } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import type { AssistantMessageGroup, MessageContent } from '../types/conversation';
import './AssistantMessageNode.css';

interface AssistantMessageNodeData {
  messageGroup: AssistantMessageGroup;
}

function AssistantMessageNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as AssistantMessageNodeData;
  const { messageGroup } = nodeData;
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  const toggleTool = (toolId: string) => {
    const newExpanded = new Set(expandedTools);
    if (newExpanded.has(toolId)) {
      newExpanded.delete(toolId);
    } else {
      newExpanded.add(toolId);
    }
    setExpandedTools(newExpanded);
  };

  const renderContent = (content: MessageContent, entryIndex: number) => {
    if (content.type === 'text') {
      return (
        <div key={`text-${entryIndex}`} className="assistant-text-content">
          {content.text}
        </div>
      );
    }

    if (content.type === 'tool_use') {
      const isExpanded = expandedTools.has(content.id);
      return (
        <div key={`tool-${content.id}`} className="assistant-tool-use">
          <button
            className="tool-use-header"
            onClick={() => toggleTool(content.id)}
          >
            <span className="tool-icon">🔧</span>
            <span className="tool-name">{content.name}</span>
            <span className="tool-toggle">{isExpanded ? '▼' : '▶'}</span>
          </button>
          {isExpanded && (
            <div className="tool-use-details">
              <div className="tool-input">
                <div className="tool-input-label">Input:</div>
                <pre>{JSON.stringify(content.input, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (content.type === 'tool_result') {
      const resultContent = Array.isArray(content.content)
        ? content.content.map((c) => c.text).join('\n')
        : content.content;
      
      return (
        <div key={`result-${content.tool_use_id}`} className="assistant-tool-result">
          <div className="tool-result-label">Result:</div>
          <div className="tool-result-content">
            {resultContent.length > 500 ? (
              <>
                <pre>{resultContent.substring(0, 500)}...</pre>
                <div className="tool-result-truncated">
                  (truncated, {resultContent.length} chars total)
                </div>
              </>
            ) : (
              <pre>{resultContent}</pre>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`assistant-message-node ${selected ? 'selected' : ''}`}>
      <NodeResizer minWidth={300} minHeight={150} />
      <Handle type="target" position={Position.Top} />
      
      <div className="assistant-message-header">
        <span className="assistant-message-label">Assistant</span>
        {messageGroup.model && (
          <span className="assistant-model">{messageGroup.model}</span>
        )}
        <span className="assistant-message-timestamp">
          {new Date(messageGroup.timestamp).toLocaleTimeString()}
        </span>
      </div>
      
      <div className="assistant-message-content">
        {messageGroup.entries.map((entry, entryIndex) => (
          <div key={entry.uuid} className="assistant-entry">
            {entry.message.content.map((content, contentIndex) =>
              renderContent(content, `${entryIndex}-${contentIndex}`)
            )}
          </div>
        ))}
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default AssistantMessageNode;
