# Shared Memory UI Implementation Plan

## Overview
This document outlines the UI components and API endpoints needed to complete Phase 2 of the Shared Memory system - the user-facing interface for reviewing and managing extracted coding rules.

## Current Status (Phase 1 - Complete ✅)

### Backend Infrastructure
- ✅ Database schema with 5 tables (extracted_rules, rule_approvals, rule_approval_history, extraction_prompts, rule_file_configs)
- ✅ RLS policies for security
- ✅ Python memory service with mem0 integration
- ✅ FastAPI endpoints: `/health` and `/extract-rules`
- ✅ Helper functions: `get_approved_rules()`, `approve_rule()`, `reject_rule()`

---

## Phase 2: UI Implementation

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Web App                      │
│                                                         │
│  ┌────────────────────────────────────────────────┐   │
│  │  Pages/Routes                                   │   │
│  │  - /rules (dashboard)                           │   │
│  │  - /rules/pending (review queue)                │   │
│  │  - /rules/approved (approved rules)             │   │
│  │  - /rules/prompts (prompt management)           │   │
│  │  - /rules/generate (file generation)            │   │
│  └────────────────────────────────────────────────┘   │
│                         ↓                               │
│  ┌────────────────────────────────────────────────┐   │
│  │  API Routes (apps/web/src/app/api/rules/)      │   │
│  │  - POST /api/rules/extract                      │   │
│  │  - GET  /api/rules?status=pending               │   │
│  │  - PATCH /api/rules/:id/status                  │   │
│  │  - POST /api/rules/:id/edit                     │   │
│  │  - POST /api/rules/sync                         │   │
│  │  - GET  /api/prompts                            │   │
│  │  - POST /api/prompts                            │   │
│  └────────────────────────────────────────────────┘   │
│                         ↓                               │
│  ┌────────────────────────────────────────────────┐   │
│  │  Supabase Client (server-side)                  │   │
│  │  - Query extracted_rules + rule_approvals       │   │
│  │  - Call helper functions                        │   │
│  └────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         ↓
         ┌───────────────────────────┐
         │  Memory Service (Python)  │
         │  POST /extract-rules      │
         └───────────────────────────┘
```

---

## 1. API Routes to Implement

### Location: `apps/web/src/app/api/rules/`

#### A. Extract Rules (`POST /api/rules/extract/route.ts`)
Trigger rule extraction from selected chat histories.

**Request:**
```typescript
{
  chat_history_ids: string[];  // UUIDs of sessions to analyze
  workspace_id?: string;        // Optional workspace scope
  prompt_id?: string;           // Optional custom prompt
}
```

**Response:**
```typescript
{
  success: boolean;
  rules_extracted: number;
  pending_review: number;
  job_id?: string;  // For async processing
}
```

**Implementation Steps:**
1. Validate user has access to chat histories
2. Fetch chat histories from Supabase
3. Call Python memory service: `POST http://localhost:8000/extract-rules`
4. Return summary of extraction results

---

#### B. List Rules (`GET /api/rules/route.ts`)
Get rules with optional filtering.

**Query Parameters:**
- `status` - pending | approved | rejected | needs_revision | archived
- `category` - git-workflow | code-style | architecture | best-practices | testing | documentation
- `workspace_id` - Filter by workspace
- `project_id` - Filter by project
- `limit` - Pagination limit (default: 50)
- `offset` - Pagination offset (default: 0)

**Response:**
```typescript
{
  rules: Array<{
    id: string;
    rule_text: string;
    rule_category: string;
    confidence_score: number;
    source_session_ids: string[];
    status: string;
    reviewed_by?: string;
    reviewed_at?: string;
    created_at: string;
  }>;
  total: number;
  page: number;
}
```

