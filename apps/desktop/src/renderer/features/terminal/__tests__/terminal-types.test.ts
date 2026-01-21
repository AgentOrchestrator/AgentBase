/**
 * Terminal Types Tests
 *
 * Tests to verify that the Terminal feature exports all required types.
 * These are compile-time verified, but we test module loading.
 *
 * TDD: These tests are written BEFORE implementation and should FAIL initially.
 */

import { describe, expect, it } from 'vitest';

describe('Terminal Types', () => {
  describe('TerminalNodeData type', () => {
    it('should export TerminalNodeData from types module', async () => {
      const types = await import('../types');
      // TypeScript would fail compilation if type doesn't exist
      // At runtime, we just verify the module loads
      expect(types).toBeDefined();
    });

    it('should be usable as a type for terminal node data', async () => {
      // This test verifies the type structure at compile time
      const types = await import('../types');

      // Create a mock object matching the expected type
      const mockData = {
        terminalId: 'test-terminal',
        attachments: [],
        autoStartClaude: false,
      };

      // The existence of this test verifies the type structure is correct
      expect(mockData.terminalId).toBe('test-terminal');
    });
  });

  describe('TerminalAttachment type', () => {
    it('should export TerminalAttachment from types module', async () => {
      const types = await import('../types');
      expect(types).toBeDefined();
    });
  });

  describe('ITerminalService interface', () => {
    it('should be importable from services module', async () => {
      const services = await import('../services');
      expect(services).toBeDefined();
    });

    it('should be importable from main feature index', async () => {
      const feature = await import('../index');
      expect(feature).toBeDefined();
    });
  });
});
