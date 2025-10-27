/**
 * Generate Rules Files Page
 * Allows users to select file types, generate, and download .cursorrules or CLAUDE.md files
 */

import { createClient } from '@/lib/supabase-server';
import { FileGenerator } from '@/components/rules/file-generator';
import { redirect } from 'next/navigation';

export default async function GenerateRulesPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // Get user's workspace (assuming we have this in a profile or settings table)
  // For now, we'll let the client component handle workspace selection

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Generate Rules Files</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Select which file types to generate from your approved rules. You can also upload existing files to merge with your rules.
        </p>
      </div>

      <FileGenerator userId={user.id} />
    </div>
  );
}
