/**
 * Test script for ProviderRegistry
 *
 * Run with: npx tsx scripts/test-registry.ts
 */
import { createDefaultRegistry } from '../src/main/services/coding-agent/registry';

async function main() {
  console.log('Testing ProviderRegistry...\n');

  // Create registry with default providers
  const registry = await createDefaultRegistry();

  // Show status
  const status = registry.getStatus();
  console.log('Registry status:');
  console.log(`  Registered providers: ${status.registered}`);
  for (const p of status.providers) {
    console.log(`  - ${p.agentType}: ${p.dataPaths.join(', ')}`);
  }
  console.log('');

  // Test: List all sessions (aggregated)
  console.log('Listing all sessions (last 1 day)...\n');
  const allResult = await registry.listSessionSummaries({ lookbackDays: 1 });

  if (!allResult.success) {
    console.error('Failed:', allResult.error?.message);
    return;
  }

  console.log(`Found ${allResult.data.length} sessions across all providers\n`);

  // Show top 5 sessions
  console.log('Top 5 sessions:');
  console.log('-'.repeat(80));
  for (const session of allResult.data.slice(0, 5)) {
    console.log(`[${session.agentType}] ${session.id.substring(0, 8)}...`);
    console.log(`  Project: ${session.projectName}`);
    console.log(`  Messages: ${session.messageCount}, Tools: ${session.toolCallCount}`);
    console.log(`  Timestamp: ${session.timestamp}`);
    console.log('-'.repeat(80));
  }

  // Test: Query specific provider
  console.log('\nQuerying claude_code specifically...');
  const claudeResult = await registry.listSessionSummaries({
    agent: 'claude_code',
    lookbackDays: 1,
  });

  if (claudeResult.success) {
    console.log(`Found ${claudeResult.data.length} Claude Code sessions\n`);
  }

  // Test: Get session by ID
  if (allResult.data.length > 0) {
    const firstSession = allResult.data[0];
    console.log(`Fetching full session: ${firstSession.id}...`);

    const sessionResult = await registry.getSession(firstSession.id);
    if (sessionResult.success && sessionResult.data) {
      console.log(`  Messages: ${sessionResult.data.messages.length}`);
      console.log(`  Project: ${sessionResult.data.projectPath}`);
    }
  }

  // Test: Get modification times
  console.log('\nGetting modification times...');
  const modTimesResult = await registry.getSessionModificationTimes({ lookbackDays: 1 });
  if (modTimesResult.success) {
    console.log(`  Sessions tracked: ${modTimesResult.data.size}`);
  }

  console.log('\n✓ Registry test completed successfully!');
}

main().catch(console.error);