**SQL Query:**
```sql
SELECT
  r.id,
  r.rule_text,
  r.rule_category,
  r.confidence_score,
  r.source_session_ids,
  ra.status,
  ra.reviewed_by,
  ra.reviewed_at,
  r.created_at
FROM extracted_rules r
INNER JOIN rule_approvals ra ON r.id = ra.rule_id
WHERE ra.status = $1
  AND ($2::uuid IS NULL OR r.workspace_id = $2)
  AND ($3::text IS NULL OR r.rule_category = $3)
ORDER BY r.confidence_score DESC, r.created_at DESC
LIMIT $4 OFFSET $5;
```

---

#### C. Update Rule Status (`PATCH /api/rules/[id]/status/route.ts`)
Approve, reject, or change status of a rule.

**Request:**
```typescript
{
  status: 'approved' | 'rejected' | 'needs_revision' | 'archived';
  reason?: string;  // Required for rejection
  notes?: string;   // Optional notes
}
```

**Response:**
```typescript
{
  success: boolean;
  rule_id: string;
  new_status: string;
}
```

**Implementation:**
- Use helper functions: `approve_rule()` or `reject_rule()`
- Automatically creates audit trail entry

---

#### D. Edit Rule (`PATCH /api/rules/[id]/route.ts`)
Edit rule text or category.

**Request:**
```typescript
{
  rule_text?: string;
  rule_category?: string;
}
```

**Implementation:**
- Update `extracted_rules` table
- Trigger `updated_at` timestamp
- Check user has permission (RLS handles this)

---

#### E. Generate Rule Files (`POST /api/rules/sync/route.ts`)
Generate `.cursorrules` or `CLAUDE.md` from approved rules.

**Request:**
```typescript
{
  workspace_id: string;
  project_id?: string;
  file_type: 'cursorrules' | 'claude_md';
  preview_only?: boolean;  // If true, don't save, just return content
}
```

**Response:**
```typescript
{
  success: boolean;
  file_content: string;
  file_path: string;
  rules_included: number;
  download_url?: string;
}
```

**Implementation:**
1. Call `get_approved_rules(workspace_id, project_id)`
2. Format rules into appropriate file format
3. Store in `rule_file_configs` table
4. Return file content for download or PR creation

---

#### F. Manage Prompts (`GET/POST /api/prompts/route.ts`)
CRUD operations for extraction prompts.

**GET Response:**
```typescript
{
  prompts: Array<{
    id: string;
    name: string;
    description: string;
    is_active: boolean;
    target_categories: string[];
    min_confidence: number;
  }>;
}
```

**POST Request:**
```typescript
{
  name: string;
  description: string;
  prompt_text: string;
  target_categories: string[];
  min_confidence: number;
  workspace_id?: string;
}
```

---

## 2. UI Components to Build

### Location: `apps/web/src/components/rules/`

#### A. RulesDashboard (`rules-dashboard.tsx`)
Main dashboard showing overview and quick stats.

**Features:**
- Card showing pending rules count
- Card showing approved rules count
- Recent extractions timeline
- Quick actions: "Extract Rules", "Review Pending", "Generate Files"

**Data Requirements:**
```typescript
const stats = {
  pending: number;
  approved: number;
  rejected: number;
  recent_extractions: Array<{
    timestamp: string;
    rules_count: number;
    user: string;
  }>;
};
```

---

#### B. PendingRulesTable (`pending-rules-table.tsx`)
Table/list of rules awaiting review.

**Columns:**
- Confidence score (visual badge)
- Rule text (truncated, expandable)
- Category (badge)
- Source sessions count (clickable to view)
- Actions (Approve, Reject, Edit, View Details)

**Features:**
- Sortable by confidence, date
- Filterable by category
- Bulk selection for batch operations
- Inline preview of source conversations

