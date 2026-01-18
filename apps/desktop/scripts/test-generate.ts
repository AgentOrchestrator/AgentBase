/**
 * Test script for agent.generate() functionality
 *
 * Run with: npx tsx scripts/test-generate.ts
 */

import * as os from 'node:os';
import * as path from 'node:path';
import { ClaudeCodeAgent } from '../src/main/services/coding-agent/implementations/ClaudeCodeAgent';

async function main() {
  console.log('Testing agent.generate()...\n');

  // Use the common Claude Code CLI location (shell aliases don't work in child processes)
  const executablePath = path.join(os.homedir(), '.claude', 'local', 'claude');

  const agent = new ClaudeCodeAgent({ executablePath });

  // Initialize the agent
  console.log('Initializing agent...');
  const initResult = await agent.initialize();
  if (!initResult.success) {
    console.error('Failed to initialize agent:', initResult.error?.message);
    console.log('(Make sure claude CLI is installed and in PATH)');
    return;
  }
  console.log('Agent initialized successfully!\n');

  // Check capabilities
  const capabilities = agent.getCapabilities();
  console.log('Agent capabilities:');
  console.log(`  canGenerate: ${capabilities.canGenerate}`);
  console.log(`  supportsStreaming: ${capabilities.supportsStreaming}`);
  console.log('');

  // Test generate() with a simple prompt
  console.log('Calling agent.generate()...');
  console.log('-'.repeat(60));

  const result = await agent.generate({
    prompt: 'Say "Hello from agent.generate()!" and nothing else.',
    timeout: 30000,
  });

  if (!result.success) {
    console.error('Generate failed:', result.error?.message);
    return;
  }

  console.log('Response:');
  console.log(result.data.content);
  console.log('-'.repeat(60));
  console.log('');
  console.log('Response metadata:');
  console.log(`  messageId: ${result.data.messageId}`);
  console.log(`  timestamp: ${result.data.timestamp}`);
  if (result.data.sessionId) {
    console.log(`  sessionId: ${result.data.sessionId}`);
  }

  console.log('\n✓ agent.generate() test completed successfully!');
}

main().catch(console.error);
