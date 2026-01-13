/**
 * Test script to verify terminal IPC handlers work correctly
 * Run with: node apps/desktop/test-terminal-ipc.js
 */

// Mock Electron IPC
const terminalProcesses = new Map();
const terminalsBeingCreated = new Set();
const terminalCreationTimes = new Map();

function simulateTerminalCreate(terminalId) {
  const callTime = Date.now();
  const lastCreationTime = terminalCreationTimes.get(terminalId);
  const timeSinceLastCreation = lastCreationTime ? callTime - lastCreationTime : null;
  
  console.log('\n[Test] terminal-create called', { 
    terminalId, 
    timeSinceLastCreation: timeSinceLastCreation ? `${timeSinceLastCreation}ms` : 'never',
    existingInMap: terminalProcesses.has(terminalId),
    beingCreated: terminalsBeingCreated.has(terminalId)
  });

  // If terminal already exists, skip creation
  const existingProcess = terminalProcesses.get(terminalId);
  if (existingProcess) {
    console.log('[Test] ⚠️ Terminal already exists, skipping');
    return { skipped: true, reason: 'already exists' };
  }

  // If terminal is currently being created, skip
  if (terminalsBeingCreated.has(terminalId)) {
    console.log('[Test] ⚠️ Terminal is already being created, skipping');
    return { skipped: true, reason: 'being created' };
  }

  // Mark as being created
  terminalsBeingCreated.add(terminalId);
  terminalCreationTimes.set(terminalId, callTime);

  // Simulate process creation
  const mockProcess = { id: terminalId, createdAt: callTime };
  terminalProcesses.set(terminalId, mockProcess);
  terminalsBeingCreated.delete(terminalId);

  console.log('[Test] ✅ Terminal created successfully');
  return { created: true, process: mockProcess };
}

function simulateTerminalDestroy(terminalId) {
  const destroyTime = Date.now();
  const creationTime = terminalCreationTimes.get(terminalId);
  const lifetime = creationTime ? destroyTime - creationTime : null;
  
  console.log('\n[Test] terminal-destroy called', { 
    terminalId,
    lifetime: lifetime ? `${lifetime}ms` : 'unknown',
    existsInMap: terminalProcesses.has(terminalId)
  });

  const ptyProcess = terminalProcesses.get(terminalId);
  if (ptyProcess) {
    console.log('[Test] 🗑️ Destroying terminal process');
    terminalProcesses.delete(terminalId);
    terminalsBeingCreated.delete(terminalId);
    terminalCreationTimes.delete(terminalId);
    return { destroyed: true };
  } else {
    console.log('[Test] ⚠️ Terminal destroy requested but process not found');
    return { destroyed: false, reason: 'not found' };
  }
}

// Test scenarios
console.log('=== Testing Terminal IPC Logic ===\n');

// Test 1: Normal creation
console.log('Test 1: Normal creation');
simulateTerminalCreate('terminal-1');

// Test 2: Duplicate creation (should skip)
console.log('\nTest 2: Duplicate creation');
simulateTerminalCreate('terminal-1');

// Test 3: Rapid successive calls (simulating race condition)
console.log('\nTest 3: Rapid successive calls (race condition)');
const results = [];
for (let i = 0; i < 3; i++) {
  results.push(simulateTerminalCreate('terminal-2'));
}
console.log('\nResults:', results.filter(r => r.created).length, 'created');

// Test 4: Destroy and recreate
console.log('\nTest 4: Destroy and recreate');
simulateTerminalDestroy('terminal-1');
simulateTerminalCreate('terminal-1');

// Test 5: Destroy non-existent
console.log('\nTest 5: Destroy non-existent terminal');
simulateTerminalDestroy('terminal-nonexistent');

console.log('\n=== Test Complete ===');
console.log('\nFinal state:');
console.log('  Processes:', Array.from(terminalProcesses.keys()));
console.log('  Being created:', Array.from(terminalsBeingCreated));

