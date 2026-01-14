import { useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import './StarterNode.css';

interface StarterNodeData {
  placeholder?: string;
}

function StarterNode({ data, selected, id }: NodeProps) {
  const nodeData = data as unknown as StarterNodeData;
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  }, [inputValue]);

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (!inputValue.trim() || isSubmitting) return;

    setIsSubmitting(true);

    // Dispatch event for Canvas to handle
    window.dispatchEvent(
      new CustomEvent('starter-node-submit', {
        detail: {
          nodeId: id,
          message: inputValue.trim(),
        },
      })
    );

    // Clear input after submit
    setInputValue('');
    setIsSubmitting(false);
  }, [id, inputValue, isSubmitting]);

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
        placeholder={nodeData.placeholder || 'Type your message...'}
        rows={3}
      />

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default StarterNode;
