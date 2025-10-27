'use client';

import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { RulesStats } from '@/lib/rules/types';
import { formatDate } from '@/lib/rules/rules-formatter';

interface RulesDashboardProps {
  stats: RulesStats;
}

export function RulesDashboard({ stats }: RulesDashboardProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Shared Memory</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage coding rules extracted from your team's chat histories
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Pending Review</h3>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-bold">{stats.pending}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">rules</p>
            </div>
            <Button
              variant="link"
              className="mt-4 p-0 h-auto"
              onClick={() => (window.location.href = '/rules/pending')}
            >
              Review pending →
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Approved</h3>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-bold text-green-600 dark:text-green-400">{stats.approved}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">rules</p>
            </div>
            <Button
              variant="link"
              className="mt-4 p-0 h-auto"
              onClick={() => (window.location.href = '/rules/approved')}
            >
              View approved →
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Rejected</h3>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <p className="text-4xl font-bold text-red-600 dark:text-red-400">{stats.rejected}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">rules</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Quick Actions</h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button variant="default" onClick={() => (window.location.href = '/rules/extract')} className="h-auto py-4">
              <div className="text-center">
                <p className="font-semibold">Extract Rules</p>
                <p className="text-xs opacity-80 mt-1">From chat histories</p>
              </div>
            </Button>

            <Button variant="outline" onClick={() => (window.location.href = '/rules/pending')} className="h-auto py-4">
              <div className="text-center">
                <p className="font-semibold">Review Pending</p>
                <p className="text-xs opacity-80 mt-1">{stats.pending} rules waiting</p>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => (window.location.href = '/rules/generate')}
              className="h-auto py-4"
            >
              <div className="text-center">
                <p className="font-semibold">Generate Files</p>
                <p className="text-xs opacity-80 mt-1">.cursorrules or CLAUDE.md</p>
              </div>
            </Button>

            <Button variant="outline" onClick={() => (window.location.href = '/rules/prompts')} className="h-auto py-4">
              <div className="text-center">
                <p className="font-semibold">Manage Prompts</p>
                <p className="text-xs opacity-80 mt-1">Customize extraction</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Extractions */}
      {stats.recent_extractions.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Recent Extractions</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recent_extractions.map((extraction, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div>
                    <p className="text-sm font-medium">
                      {extraction.rules_count} rule{extraction.rules_count !== 1 ? 's' : ''} extracted
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">by {extraction.user}</p>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{formatDate(extraction.timestamp)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
