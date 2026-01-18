/**
 * StarterNodePresentation
 *
 * Pure UI component for the starter node.
 * Handles textarea input, auto-resize, and keyboard events.
 */

import { Handle, Position } from '@xyflow/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import './StarterNode.css';

export interface StarterNodePresentationProps {
  /** Whether the node is selected */
  selected?: boolean;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Callback when user submits a message */
  onSubmit: (message: string) => void;
}

/**
 * StarterNodePresentation
 *
 * Renders the starter node UI with a textarea input.
 * Calls onSubmit when user presses Enter (without Shift).
 */
export function StarterNodePresentation({
  selected = false,
  placeholder = 'Type your message...',
  onSubmit,
}: StarterNodePresentationProps) {
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
  }, []);

  // Handle submit
  const handleSubmit = useCallback(() => {
    const message = inputValue.trim();
    if (!message) return;

    onSubmit(message);
    setInputValue('');
  }, [inputValue, onSubmit]);

  // Handle key down - Enter to submit, Shift+Enter for newline
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className={`starter-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Top} />

      <div className="starter-header">
        <span className="starter-label">User</span>
      </div>

      <textarea
        ref={textareaRef}
        className="starter-input"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={3}
      />

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
