'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  x_github_name: string | null;
  x_github_avatar_url: string | null;
}

interface MentionAutocompleteProps {
  onSelect: (user: User) => void;
  searchQuery: string;
  position: { top: number; left: number; showAbove?: boolean };
  onClose: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
}

export function MentionAutocomplete({
  onSelect,
  searchQuery,
  position,
  onClose,
  inputRef,
}: MentionAutocompleteProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Ensure we're mounted (for portal)
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Fetch users based on search query
  useEffect(() => {
    const fetchUsers = async () => {
      console.log('[MentionAutocomplete] Fetching users with query:', searchQuery);
      setLoading(true);
      try {
        // Always fetch - even with empty query to show all users when @ is first typed
        const url = `/api/users/search?q=${encodeURIComponent(searchQuery)}`;
        console.log('[MentionAutocomplete] Fetching from:', url);
        const response = await fetch(url);
        const data = await response.json();
        console.log('[MentionAutocomplete] Received users:', data.users?.length || 0, data);
        setUsers(data.users || []);
        setSelectedIndex(0); // Reset selection on new results
      } catch (error) {
        console.error('[MentionAutocomplete] Error fetching users:', error);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    // Fetch immediately - no debouncing for better UX
    fetchUsers();
  }, [searchQuery]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (users.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % users.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + users.length) % users.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (users[selectedIndex]) {
            onSelect(users[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [users, selectedIndex, onSelect, onClose]);

  // Handle click outside (but not on the input field)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const clickedElement = e.target as Node;

      // Don't close if clicking on the autocomplete itself
      if (containerRef.current && containerRef.current.contains(clickedElement)) {
        console.log('[MentionAutocomplete] Click inside autocomplete, keeping open');
        return;
      }

      // Don't close if clicking on the input field
      if (inputRef?.current && inputRef.current.contains(clickedElement)) {
        console.log('[MentionAutocomplete] Click on input field, keeping open');
        return;
      }

      // Close for any other click
      console.log('[MentionAutocomplete] Click outside, closing');
      onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, inputRef]);

  const getUserDisplayName = (user: User) => {
    return user.display_name || user.x_github_name || user.email.split('@')[0];
  };

  const getUserAvatar = (user: User) => {
    return user.avatar_url || user.x_github_avatar_url;
  };

  if (!mounted) {
    console.log('[MentionAutocomplete] Not mounted yet');
    return null;
  }

  console.log('[MentionAutocomplete] Rendering with:', { loading, usersCount: users.length, position });

  const baseStyle = {
    top: `${position.top}px`,
    left: `${position.left}px`,
    ...(position.showAbove && { transform: 'translateY(-100%)' })
  };

  const content = loading ? (
    <div
      ref={containerRef}
      className="fixed z-[9999] w-64 bg-popover border border-border rounded-lg shadow-lg p-2"
      style={baseStyle}
    >
      <div className="text-sm text-muted-foreground p-2">
        Loading users...
      </div>
    </div>
  ) : users.length === 0 ? (
    <div
      ref={containerRef}
      className="fixed z-[9999] w-64 bg-popover border border-border rounded-lg shadow-lg p-2"
      style={baseStyle}
    >
      <div className="text-sm text-muted-foreground p-2">
        No users found
      </div>
    </div>
  ) : (
    <div
      ref={containerRef}
      className="fixed z-[9999] w-64 bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
      style={baseStyle}
    >
      <div className="max-h-64 overflow-y-auto">
        {users.map((user, index) => (
          <button
            key={user.id}
            className={`w-full flex items-center gap-2 p-2 text-left hover:bg-accent transition-colors ${
              index === selectedIndex
                ? 'bg-accent dark:bg-sidebar-accent'
                : ''
            }`}
            onClick={() => onSelect(user)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={getUserAvatar(user) || undefined} />
              <AvatarFallback className="text-xs">
                {getUserDisplayName(user).substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-popover-foreground truncate">
                {getUserDisplayName(user)}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {user.email}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
