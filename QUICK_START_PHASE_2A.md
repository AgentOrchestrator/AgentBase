# Quick Start Guide: Testing Phase 2A

## ✅ Setup Complete!

Your database is seeded with **10 sample rules** ready for testing.

## Start Testing in 3 Steps

### 1. Start the Development Server

```bash
cd /Users/duonghaidang/Developer/agent-orchestrator
pnpm dev:web
```

The web app will be available at: **http://localhost:3000**

### 2. Navigate to the Rules Pages

Open your browser and visit:

- **Main Dashboard**: http://localhost:3000/rules
  - See statistics (10 pending rules)
  - Quick action buttons

- **Pending Rules**: http://localhost:3000/rules/pending
  - Table with all 10 rules
  - Search, filter, approve, reject

### 3. Try These Actions

#### ✅ Search for Rules
- Type "branch" in the search box → finds git-workflow rule
- Type "TypeScript" → finds code-style rule

#### ✅ Filter by Category
- Select "Architecture" from dropdown → shows 3 rules
- Select "Best Practices" → shows 2 rules

#### ✅ View Details
- Click "Details" on any rule → opens modal with full information

#### ✅ Approve a Rule
- Click "Approve" button → rule disappears from pending list
- Check the stats counter decreases

#### ✅ Reject a Rule
- Click "Reject" button → modal asks for reason
- Enter reason (e.g., "Too vague") → rule is rejected

## Sample Data Seeded

You have 10 rules covering all categories:
- 🔀 **Git Workflow** (1): Branch management
- 🎨 **Code Style** (2): TypeScript, conventions
- 🏗️ **Architecture** (3): Next.js, server components
- ✨ **Best Practices** (2): pnpm, migrations
- 🧪 **Testing** (1): Unit tests
- 📚 **Documentation** (1): JSDoc comments

## Expected Behavior

### What Works ✅
- View all pending rules in a table
- Search rules by text
- Filter rules by category
- View detailed rule information
- Approve rules (moves to approved status)
- Reject rules with reason (moves to rejected status)
- Dark mode support
- Responsive design

### API Endpoints Working ✅
- `GET /api/rules` - List rules with filters
- `GET /api/rules/:id` - Get single rule
- `PATCH /api/rules/:id/status` - Approve/reject rules
- `GET /api/rules/stats` - Get statistics

## Quick Database Check

To verify the data in your database:

```sql
-- Count rules by status
SELECT ra.status, COUNT(*)
FROM rule_approvals ra
GROUP BY ra.status;

-- Should show:
-- pending: 10 (or less if you approved/rejected some)
-- approved: 0 (or more if you approved some)
-- rejected: 0 (or more if you rejected some)
```

## Troubleshooting

### Can't see rules?
1. Make sure you're logged in
2. Check browser console for errors
3. Verify the server is running

### Rules not updating?
1. Check Network tab in DevTools
2. Look for 401 errors (authentication issue)
3. Check server logs

### Need to reset data?
```sql
-- Delete all rules and start over
DELETE FROM rule_approvals;
DELETE FROM extracted_rules;

-- Then re-run the seed script from TESTING_PHASE_2A.md
```

## What's Next?

Once you've tested Phase 2A:

**Phase 2B** - Extraction Wizard
- Select chat histories to analyze
- Choose extraction prompt
- Extract new rules

**Phase 2C** - File Generation
- Generate .cursorrules files
- Generate CLAUDE.md files
- Preview and download

**Phase 2D** - Prompt Management
- Create custom extraction prompts
- Fine-tune extraction behavior

---

## Need More Details?

See [TESTING_PHASE_2A.md](TESTING_PHASE_2A.md) for comprehensive testing guide with:
- API endpoint testing with curl
- Visual testing checklist
- Error handling scenarios
- Database verification commands

---

**Happy Testing! 🚀**

Having issues? Check the browser console and server logs for error messages.
