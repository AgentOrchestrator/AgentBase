/**
 * TextSelectionButton
 *
 * A floating plus button that appears when text is selected in chat messages.
 * Clicking it dispatches a 'chat-message-fork' event to create a lightweight
 * fork of the conversation.
 */

import React, { useCallback } from 'react';

export interface TextSelectionButtonProps {
  /** The selected text content */
  text: string;
  /** Vertical position (in content coordinates) */
  mouseY: number;
  /** Right offset from container edge */
  rightOffset: number;
  /** Parent node ID for the fork event */
  nodeId: string;
  /** Current session ID (if available) */
  sessionId?: string;
}

/**
 * Event detail for chat-message-fork custom event
 */
export interface ChatMessageForkEventDetail {
  /** Source node to fork from */
  nodeId: string;
  /** Session to fork (if available) */
  sessionId?: string;
  /** Text that was selected */
  selectedText: string;
}

export function TextSelectionButton({
  text,
  mouseY,
  rightOffset,
  nodeId,
  sessionId,
}: TextSelectionButtonProps) {
  // Use onMouseDown instead of onClick to fire before selection clears
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Prevent default to avoid clearing the text selection
      e.preventDefault();
      // Stop propagation to prevent parent handlers
      e.stopPropagation();

      const detail: ChatMessageForkEventDetail = {
        nodeId,
        sessionId,
        selectedText: text,
      };

      window.dispatchEvent(new CustomEvent('chat-message-fork', { detail }));
    },
    [nodeId, sessionId, text]
  );

  return (
    <div
      className="conversation-message-plus-button"
      style={{
        top: `${mouseY}px`,
        right: `${rightOffset}px`,
      }}
      onMouseDown={handleMouseDown}
      role="button"
      aria-label="Fork conversation from selection"
    >
      +
    </div>
  );
}
