/**
 * TextSelectionButton
 *
 * A floating plus button that appears when text is selected in chat messages.
 * Clicking it dispatches a 'chat-message-fork' event to create a lightweight
 * fork of the conversation.
 */

import type React from 'react';
import { useCallback } from 'react';

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
  /** Message ID where text was selected (for fork filtering) */
  messageId?: string;
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
  /** Message ID where text was selected (for fork filtering) */
  messageId?: string;
}

export function TextSelectionButton({
  text,
  mouseY,
  rightOffset,
  nodeId,
  sessionId,
  messageId,
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
        messageId,
      };

      window.dispatchEvent(new CustomEvent('chat-message-fork', { detail }));
    },
    [nodeId, sessionId, text, messageId]
  );

  // Button height is 24px, so offset by 50% (12px) towards the top
  const BUTTON_HEIGHT = 24;
  const offsetY = mouseY - BUTTON_HEIGHT / 2;

  return (
    <div
      className="conversation-message-plus-button"
      style={{
        top: `${offsetY}px`,
        right: `${rightOffset}px`,
      }}
      onMouseDown={handleMouseDown}
      role="button"
      aria-label="Fork conversation from selection"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 162 162"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g clipPath="url(#clip0_1022_356)">
          <path
            d="M89.3555 152.441V8.69141C89.3555 4.00391 85.3516 0 80.5664 0C75.7812 0 71.875 4.00391 71.875 8.69141V152.441C71.875 157.129 75.7812 161.133 80.5664 161.133C85.3516 161.133 89.3555 157.129 89.3555 152.441ZM8.69141 89.2578H152.441C157.129 89.2578 161.133 85.3516 161.133 80.5664C161.133 75.7812 157.129 71.7773 152.441 71.7773H8.69141C4.00391 71.7773 0 75.7812 0 80.5664C0 85.3516 4.00391 89.2578 8.69141 89.2578Z"
            fill="currentColor"
            fillOpacity="0.85"
          />
        </g>
        <defs>
          <clipPath id="clip0_1022_356">
            <rect width="161.133" height="161.23" fill="white" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}
