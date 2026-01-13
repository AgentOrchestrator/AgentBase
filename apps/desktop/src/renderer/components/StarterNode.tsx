import { useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import './StarterNode.css';

interface StarterNodeData {
  placeholder?: string;
}

function StarterNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as StarterNodeData;
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
  }, [inputValue]);

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
        placeholder={nodeData.placeholder || 'Type your message...'}
        rows={3}
      />

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default StarterNode;
