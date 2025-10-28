'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import type { RuleWithApproval } from '@/lib/rules/types';

interface RulesListProps {
  rules: RuleWithApproval[];
}

interface DummyRule {
  id: string;
  rule_text: string;
  rule_category: string;
  confidence_score: number;
  created_at: string;
  approval: {
    status: 'pending' | 'approved' | 'rejected';
    rule_id: string;
  };
}

const DUMMY_RULES: DummyRule[] = [
  {
    id: '1',
    rule_text: 'Always create a new branch for any code edits or features. Branch naming convention: Use descriptive names (e.g., feature/add-auth, fix/install-env-vars).',
    rule_category: 'git-workflow',
    confidence_score: 0.95,
    created_at: new Date().toISOString(),
    approval: { status: 'pending', rule_id: '1' },
  },
  {
    id: '2',
    rule_text: 'Use semantic HTML elements and follow accessibility best practices. Always include proper ARIA labels where needed.',
    rule_category: 'code-style',
    confidence_score: 0.88,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    approval: { status: 'pending', rule_id: '2' },
  },
  {
    id: '3',
    rule_text: 'Ensure all async operations are properly handled with try-catch blocks and meaningful error messages.',
    rule_category: 'best-practices',
    confidence_score: 0.92,
    created_at: new Date(Date.now() - 172800000).toISOString(),
    approval: { status: 'approved', rule_id: '3' },
  },
  {
    id: '4',
    rule_text: 'Keep server-only code in separate files with clear naming (e.g., *-admin.ts, *-server.ts) to prevent bundling with client code.',
    rule_category: 'architecture',
    confidence_score: 0.85,
    created_at: new Date(Date.now() - 259200000).toISOString(),
    approval: { status: 'approved', rule_id: '4' },
  },
  {
    id: '5',
    rule_text: 'Write clear, descriptive commit messages following conventional commits format: type(scope): subject.',
    rule_category: 'git-workflow',
    confidence_score: 0.90,
    created_at: new Date(Date.now() - 345600000).toISOString(),
    approval: { status: 'approved', rule_id: '5' },
  },
  {
    id: '6',
    rule_text: 'Never expose API keys or sensitive credentials in frontend code. Use environment variables for all secrets.',
    rule_category: 'best-practices',
    confidence_score: 0.98,
    created_at: new Date().toISOString(),
    approval: { status: 'pending', rule_id: '6' },
  },
];

