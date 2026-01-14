import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Handle, Position, NodeProps, NodeResizer, useReactFlow } from '@xyflow/react';
import { marked } from 'marked';
import type { MessageGroup, UserMessageGroup, AssistantMessageGroup, MessageContent, ToolUseContent, ThinkingContent } from '../types/conversation';
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
        <div className="consolidated-user-content">
          {group.text}
        </div>
      </div>
    );
  };

  // Represents a displayable item for assistant messages
  type DisplayItem =
    | { type: 'text'; content: MessageContent; key: string }
    | { type: 'thinking'; content: ThinkingContent; key: string }
    | { type: 'tool_summary'; toolType: 'read' | 'edit' | 'grep' | 'glob'; count: number; key: string };

  const getToolType = (toolName: string): 'read' | 'edit' | 'grep' | 'glob' | null => {
    if (toolName === 'Read') return 'read';
    if (toolName === 'Edit' || toolName === 'Write') return 'edit';
    if (toolName === 'Grep') return 'grep';
    if (toolName === 'Glob') return 'glob';
    return null; // Skip TodoWrite and other tools
  };

  const processAssistantEntries = (group: AssistantMessageGroup): DisplayItem[] => {
    const items: DisplayItem[] = [];
    let currentToolType: 'read' | 'edit' | 'grep' | 'glob' | null = null;
    let currentToolCount = 0;
    let itemIndex = 0;

    const flushToolGroup = () => {
      if (currentToolType && currentToolCount > 0) {
        items.push({
          type: 'tool_summary',
          toolType: currentToolType,
          count: currentToolCount,
          key: `tool-summary-${itemIndex++}`
        });
        currentToolType = null;
        currentToolCount = 0;
      }
    };

    for (const entry of group.entries) {
      for (const content of entry.message.content) {
        if (content.type === 'text') {
          flushToolGroup();
          items.push({ type: 'text', content, key: `text-${itemIndex++}` });
        } else if (content.type === 'thinking') {
          flushToolGroup();
          items.push({ type: 'thinking', content: content as ThinkingContent, key: `thinking-${itemIndex++}` });
        } else if (content.type === 'tool_use') {
          const toolContent = content as ToolUseContent;
          const toolType = getToolType(toolContent.name);

          if (toolType) {
            if (currentToolType === toolType) {
              currentToolCount++;
            } else {
              flushToolGroup();
              currentToolType = toolType;
              currentToolCount = 1;
            }
          }
        }
      }
    }

    flushToolGroup();
    return items;
  };

  const renderDisplayItem = (item: DisplayItem) => {
    if (item.type === 'text') {
      const html = marked.parse((item.content as any).text) as string;
      return (
        <div
          key={item.key}
          className="consolidated-assistant-text-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    if (item.type === 'thinking') {
      return (
        <div key={item.key} className="consolidated-thinking-content">
          <span className="thinking-label">Thinking:</span>
          <span className="thinking-text">{item.content.thinking}</span>
        </div>
      );
    }

    if (item.type === 'tool_summary') {
      let label = '';
      if (item.toolType === 'read') {
        label = `Read ${item.count} file${item.count > 1 ? 's' : ''}`;
      } else if (item.toolType === 'edit') {
        label = `Edited ${item.count} file${item.count > 1 ? 's' : ''}`;
      } else if (item.toolType === 'grep') {
        label = 'Scanning the code';
      } else if (item.toolType === 'glob') {
        label = 'Gathering files';
      }

      return (
        <div key={item.key} className="consolidated-tool-summary">
          {label}
        </div>
      );
    }

    return null;
  };

  const renderAssistantMessage = (group: AssistantMessageGroup, index: number) => {
    const displayItems = processAssistantEntries(group);

    return (
      <div key={`assistant-${group.uuid}`} className="consolidated-assistant-message">
        <div className="consolidated-assistant-content">
          {displayItems.map(item => renderDisplayItem(item))}
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
