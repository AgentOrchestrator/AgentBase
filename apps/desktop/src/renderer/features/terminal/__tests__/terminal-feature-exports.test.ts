/**
 * Terminal Feature Exports Tests
 *
 * These tests verify that the Terminal feature module exports all required
 * components, services, hooks, and types from the feature's public API.
 *
 * TDD: These tests are written BEFORE implementation and should FAIL initially.
 */

import { describe, expect, it, vi } from 'vitest';

// Mock xterm.js and related addons (browser-only dependencies)
// vi.mock calls are hoisted to top of file by vitest
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    loadAddon: vi.fn(),
    open: vi.fn(),
    focus: vi.fn(),
    dispose: vi.fn(),
    onData: vi.fn(),
    onSelectionChange: vi.fn(),
    write: vi.fn(),
    writeln: vi.fn(),
    getSelection: vi.fn(() => ''),
    hasSelection: vi.fn(() => false),
    clearSelection: vi.fn(),
    buffer: { active: { baseY: 0, length: 0, cursorX: 0, cursorY: 0 } },
  })),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn(),
    proposeDimensions: vi.fn(() => ({ cols: 80, rows: 24 })),
  })),
}));

vi.mock('@xterm/addon-webgl', () => ({
  WebglAddon: vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
  })),
}));

vi.mock('@xyflow/react', () => ({
  NodeResizer: vi.fn(() => null),
}));

// Mock context hooks
vi.mock('../../../context', () => ({
  useAgentService: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
  useNodeInitialized: vi.fn(() => true),
  useTerminalService: vi.fn(() => ({
    create: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    sendUserInput: vi.fn(),
    onData: vi.fn(() => vi.fn()),
    onExit: vi.fn(() => vi.fn()),
    resize: vi.fn(),
    getBuffer: vi.fn().mockResolvedValue(null),
    terminalId: 'test-terminal',
  })),
}));

// Mock other dependencies
vi.mock('../../canvas/context', () => ({
  useNodeActions: vi.fn(() => ({
    updateAttachments: vi.fn(),
  })),
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

// Mock the xterm CSS import
vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

describe('Terminal Feature Exports', () => {
  describe('Main feature index exports', () => {
    it('should export TerminalNode component', async () => {
      const terminalFeature = await import('../index');
      expect(terminalFeature.TerminalNode).toBeDefined();
      expect(typeof terminalFeature.TerminalNode).toBe('function');
    });

    it('should export AgentTerminalView component', async () => {
      const terminalFeature = await import('../index');
      expect(terminalFeature.AgentTerminalView).toBeDefined();
      expect(typeof terminalFeature.AgentTerminalView).toBe('function');
    });

    it('should export ITerminalService interface type', async () => {
      // Type exports are verified at compile time, but we can check the module loads
      const terminalFeature = await import('../index');
      expect(terminalFeature).toBeDefined();
    });

    it('should export TerminalServiceImpl class', async () => {
      const terminalFeature = await import('../index');
      expect(terminalFeature.TerminalServiceImpl).toBeDefined();
      expect(typeof terminalFeature.TerminalServiceImpl).toBe('function');
    });

    it('should export terminal types', async () => {
      const terminalFeature = await import('../index');
      // Type exports are compile-time, but we verify the module structure
      expect(terminalFeature).toBeDefined();
    });
  });

  describe('Components sub-module exports', () => {
    it('should export TerminalNode from components', async () => {
      const components = await import('../components');
      expect(components.TerminalNode).toBeDefined();
    });

    it('should export AgentTerminalView from components', async () => {
      const components = await import('../components');
      expect(components.AgentTerminalView).toBeDefined();
    });
  });

  describe('Services sub-module exports', () => {
    it('should export TerminalServiceImpl from services', async () => {
      const services = await import('../services');
      expect(services.TerminalServiceImpl).toBeDefined();
    });

    it('should export ITerminalService type from services', async () => {
      // Type-only exports verified at compile time
      const services = await import('../services');
      expect(services).toBeDefined();
    });
  });

  describe('Types sub-module exports', () => {
    it('should export TerminalNodeData type from types', async () => {
      // Type exports are compile-time verified
      const types = await import('../types');
      expect(types).toBeDefined();
    });
  });
});
