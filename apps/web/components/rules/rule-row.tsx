'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import {
  formatConfidence,
  getConfidenceColor,
  getCategoryColor,
  formatCategory,
  formatDate,
  truncate,
} from '@/lib/rules/rules-formatter';
import type { RuleWithApproval } from '@/lib/rules/types';

interface RuleRowProps {
  rule: RuleWithApproval;
  onApprove: (ruleId: string) => void;
  onReject: (ruleId: string) => void;
  onEdit: (ruleId: string) => void;
  onViewDetails: (ruleId: string) => void;
}

export function RuleRow({ rule, onApprove, onReject, onEdit, onViewDetails }: RuleRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <TableRow className="hover:bg-gray-50 dark:hover:bg-gray-900">
      <TableCell className="w-20">
        <Badge className={getConfidenceColor(rule.confidence_score)}>{formatConfidence(rule.confidence_score)}</Badge>
      </TableCell>
      <TableCell className="max-w-md">
        <div className="space-y-1">
          <p className={isExpanded ? '' : 'line-clamp-2'}>{rule.rule_text}</p>
          {rule.rule_text.length > 100 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      </TableCell>
      <TableCell className="w-36">
        <Badge className={getCategoryColor(rule.rule_category)}>{formatCategory(rule.rule_category)}</Badge>
      </TableCell>
      <TableCell className="w-28 text-sm text-gray-600 dark:text-gray-400">
        {rule.source_session_ids?.length || 0} sessions
      </TableCell>
      <TableCell className="w-28 text-sm text-gray-600 dark:text-gray-400">{formatDate(rule.created_at)}</TableCell>
      <TableCell className="w-72">
        <div className="flex gap-2">
          <Button size="sm" variant="default" onClick={() => onApprove(rule.id)} className="h-8 px-3">
            Approve
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onReject(rule.id)} className="h-8 px-3">
            Reject
          </Button>
          <Button size="sm" variant="outline" onClick={() => onEdit(rule.id)} className="h-8 px-3">
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onViewDetails(rule.id)} className="h-8 px-3">
            Details
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
