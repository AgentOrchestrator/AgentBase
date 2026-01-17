/**
 * Tests for default implementations
 */

import { describe, expect, it } from 'vitest';
import type { CodingAgentState } from '../../../../types/coding-agent-status';
import { InMemoryPersistence } from '../defaults/CanvasDatabasePersistence';
import { SimpleSummaryComputer } from '../defaults/SimpleSummaryComputer';
import { SimpleTitleComputer } from '../defaults/SimpleTitleComputer';

// =============================================================================
// SimpleTitleComputer Tests
// =============================================================================

describe('SimpleTitleComputer', () => {
  const computer = new SimpleTitleComputer();

  it('should return default title for empty messages', async () => {
    const title = await computer.computeTitle([]);
    expect(title).toBe('Untitled Session');
  });

  it('should return default title for empty first message', async () => {
    const title = await computer.computeTitle(['', 'second message']);
    expect(title).toBe('Untitled Session');
  });

  it('should extract title from first message', async () => {
    const title = await computer.computeTitle(['Fix the authentication bug']);
    expect(title).toBe('Fix the authentication bug');
  });

  it('should capitalize first letter', async () => {
    const title = await computer.computeTitle(['fix the bug']);
    expect(title).toBe('Fix the bug');
  });

  it('should truncate long messages at word boundary', async () => {
    const longMessage =
      'This is a very long message that should be truncated at a word boundary to keep the title reasonable';
    const title = await computer.computeTitle([longMessage]);

    expect(title.length).toBeLessThanOrEqual(53); // 50 + "..."
    expect(title.endsWith('...')).toBe(true);
  });

  it('should remove common prefixes', async () => {
    expect(await computer.computeTitle(['Hey, fix the bug'])).toBe('Fix the bug');
    // "Please" is removed, then "help me" is also removed (both are common prefixes)
    expect(await computer.computeTitle(['Please help me with this'])).toBe('With this');
    expect(await computer.computeTitle(['Can you refactor this code'])).toBe('Refactor this code');
    expect(await computer.computeTitle(['Help me understand the error'])).toBe(
      'Understand the error'
    );
  });

  it('should handle messages with only prefix', async () => {
    const title = await computer.computeTitle(['Hey']);
    // After removing "Hey", empty string -> capitalize empty -> still valid
    expect(title).toBeDefined();
  });
});

// =============================================================================
// SimpleSummaryComputer Tests
// =============================================================================

describe('SimpleSummaryComputer', () => {
  const computer = new SimpleSummaryComputer();

  it('should return default summary for empty messages', async () => {
    const summary = await computer.computeSummary([]);
    expect(summary).toBe('No task description available.');
  });

  it('should create summary from single message', async () => {
    const summary = await computer.computeSummary(['Fix the bug in auth']);
    expect(summary).toBe('Fix the bug in auth');
  });

  it('should combine multiple messages with separator', async () => {
    const summary = await computer.computeSummary([
      'First message',
      'Second message',
      'Third message',
    ]);
    expect(summary).toBe('First message | Second message | Third message');
  });

  it('should only use first 3 messages', async () => {
    const summary = await computer.computeSummary(['One', 'Two', 'Three', 'Four', 'Five']);
    expect(summary).toBe('One | Two | Three');
    expect(summary).not.toContain('Four');
  });

  it('should replace code blocks with [code] placeholder', async () => {
    const summary = await computer.computeSummary([
      'Check this code:\n```javascript\nconst x = 1;\n```',
    ]);
    expect(summary).toContain('[code]');
    expect(summary).not.toContain('const x = 1');
  });

  it('should replace inline code with [code] placeholder', async () => {
    const summary = await computer.computeSummary(['The variable `myVar` is undefined']);
    expect(summary).toContain('[code]');
    expect(summary).not.toContain('myVar');
  });

  it('should truncate long summaries', async () => {
    const longMessages = [
      'This is a fairly long message that contains a lot of text and information about what the user wants to accomplish with their coding task.',
      'Here is another long message that adds even more context to the request and provides additional details about the implementation.',
      'And a third message that continues to describe the requirements in great detail with many specific instructions.',
    ];
    const summary = await computer.computeSummary(longMessages);

    expect(summary.length).toBeLessThanOrEqual(203); // 200 + "..."
  });

  it('should filter out empty messages', async () => {
    const summary = await computer.computeSummary(['Hello', '', 'World']);
    expect(summary).toBe('Hello | World');
  });
});

// =============================================================================
// InMemoryPersistence Tests
// =============================================================================

describe('InMemoryPersistence', () => {
  const createTestState = (agentId: string): CodingAgentState => ({
    agentId,
    agentType: 'claude_code',
    statusInfo: {
      status: 'idle',
      startedAt: Date.now(),
    },
    title: {
      value: 'Test Session',
      isManuallySet: false,
    },
    summary: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  it('should save and load state', async () => {
    const persistence = new InMemoryPersistence();
    const state = createTestState('agent-1');

    await persistence.save(state);
    const loaded = await persistence.load('agent-1');

    expect(loaded).not.toBeNull();
    expect(loaded?.agentId).toBe('agent-1');
  });

  it('should return null for non-existent agent', async () => {
    const persistence = new InMemoryPersistence();
    const loaded = await persistence.load('non-existent');
    expect(loaded).toBeNull();
  });

  it('should delete state', async () => {
    const persistence = new InMemoryPersistence();
    const state = createTestState('agent-1');

    await persistence.save(state);
    expect(await persistence.load('agent-1')).not.toBeNull();

    await persistence.delete('agent-1');
    expect(await persistence.load('agent-1')).toBeNull();
  });

  it('should load all states', async () => {
    const persistence = new InMemoryPersistence();

    await persistence.save(createTestState('agent-1'));
    await persistence.save(createTestState('agent-2'));
    await persistence.save(createTestState('agent-3'));

    const all = await persistence.loadAll();
    expect(all).toHaveLength(3);
  });

  it('should return defensive copies', async () => {
    const persistence = new InMemoryPersistence();
    const state = createTestState('agent-1');

    await persistence.save(state);

    const loaded1 = await persistence.load('agent-1');
    const loaded2 = await persistence.load('agent-1');

    expect(loaded1).not.toBe(loaded2);
    expect(loaded1).toEqual(loaded2);
  });

  it('should update existing state on save', async () => {
    const persistence = new InMemoryPersistence();

    const state1 = createTestState('agent-1');
    state1.title.value = 'First Title';
    await persistence.save(state1);

    const state2 = createTestState('agent-1');
    state2.title.value = 'Updated Title';
    await persistence.save(state2);

    const loaded = await persistence.load('agent-1');
    expect(loaded?.title.value).toBe('Updated Title');

    // Should only have one entry
    const all = await persistence.loadAll();
    expect(all).toHaveLength(1);
  });
});
