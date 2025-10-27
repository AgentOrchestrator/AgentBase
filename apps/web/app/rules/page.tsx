/**
 * Main Rules Page
 * Server Component that fetches all rules
 */

import { createClient } from '@/lib/supabase-server';
import { getRules } from '@/lib/rules/rules-queries';
import { RulesList } from '@/components/rules/rules-list';
import { redirect } from 'next/navigation';

export default async function RulesPage() {
  // Verify authentication
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // Fetch all rules
  let allRules = [];
  try {
    const result = await getRules({ limit: 1000 });
    allRules = result.rules;
  } catch (error) {
    console.error('Error fetching rules:', error);
    allRules = [];
  }

  return (
    <div className="container mx-auto py-10 space-y-6 px-24">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Shared Memory</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage coding rules extracted from your team's chat histories
        </p>
      </div>

      {/* Rules List */}
      <RulesList rules={allRules} />
    </div>
  );
}
