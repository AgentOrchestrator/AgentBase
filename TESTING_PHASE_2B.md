# Testing Guide: Phase 2B - Extraction Wizard

This guide will help you test the Rule Extraction workflow.

## What Phase 2B Adds

Phase 2B implements the **3-step extraction wizard** that allows users to:
1. Select chat conversations to analyze
2. Choose an extraction prompt
3. Extract coding rules automatically

---

## Prerequisites

1. **Phase 2A tested and working** ✅
2. **Web app running** - `pnpm dev:web`
3. **Authenticated user**
4. **Chat histories in database** (your existing conversations)

---

## Step 1: Access the Extraction Wizard

Navigate to: **http://localhost:3000/rules/extract**

Or click "Extract Rules" button from:
- Main dashboard (`/rules`)
- Pending rules page (`/rules/pending`)

---

## Step 2: Test Wizard Step 1 - Select Conversations

### What You Should See

- ✅ Header: "Select Chat Histories"
- ✅ Search box to filter conversations
- ✅ Date range filter (All time / Last 7/30/90 days)
- ✅ List of your chat conversations with:
  - Checkbox for selection
  - AI-generated title (or "Untitled conversation")
  - Date and message count
  - AI summary (if available)
- ✅ "Select All" / "Deselect All" buttons
- ✅ Counter showing "Selected: X conversations"

### Actions to Test

**Test 1: Basic Selection**
1. Click a conversation → Checkbox should check
2. Click again → Checkbox should uncheck
3. Bottom should show "Selected: 1 conversation"

**Test 2: Select All**
1. Click "Select All" → All conversations should be checked
2. Counter should show total number

**Test 3: Deselect All**
1. Select some conversations
2. Click "Deselect All" → All should uncheck
3. Counter should show "Selected: 0 conversations"

**Test 4: Search Filter**
1. Type in search box → List should filter in real-time
2. Clear search → All conversations should reappear

**Test 5: Date Filter**
1. Select "Last 7 days" → Should show only recent conversations
2. Select "All time" → Should show all conversations

**Test 6: Validation**
1. Without selecting any conversation, click "Next →"
2. Should show alert: "Please select at least one conversation"
3. Should NOT proceed to next step

**Test 7: Proceed to Step 2**
1. Select at least 1 conversation
2. Click "Next →"
3. Should proceed to Step 2

---

## Step 3: Test Wizard Step 2 - Choose Prompt

### What You Should See

- ✅ Header: "Choose Extraction Prompt"
- ✅ "+ Create Custom" button (links to `/rules/prompts`)
- ✅ List of available prompts with radio buttons
- ✅ Default prompt auto-selected
- ✅ Each prompt shows:
  - Name with "Default" badge if applicable
  - Description
  - Target categories (badges)
  - Min confidence threshold
  - "Show/Hide prompt" toggle
- ✅ Info box explaining how extraction works

### Actions to Test

**Test 1: Default Selection**
1. Should have "Default" prompt pre-selected
2. Radio button should be checked

**Test 2: Select Different Prompt**
1. Click another prompt → Radio should switch
2. Only one prompt should be selected at a time

**Test 3: View Prompt Text**
1. Click "Show prompt ▶" → Prompt text should expand
2. Should show full prompt in code block
3. Click "Hide prompt ▼" → Should collapse

**Test 4: Navigation**
1. Click "← Back" → Should return to Step 1
2. Your conversation selections should be preserved
3. Click "Next →" again → Should return to Step 2
4. Prompt selection should be preserved

**Test 5: Proceed to Step 3**
1. With a prompt selected, click "Next →"
2. Should proceed to Step 3

---

## Step 4: Test Wizard Step 3 - Extract Rules

### Initial State - Ready to Extract

**What You Should See:**
- ✅ Header: "Ready to Extract"
- ✅ Summary box showing:
  - Number of conversations selected
  - Confirmation that prompt is selected
- ✅ "What happens next?" information box
- ✅ "Start Extraction" button
- ✅ "← Back" button
- ✅ "Cancel" button

### Actions to Test

**Test 1: Navigate Back**
1. Click "← Back" → Should return to Step 2
2. Selections should be preserved

**Test 2: Start Extraction**
1. Click "Start Extraction" button
2. Should transition to extraction progress view

### Extraction Progress State

**What You Should See:**
- ✅ Header: "Extracting Rules..."
- ✅ Progress bar showing 0-100%
- ✅ Status message (e.g., "Analyzing with AI...")
- ✅ Stats showing:
  - Rules Found: (updating number)
  - Status: "Analyzing..."
- ✅ "Cancel Extraction" button

**Expected Behavior:**
1. Progress bar should animate from 0% to 100%
2. Status message should change as progress increases:
   - "Preparing conversations..." (0-30%)
   - "Analyzing with AI..." (30-60%)
   - "Extracting rules..." (60-90%)
   - "Finalizing..." (90-100%)
3. Should take 5-10 seconds (simulated)

### Success State

