/**
 * Main Rules Dashboard Page
 * Server Component that fetches initial statistics
 */

import { createClient } from '@/lib/supabase-server';
import { getRulesStats } from '@/lib/rules/rules-queries';
import { RulesDashboard } from '@/components/rules/rules-dashboard';
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

  // Fetch rules statistics
  let stats;
  try {
    stats = await getRulesStats();
  } catch (error) {
    console.error('Error fetching rules stats:', error);
    stats = {
      pending: 0,
      approved: 0,
      rejected: 0,
      recent_extractions: [],
    };
  }

  return (
    <div className="container py-8">
      <RulesDashboard stats={stats} />
    </div>
  );
}
