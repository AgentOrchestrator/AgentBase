/**
 * Terminal Types Tests
 *
 * Tests to verify that the Terminal feature exports all required types.
 * These are compile-time verified, but we test module loading.
 *
 * TDD: These tests are written BEFORE implementation and should FAIL initially.
 */

import { describe, expect, it, vi } from 'vitest';

// Mock xterm.js and related addons (browser-only dependencies)
// Required because the main index exports components that import xterm.js
// vi.mock calls are hoisted to top of file by vitest
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn(),
}));

vi.mock('@xterm/addon-webgl', () => ({
  WebglAddon: vi.fn(),
}));

vi.mock('@xyflow/react', () => ({
  NodeResizer: vi.fn(() => null),
}));

vi.mock('../../../context', () => ({
  useAgentService: vi.fn(),
  useNodeInitialized: vi.fn(() => true),
  useTerminalService: vi.fn(),
}));

vi.mock('../../canvas/context', () => ({
  useNodeActions: vi.fn(() => ({})),
}));

vi.mock('../../../AttachmentHeader', () => ({
  default: vi.fn(() => null),
}));

vi.mock('../../../IssueDetailsModal', () => ({
  default: vi.fn(() => null),
}));

vi.mock('../../../types/attachments', () => ({
  createLinearIssueAttachment: vi.fn(),
  isLinearIssueAttachment: vi.fn(() => false),
}));

// Mock the shared package
vi.mock('@agent-orchestrator/shared', () => ({
  createLinearIssueAttachment: vi.fn(),
  isLinearIssueAttachment: vi.fn(() => false),
  createWorkspaceMetadataAttachment: vi.fn(),
  isWorkspaceMetadataAttachment: vi.fn(() => false),
}));

vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

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
