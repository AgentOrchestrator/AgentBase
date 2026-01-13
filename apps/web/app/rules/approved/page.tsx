/**
 * Approved Rules Page - View approved rules
 * Server Component that fetches initial data
 */

import { createClient } from '@/lib/supabase-server';
import { getRules } from '@/lib/rules/rules-queries';
import { redirect } from 'next/navigation';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCategory, getCategoryColor, formatDate, formatConfidence, getConfidenceColor } from '@/lib/rules/rules-formatter';
import type { RuleWithApproval } from '@/lib/rules/types';

export default async function ApprovedRulesPage() {
  // Verify authentication
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // Fetch approved rules
  let approvedRules: RuleWithApproval[] = [];
  try {
    const result = await getRules({ status: 'approved', limit: 100 });
    approvedRules = result.rules;
  } catch (error) {
    console.error('Error fetching approved rules:', error);
  }

  return (
    <div className="container py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Approved Rules ({approvedRules.length})</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Rules ready to be exported to configuration files
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="default" onClick={() => (window.location.href = '/rules/generate')}>
                Generate Files
              </Button>
              <Button variant="outline" onClick={() => (window.location.href = '/rules')}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {approvedRules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-gray-600 dark:text-gray-400 mb-4">No approved rules yet</p>
              <Button onClick={() => (window.location.href = '/rules/pending')}>
                Review Pending Rules
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {approvedRules.map((rule) => (
                <div
                  key={rule.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <Badge className={getConfidenceColor(rule.confidence_score)}>
                      {formatConfidence(rule.confidence_score)}
                    </Badge>
                    <div className="flex-1">
                      <p className="text-base mb-2">{rule.rule_text}</p>
                      <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                        <Badge className={getCategoryColor(rule.rule_category)}>
                          {formatCategory(rule.rule_category)}
                        </Badge>
                        <span>•</span>
                        <span>{formatDate(rule.created_at)}</span>
                        {rule.source_session_ids && rule.source_session_ids.length > 0 && (
                          <>
                            <span>•</span>
                            <span>{rule.source_session_ids.length} source(s)</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
