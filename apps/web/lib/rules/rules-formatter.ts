/**
 * Formatting utilities for rules display
 */

import type { Rule, RuleCategory } from './types';

/**
 * Format confidence score as percentage
 */
export function formatConfidence(score: number): string {
  return `${(score * 100).toFixed(0)}%`;
}

/**
 * Get confidence level label
 */
export function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

/**
 * Get color class for confidence score
 */
export function getConfidenceColor(score: number): string {
  const level = getConfidenceLevel(score);
  switch (level) {
    case 'high':
      return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950';
    case 'medium':
      return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950';
    case 'low':
      return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950';
  }
}

/**
 * Get color class for rule category
 */
export function getCategoryColor(category: RuleCategory): string {
  switch (category) {
    case 'git-workflow':
      return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950';
    case 'code-style':
      return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950';
    case 'architecture':
      return 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950';
    case 'best-practices':
      return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950';
    case 'testing':
      return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950';
    case 'documentation':
      return 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950';
    default:
      return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950';
  }
}

/**
 * Format category name for display
 */
export function formatCategory(category: RuleCategory): string {
  return category
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Group rules by category
 */
export function groupByCategory(rules: Rule[]): Record<RuleCategory, Rule[]> {
  const grouped: Record<string, Rule[]> = {};

  for (const rule of rules) {
    if (!grouped[rule.rule_category]) {
      grouped[rule.rule_category] = [];
    }
    grouped[rule.rule_category].push(rule);
  }

  return grouped as Record<RuleCategory, Rule[]>;
}

/**
 * Sort rules by confidence score (descending)
 */
export function sortByConfidence(rules: Rule[]): Rule[] {
  return [...rules].sort((a, b) => b.confidence_score - a.confidence_score);
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Get status badge color
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'approved':
      return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950';
    case 'pending':
      return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950';
    case 'rejected':
      return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950';
    case 'needs_revision':
      return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950';
    case 'archived':
      return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950';
    default:
      return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950';
  }
}

/**
 * Format status for display
 */
export function formatStatus(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
