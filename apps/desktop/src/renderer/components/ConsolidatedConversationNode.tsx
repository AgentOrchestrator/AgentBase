import React, { useRef, useEffect, useState } from 'react';
import { Handle, Position, NodeProps, NodeResizer, useReactFlow } from '@xyflow/react';
import { marked } from 'marked';
import type { MessageGroup, UserMessageGroup, AssistantMessageGroup, MessageContent } from '../types/conversation';
import './ConsolidatedConversationNode.css';

// Configure marked for tight spacing
marked.setOptions({
  gfm: true,
  breaks: false,
});

interface ConsolidatedConversationNodeData {
  groups: MessageGroup[];
}

function ConsolidatedConversationNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as ConsolidatedConversationNodeData;
  const { groups } = nodeData;
  const contentRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { setNodes } = useReactFlow();

  // Auto-scroll to bottom on mount and when content changes
  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;

    const scrollToBottom = () => {
      contentElement.scrollTop = contentElement.scrollHeight;
    };

    const timeoutId = setTimeout(scrollToBottom, 0);
    return () => clearTimeout(timeoutId);
  }, [groups]);

  // Handle scroll events when node is selected
  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement || !selected) return;

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
    };

    contentElement.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      contentElement.removeEventListener('wheel', handleWheel);
    };
  }, [selected]);

  // Handle fullscreen toggle
  const handleFullscreenToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);

    if (newExpanded) {
      // Calculate height needed for full content - use setTimeout to ensure DOM is updated
      setTimeout(() => {
        if (contentRef.current) {
          const contentHeight = contentRef.current.scrollHeight;
          const padding = 24; // 12px top + 12px bottom
          const fullHeight = Math.max(contentHeight + padding, 600); // At least 600px

          // Update node dimensions using setNodes
          setNodes((nds) =>
            nds.map((node) => {
              if (node.id === id) {
                return {
                  ...node,
                  style: { ...node.style, width: 600, height: fullHeight },
                  height: fullHeight,
                };
              }
              return node;
            })
          );
        }
      }, 0);
    } else {
      // Return to 1.5x terminal height (600px)
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            return {
              ...node,
              style: { ...node.style, width: 600, height: 600 },
              height: 600,
            };
          }
          return node;
        })
      );
    }
  };

  const renderUserMessage = (group: UserMessageGroup, index: number) => {
    return (
      <div key={`user-${group.uuid}`} className="consolidated-user-message">
        <div className="consolidated-user-header">
          <span className="consolidated-user-label">User</span>
        </div>
        <div className="consolidated-user-content">
          {group.text}
        </div>
      </div>
    );
  };

  const renderAssistantMessage = (group: AssistantMessageGroup, index: number) => {
    const renderContent = (content: MessageContent, entryIndex: number) => {
      if (content.type === 'text') {
        const html = marked.parse(content.text) as string;
        return (
          <div
            key={`text-${entryIndex}`}
            className="consolidated-assistant-text-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      }
      return null;
    };

    return (
      <div key={`assistant-${group.uuid}`} className="consolidated-assistant-message">
        <div className="consolidated-assistant-header">
          <span className="consolidated-assistant-label">Assistant</span>
        </div>
        <div className="consolidated-assistant-content">
          {group.entries.map((entry, entryIndex) => {
            const textContent = entry.message.content.filter(c => c.type === 'text');
            if (textContent.length === 0) {
              return null;
            }
            return (
              <div key={entry.uuid} className="consolidated-assistant-entry">
                {textContent.map((content, contentIndex) =>
                  renderContent(content, `${entryIndex}-${contentIndex}`)
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`consolidated-conversation-node ${selected ? 'selected' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <NodeResizer
        minWidth={600}
        minHeight={600}
        isVisible={true}
        lineStyle={{ borderColor: 'transparent' }}
        handleStyle={{ width: 8, height: 8, borderRadius: '50%' }}
      />

      {/* Fullscreen icon - appears on hover */}
      {isHovered && (
        <div
          className="consolidated-fullscreen-icon"
          onClick={handleFullscreenToggle}
          title={isExpanded ? 'Collapse' : 'Expand to full conversation'}
        >
          {isExpanded ? '⤓' : '⤢'}
        </div>
      )}

      <Handle type="target" position={Position.Top} />

      <div
        ref={contentRef}
        className="consolidated-conversation-content"
      >
        {groups.map((group, index) => {
          if (group.type === 'user') {
            return renderUserMessage(group as UserMessageGroup, index);
          } else {
            return renderAssistantMessage(group as AssistantMessageGroup, index);
          }
        })}
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default ConsolidatedConversationNode;
