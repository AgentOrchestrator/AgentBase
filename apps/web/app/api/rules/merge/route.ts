/**
 * API endpoint for merging uploaded files with generated rules using LLM
 * POST /api/rules/merge
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getApprovedRules } from '@/lib/rules/rules-queries';
import { generateCursorRules } from '@/lib/rules/templates/cursorrules';
import { generateClaudeMd } from '@/lib/rules/templates/claude-md';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const workspaceId = formData.get('workspace_id') as string;
    const projectId = formData.get('project_id') as string | null;
    const fileType = formData.get('file_type') as 'cursorrules' | 'claude_md';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    if (!fileType || !['cursorrules', 'claude_md'].includes(fileType)) {
      return NextResponse.json({ error: 'Invalid file_type' }, { status: 400 });
    }

    // Read uploaded file content
    const uploadedContent = await file.text();

    if (!uploadedContent.trim()) {
      return NextResponse.json({ error: 'Uploaded file is empty' }, { status: 400 });
    }

    // Get approved rules and generate new content
    const rules = await getApprovedRules(workspaceId, projectId || undefined);

    if (!rules || rules.length === 0) {
      return NextResponse.json({ error: 'No approved rules found' }, { status: 404 });
    }

    let generatedContent: string;
    let fileName: string;

    if (fileType === 'cursorrules') {
      generatedContent = generateCursorRules(rules);
      fileName = '.cursorrules';
    } else {
      generatedContent = generateClaudeMd(rules);
      fileName = 'CLAUDE.md';
    }

    // Use Claude to intelligently merge the files
    const mergePrompt = `You are a helpful assistant that merges coding rules files. You have two inputs:

1. EXISTING FILE CONTENT (uploaded by user):
\`\`\`
${uploadedContent}
\`\`\`

2. NEW GENERATED RULES:
\`\`\`
${generatedContent}
\`\`\`

Your task is to intelligently merge these two files following these rules:

1. **Preserve Structure**: Keep the overall structure and formatting style of the existing file
2. **Remove Duplicates**: If a rule appears in both files (even with slightly different wording), keep only one version - prefer the existing file's wording unless the new one is clearly better
3. **Add New Rules**: Add rules from the generated content that don't exist in the existing file
4. **Maintain Categories**: If the existing file has categories/sections, place new rules in appropriate categories
5. **Preserve Comments**: Keep all comments and metadata from the existing file
6. **Keep Custom Content**: Preserve any custom instructions, examples, or explanations in the existing file
7. **Maintain Format**: Use the same formatting style (markdown, bullet points, etc.) as the existing file
8. **Sort Intelligently**: Within categories, maintain the existing order but append new rules at the end of each category

Output ONLY the merged file content, with no explanations or additional text. The output should be ready to save as a ${fileName} file.`;

    const { text: mergedContent } = await generateText({
      model: anthropic('claude-3-5-haiku-20241022'),
      temperature: 0.3,
      prompt: mergePrompt,
    });

    const filePath = projectId ? `/${projectId}/${fileName}` : `/${fileName}`;

    // Save merge record to database
    const { error: configError } = await supabase.from('rule_file_configs').upsert({
      workspace_id: workspaceId,
      project_id: projectId || null,
      file_type: fileType,
      file_path: filePath,
      last_generated_at: new Date().toISOString(),
      generated_by: user.id,
      rules_count: rules.length,
    });

    if (configError) {
      console.error('Error saving file config:', configError);
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      success: true,
      file_content: mergedContent,
      file_path: filePath,
      rules_included: rules.length,
      merged: true,
    });
  } catch (error) {
    console.error('Error merging rule file:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
