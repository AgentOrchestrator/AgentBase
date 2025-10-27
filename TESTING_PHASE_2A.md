# Testing Guide: Phase 2A - Shared Memory UI

This guide will help you test the Shared Memory UI implementation (Phase 2A - Pending Rules Review).

## Prerequisites

1. **Database migrations applied** ✅ (Already done)
2. **Web app running** - Start the development server
3. **Authenticated user** - You need to be logged in

## Step 1: Start the Development Server

```bash
cd /Users/duonghaidang/Developer/agent-orchestrator

# Start the web app
pnpm dev:web

# Or start all services
pnpm dev
```

The web app should be available at `http://localhost:3000`

## Step 2: Seed Test Data

We've created 10 sample rules in various categories. To verify they were created:

```bash
# Connect to your Supabase project and run:
# You can use the Supabase Studio at: https://supabase.com/dashboard/project/<your-project-id>

# Or use MCP tools to verify
```

Let me verify the data for you now...

## Step 3: Access the Rules Pages

### Main Dashboard
Navigate to: `http://localhost:3000/rules`

**What you should see:**
- Statistics cards showing:
  - Pending Review: 10 rules
  - Approved: 0 rules
  - Rejected: 0 rules
- Quick action buttons for:
  - Extract Rules
  - Review Pending
  - Generate Files
  - Manage Prompts
- Recent extractions (if any)

### Pending Rules Page
Navigate to: `http://localhost:3000/rules/pending`

**What you should see:**
- Table with 10 pending rules
- Each rule showing:
  - ✅ Confidence badge (colored by score)
  - ✅ Rule text (expandable if long)
  - ✅ Category badge (colored)
  - ✅ Source session count
  - ✅ Created date
  - ✅ Action buttons: Approve, Reject, Edit, Details

## Step 4: Test Features

### 4.1 Search and Filter
- **Search**: Type "branch" in the search box → should show git-workflow rule
- **Filter by category**: Select "Architecture" → should show 3 rules
- **Clear filters**: Select "All Categories" → should show all 10 rules

### 4.2 Expand/Collapse Rule Text
- Find a rule with long text (e.g., "Keep server-only code...")
- Click "Show more" → should expand full text
- Click "Show less" → should collapse text

### 4.3 View Rule Details
- Click "Details" button on any rule
- **Modal should show:**
  - Full rule text
  - Category badge
  - Confidence score badge
  - Created date
  - Source sessions count
  - Links to source sessions
  - Approval status section
  - Action buttons (Approve, Reject, Edit)

### 4.4 Approve a Rule
1. Click "Approve" button on any rule
2. The rule should:
   - Disappear from the pending list
   - Counter should decrease by 1
3. Verify in database:
   ```sql
   SELECT ra.status, ra.reviewed_by, ra.reviewed_at
   FROM rule_approvals ra
   WHERE ra.rule_id = '<rule-id>';
   ```
   - Status should be 'approved'
   - reviewed_by should be your user ID
   - reviewed_at should be current timestamp

### 4.5 Reject a Rule
1. Click "Reject" button on any rule
2. **Modal should appear** asking for rejection reason
3. Enter a reason (e.g., "Too vague, needs more context")
4. Click "Reject Rule" button
5. The rule should:
   - Disappear from the pending list
   - Counter should decrease by 1
6. Verify in database:
   ```sql
   SELECT ra.status, ra.rejection_reason
   FROM rule_approvals ra
   WHERE ra.rule_id = '<rule-id>';
   ```
   - Status should be 'rejected'
   - rejection_reason should match what you entered

## Step 5: Test API Endpoints

### Test with curl or browser DevTools

