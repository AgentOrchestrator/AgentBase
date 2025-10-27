/**
 * API endpoint for generating rule files from approved rules
 * POST /api/rules/sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getApprovedRules } from '@/lib/rules/rules-queries';
import { generateCursorRules } from '@/lib/rules/templates/cursorrules';
import { generateClaudeMd } from '@/lib/rules/templates/claude-md';
import type { FileConfig } from '@/lib/rules/types';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body: FileConfig = await request.json();
    const { workspace_id, project_id, file_type, preview_only = false } = body;

    if (!workspace_id) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    if (!file_type || !['cursorrules', 'claude_md'].includes(file_type)) {
      return NextResponse.json({ error: 'Invalid file_type' }, { status: 400 });
    }

    // Get approved rules
    const rules = await getApprovedRules(workspace_id, project_id);

    if (!rules || rules.length === 0) {
      return NextResponse.json({ error: 'No approved rules found' }, { status: 404 });
    }

    // Generate file content
    let fileContent: string;
    let fileName: string;

    if (file_type === 'cursorrules') {
      fileContent = generateCursorRules(rules);
      fileName = '.cursorrules';
    } else {
      fileContent = generateClaudeMd(rules);
      fileName = 'CLAUDE.md';
    }

    const filePath = project_id ? `/${project_id}/${fileName}` : `/${fileName}`;

    // If not preview only, save to database
    if (!preview_only) {
      const { error: configError } = await supabase.from('rule_file_configs').upsert({
        workspace_id,
        project_id: project_id || null,
        file_type,
        file_path: filePath,
        last_generated_at: new Date().toISOString(),
        generated_by: user.id,
        rules_count: rules.length,
      });

      if (configError) {
        console.error('Error saving file config:', configError);
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json({
      success: true,
      file_content: fileContent,
      file_path: filePath,
      rules_included: rules.length,
      // download_url could be added later if we store files in storage
    });
  } catch (error) {
    console.error('Error generating rule file:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
