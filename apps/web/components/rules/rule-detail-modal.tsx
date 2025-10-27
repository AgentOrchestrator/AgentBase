'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  formatConfidence,
  getConfidenceColor,
  getCategoryColor,
  formatCategory,
  formatDate,
} from '@/lib/rules/rules-formatter';
import type { RuleWithApproval } from '@/lib/rules/types';

interface RuleDetailModalProps {
  ruleId: string | null;
  open: boolean;
  onClose: () => void;
  onApprove: (ruleId: string) => void;
  onReject: (ruleId: string) => void;
  onEdit: (ruleId: string) => void;
}

export function RuleDetailModal({ ruleId, open, onClose, onApprove, onReject, onEdit }: RuleDetailModalProps) {
  const [rule, setRule] = useState<RuleWithApproval | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ruleId || !open) {
      setRule(null);
      return;
    }

    const fetchRule = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/rules/${ruleId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch rule details');
        }
        const data = await response.json();
        setRule(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchRule();
  }, [ruleId, open]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rule Details</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-950 p-4">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {rule && (
          <div className="space-y-6">
            {/* Rule Info */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Rule Text</h3>
                <p className="text-base">{rule.rule_text}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</h3>
                  <Badge className={getCategoryColor(rule.rule_category)}>{formatCategory(rule.rule_category)}</Badge>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confidence Score</h3>
                  <Badge className={getConfidenceColor(rule.confidence_score)}>
                    {formatConfidence(rule.confidence_score)}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Created</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{formatDate(rule.created_at)}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Source Sessions</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {rule.source_session_ids?.length || 0} conversation(s)
                  </p>
                </div>
              </div>
            </div>

            {/* Source Context */}
            {rule.source_session_ids && rule.source_session_ids.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Source Sessions</h3>
                <div className="space-y-2">
                  {rule.source_session_ids.map((sessionId) => (
                    <div key={sessionId} className="rounded-md bg-gray-50 dark:bg-gray-900 p-3">
                      <a
                        href={`/session/${sessionId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        View session {sessionId.slice(0, 8)}...
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Approval Info */}
            {rule.approval && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Approval Status</h3>
                <div className="rounded-md bg-gray-50 dark:bg-gray-900 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
                    <Badge variant="outline">{rule.approval.status}</Badge>
                  </div>
                  {rule.approval.reviewed_by && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Reviewed by:</span>
                      <span className="text-sm">{rule.approval.reviewed_by}</span>
                    </div>
                  )}
                  {rule.approval.reviewed_at && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Reviewed at:</span>
                      <span className="text-sm">{formatDate(rule.approval.reviewed_at)}</span>
                    </div>
                  )}
                  {rule.approval.rejection_reason && (
                    <div className="space-y-1">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Rejection reason:</span>
                      <p className="text-sm">{rule.approval.rejection_reason}</p>
                    </div>
                  )}
                  {rule.approval.notes && (
                    <div className="space-y-1">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Notes:</span>
                      <p className="text-sm">{rule.approval.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            {rule && rule.approval?.status === 'pending' && (
              <>
                <Button variant="outline" onClick={() => onEdit(rule.id)}>
                  Edit
                </Button>
                <Button variant="destructive" onClick={() => onReject(rule.id)}>
                  Reject
                </Button>
                <Button variant="default" onClick={() => onApprove(rule.id)}>
                  Approve
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
