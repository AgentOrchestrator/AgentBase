import { Handle, type NodeProps, NodeResizer, Position, useReactFlow } from '@xyflow/react';
import { marked } from 'marked';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AssistantMessageGroup,
  MessageContent,
  MessageGroup,
  ThinkingContent,
  ToolUseContent,
  UserMessageGroup,
} from '../types/conversation';
import './ConversationNode.css';

// Configure marked for tight spacing
marked.setOptions({
  gfm: true,
  breaks: false,
});

interface ConversationNodeData {
  groups: MessageGroup[];
}

function ConversationNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as ConversationNodeData;
  const { groups } = nodeData;
  const contentRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [textSelection, setTextSelection] = useState<{
    text: string;
    position: { top: number; right: number };
  } | null>(null);
  const [mouseY, setMouseY] = useState<number | null>(null);
  const [isCommandPressed, setIsCommandPressed] = useState(false);
  const { setNodes, getViewport } = useReactFlow();

  // Detect Command/Ctrl key press for cursor change
  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    const handleKeyDown = (event: KeyboardEvent) => {
      const modifierKey = isMac ? event.metaKey : event.ctrlKey;
      if (modifierKey) {
        setIsCommandPressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const modifierKey = isMac ? event.metaKey : event.ctrlKey;
      if (!modifierKey) {
        setIsCommandPressed(false);
      }
    };

    // Also handle when key is released outside the window
    const handleBlur = () => {
      setIsCommandPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Auto-scroll to bottom on mount and when content changes
  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;

    const scrollToBottom = () => {
      contentElement.scrollTop = contentElement.scrollHeight;
    };

    const timeoutId = setTimeout(scrollToBottom, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  // Update button position based on mouse Y coordinate
  const updateButtonPositionFromMouse = useCallback(
    (clientY: number) => {
      if (!contentRef.current) return;

      const viewport = getViewport();
      const zoom = viewport.zoom;

      // Get the content element's bounding rect (already accounts for React Flow zoom transform)
      const contentRect = contentRef.current.getBoundingClientRect();
      const scrollTop = contentRef.current.scrollTop;

      // Calculate mouse Y position relative to content container
      // When React Flow zooms, it applies a CSS transform to the node
      // getBoundingClientRect() returns coordinates in viewport space (already transformed)
      // clientY is also in viewport space
      // scrollTop is in content space (not transformed)
      //
      // The visible content area is scaled by zoom, so:
      // - (clientY - contentRect.top) gives position in the visible viewport (scaled by zoom)
      // - Divide by zoom to convert from viewport-scaled to content coordinates
      // - Add scrollTop to get absolute position in the scrollable content
      const viewportRelativeY = clientY - contentRect.top;
      const contentRelativeY = viewportRelativeY / zoom;
      const absoluteY = contentRelativeY + scrollTop;

      setMouseY(absoluteY);
    },
    [getViewport]
  );

  // Detect text selection
  const handleSelectionChange = useCallback(() => {
    if (!contentRef.current) {
      setTextSelection(null);
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setTextSelection(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();

    // Check if selection is within our content container
    if (!contentRef.current.contains(range.commonAncestorContainer)) {
      setTextSelection(null);
      return;
    }

    // If no meaningful text is selected, hide button
    if (!selectedText || selectedText.length === 0) {
      setTextSelection(null);
      return;
    }

    // Keep the selection text, position will be updated by mouse movement
    setTextSelection({
      text: selectedText,
      position: { top: 0, right: 12 }, // Top will be overridden by mouseY
    });
  }, []);

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

  // Track mouse movement and update button position
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Track mouse Y position when within the content area
      if (contentRef.current) {
        const contentRect = contentRef.current.getBoundingClientRect();
        // Check if mouse is over the content area
        if (
          e.clientX >= contentRect.left &&
          e.clientX <= contentRect.right &&
          e.clientY >= contentRect.top &&
          e.clientY <= contentRect.bottom
        ) {
          updateButtonPositionFromMouse(e.clientY);
        }
      }
    };

    const handleMouseUp = () => {
      // Small delay to ensure selection is updated
      setTimeout(handleSelectionChange, 10);
    };

    // Listen for selection changes
    document.addEventListener('selectionchange', handleSelectionChange);
    // Track mouse movement
    document.addEventListener('mousemove', handleMouseMove);
    // Listen for mouseup to catch selection end
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleSelectionChange, updateButtonPositionFromMouse]);

  // Update button position on scroll when text is selected
  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement || !textSelection || mouseY === null) return;

    // Note: mouseY already accounts for scrollTop in its calculation,
    // so we don't need to adjust it on scroll - it's relative to the scrollable content
  }, [textSelection, mouseY]);

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

  const renderUserMessage = (group: UserMessageGroup, _index: number) => {
    const messageKey = `user-${group.uuid}`;
    return (
      <div key={messageKey} className="conversation-user-message">
        <div className="conversation-user-content">{group.text}</div>
      </div>
    );
  };

  // Represents a displayable item for assistant messages
  type DisplayItem =
    | { type: 'text'; content: MessageContent; key: string }
    | { type: 'thinking'; content: ThinkingContent; key: string }
    | {
        type: 'tool_summary';
        toolType: 'read' | 'edit' | 'grep' | 'glob';
        count: number;
        key: string;
      };

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
          key: `tool-summary-${itemIndex++}`,
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
          className="conversation-assistant-text-content"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Markdown rendering requires innerHTML
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    if (item.type === 'thinking') {
      return (
        <div key={item.key} className="conversation-thinking-content">
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
        <div key={item.key} className="conversation-tool-summary">
          {label}
        </div>
      );
    }

    return null;
  };

  const renderAssistantMessage = (group: AssistantMessageGroup, _index: number) => {
    const displayItems = processAssistantEntries(group);
    const messageKey = `assistant-${group.uuid}`;

    return (
      <div key={messageKey} className="conversation-assistant-message">
        <div className="conversation-assistant-content">
          {displayItems.map((item) => renderDisplayItem(item))}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`conversation-node ${selected ? 'selected' : ''}`}
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
          className="conversation-fullscreen-icon"
          onClick={handleFullscreenToggle}
          title={isExpanded ? 'Collapse' : 'Expand to full conversation'}
        >
          {isExpanded ? '⤓' : '⤢'}
        </div>
      )}

      <Handle type="target" position={Position.Top} />

      <div
        ref={contentRef}
        className={`conversation-content ${isCommandPressed ? 'command-pressed' : ''}`}
      >
        {groups.map((group, index) => {
          if (group.type === 'user') {
            return renderUserMessage(group as UserMessageGroup, index);
          } else {
            return renderAssistantMessage(group as AssistantMessageGroup, index);
          }
        })}

        {/* Plus button - appears when text is selected, follows mouse */}
        {textSelection && mouseY !== null && (
          <div
            className="conversation-message-plus-button"
            style={{
              top: `${mouseY}px`,
              right: `${textSelection.position.right}px`,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 162 162"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g clipPath="url(#clip0_1022_356_conv)">
                <path
                  d="M89.3555 152.441V8.69141C89.3555 4.00391 85.3516 0 80.5664 0C75.7812 0 71.875 4.00391 71.875 8.69141V152.441C71.875 157.129 75.7812 161.133 80.5664 161.133C85.3516 161.133 89.3555 157.129 89.3555 152.441ZM8.69141 89.2578H152.441C157.129 89.2578 161.133 85.3516 161.133 80.5664C161.133 75.7812 157.129 71.7773 152.441 71.7773H8.69141C4.00391 71.7773 0 75.7812 0 80.5664C0 85.3516 4.00391 89.2578 8.69141 89.2578Z"
                  fill="currentColor"
                  fillOpacity="0.85"
                />
              </g>
              <defs>
                <clipPath id="clip0_1022_356_conv">
                  <rect width="161.133" height="161.23" fill="white" />
                </clipPath>
              </defs>
            </svg>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default ConversationNode;
