/**
 * Pending Rules Page - Review rules awaiting approval
 * Server Component that fetches initial data
 */

import { createClient } from '@/lib/supabase-server';
import { getRules } from '@/lib/rules/rules-queries';
import { PendingRulesTable } from '@/components/rules/pending-rules-table';
import { redirect } from 'next/navigation';

export default async function PendingRulesPage() {
  // Verify authentication
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // Fetch pending rules
  let pendingRules;
  try {
    const result = await getRules({ status: 'pending', limit: 100 });
    pendingRules = result.rules;
  } catch (error) {
    console.error('Error fetching pending rules:', error);
    pendingRules = [];
  }

  return (
    <div className="container py-8">
      <PendingRulesTable initialRules={pendingRules} />
    </div>
  );
}
