import type React from 'react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface InteractiveMarkdownProps {
  content: string;
  onContentChange?: (newContent: string) => void;
  className?: string;
}

function InteractiveMarkdown({ content, onContentChange, className }: InteractiveMarkdownProps) {
  const [localContent, setLocalContent] = useState(content);

  // Sync with parent content changes
  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  const toggleCheckbox = (lineIndex: number) => {
    const lines = localContent.split('\n');
    const line = lines[lineIndex];

    if (!line) return;

    // Toggle checkbox state
    let newLine: string;
    if (line.includes('- [ ]')) {
      newLine = line.replace('- [ ]', '- [x]');
    } else if (line.includes('- [x]')) {
      newLine = line.replace('- [x]', '- [ ]');
    } else if (line.includes('* [ ]')) {
      newLine = line.replace('* [ ]', '* [x]');
    } else if (line.includes('* [x]')) {
      newLine = line.replace('* [x]', '* [ ]');
    } else {
      return; // Not a checkbox line
    }

    lines[lineIndex] = newLine;
    const newContent = lines.join('\n');
    setLocalContent(newContent);

    // Notify parent of change
    if (onContentChange) {
      onContentChange(newContent);
    }
  };

  // Custom checkbox component that intercepts clicks
  const CustomCheckbox = ({ checked }: { checked?: boolean }) => {
    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Find which line this checkbox belongs to
      const checkboxElement = e.currentTarget as HTMLInputElement;
      let lineIndex = 0;

      // Walk up the DOM to find the parent list item
      let element = checkboxElement.parentElement;
      while (element) {
        if (element.tagName === 'LI') {
          // Count previous list items to determine line index
          let sibling = element.previousElementSibling;
          while (sibling) {
            lineIndex++;
            sibling = sibling.previousElementSibling;
          }
          break;
        }
        element = element.parentElement;
      }

      // Find the actual line index in the markdown by counting task list items
      const lines = localContent.split('\n');
      let taskListCount = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/^\s*[-*]\s+\[([ x])\]/)) {
          if (taskListCount === lineIndex) {
            toggleCheckbox(i);
            return;
          }
          taskListCount++;
        }
      }
    };

    return (
      <input
        type="checkbox"
        checked={checked}
        onChange={() => {}} // Controlled by onClick
        onClick={handleClick}
        style={{ cursor: 'pointer' }}
      />
    );
  };

  return (
    <ReactMarkdown
      className={className}
      remarkPlugins={[remarkGfm]}
      components={{
        input: ({ node, ...props }) => {
          if (props.type === 'checkbox') {
            return <CustomCheckbox {...props} />;
          }
          return <input {...props} />;
        },
      }}
    >
      {localContent}
    </ReactMarkdown>
  );
}

export default InteractiveMarkdown;
