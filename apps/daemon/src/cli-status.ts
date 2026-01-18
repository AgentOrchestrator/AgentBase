#!/usr/bin/env node
import { getDatabase } from './database.js';

/**
 * CLI utility to check daemon sync status
 * Usage: npm run status
 */
function main() {
  console.log('Agent Orchestrator Daemon - Sync Status\n');
  console.log('='.repeat(50));

  const db = getDatabase();
  const syncState = db.getSyncState();
  const failedSyncs = db.getFailedSyncs();

  if (!syncState) {
    console.log('❌ No sync state found (daemon has never run)');
    return;
  }

  // Sync status
  const statusEmoji =
    {
      idle: '✅',
      syncing: '🔄',
      error: '❌',
    }[syncState.sync_status] || '❓';

  console.log(`\n📊 Sync Status: ${statusEmoji} ${syncState.sync_status.toUpperCase()}`);

  // Last successful sync
  if (syncState.last_sync_completed_at > 0) {
    const lastSync = new Date(syncState.last_sync_completed_at);
    const timeSince = Date.now() - syncState.last_sync_completed_at;
    const minutesAgo = Math.floor(timeSince / 1000 / 60);
    const hoursAgo = Math.floor(minutesAgo / 60);
    const daysAgo = Math.floor(hoursAgo / 24);

    let timeAgoStr = '';
    if (daysAgo > 0) {
      timeAgoStr = `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`;
    } else if (hoursAgo > 0) {
      timeAgoStr = `${hoursAgo} hour${hoursAgo > 1 ? 's' : ''} ago`;
    } else if (minutesAgo > 0) {
      timeAgoStr = `${minutesAgo} minute${minutesAgo > 1 ? 's' : ''} ago`;
    } else {
      timeAgoStr = 'just now';
    }

    console.log(`\n🕐 Last Successful Sync:`);
    console.log(`   ${lastSync.toLocaleString()} (${timeAgoStr})`);
    console.log(`\n📈 Last Sync Results:`);
    console.log(`   ✅ Success: ${syncState.sessions_synced_count} sessions`);
    console.log(`   ❌ Failed:  ${syncState.sessions_failed_count} sessions`);
  } else {
    console.log(`\n⚠️  No successful sync yet`);
  }

  // Current/last sync started
  if (syncState.last_sync_started_at > 0) {
    const lastStarted = new Date(syncState.last_sync_started_at);
    console.log(`\n🚀 Last Sync Started:`);
    console.log(`   ${lastStarted.toLocaleString()}`);
  }

  // Error message
  if (syncState.error_message) {
    console.log(`\n❌ Last Error:`);
    console.log(`   ${syncState.error_message}`);
  }

  // Failed syncs
  if (failedSyncs.length > 0) {
    console.log(`\n⚠️  Failed Syncs (${failedSyncs.length} total):`);

    const recentFailed = failedSyncs.slice(0, 5);
    for (const failed of recentFailed) {
      const firstFailed = new Date(failed.first_failed_at);
      const source = failed.session_source
        .replace('cursor-', '')
        .replace('claude_code', 'Claude Code');
      console.log(`   • ${failed.session_id.substring(0, 8)}... [${source}]`);
      console.log(`     First failed: ${firstFailed.toLocaleString()}`);
      console.log(`     Retry count: ${failed.retry_count}`);
      console.log(`     Error: ${failed.error_message}`);
    }

    if (failedSyncs.length > 5) {
      console.log(`   ... and ${failedSyncs.length - 5} more`);
    }
  } else {
    console.log(`\n✅ No failed syncs`);
  }

  // Database info
  console.log(`\n📁 Database Location:`);
  console.log(`   ${db.getDbPath()}`);

  console.log(`\n${'='.repeat(50)}`);

  db.close();
}

main();
