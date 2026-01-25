import { Handle, type NodeProps, Position } from '@xyflow/react';
import { marked } from 'marked';
import { useEffect, useMemo, useRef } from 'react';
import type {
  AssistantMessageGroup,
  MessageContent,
  ThinkingContent,
  ToolUseContent,
} from '../types/conversation';
import './AssistantMessageNode.css';

// Configure marked for tight spacing
marked.setOptions({
  gfm: true,
  breaks: false,
});

interface AssistantMessageNodeData {
  messageGroup: AssistantMessageGroup;
}

// Represents a displayable item (either content or a tool summary)
type DisplayItem =
  | { type: 'text'; content: MessageContent; key: string }
  | { type: 'thinking'; content: ThinkingContent; key: string }
  | {
      type: 'tool_summary';
      toolType: 'read' | 'edit' | 'grep' | 'glob';
      count: number;
      key: string;
    };

function AssistantMessageNode({ data, id: _id, selected }: NodeProps) {
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
  }, []);

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

  // Process all entries and group consecutive tool uses
  const displayItems = useMemo(() => {
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
          key: `tool-summary-${itemIndex++}`,
        });
        currentToolType = null;
        currentToolCount = 0;
      }
    };

    const getToolType = (toolName: string): 'read' | 'edit' | 'grep' | 'glob' | null => {
      if (toolName === 'Read') return 'read';
      if (toolName === 'Edit' || toolName === 'Write') return 'edit';
      if (toolName === 'Grep') return 'grep';
      if (toolName === 'Glob') return 'glob';
      return null; // Skip TodoWrite and other tools
    };

    for (const entry of messageGroup.entries) {
      for (const content of entry.message.content) {
        if (content.type === 'text') {
          flushToolGroup();
          items.push({ type: 'text', content, key: `text-${itemIndex++}` });
        } else if (content.type === 'thinking') {
          flushToolGroup();
          items.push({
            type: 'thinking',
            content: content as ThinkingContent,
            key: `thinking-${itemIndex++}`,
          });
        } else if (content.type === 'tool_use') {
          const toolContent = content as ToolUseContent;
          const toolType = getToolType(toolContent.name);

          if (toolType) {
            if (currentToolType === toolType) {
              // Same tool type, increment count
              currentToolCount++;
            } else {
              // Different tool type, flush previous and start new
              flushToolGroup();
              currentToolType = toolType;
              currentToolCount = 1;
            }
          }
          // Skip tools not in our list (like TodoWrite)
        }
      }
    }

    // Flush any remaining tool group
    flushToolGroup();

    return items;
  }, [messageGroup.entries]);

  const renderItem = (item: DisplayItem) => {
    if (item.type === 'text') {
      const html = marked.parse((item.content as any).text) as string;
      return (
        <div
          key={item.key}
          className="assistant-text-content"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Markdown rendering requires innerHTML
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    if (item.type === 'thinking') {
      return (
        <div key={item.key} className="assistant-thinking-content">
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
        <div key={item.key} className="assistant-tool-summary">
          {label}
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`assistant-message-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Top} />

      <div className="assistant-message-header">
        <span className="assistant-message-label">Assistant</span>
      </div>

      <div ref={contentRef} className="assistant-message-content">
        {displayItems.map((item) => renderItem(item))}
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default AssistantMessageNode;
