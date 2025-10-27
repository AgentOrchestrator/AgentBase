'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCategory } from '@/lib/rules/rules-formatter';
import type { ExtractionPrompt } from '@/lib/rules/types';

interface PromptSelectorProps {
  selectedPromptId: string | null;
  onPromptChange: (promptId: string | null) => void;
}

export function PromptSelector({ selectedPromptId, onPromptChange }: PromptSelectorProps) {
  const [prompts, setPrompts] = useState<ExtractionPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null);

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/prompts');
      if (!response.ok) throw new Error('Failed to fetch prompts');

      const data = await response.json();
      const promptsList = data.prompts || [];
      setPrompts(promptsList);

      // Auto-select the default prompt if none selected
      if (!selectedPromptId && promptsList.length > 0) {
        const defaultPrompt = promptsList.find((p: ExtractionPrompt) => p.name === 'default' && p.is_active);
        if (defaultPrompt) {
          onPromptChange(defaultPrompt.id);
        } else {
          // Select first active prompt
          const firstActive = promptsList.find((p: ExtractionPrompt) => p.is_active);
          if (firstActive) {
            onPromptChange(firstActive.id);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching prompts:', error);
      setPrompts([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (promptId: string) => {
    setExpandedPromptId(expandedPromptId === promptId ? null : promptId);
  };

  const activePrompts = prompts.filter(p => p.is_active);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-semibold">Choose Extraction Prompt</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Select how rules should be extracted from conversations
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => (window.location.href = '/rules/prompts')}
          >
            + Create Custom
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-600 dark:text-gray-400">Loading prompts...</p>
          </div>
        ) : activePrompts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-gray-600 dark:text-gray-400 mb-4">No extraction prompts available</p>
            <Button onClick={() => (window.location.href = '/rules/prompts')}>
              Create a Prompt
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {activePrompts.map((prompt) => (
              <div
                key={prompt.id}
                className={`
                  border rounded-lg p-4 cursor-pointer transition-all
                  ${selectedPromptId === prompt.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                  }
                `}
                onClick={() => onPromptChange(prompt.id)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="prompt"
                    checked={selectedPromptId === prompt.id}
                    onChange={() => onPromptChange(prompt.id)}
                    className="mt-1"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-medium text-base">
                        {prompt.name.charAt(0).toUpperCase() + prompt.name.slice(1)}
                      </h4>
                      {prompt.name === 'default' && (
                        <Badge variant="secondary" className="text-xs">
                          Default
                        </Badge>
                      )}
                    </div>

                    {prompt.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {prompt.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 mb-3">
                      {prompt.target_categories && prompt.target_categories.length > 0 ? (
                        <>
                          <span className="text-xs text-gray-600 dark:text-gray-400">Targets:</span>
                          {prompt.target_categories.map((category) => (
                            <Badge
                              key={category}
                              variant="outline"
                              className="text-xs"
                            >
                              {formatCategory(category as any)}
                            </Badge>
                          ))}
                        </>
                      ) : (
                        <span className="text-xs text-gray-500 dark:text-gray-500">
                          Targets: All categories
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Min confidence: {(prompt.min_confidence * 100).toFixed(0)}%
                    </div>

                    {/* Expandable prompt text */}
                    <div className="mt-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(prompt.id);
                        }}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {expandedPromptId === prompt.id ? '▼ Hide prompt' : '▶ Show prompt'}
                      </button>
                      {expandedPromptId === prompt.id && (
                        <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
                          {prompt.prompt_text}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info box */}
        {!loading && activePrompts.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
              💡 How Extraction Works
            </h4>
            <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
              <li>• The prompt guides the AI in identifying coding rules from conversations</li>
              <li>• Higher confidence thresholds mean stricter rule filtering</li>
              <li>• Target categories focus extraction on specific rule types</li>
              <li>• All extracted rules will be pending your review before being applied</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