**Component Structure:**
```tsx
<Card>
  <CardHeader>
    <div>Pending Rules ({count})</div>
    <Button onClick={handleExtractNew}>Extract New Rules</Button>
  </CardHeader>
  <CardContent>
    <div>
      <Select onChange={filterByCategory} />
      <Input placeholder="Search rules..." />
    </div>
    <Table>
      <TableHeader>...</TableHeader>
      <TableBody>
        {rules.map(rule => (
          <RuleRow
            key={rule.id}
            rule={rule}
            onApprove={handleApprove}
            onReject={handleReject}
            onEdit={handleEdit}
          />
        ))}
      </TableBody>
    </Table>
  </CardContent>
</Card>
```

---

#### C. RuleDetailModal (`rule-detail-modal.tsx`)
Modal showing full rule details with source context.

**Sections:**
1. **Rule Info**
   - Full rule text
   - Category
   - Confidence score with visual indicator
   - Created date
   - Extracted by (user)

2. **Source Context**
   - List of source chat sessions
   - Expandable excerpts showing where rule was derived
   - mem0 memory references (if available)

3. **Evidence**
   - Quoted text from conversations supporting this rule

4. **Actions**
   - Approve button (green)
   - Reject button (red) → opens rejection reason modal
   - Edit button → inline editor
   - Archive button

---

#### D. RejectReasonModal (`reject-reason-modal.tsx`)
Simple modal to collect rejection reason.

```tsx
<Dialog>
  <DialogHeader>
    <DialogTitle>Reject Rule</DialogTitle>
  </DialogHeader>
  <DialogContent>
    <Textarea
      placeholder="Why are you rejecting this rule?"
      value={reason}
      onChange={setReason}
    />
  </DialogContent>
  <DialogFooter>
    <Button variant="ghost" onClick={onCancel}>Cancel</Button>
    <Button variant="destructive" onClick={() => onConfirm(reason)}>
      Reject Rule
    </Button>
  </DialogFooter>
</Dialog>
```

---

#### E. ExtractionWizard (`extraction-wizard.tsx`)
Multi-step wizard to extract rules from chat histories.

**Steps:**
1. **Select Sessions**
   - Search/filter chat histories
   - Multi-select checkbox list
   - Show session metadata (date, project, agent type)
   - "Select All Recent" button

2. **Choose Prompt** (optional)
   - Radio list of available prompts
   - Show prompt description
   - Preview prompt text (collapsible)
   - "Use Default" option selected by default

3. **Review & Extract**
   - Summary of selections
   - Estimated processing time
   - "Start Extraction" button
   - Progress indicator (if async)

**Component Structure:**
```tsx
const steps = [
  { title: 'Select Sessions', component: SelectSessionsStep },
  { title: 'Choose Prompt', component: ChoosePromptStep },
  { title: 'Extract', component: ExtractStep },
];

<Stepper activeStep={currentStep}>
  {steps.map((step, index) => (
    <Step key={index}>{step.component}</Step>
  ))}
</Stepper>
```

---

#### F. ApprovedRulesList (`approved-rules-list.tsx`)
View approved rules, organized by category.

**Features:**
- Grouped by category (collapsible sections)
- Sortable by confidence, date
- Search/filter
- Bulk export to file
- "Generate .cursorrules" button

**Layout:**
```tsx
<Accordion>
  {categories.map(category => (
    <AccordionItem key={category}>
      <AccordionTrigger>
        {category} ({rules_count})
      </AccordionTrigger>
      <AccordionContent>
        {rules.map(rule => (
          <RuleCard
            rule={rule}
            actions={['unapprove', 'edit', 'archive']}
          />
        ))}
      </AccordionContent>
    </AccordionItem>
  ))}
</Accordion>
```

---

#### G. RuleFilePreview (`rule-file-preview.tsx`)
Preview generated rule file before syncing.

**Features:**
- Syntax-highlighted preview
- Side-by-side diff if file already exists
- "Download" button
- "Copy to Clipboard" button
- "Create PR" button (future)
- "Save to Workspace" button

