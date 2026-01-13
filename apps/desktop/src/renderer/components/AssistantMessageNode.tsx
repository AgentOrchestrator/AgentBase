import React, { useRef, useEffect } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import type { AssistantMessageGroup, MessageContent } from '../types/conversation';
import './AssistantMessageNode.css';

interface AssistantMessageNodeData {
  messageGroup: AssistantMessageGroup;
}

function AssistantMessageNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as AssistantMessageNodeData;
  const { messageGroup } = nodeData;
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on mount and when content changes
  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;

    // Use setTimeout to ensure DOM has updated
    const scrollToBottom = () => {
      contentElement.scrollTop = contentElement.scrollHeight;
    };

    // Small delay to ensure content is rendered
    const timeoutId = setTimeout(scrollToBottom, 0);
    return () => clearTimeout(timeoutId);
  }, [messageGroup.entries]);

  // Handle scroll events when node is selected
  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement || !selected) return;

    const handleWheel = (e: WheelEvent) => {
      // Always prevent canvas scrolling when node is selected
      // This prevents the "snap" effect when reaching boundaries
      e.stopPropagation();
    };

    contentElement.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      contentElement.removeEventListener('wheel', handleWheel);
    };
  }, [selected]);

  const renderContent = (content: MessageContent, entryIndex: number) => {
    // Only display text content, skip tool_use and tool_result
    if (content.type === 'text') {
      return (
        <div key={`text-${entryIndex}`} className="assistant-text-content">
          {content.text}
        </div>
      );
    }

    // Skip tool_use and tool_result - don't render them
    return null;
  };

  return (
    <div className={`assistant-message-node ${selected ? 'selected' : ''}`}>
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
      
      <div 
        ref={contentRef}
        className="assistant-message-content"
      >
        {messageGroup.entries.map((entry, entryIndex) => {
          // Filter to only text content
          const textContent = entry.message.content.filter(c => c.type === 'text');
          
          // Skip entries with no text content
          if (textContent.length === 0) {
            return null;
          }
          
          return (
            <div key={entry.uuid} className="assistant-entry">
              {textContent.map((content, contentIndex) =>
                renderContent(content, `${entryIndex}-${contentIndex}`)
              )}
            </div>
          );
        })}
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default AssistantMessageNode;