```bash
# Get your auth token from browser localStorage
# Open DevTools → Application → Local Storage → find the Supabase token

# 1. Get all pending rules
curl -X GET "http://localhost:3000/api/rules?status=pending" \
  -H "Cookie: <your-session-cookie>"

# 2. Get rules filtered by category
curl -X GET "http://localhost:3000/api/rules?category=architecture" \
  -H "Cookie: <your-session-cookie>"

# 3. Get rule by ID
curl -X GET "http://localhost:3000/api/rules/<rule-id>" \
  -H "Cookie: <your-session-cookie>"

# 4. Approve a rule
curl -X PATCH "http://localhost:3000/api/rules/<rule-id>/status" \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"status": "approved", "notes": "Looks good!"}'

# 5. Reject a rule
curl -X PATCH "http://localhost:3000/api/rules/<rule-id>/status" \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"status": "rejected", "reason": "Too vague", "notes": "Needs more specificity"}'

# 6. Get statistics
curl -X GET "http://localhost:3000/api/rules/stats" \
  -H "Cookie: <your-session-cookie>"
```

## Step 6: Visual Testing Checklist

### Dark Mode
- Toggle between light and dark mode
- Verify all components render correctly:
  - ✅ Badges have proper dark mode colors
  - ✅ Cards have proper backgrounds
  - ✅ Text is readable in both modes
  - ✅ Modals have proper contrast

### Responsive Design
Test on different screen sizes:
- Desktop (1920x1080)
- Tablet (768x1024)
- Mobile (375x667)

Verify:
- ✅ Table scrolls horizontally on small screens
- ✅ Stats cards stack on mobile
- ✅ Buttons remain accessible

### Loading States
- Refresh page and observe loading indicators
- Approve/reject rules and verify loading states on buttons

## Step 7: Error Handling

### Test Error Scenarios

1. **Unauthorized Access**
   - Log out
   - Try accessing `/rules` → should redirect to login

2. **Network Errors**
   - Open DevTools → Network tab
   - Throttle connection to "Slow 3G"
   - Try approving a rule → should handle gracefully

3. **Invalid Data**
   - Try rejecting without entering a reason → button should be disabled

## Troubleshooting

### Issue: No rules visible
**Possible causes:**
1. RLS policies preventing access
2. No data seeded
3. Not authenticated

**Solution:**
```sql
-- Check if rules exist
SELECT COUNT(*) FROM extracted_rules;

-- Check if you can see them
SELECT id, rule_text, rule_category
FROM extracted_rules
LIMIT 5;

-- Check your user ID
SELECT auth.uid();
```

### Issue: Can't approve/reject rules
**Possible causes:**
1. User ID not matching
2. RLS policies blocking update

**Solution:**
```sql
-- Verify you can update approvals
SELECT * FROM rule_approvals
WHERE rule_id IN (SELECT id FROM extracted_rules LIMIT 1);
```

### Issue: Modals not appearing
**Possible causes:**
1. JavaScript errors
2. Missing Dialog component

**Solution:**
- Check browser console for errors
- Verify shadcn/ui Dialog component is installed

## Expected Results Summary

After testing, you should have:
- ✅ Seen the main dashboard with statistics
- ✅ Viewed the pending rules table with 10 rules
- ✅ Successfully searched and filtered rules
- ✅ Expanded/collapsed rule text
- ✅ Viewed detailed rule information in modal
- ✅ Approved at least 1 rule
- ✅ Rejected at least 1 rule with a reason
- ✅ Verified changes in the database
- ✅ Tested dark mode
- ✅ Verified responsive design

## Next Steps

Once Phase 2A is working:
1. **Phase 2B**: Implement extraction wizard
2. **Phase 2C**: Implement file generation
3. **Phase 2D**: Implement prompt management

## Need Help?

If you encounter issues:
1. Check the browser console for JavaScript errors
2. Check the server logs for API errors
3. Verify database schema with `\d+ extracted_rules` in psql
4. Check RLS policies are not blocking access
5. Ensure you're authenticated

## Database Verification Commands

```sql
-- Count rules by status
SELECT ra.status, COUNT(*)
FROM rule_approvals ra
GROUP BY ra.status;

-- View recent approvals
SELECT r.rule_text, ra.status, ra.reviewed_at, ra.reviewed_by
FROM extracted_rules r
JOIN rule_approvals ra ON ra.rule_id = r.id
ORDER BY ra.reviewed_at DESC
LIMIT 10;

-- Check RLS is working
SELECT * FROM extracted_rules; -- Should only show your accessible rules
```

---

**Happy Testing! 🚀**