**What You Should See:**
- ✅ Header: "✓ Extraction Complete!"
- ✅ Green checkmark icon
- ✅ "X rules extracted and ready for review"
- ✅ "What's Next?" info box
- ✅ "Review Pending Rules" button (primary)
- ✅ "Back to Dashboard" button (secondary)

### Actions to Test

**Test 1: View Results**
1. Click "Review Pending Rules" button
2. Should redirect to `/rules/pending`
3. Should see newly extracted rules at the top

**Test 2: Return to Dashboard**
1. Start another extraction
2. After success, click "Back to Dashboard"
3. Should redirect to `/rules`
4. Pending count should be updated

### Error State

**To Simulate Error:**
- Memory service not running
- Invalid chat history data
- Network error

**What You Should See:**
- ✅ Header: "✗ Extraction Failed"
- ✅ Red X icon
- ✅ Error message
- ✅ "Error Details" box with technical error
- ✅ "Troubleshooting" suggestions
- ✅ "Try Again" button
- ✅ "Back to Dashboard" button

---

## Step 5: Visual & UX Testing

### Responsive Design
Test on different screen sizes:
- **Desktop (1920x1080)**: All elements should be visible
- **Tablet (768x1024)**: Wizard should stack properly
- **Mobile (375x667)**: Should be scrollable, buttons accessible

### Dark Mode
1. Toggle dark mode
2. Verify all components render correctly:
   - ✅ Step indicator colors
   - ✅ Card backgrounds
   - ✅ Badges and buttons
   - ✅ Progress bar
   - ✅ Info boxes

### Loading States
1. Initial page load should show wizard immediately
2. Step 1: "Loading conversations..." while fetching
3. Step 2: "Loading prompts..." while fetching

---

## Step 6: Integration Testing

### End-to-End Flow

**Complete Extraction Flow:**
1. Navigate to `/rules/extract`
2. Select 3 conversations
3. Use search to find specific conversation
4. Click "Next →"
5. Keep default prompt selected
6. Click "Show prompt" to view
7. Click "Next →"
8. Review summary
9. Click "Start Extraction"
10. Wait for completion
11. Click "Review Pending Rules"
12. Should see extracted rules in pending table
13. Approve one rule
14. Navigate to `/rules/approved`
15. Should see approved rule

### Database Verification

After extraction completes, check database:

```sql
-- Check extracted rules
SELECT
  id,
  rule_text,
  rule_category,
  confidence_score,
  source_session_ids
FROM extracted_rules
ORDER BY created_at DESC
LIMIT 10;

-- Check approval status
SELECT
  r.rule_text,
  ra.status,
  ra.created_at
FROM extracted_rules r
JOIN rule_approvals ra ON ra.rule_id = r.id
ORDER BY r.created_at DESC
LIMIT 10;
```

---

## Step 7: Error Scenarios

### Test Error Handling

**Scenario 1: No Conversations**
- If user has no chat histories
- Should show "No chat histories found"
- Should not crash

**Scenario 2: No Prompts**
- Temporarily disable all prompts in database
- Should show "No extraction prompts available"
- Should offer "Create a Prompt" button

**Scenario 3: Network Error**
- Throttle network to simulate slow connection
- Extraction should still show progress
- Should handle timeout gracefully

**Scenario 4: Memory Service Down**
- Stop memory service (if running)
- Extraction should fail gracefully
- Should show helpful error message

---

## Expected Results Summary

After complete testing, you should have:
- ✅ Navigated through all 3 wizard steps
- ✅ Selected conversations with search/filter
- ✅ Chosen extraction prompt
- ✅ Started extraction and seen progress
- ✅ Completed extraction successfully
- ✅ Viewed extracted rules in pending table
- ✅ Tested back navigation (selections preserved)
- ✅ Tested dark mode
- ✅ Tested responsive design
- ✅ Verified database entries created

---

## Known Limitations

1. **Memory Service Integration**: The actual AI extraction depends on the Python memory service. If not running, extractions will fail.
2. **Progress Simulation**: Progress is currently simulated. Real extraction may have different timing.
3. **Cancellation**: Cancel button shows but doesn't stop backend processing (future enhancement).

---

## Troubleshooting

### Issue: No conversations showing
**Solution:**
- Verify you have chat histories in database
- Check RLS policies allow viewing
- Look for errors in browser console

### Issue: Extraction fails immediately
**Solution:**
- Check if memory service is running
- Verify `MEMORY_SERVICE_URL` environment variable
- Check API logs for errors
- Ensure selected chat histories have valid data

### Issue: Progress stuck at certain percentage
**Solution:**
- This is normal during AI analysis
- Wait up to 2 minutes
- If still stuck, check backend logs

---

## Next Steps: Phase 2C

Once Phase 2B is working:
1. Implement file generation (`.cursorrules`, `CLAUDE.md`)
2. Add file preview and download
3. Implement auto-sync functionality

---

**Happy Testing! 🚀**

For issues, check browser console and server logs.
