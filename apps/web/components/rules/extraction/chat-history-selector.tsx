'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/rules/rules-formatter';

interface ChatHistory {
  id: string;
  ai_title: string | null;
  ai_summary: string | null;
  messages: any;
  latest_message_timestamp: string;
  created_at: string;
}

interface ChatHistorySelectorProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function ChatHistorySelector({ selectedIds, onSelectionChange }: ChatHistorySelectorProps) {
  const [histories, setHistories] = useState<ChatHistory[]>([]);
  const [filteredHistories, setFilteredHistories] = useState<ChatHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d' | '90d'>('all');

  useEffect(() => {
    fetchChatHistories();
  }, []);

  useEffect(() => {
    filterHistories();
  }, [searchQuery, dateFilter, histories]);

  const fetchChatHistories = async () => {
    setLoading(true);
    try {
      // Fetch chat histories from Supabase
      const response = await fetch('/api/chat-histories');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('API error:', response.status, errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch chat histories`);
      }

      const data = await response.json();
      console.log('Fetched chat histories:', data.total, 'histories');
      setHistories(data.histories || []);
      setFilteredHistories(data.histories || []);
    } catch (error) {
      console.error('Error fetching chat histories:', error);
      setHistories([]);
    } finally {
      setLoading(false);
    }
  };

  const filterHistories = () => {
    let filtered = [...histories];

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const daysAgo = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
      }[dateFilter];

      const cutoffDate = new Date(now.getTime() - (daysAgo! * 24 * 60 * 60 * 1000));
      filtered = filtered.filter(h => {
        const historyDate = new Date(h.latest_message_timestamp || h.created_at);
        return historyDate >= cutoffDate;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(h => {
        const title = h.ai_title?.toLowerCase() || '';
        const summary = h.ai_summary?.toLowerCase() || '';
        return title.includes(query) || summary.includes(query);
      });
    }

    setFilteredHistories(filtered);
  };

  const toggleSelection = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(sid => sid !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    onSelectionChange(filteredHistories.map(h => h.id));
  };

  const deselectAll = () => {
    onSelectionChange([]);
  };

  const getMessageCount = (messages: any): number => {
    if (Array.isArray(messages)) return messages.length;
    if (messages?.messages && Array.isArray(messages.messages)) return messages.messages.length;
    return 0;
  };

  const getFirstMessage = (messages: any): string => {
    let messageArray = messages;
    if (messages?.messages && Array.isArray(messages.messages)) {
      messageArray = messages.messages;
    }

    if (Array.isArray(messageArray) && messageArray.length > 0) {
      const firstMsg = messageArray[0];
      const content = firstMsg.content || firstMsg.text || '';
      return content.slice(0, 100) + (content.length > 100 ? '...' : '');
    }
    return 'No messages';
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <h3 className="text-xl font-semibold">Select Chat Histories</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Choose conversations to analyze for coding rules
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All time</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll} disabled={loading}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAll} disabled={loading}>
              Deselect All
            </Button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Selected: <span className="font-semibold">{selectedIds.length}</span> conversation{selectedIds.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Chat histories list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-600 dark:text-gray-400">Loading conversations...</p>
          </div>
        ) : filteredHistories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              {histories.length === 0 ? 'No chat histories found' : 'No conversations match your filters'}
            </p>
            {histories.length > 0 && (
              <Button variant="link" onClick={() => { setSearchQuery(''); setDateFilter('all'); }}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {filteredHistories.map((history) => (
              <div
                key={history.id}
                className={`
                  border rounded-lg p-4 cursor-pointer transition-all
                  ${selectedIds.includes(history.id)
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                  }
                `}
                onClick={() => toggleSelection(history.id)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(history.id)}
                    onChange={() => toggleSelection(history.id)}
                    className="mt-1"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm mb-1 truncate">
                      {history.ai_title || 'Untitled conversation'}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                      {formatDate(history.latest_message_timestamp || history.created_at)} • {getMessageCount(history.messages)} messages
                    </p>
                    {history.ai_summary && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 line-clamp-2">
                        {history.ai_summary}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {!loading && filteredHistories.length > 0 && (
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredHistories.length} of {histories.length} conversations
              {selectedIds.length > 0 && ` • ${selectedIds.length} selected for extraction`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
