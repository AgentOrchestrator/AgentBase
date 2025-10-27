'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableHead, TableRow } from '@/components/ui/table';
import { RuleRow } from './rule-row';
import { RuleDetailModal } from './rule-detail-modal';
import { RejectReasonModal } from './reject-reason-modal';
import { rulesClient } from '@/lib/rules/rules-client';
import type { RuleWithApproval, RuleCategory } from '@/lib/rules/types';

interface PendingRulesTableProps {
  initialRules?: RuleWithApproval[];
}

export function PendingRulesTable({ initialRules = [] }: PendingRulesTableProps) {
  const [rules, setRules] = useState<RuleWithApproval[]>(initialRules);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<RuleCategory | 'all'>('all');

  // Modal states
  const [detailRuleId, setDetailRuleId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [rejectRuleId, setRejectRuleId] = useState<string | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch rules
  const fetchRules = async () => {
    setLoading(true);
    try {
      const result = await rulesClient.getRules({
        status: 'pending',
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
      });
      setRules(result.rules);
    } catch (error) {
      console.error('Error fetching rules:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialRules.length === 0) {
      fetchRules();
    }
  }, [categoryFilter]);

  // Filter rules by search query
  const filteredRules = rules.filter((rule) =>
    rule.rule_text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleApprove = async (ruleId: string) => {
    setActionLoading(true);
    try {
      await rulesClient.approveRule(ruleId);
      // Remove from list
      setRules(rules.filter((r) => r.id !== ruleId));
      setDetailModalOpen(false);
    } catch (error) {
      console.error('Error approving rule:', error);
      alert('Failed to approve rule');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = (ruleId: string) => {
    setRejectRuleId(ruleId);
    setRejectModalOpen(true);
    setDetailModalOpen(false);
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectRuleId) return;

    setActionLoading(true);
    try {
      await rulesClient.rejectRule(rejectRuleId, reason);
      // Remove from list
      setRules(rules.filter((r) => r.id !== rejectRuleId));
      setRejectModalOpen(false);
      setRejectRuleId(null);
    } catch (error) {
      console.error('Error rejecting rule:', error);
      alert('Failed to reject rule');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = (ruleId: string) => {
    // TODO: Implement edit functionality
    console.log('Edit rule:', ruleId);
  };

  const handleViewDetails = (ruleId: string) => {
    setDetailRuleId(ruleId);
    setDetailModalOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Pending Rules ({filteredRules.length})</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Review and approve rules extracted from chat histories
              </p>
            </div>
            <Button onClick={() => (window.location.href = '/rules/extract')}>Extract New Rules</Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <Input
              placeholder="Search rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All Categories</option>
              <option value="git-workflow">Git Workflow</option>
              <option value="code-style">Code Style</option>
              <option value="architecture">Architecture</option>
              <option value="best-practices">Best Practices</option>
              <option value="testing">Testing</option>
              <option value="documentation">Documentation</option>
            </select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-600 dark:text-gray-400">Loading rules...</p>
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-gray-600 dark:text-gray-400 mb-4">No pending rules found</p>
              <Button onClick={() => (window.location.href = '/rules/extract')}>Extract Rules</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Rule Text</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Sources</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRules.map((rule) => (
                    <RuleRow
                      key={rule.id}
                      rule={rule}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onEdit={handleEdit}
                      onViewDetails={handleViewDetails}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <RuleDetailModal
        ruleId={detailRuleId}
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        onApprove={handleApprove}
        onReject={handleReject}
        onEdit={handleEdit}
      />

      <RejectReasonModal
        open={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false);
          setRejectRuleId(null);
        }}
        onConfirm={handleRejectConfirm}
        loading={actionLoading}
      />
    </>
  );
}