**Component:**
```tsx
<Card>
  <CardHeader>
    <div>
      <Select value={fileType} onChange={setFileType}>
        <option value="cursorrules">.cursorrules</option>
        <option value="claude_md">CLAUDE.md</option>
      </Select>
    </div>
    <div>
      <Badge>{rules_count} rules included</Badge>
    </div>
  </CardHeader>
  <CardContent>
    <Tabs defaultValue="preview">
      <TabsList>
        <TabsTrigger value="preview">Preview</TabsTrigger>
        <TabsTrigger value="diff">Diff</TabsTrigger>
      </TabsList>
      <TabsContent value="preview">
        <CodeBlock language="markdown" code={fileContent} />
      </TabsContent>
      <TabsContent value="diff">
        <DiffViewer oldCode={existing} newCode={fileContent} />
      </TabsContent>
    </Tabs>
  </CardContent>
  <CardFooter>
    <Button onClick={handleDownload}>Download</Button>
    <Button onClick={handleCopy}>Copy</Button>
    <Button onClick={handleSave} variant="default">
      Save to Project
    </Button>
  </CardFooter>
</Card>
```

---

#### H. PromptManager (`prompt-manager.tsx`)
Admin UI for managing extraction prompts.

**Features:**
- List of prompts with edit/delete actions
- Create new prompt form
- Test prompt on sample conversation
- Version history (future)
- Import/export prompts

---

## 3. Page Routes to Create

### Location: `apps/web/src/app/(dashboard)/rules/`

#### A. `/rules/page.tsx`
Main rules dashboard.

```tsx
export default async function RulesPage() {
  const stats = await getRulesStats();

  return (
    <div className="container py-8">
      <h1>Shared Memory</h1>
      <RulesDashboard stats={stats} />
    </div>
  );
}
```

---

#### B. `/rules/pending/page.tsx`
Review pending rules.

```tsx
export default async function PendingRulesPage() {
  const pendingRules = await getRules({ status: 'pending' });

  return (
    <div className="container py-8">
      <h1>Pending Rules ({pendingRules.total})</h1>
      <PendingRulesTable rules={pendingRules.rules} />
    </div>
  );
}
```

---

#### C. `/rules/approved/page.tsx`
View approved rules.

---

#### D. `/rules/extract/page.tsx`
Extraction wizard.

---

#### E. `/rules/generate/page.tsx`
Generate rule files.

---

#### F. `/rules/prompts/page.tsx`
Manage prompts (admin only).

---

## 4. File Generation Templates

### Location: `apps/web/src/lib/rules/templates/`

#### A. `.cursorrules` Template

```typescript
export function generateCursorRules(rules: Rule[]): string {
  const grouped = groupByCategory(rules);

  let content = `# Cursor AI Rules
# Generated by Agent Orchestrator - Shared Memory System
# Last updated: ${new Date().toISOString()}
# Total rules: ${rules.length}

`;

  for (const [category, categoryRules] of Object.entries(grouped)) {
    content += `## ${formatCategory(category)}\n\n`;

    for (const rule of categoryRules) {
      content += `- ${rule.rule_text}\n`;
    }

    content += '\n';
  }

  return content;
}
```

---

#### B. `CLAUDE.md` Template

```typescript
export function generateClaudeMd(rules: Rule[]): string {
  const grouped = groupByCategory(rules);

  let content = `# Claude Code Project Instructions
# Generated by Agent Orchestrator - Shared Memory System
# Last updated: ${new Date().toISOString()}

## Overview
This document contains coding rules and conventions extracted from your team's chat histories.

`;

  for (const [category, categoryRules] of Object.entries(grouped)) {
    content += `## ${formatCategory(category)}\n\n`;

    for (const rule of categoryRules) {
      content += `### ${rule.rule_text}\n\n`;
      content += `**Confidence:** ${(rule.confidence_score * 100).toFixed(0)}%\n\n`;

      if (rule.evidence) {
        content += `**Evidence:**\n> ${rule.evidence}\n\n`;
      }
    }

    content += '\n';
  }

  return content;
}
```

---

## 5. Utilities & Helpers

### Location: `apps/web/src/lib/rules/`

#### A. `rules-client.ts`
Client-side wrapper for API calls.

```typescript
export class RulesClient {
  async extractRules(chatHistoryIds: string[]): Promise<ExtractionResult> { }
  async getRules(filters: RuleFilters): Promise<RulesResponse> { }
  async approveRule(ruleId: string, notes?: string): Promise<void> { }
  async rejectRule(ruleId: string, reason: string): Promise<void> { }
  async generateFile(config: FileConfig): Promise<FileResult> { }
}
```

---

#### B. `rules-formatter.ts`
Formatting utilities.

```typescript
export function formatConfidence(score: number): string { }
export function getCategoryColor(category: string): string { }
export function groupByCategory(rules: Rule[]): Record<string, Rule[]> { }
export function formatCategory(category: string): string { }
```

---

## 6. Database Queries

### Location: `apps/web/src/lib/db/rules-queries.ts`

```typescript
import { createClient } from '@/lib/supabase-server';

