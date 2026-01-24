/**
 * Acceptance Tests: Orchestrator Persistence Layer
 *
 * TDD: These tests define the contract for orchestrator conversation persistence.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ToolCall } from '../../services/orchestrator/interfaces';
import type { IDatabase } from '../IDatabase';
import { SQLiteDatabase } from '../SQLiteDatabase';

let db: IDatabase;

describe('Orchestrator Persistence', () => {
  beforeEach(async () => {
    db = new SQLiteDatabase(':memory:');
    await db.initialize();
  });

  afterEach(() => {
    db?.close();
  });

  describe('Conversation CRUD', () => {
    it('creates conversation with UUID', async () => {
      const conv = await db.createOrchestratorConversation();

      expect(conv.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(conv.createdAt).toBeTypeOf('number');
      expect(conv.updatedAt).toBeTypeOf('number');
    });

    it('retrieves conversation by ID', async () => {
      const created = await db.createOrchestratorConversation();
      const retrieved = await db.getOrchestratorConversation(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
    });

    it('returns null for non-existent conversation', async () => {
      const result = await db.getOrchestratorConversation('non-existent-id');

      expect(result).toBeNull();
    });

    it('restores most recent conversation', async () => {
      // Create multiple conversations with different timestamps
      await db.createOrchestratorConversation();

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const conv2 = await db.createOrchestratorConversation();

      const recent = await db.getMostRecentOrchestratorConversation();

      expect(recent).not.toBeNull();
      expect(recent?.id).toBe(conv2.id);
    });

    it('returns null when no conversations exist', async () => {
      const recent = await db.getMostRecentOrchestratorConversation();

      expect(recent).toBeNull();
    });
  });

  describe('Message CRUD', () => {
    it('adds user message to conversation', async () => {
      const conv = await db.createOrchestratorConversation();

      await db.addOrchestratorMessage({
        conversationId: conv.id,
        role: 'user',
        content: 'Hello, orchestrator!',
        timestamp: Date.now(),
      });

      const messages = await db.getOrchestratorMessages(conv.id);

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('Hello, orchestrator!');
    });

    it('adds assistant message with tool calls', async () => {
      const conv = await db.createOrchestratorConversation();
      const toolCalls: ToolCall[] = [
        {
          id: 'tool-1',
          name: 'canvas/create_agent',
          input: { workspacePath: '/path/to/project' },
          result: { agentId: 'agent-123' },
        },
      ];

      await db.addOrchestratorMessage({
        conversationId: conv.id,
        role: 'assistant',
        content: 'Creating agent...',
        timestamp: Date.now(),
        toolCalls,
      });

      const messages = await db.getOrchestratorMessages(conv.id);

      expect(messages).toHaveLength(1);
      expect(messages[0].toolCalls).toHaveLength(1);
      expect(messages[0].toolCalls?.[0].name).toBe('canvas/create_agent');
      expect(messages[0].toolCalls?.[0].result).toEqual({ agentId: 'agent-123' });
    });

    it('preserves message order (chronological)', async () => {
      const conv = await db.createOrchestratorConversation();

      await db.addOrchestratorMessage({
        conversationId: conv.id,
        role: 'user',
        content: 'First message',
        timestamp: 1000,
      });

      await db.addOrchestratorMessage({
        conversationId: conv.id,
        role: 'assistant',
        content: 'Second message',
        timestamp: 2000,
      });

      await db.addOrchestratorMessage({
        conversationId: conv.id,
        role: 'user',
        content: 'Third message',
        timestamp: 3000,
      });

      const messages = await db.getOrchestratorMessages(conv.id);

      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('First message');
      expect(messages[1].content).toBe('Second message');
      expect(messages[2].content).toBe('Third message');
    });

    it('returns empty array for conversation with no messages', async () => {
      const conv = await db.createOrchestratorConversation();
      const messages = await db.getOrchestratorMessages(conv.id);

      expect(messages).toEqual([]);
    });

    it('generates unique message IDs', async () => {
      const conv = await db.createOrchestratorConversation();

      await db.addOrchestratorMessage({
        conversationId: conv.id,
        role: 'user',
        content: 'Message 1',
        timestamp: Date.now(),
      });

      await db.addOrchestratorMessage({
        conversationId: conv.id,
        role: 'user',
        content: 'Message 2',
        timestamp: Date.now(),
      });

      const messages = await db.getOrchestratorMessages(conv.id);

      expect(messages[0].id).not.toBe(messages[1].id);
      expect(messages[0].id).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('Conversation Updates', () => {
    it('updates conversation updatedAt when message added', async () => {
      const conv = await db.createOrchestratorConversation();
      const initialUpdatedAt = conv.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      await db.addOrchestratorMessage({
        conversationId: conv.id,
        role: 'user',
        content: 'New message',
        timestamp: Date.now(),
      });

      const updated = await db.getOrchestratorConversation(conv.id);

      expect(updated?.updatedAt).toBeGreaterThan(initialUpdatedAt);
    });
  });

  describe('Data Integrity', () => {
    it('cascades delete messages when conversation deleted', async () => {
      const conv = await db.createOrchestratorConversation();

      await db.addOrchestratorMessage({
        conversationId: conv.id,
        role: 'user',
        content: 'Test message',
        timestamp: Date.now(),
      });

      await db.deleteOrchestratorConversation(conv.id);

      const messages = await db.getOrchestratorMessages(conv.id);
      expect(messages).toEqual([]);
    });
  });
});
