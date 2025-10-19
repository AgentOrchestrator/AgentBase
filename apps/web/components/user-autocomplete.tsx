'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';

export interface UserOption {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  x_github_name: string | null;
  x_github_avatar_url: string | null;
}

interface UserAutocompleteProps {
  onSelect: (user: UserOption) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  excludeUserIds?: string[];
}

export function UserAutocomplete({
  onSelect,
  placeholder = 'Search users...',
  disabled = false,
  className = '',
  excludeUserIds = [],
}: UserAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch users based on search query
  useEffect(() => {
    if (!showDropdown) {
      return;
    }

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        // Filter out excluded users
        const filteredUsers = (data.users || []).filter(
          (u: UserOption) => !excludeUserIds.includes(u.id)
        );
        setUsers(filteredUsers);
        setSelectedIndex(0);
      } catch (error) {
        console.error('Error fetching users:', error);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    // Debounce the search
    const timeoutId = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [query, showDropdown, excludeUserIds]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || users.length === 0) return;

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
          handleSelect(users[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        break;
    }
  };

  // Handle user selection
  const handleSelect = (user: UserOption) => {
    onSelect(user);
    setQuery('');
    setShowDropdown(false);
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getUserDisplayName = (user: UserOption) => {
    return user.display_name || user.x_github_name || user.email.split('@')[0];
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <Input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setShowDropdown(true)}
        placeholder={placeholder}
        disabled={disabled}
      />

      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-sm text-muted-foreground">
              Loading users...
            </div>
          ) : users.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">
              No users found
            </div>
          ) : (
            users.map((user, index) => (
              <button
                key={user.id}
                type="button"
                className={`w-full flex items-start gap-2 p-3 text-left hover:bg-sidebar-accent transition-colors ${
                  index === selectedIndex ? 'bg-sidebar-accent' : ''
                }`}
                onClick={() => handleSelect(user)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {getUserDisplayName(user)}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
