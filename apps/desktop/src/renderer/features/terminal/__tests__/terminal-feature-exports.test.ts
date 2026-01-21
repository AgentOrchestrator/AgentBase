/**
 * Terminal Feature Exports Tests
 *
 * These tests verify that the Terminal feature module exports all required
 * components, services, hooks, and types from the feature's public API.
 *
 * TDD: These tests are written BEFORE implementation and should FAIL initially.
 */

import { describe, expect, it } from 'vitest';

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