export async function getPendingRules(workspaceId?: string) {
  const supabase = createClient();

  return supabase
    .from('extracted_rules')
    .select(`
      *,
      rule_approvals (
        status,
        reviewed_by,
        reviewed_at,
        rejection_reason
      )
    `)
    .eq('rule_approvals.status', 'pending')
    .order('confidence_score', { ascending: false });
}

export async function approveRuleQuery(ruleId: string, userId: string) {
  const supabase = createClient();

  return supabase.rpc('approve_rule', {
    p_rule_id: ruleId,
    p_reviewed_by: userId,
  });
}
```

---

## 7. Implementation Priority

### Phase 2A (Core Functionality)
1. ✅ API: `GET /api/rules` (list)
2. ✅ API: `PATCH /api/rules/:id/status` (approve/reject)
3. ✅ Component: `PendingRulesTable`
4. ✅ Component: `RuleDetailModal`
5. ✅ Page: `/rules/pending`

### Phase 2B (Extraction)
6. ✅ API: `POST /api/rules/extract`
7. ✅ Component: `ExtractionWizard`
8. ✅ Page: `/rules/extract`

### Phase 2C (File Generation)
9. ✅ API: `POST /api/rules/sync`
10. ✅ Component: `RuleFilePreview`
11. ✅ Component: `ApprovedRulesList`
12. ✅ Page: `/rules/generate`

### Phase 2D (Advanced)
13. ✅ API: `GET/POST /api/prompts`
14. ✅ Component: `PromptManager`
15. ✅ Page: `/rules/prompts`

---

## 8. Testing Checklist

- [ ] Can extract rules from chat histories
- [ ] Rules appear in pending queue
- [ ] Can approve rules (with history tracking)
- [ ] Can reject rules (with reason)
- [ ] Can edit rule text
- [ ] Can filter by category/status
- [ ] Can generate `.cursorrules` file
- [ ] Can generate `CLAUDE.md` file
- [ ] File preview shows correct formatting
- [ ] RLS policies prevent unauthorized access
- [ ] Workspace isolation works correctly

---

## 9. Future Enhancements (Phase 3+)

- [ ] Batch approval/rejection
- [ ] Rule suggestions based on usage patterns
- [ ] Auto-approval for high-confidence rules
- [ ] GitHub PR creation for rule file updates
- [ ] Rule conflict detection
- [ ] Rule versioning and rollback
- [ ] Public rule library (opt-in sharing)
- [ ] Analytics dashboard (approval rates, usage)
- [ ] Email notifications for new pending rules
- [ ] Slack integration for rule reviews

---

## Summary

This UI implementation will provide a complete interface for:
1. **Reviewing** extracted rules with context
2. **Managing** rule approval workflow
3. **Generating** rule files from approved rules
4. **Customizing** extraction prompts

All components use shadcn/ui for consistency with the existing app design.
