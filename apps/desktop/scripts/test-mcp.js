#!/usr/bin/env node
/**
 * Simple test script to verify MCP server functionality.
 * This spawns the Electron app with --mcp flag and sends test commands.
 */

const { spawn } = require('child_process');
const path = require('path');

const electronPath = require('electron');
const appPath = path.join(__dirname, '..');

// JSON-RPC request helper
function createRequest(method, params = {}, id = 1) {
  return (
    JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id,
    }) + '\n'
  );
}

async function runTest() {
  console.log('Starting MCP server test...\n');

  // Start electron with --mcp flag
  const electron = spawn(electronPath, [appPath, '--mcp'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' },
  });

  let responseBuffer = '';
  let requestId = 1;

  // Handle stdout (MCP responses)
  electron.stdout.on('data', (data) => {
    responseBuffer += data.toString();
    // Try to parse complete JSON lines
    const lines = responseBuffer.split('\n');
    responseBuffer = lines.pop() || '';
    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line);
          console.log('Response:', JSON.stringify(response, null, 2));
        } catch (e) {
          console.log('stdout:', line);
        }
      }
    }
  });

  // Handle stderr (logs)
  electron.stderr.on('data', (data) => {
    const msg = data.toString();
    if (msg.includes('[MCP]')) {
      console.log('stderr:', msg.trim());
    }
  });

  // Wait for initialization
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Test 1: List tools
  console.log('\n--- Test 1: List tools ---');
  electron.stdin.write(createRequest('tools/list', {}, requestId++));
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Test 2: Inject a log
  console.log('\n--- Test 2: Inject log ---');
  electron.stdin.write(
    createRequest(
      'tools/call',
      {
        name: 'log_inject',
        arguments: {
          level: 'info',
          message: 'Test log message from MCP test script',
        },
      },
      requestId++
    )
  );
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Test 3: Read logs
  console.log('\n--- Test 3: Read logs ---');
  electron.stdin.write(
    createRequest(
      'tools/call',
      {
        name: 'log_read',
        arguments: {
          limit: 5,
        },
      },
      requestId++
    )
  );
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Test 4: Take screenshot
  console.log('\n--- Test 4: Screenshot ---');
  electron.stdin.write(
    createRequest(
      'tools/call',
      {
        name: 'ui_screenshot',
        arguments: {},
      },
      requestId++
    )
  );
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Cleanup
  console.log('\nTest complete. Shutting down...');
  electron.kill();
  process.exit(0);
}

runTest().catch(console.error);
