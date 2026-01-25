/**
 * Test script for IChatHistoryProvider implementation
 *
 * Run with: npx tsx scripts/test-chat-history.ts
 */
import { ClaudeCodeAgent } from '../src/main/services/coding-agent/implementations/ClaudeCodeAgent';

async function main() {
  console.log('Testing IChatHistoryProvider for ClaudeCodeAgent...\n');

  const agent = new ClaudeCodeAgent({});

  // Initialize the agent
  const initResult = await agent.initialize();
  if (!initResult.success) {
    console.log('Note: Agent init returned:', initResult.error?.message);
    console.log('(This is expected if claude CLI is not in PATH)\n');
  }

  // Get data paths
  console.log('Data paths:', agent.getDataPaths());
  console.log('');

  // List session summaries
  console.log('Fetching session summaries (last 7 days)...\n');
  const summariesResult = await agent.listSessionSummaries({ lookbackDays: 7 });

  if (!summariesResult.success) {
    console.error('Failed to list sessions:', summariesResult.error?.message);
    return;
  }

  const summaries = summariesResult.data;
  console.log(`Found ${summaries.length} sessions\n`);

  if (summaries.length === 0) {
    console.log(
      'No sessions found. Make sure you have Claude Code sessions in ~/.claude/projects/'
    );
    return;
  }

  // Show summaries table
  console.log('Most recent sessions:');
  console.log('-'.repeat(100));
  for (const summary of summaries.slice(0, 5)) {
    console.log(`ID: ${summary.id.substring(0, 8)}...`);
    console.log(`  Project: ${summary.projectName || summary.projectPath}`);
    console.log(
      `  Messages: ${summary.messageCount}, Tools: ${summary.toolCallCount}, Thinking: ${summary.hasThinking}`
    );
    console.log(`  Updated: ${summary.updatedAt}`);
    console.log(`  First user msg: ${(summary.firstUserMessage || '(none)').substring(0, 60)}...`);
    console.log('-'.repeat(100));
  }

  // Get the most recent session
  const mostRecent = summaries[0];
  console.log(`\nFetching full content for most recent session: ${mostRecent.id}\n`);

  const sessionResult = await agent.getSession(mostRecent.id);
  if (!sessionResult.success || !sessionResult.data) {
    console.error('Failed to get session:', sessionResult.error?.message);
    return;
  }

  const session = sessionResult.data;
  console.log('Session details:');
  console.log(`  ID: ${session.id}`);
  console.log(`  Project: ${session.projectPath}`);
  console.log(`  Total messages: ${session.messages.length}`);
  console.log('');

  // Show first message
  const firstUserMsg = session.messages.find((m) => m.messageType === 'user');
  if (firstUserMsg) {
    console.log('='.repeat(80));
    console.log('FIRST USER MESSAGE:');
    console.log('='.repeat(80));
    console.log(`Timestamp: ${firstUserMsg.timestamp}`);
    console.log(`Type: ${firstUserMsg.messageType}`);
    console.log('Content:');
    console.log(firstUserMsg.content.substring(0, 500));
    if (firstUserMsg.content.length > 500) console.log('...(truncated)');
    console.log('');
  }

  // Show last message (reverse find for assistant message)
  const lastAssistantMsg = [...session.messages]
    .reverse()
    .find((m) => m.messageType === 'assistant');
  if (lastAssistantMsg) {
    console.log('='.repeat(80));
    console.log('LAST ASSISTANT MESSAGE:');
    console.log('='.repeat(80));
    console.log(`Timestamp: ${lastAssistantMsg.timestamp}`);
    console.log(`Type: ${lastAssistantMsg.messageType}`);
    console.log('Content:');
    console.log(lastAssistantMsg.content.substring(0, 500));
    if (lastAssistantMsg.content.length > 500) console.log('...(truncated)');
    console.log('');
  }

  // Show message type distribution
  const typeDistribution: Record<string, number> = {};
  for (const msg of session.messages) {
    const type = msg.messageType || 'unknown';
    typeDistribution[type] = (typeDistribution[type] || 0) + 1;
  }

  console.log('='.repeat(80));
  console.log('MESSAGE TYPE DISTRIBUTION:');
  console.log('='.repeat(80));
  for (const [type, count] of Object.entries(typeDistribution)) {
    console.log(`  ${type}: ${count}`);
  }

  console.log('\n✓ Test completed successfully!');
}

main().catch(console.error);
