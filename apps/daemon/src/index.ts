import { readChatHistories, extractProjectsFromClaudeCodeHistories } from './claude-code-reader.js';
import { readCursorHistories, convertCursorToStandardFormat, extractProjectsFromConversations } from './cursor-reader.js';
import { uploadAllHistories, syncProjects } from './uploader.js';
import { runPeriodicSummaryUpdate, runPeriodicKeywordUpdate, runPeriodicTitleUpdate } from './summarizer.js';
import { AuthManager } from './auth-manager.js';
import { mergeProjects } from './project-aggregator.js';
import { getDatabase } from './database.js';

let authManager: AuthManager;

async function processHistories() {
  console.log('Processing chat histories...');

  const db = getDatabase();
  const syncState = db.getSyncState();

  // Mark sync as started
  db.startSync();

  // Log last sync time if available
  if (syncState && syncState.last_sync_completed_at > 0) {
    const lastSyncDate = new Date(syncState.last_sync_completed_at);
    console.log(`Last successful sync: ${lastSyncDate.toISOString()}`);
    console.log(`Last sync stats: ${syncState.sessions_synced_count} synced, ${syncState.sessions_failed_count} failed`);
  }

  try {
    // Check if already authenticated (silently checks and refreshes token if needed)
    const alreadyAuthenticated = await authManager.isAuthenticated();

    if (!alreadyAuthenticated) {
      // Only prompt for authentication if not already authenticated
      const isAuthenticated = await authManager.waitForAuth();

      if (!isAuthenticated) {
        console.log('⚠️  Authentication failed. Skipping upload.');
        console.log('💡 Tip: Run the daemon again and authenticate in your browser.');
        db.completeSyncError('Authentication failed');
        return;
      }
    }

    const accountId = authManager.getUserId();
    const accessToken = authManager.getAccessToken();
    const refreshToken = authManager.getRefreshToken();
    console.log(`✓ Authenticated as user: ${accountId}`);

    if (!accessToken || !refreshToken) {
      console.log('⚠️  No access token or refresh token available. Skipping upload.');
      db.completeSyncError('No access token or refresh token');
      return;
    }

    // Get session lookback period from environment (default: 30 days)
    const lookbackDays = parseInt(process.env.SESSION_LOOKBACK_DAYS || '30', 10);
    console.log(`Using session lookback period: ${lookbackDays} days`);

    // Calculate the time threshold for filtering sessions
    // Use last sync time if available, otherwise fall back to lookback period
    const lastSyncTime = syncState?.last_sync_completed_at || 0;
    const useIncrementalSync = lastSyncTime > 0 && (Date.now() - lastSyncTime) < (lookbackDays * 24 * 60 * 60 * 1000);

    if (useIncrementalSync) {
      console.log(`Using incremental sync since ${new Date(lastSyncTime).toISOString()}`);
    }

    // Read Claude Code histories (with file modification time filtering)
    // Pass the last sync time for incremental filtering
    const claudeHistories = readChatHistories(lookbackDays, useIncrementalSync ? lastSyncTime : undefined);
    console.log(`Found ${claudeHistories.length} Claude Code chat histories.`);

    // Read Cursor histories (with timestamp filtering and authenticated session for heuristic timestamps)
    const cursorConversations = await readCursorHistories(lookbackDays, accessToken, refreshToken, useIncrementalSync ? lastSyncTime : undefined);
    const cursorHistories = convertCursorToStandardFormat(cursorConversations);
    console.log(`Found ${cursorHistories.length} Cursor chat histories.`);

    // Retry any previously failed syncs
    const failedSyncs = db.getFailedSyncsForRetry();
    if (failedSyncs.length > 0) {
      console.log(`Retrying ${failedSyncs.length} previously failed syncs...`);
    }

    // Extract and merge projects from both Claude Code and Cursor
    const claudeCodeProjects = extractProjectsFromClaudeCodeHistories(claudeHistories);
    const cursorProjects = extractProjectsFromConversations(cursorConversations);
    const allProjects = mergeProjects(cursorProjects, claudeCodeProjects);

    if (allProjects.length > 0) {
      await syncProjects(allProjects, accountId, accessToken, refreshToken);
    }

    // Combine all histories
    const allHistories = [...claudeHistories, ...cursorHistories];

    if (allHistories.length === 0 && failedSyncs.length === 0) {
      console.log('No new chat histories found and no failed syncs to retry.');
      db.completeSyncSuccess(0, 0);
      return;
    }

    console.log(`Total: ${allHistories.length} chat histories to sync.`);
    const uploadResult = await uploadAllHistories(allHistories, accountId, accessToken, refreshToken, failedSyncs);
    console.log('Upload complete.');

    // Mark sync as completed successfully
    db.completeSyncSuccess(uploadResult.successCount, uploadResult.failureCount);

    // Clean up old failed syncs (older than 7 days)
    db.clearOldFailedSyncs();
  } catch (error) {
    console.error('Error during sync:', error);
    db.completeSyncError(error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function main() {
  console.log('Agent Orchestrator Daemon Starting...');
  console.log('Running in background watch mode...');

  // Initialize auth manager
  authManager = new AuthManager();

  // Check authentication status on startup
  const alreadyAuthenticated = await authManager.isAuthenticated();
  if (alreadyAuthenticated) {
    console.log('✓ Using existing authentication session');
  }

  // Set up periodic token refresh (every 30 minutes)
  // This ensures the session stays alive even during long-running daemon processes
  setInterval(async () => {
    const stillAuthenticated = await authManager.isAuthenticated();
    if (stillAuthenticated) {
      console.log('[Auth] Token refreshed successfully');
    } else {
      console.log('[Auth] Token refresh failed - authentication required');
    }
  }, 30 * 60 * 1000); // 30 minutes

  // Process immediately on startup
  await processHistories();

  // Set up periodic session data sync
  // Get sync interval from environment variable (default: 10 minutes)
  const syncIntervalMs = parseInt(process.env.PERIODIC_SYNC_INTERVAL_MS || '600000', 10);
  console.log(`Setting up periodic session sync (every ${syncIntervalMs}ms / ${syncIntervalMs / 1000}s)...`);

  setInterval(async () => {
    console.log('\n[Periodic Sync] Checking for new session data...');
    await processHistories();
  }, syncIntervalMs);

  // Start periodic AI summary and keyword updaters (every 5 minutes)
  // Note: These will automatically use fallback mode if OPENAI_API_KEY is not set
  console.log('Starting AI summary, keyword, and title updaters (run every 5 minutes)...');

  // Function to run AI updaters with proper authentication
  const runAIUpdaters = async () => {
    // Check authentication before running updaters
    const authenticated = await authManager.isAuthenticated();
    if (!authenticated) {
      console.log('[AI Updaters] Not authenticated, skipping update');
      return;
    }

    const accessToken = authManager.getAccessToken();
    const refreshToken = authManager.getRefreshToken();

    if (!accessToken || !refreshToken) {
      console.log('[AI Updaters] No tokens available, skipping update');
      return;
    }

    await runPeriodicSummaryUpdate(accessToken, refreshToken);
    await runPeriodicKeywordUpdate(accessToken, refreshToken);
    await runPeriodicTitleUpdate(accessToken, refreshToken);
  };

  // Run immediately on startup
  await runAIUpdaters();

  // Then run every 5 minutes
  setInterval(runAIUpdaters, 5 * 60 * 1000); // 5 minutes

  console.log('Daemon is running. Press Ctrl+C to stop.');

  // Keep the process alive
  process.on('SIGINT', () => {
    console.log('\nShutting down daemon...');
    process.exit(0);
  });
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
