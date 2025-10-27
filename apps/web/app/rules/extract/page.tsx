/**
 * Rules Extraction Page
 * Server Component that ensures authentication
 */

import { createClient } from '@/lib/supabase-server';
import { ExtractionWizard } from '@/components/rules/extraction/extraction-wizard';
import { redirect } from 'next/navigation';

export default async function ExtractRulesPage() {
  // Verify authentication
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  return (
    <div className="container py-8">
      <ExtractionWizard />
    </div>
  );
}
