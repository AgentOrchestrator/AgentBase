'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { MentionAutocomplete } from './mention-autocomplete';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Send, Loader2 } from 'lucide-react';

interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  x_github_name: string | null;
  x_github_avatar_url: string | null;
}

interface MentionedUser extends User {
  mentionText: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  mentionedUsers?: MentionedUser[];
}

interface ChatInterfaceProps {
  onSendMessage?: (message: string, mentionedUsers: MentionedUser[]) => Promise<void>;
  placeholder?: string;
}

export function ChatInterface({
  onSendMessage,
  placeholder = 'Ask a question... Type @ to mention users',
}: ChatInterfaceProps) {
  const [message, setMessage] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0, showAbove: false });
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionedUsers, setMentionedUsers] = useState<MentionedUser[]>([]);
  const [sending, setSending] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Detect @ symbol and show mention autocomplete
  const handleInputChange = (value: string) => {
    setMessage(value);

    const cursorPos = inputRef.current?.selectionStart || 0;
    setCursorPosition(cursorPos);

    // Find @ symbol before cursor
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');

    if (lastAtSymbol !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtSymbol + 1);

      // Check if there's a space after @ (which would close the mention)
      if (!textAfterAt.includes(' ')) {
        const searchText = textAfterAt;
        console.log('[@] Showing mentions with search:', searchText);
        setMentionSearch(searchText);
        setShowMentions(true);

        // Calculate position for autocomplete dropdown at @ symbol
        if (inputRef.current) {
          const input = inputRef.current;
          const rect = input.getBoundingClientRect();

          // Create a temporary span to measure text width up to @ symbol
          const span = document.createElement('span');
          span.style.visibility = 'hidden';
          span.style.position = 'absolute';
          span.style.whiteSpace = 'pre';
          span.style.font = window.getComputedStyle(input).font;

          // Get text before @ symbol
          const textBeforeAt = value.substring(0, lastAtSymbol);
          span.textContent = textBeforeAt;
          document.body.appendChild(span);
          const textWidth = span.offsetWidth;
          document.body.removeChild(span);

          // Dropdown dimensions
          const dropdownWidth = 256; // w-64 = 16rem = 256px
          const dropdownMaxHeight = 256; // max-h-64

          // Position dropdown at @ symbol location
          // Add padding-left from input (12px = 3 in tailwind)
          const inputPaddingLeft = 12;
          let leftPosition = rect.left + inputPaddingLeft + textWidth;

          // Make sure dropdown doesn't go off-screen to the right
          if (leftPosition + dropdownWidth > window.innerWidth) {
            leftPosition = window.innerWidth - dropdownWidth - 16; // 16px margin
          }

          // Decide whether to show above or below input
          const spaceBelow = window.innerHeight - rect.bottom;
          const spaceAbove = rect.top;
          const showAbove = spaceBelow < 200 && spaceAbove > spaceBelow;

          const topPosition = showAbove
            ? rect.top - 8  // Position at top of input, dropdown will grow upward
            : rect.bottom + 8;                   // Position below

          console.log('[@] Position calculation:', {
            textBeforeAt,
            textWidth,
            rectLeft: rect.left,
            inputPaddingLeft,
            calculatedLeft: leftPosition,
            calculatedTop: topPosition,
            showAbove
          });

          setMentionPosition({
            top: topPosition,
            left: leftPosition,
            showAbove,
          });
        }
      } else {
        console.log('[@] Hiding mentions - space detected');
        setShowMentions(false);
      }
    } else {
      console.log('[@] Hiding mentions - no @ found');
      setShowMentions(false);
    }
  };

  // Handle user selection from autocomplete
  const handleUserSelect = (user: User) => {
    if (!inputRef.current) return;

    const cursorPos = inputRef.current.selectionStart || 0;
    const textBeforeCursor = message.substring(0, cursorPos);
    const textAfterCursor = message.substring(cursorPos);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');

    const userName = user.display_name || user.x_github_name || user.email.split('@')[0];
    const mentionText = `@${userName}`;

    // Replace @search with @username
    const newMessage =
      message.substring(0, lastAtSymbol) +
      mentionText +
      ' ' +
      textAfterCursor;

    setMessage(newMessage);
    setShowMentions(false);

    // Add user to mentioned users list
    setMentionedUsers((prev) => {
      // Avoid duplicates
      if (prev.some((u) => u.id === user.id)) {
        return prev;
      }
      return [...prev, { ...user, mentionText }];
    });

    // Focus back on input
    setTimeout(() => {
      if (inputRef.current) {
        const newCursorPos = lastAtSymbol + mentionText.length + 1;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Handle send message
  const handleSend = async () => {
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      if (onSendMessage) {
        await onSendMessage(message, mentionedUsers);
      }
      setMessage('');
      setMentionedUsers([]);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !showMentions) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative w-full">
      <div className="flex gap-2 items-center">
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={sending}
            className="pr-10"
          />
          {mentionedUsers.length > 0 && (
            <div className="absolute -top-8 left-0 flex gap-1 flex-wrap">
              {mentionedUsers.map((user) => (
                <span
                  key={user.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-full"
                >
                  {user.mentionText}
                </span>
              ))}
            </div>
          )}
        </div>
        <Button
          onClick={handleSend}
          disabled={!message.trim() || sending}
          size="icon"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {showMentions ? (
        <>
          {console.log('[@] Rendering MentionAutocomplete', { showMentions, mentionSearch, mentionPosition })}
          <MentionAutocomplete
            searchQuery={mentionSearch}
            position={mentionPosition}
            onSelect={handleUserSelect}
            onClose={() => {
              console.log('[@] Autocomplete onClose called');
              setShowMentions(false);
            }}
            inputRef={inputRef}
          />
        </>
      ) : null}
    </div>
  );
}