export function RulesList({ rules }: RulesListProps) {
  // Use dummy rules if no real rules exist
  const hasRealRules = rules.length > 0;
  const [displayRules, setDisplayRules] = useState<RuleWithApproval[]>(
    hasRealRules ? rules : (DUMMY_RULES as unknown as RuleWithApproval[])
  );
  const [loadingRuleId, setLoadingRuleId] = useState<string | null>(null);
  const [newRuleText, setNewRuleText] = useState('Create new rule...');
  const [fadingOutRules, setFadingOutRules] = useState<Set<string>>(new Set());
  const [newlyApprovedRules, setNewlyApprovedRules] = useState<Set<string>>(new Set());
  const [hoveredRuleId, setHoveredRuleId] = useState<string | null>(null);

  const handleApprove = async (ruleId: string) => {
    setLoadingRuleId(ruleId);
    setFadingOutRules((prev) => new Set(prev).add(ruleId));
    
    try {
      // Only call API if we have real rules
      if (hasRealRules) {
        const response = await fetch(`/api/rules/${ruleId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'approved' }),
        });

        if (!response.ok) {
          throw new Error('Failed to approve rule');
        }
      }

      // Wait for fade animation to complete (1000ms)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update local state to reflect approval
      setDisplayRules((prev) =>
        prev.map((rule) =>
          rule.id === ruleId
            ? {
                ...rule,
                approval: {
                  ...rule.approval,
                  status: 'approved' as const,
                  reviewed_at: new Date().toISOString(),
                },
              }
            : rule
        )
      );
      
      // Mark as newly approved after a slight delay to allow fade-out to complete
      setTimeout(() => {
        setNewlyApprovedRules((prev) => {
          const newSet = new Set(prev);
          newSet.add(ruleId);
          // Remove after animation completes
          setTimeout(() => {
            setNewlyApprovedRules((current) => {
              const updatedSet = new Set(current);
              updatedSet.delete(ruleId);
              return updatedSet;
            });
          }, 1500);
          return newSet;
        });
      }, 100);
      
      // Remove from fading state
      setFadingOutRules((prev) => {
        const newSet = new Set(prev);
        newSet.delete(ruleId);
        return newSet;
      });
    } catch (error) {
      console.error('Error approving rule:', error);
      alert('Failed to approve rule. Please try again.');
      // Remove from fading state on error
      setFadingOutRules((prev) => {
        const newSet = new Set(prev);
        newSet.delete(ruleId);
        return newSet;
      });
    } finally {
      setLoadingRuleId(null);
    }
  };

  const handleReject = async (ruleId: string) => {
    setLoadingRuleId(ruleId);
    setFadingOutRules((prev) => new Set(prev).add(ruleId));
    
    try {
      // Only call API if we have real rules
      if (hasRealRules) {
        const response = await fetch(`/api/rules/${ruleId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'rejected',
            reason: 'Not relevant for this project',
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to reject rule');
        }
      }

      // Wait for fade animation to complete (1000ms)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Remove from list
      setDisplayRules((prev) => prev.filter((rule) => rule.id !== ruleId));
      setFadingOutRules((prev) => {
        const newSet = new Set(prev);
        newSet.delete(ruleId);
        return newSet;
      });
    } catch (error) {
      console.error('Error rejecting rule:', error);
      alert('Failed to reject rule. Please try again.');
      setFadingOutRules((prev) => {
        const newSet = new Set(prev);
        newSet.delete(ruleId);
        return newSet;
      });
    } finally {
      setLoadingRuleId(null);
    }
  };

  const handleNewRuleBlur = () => {
    if (newRuleText.trim() === '') {
      setNewRuleText('Create new rule...');
    }
  };

  const handleNewRuleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewRuleText(e.target.value);
  };

  const handleNewRuleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newRuleText !== 'Create new rule...' && newRuleText.trim() !== '') {
      handleCreateNewRule();
    }
  };

  const handleCreateNewRule = async () => {
    if (newRuleText === 'Create new rule...' || newRuleText.trim() === '') {
      return;
    }
    
    const ruleText = newRuleText.trim();
    
    // Add fade-out animation to input
    setFadingOutRules((prev) => new Set(prev).add('new-rule-input'));
    
    // Wait for fade animation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Add the new rule to displayRules with approved status
    const newRule: RuleWithApproval = {
      id: `new-rule-${Date.now()}`,
      rule_text: ruleText,
      rule_category: 'best-practices' as const,
      confidence_score: 1.0,
      source_session_ids: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      approval: {
        status: 'approved' as const,
        rule_id: `new-rule-${Date.now()}`,
        reviewed_at: new Date().toISOString(),
      },
    };
    
    // Add to display rules
    setDisplayRules((prev) => [...prev, newRule]);
    
    // Mark as newly approved after a slight delay to allow fade-out to complete
    setTimeout(() => {
      setNewlyApprovedRules((prev) => {
        const newSet = new Set(prev);
        newSet.add(newRule.id);
        // Remove after animation completes
        setTimeout(() => {
          setNewlyApprovedRules((current) => {
            const updatedSet = new Set(current);
            updatedSet.delete(newRule.id);
            return updatedSet;
          });
        }, 1500);
        return newSet;
      });
    }, 100);
    
    // Remove from fading state
    setFadingOutRules((prev) => {
      const newSet = new Set(prev);
      newSet.delete('new-rule-input');
      return newSet;
    });
    
    // Reset the input
    setNewRuleText('Create new rule...');
  };

  const handleCancelNewRule = () => {
    setNewRuleText('Create new rule...');
  };

  const handleDeleteApprovedRule = async (ruleId: string) => {
    setLoadingRuleId(ruleId);
    setFadingOutRules((prev) => new Set(prev).add(ruleId));
    
    try {
      // Wait for fade animation to complete (1000ms)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Remove from list
      setDisplayRules((prev) => prev.filter((rule) => rule.id !== ruleId));
      
      // Remove from fading state
      setFadingOutRules((prev) => {
        const newSet = new Set(prev);
        newSet.delete(ruleId);
        return newSet;
      });
    } catch (error) {
      console.error('Error deleting rule:', error);
      setFadingOutRules((prev) => {
        const newSet = new Set(prev);
        newSet.delete(ruleId);
        return newSet;
      });
    } finally {
      setLoadingRuleId(null);
    }
  };

  // Separate pending and approved rules
  const pendingRules = displayRules.filter((rule) => rule.approval.status === 'pending');
  const approvedRules = displayRules
    .filter((rule) => rule.approval.status === 'approved')
    .sort((a, b) => {
      // Put newly approved rules first
      const aIsNew = newlyApprovedRules.has(a.id);
      const bIsNew = newlyApprovedRules.has(b.id);
      if (aIsNew && !bIsNew) return -1;
      if (!aIsNew && bIsNew) return 1;
      // Otherwise sort by created_at desc
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div className="space-y-8">
      {/* Create new rule box - Always visible at the top */}
      <div className={`flex items-start gap-4 p-4 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-800 transition-all duration-1000 ${
        fadingOutRules.has('new-rule-input')
          ? 'opacity-0 blur-sm'
          : 'opacity-100 blur-0'
      }`}>
        <input
          type="text"
          value={newRuleText === 'Create new rule...' ? '' : newRuleText}
          onChange={handleNewRuleChange}
          onBlur={handleNewRuleBlur}
          onKeyDown={handleNewRuleKeyDown}
          className="flex-1 text-sm bg-transparent border-none outline-none text-gray-600 dark:text-gray-400 placeholder-gray-400 dark:placeholder-gray-500"
          placeholder="Create new rule..."
        />
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className={`h-8 w-8 p-0 transition-all duration-[1000ms] ease-out ${
              newRuleText !== 'Create new rule...' && newRuleText.trim() !== ''
                ? 'opacity-100 blur-0 text-gray-600 dark:text-gray-400 hover:text-green-600 hover:bg-transparent'
                : 'opacity-0 blur-sm pointer-events-none'
            }`}
            disabled={newRuleText === 'Create new rule...' || newRuleText.trim() === ''}
            onClick={handleCreateNewRule}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={`h-8 w-8 p-0 transition-all duration-[1000ms] ease-out ${
              newRuleText !== 'Create new rule...' && newRuleText.trim() !== ''
                ? 'text-gray-600 dark:text-gray-400 hover:text-red-600 hover:bg-transparent rotate-0'
                : 'text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50 rotate-45'
            }`}
            disabled={newRuleText === 'Create new rule...' || newRuleText.trim() === ''}
            onClick={handleCancelNewRule}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Pending Rules Section */}
      {pendingRules.length > 0 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <h2 className="text-xl font-semibold">Pending Rules (WARNING: INCLUDES DUMMY_RULES - DELTE LATER)</h2>
          <div className="space-y-3">
            {pendingRules.map((rule) => (
              <div
                key={rule.id}
                className={`flex items-start gap-4 p-4 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-800 transition-all duration-1000 ${
                  fadingOutRules.has(rule.id)
                    ? 'opacity-0 blur-sm'
                    : 'opacity-100 blur-0'
                }`}
              >
                <p className="text-sm text-gray-600 dark:text-gray-400 flex-1">{rule.rule_text}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-gray-600 dark:text-gray-400 hover:text-green-600 hover:bg-transparent"
                    onClick={() => handleApprove(rule.id)}
                    disabled={loadingRuleId === rule.id}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-gray-600 dark:text-gray-400 hover:text-red-600 hover:bg-transparent"
                    onClick={() => handleReject(rule.id)}
                    disabled={loadingRuleId === rule.id}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approved Rules Section */}
      {approvedRules.length > 0 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <h2 className="text-xl font-semibold">Rule List</h2>
          <div className="space-y-3 transition-all duration-500">
            {approvedRules.map((rule) => (
              <div
                key={rule.id}
                className={`flex items-start gap-4 p-4 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-800 transition-all duration-1000 ease-out ${
                  newlyApprovedRules.has(rule.id)
                    ? 'animate-in fade-in slide-in-from-top-8 duration-700 ease-out'
                    : ''
                } ${
                  fadingOutRules.has(rule.id)
                    ? 'opacity-0 blur-sm'
                    : 'opacity-100 blur-0'
                }`}
                onMouseEnter={() => setHoveredRuleId(rule.id)}
                onMouseLeave={() => setHoveredRuleId(null)}
              >
                <p className="text-sm text-gray-900 dark:text-gray-100 flex-1">{rule.rule_text}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className={`h-8 w-8 p-0 transition-all duration-300 ease-out ${
                    hoveredRuleId === rule.id && !fadingOutRules.has(rule.id)
                      ? 'opacity-100 blur-0 text-gray-600 dark:text-gray-400 hover:text-red-600 hover:bg-transparent'
                      : 'opacity-0 blur-sm pointer-events-none'
                  }`}
                  onClick={() => handleDeleteApprovedRule(rule.id)}
                  disabled={loadingRuleId === rule.id}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingRules.length === 0 && approvedRules.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No rules found</p>
        </div>
      )}
    </div>
  );
}

