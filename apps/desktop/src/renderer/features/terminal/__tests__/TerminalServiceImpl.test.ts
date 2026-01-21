/**
 * TerminalServiceImpl Tests
 *
 * Tests for the Terminal service implementation after feature extraction.
 * Verifies the service maintains all functionality when moved to the new location.
 *
 * TDD: These tests are written BEFORE implementation and should FAIL initially.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ITerminalService } from '../services/ITerminalService';
import { TerminalServiceImpl } from '../services/TerminalServiceImpl';

// Mock the window.electronAPI
const mockElectronAPI = {
  createTerminal: vi.fn(),
  destroyTerminal: vi.fn(),
  sendTerminalInput: vi.fn(),
  sendTerminalResize: vi.fn(),
  onTerminalData: vi.fn(),
  onTerminalExit: vi.fn(),
};

// Mock the window.terminalSessionAPI
const mockTerminalSessionAPI = {
  getTerminalBuffer: vi.fn(),
  getTerminalSessionState: vi.fn(),
  setTerminalSessionState: vi.fn(),
  clearTerminalSessionState: vi.fn(),
};

describe('TerminalServiceImpl', () => {
  let service: ITerminalService;
  const nodeId = 'test-node-1';
  const terminalId = 'test-terminal-1';

  beforeEach(() => {
    // Set up window mocks
    (global as any).window = {
      electronAPI: mockElectronAPI,
      terminalSessionAPI: mockTerminalSessionAPI,
    };

    // Reset all mocks
    vi.clearAllMocks();

    // Create fresh service instance
    service = new TerminalServiceImpl(nodeId, terminalId);
  });

  afterEach(() => {
    delete (global as any).window;
  });

  describe('constructor', () => {
    it('should set nodeId correctly', () => {
      expect(service.nodeId).toBe(nodeId);
    });

    it('should set terminalId correctly', () => {
      expect(service.terminalId).toBe(terminalId);
    });
  });

  describe('initialize', () => {
    it('should register IPC data listener', async () => {
      await service.initialize();
      expect(mockElectronAPI.onTerminalData).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should register IPC exit listener', async () => {
      await service.initialize();
      expect(mockElectronAPI.onTerminalExit).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should handle missing electronAPI gracefully', async () => {
      (global as any).window.electronAPI = undefined;
      // Should not throw
      await expect(service.initialize()).resolves.not.toThrow();
    });
  });

  describe('create', () => {
    it('should call createTerminal via IPC', async () => {
      await service.create();
      expect(mockElectronAPI.createTerminal).toHaveBeenCalledWith(terminalId);
    });

    it('should mark terminal as created', async () => {
      await service.create();
      expect(service.isRunning()).toBe(true);
    });

    it('should not create duplicate terminal', async () => {
      await service.create();
      await service.create();
      expect(mockElectronAPI.createTerminal).toHaveBeenCalledTimes(1);
    });

    it('should throw if electronAPI not available', async () => {
      (global as any).window.electronAPI = undefined;
      await expect(service.create()).rejects.toThrow('electronAPI not available');
    });
  });

  describe('destroy', () => {
    it('should call destroyTerminal via IPC', async () => {
      await service.create();
      await service.destroy();
      expect(mockElectronAPI.destroyTerminal).toHaveBeenCalledWith(terminalId);
    });

    it('should mark terminal as not running', async () => {
      await service.create();
      await service.destroy();
      expect(service.isRunning()).toBe(false);
    });

    it('should not call destroyTerminal if not created', async () => {
      await service.destroy();
      expect(mockElectronAPI.destroyTerminal).not.toHaveBeenCalled();
    });
  });

  describe('restart', () => {
    it('should destroy then create terminal', async () => {
      await service.create();
      await service.restart();

      // Should have been called twice total (initial create + restart create)
      expect(mockElectronAPI.destroyTerminal).toHaveBeenCalledWith(terminalId);
      expect(mockElectronAPI.createTerminal).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendUserInput', () => {
    it('should send input to terminal via IPC', async () => {
      await service.create();
      service.sendUserInput('test input');
      expect(mockElectronAPI.sendTerminalInput).toHaveBeenCalledWith(terminalId, 'test input');
    });

    it('should not send if terminal not created', () => {
      service.sendUserInput('test input');
      expect(mockElectronAPI.sendTerminalInput).not.toHaveBeenCalled();
    });
  });

  describe('executeCommand', () => {
    it('should send command with newline', async () => {
      await service.create();
      service.executeCommand('ls -la');
      expect(mockElectronAPI.sendTerminalInput).toHaveBeenCalledWith(terminalId, 'ls -la\n');
    });

    it('should not add extra newline if already present', async () => {
      await service.create();
      service.executeCommand('echo hello\n');
      expect(mockElectronAPI.sendTerminalInput).toHaveBeenCalledWith(terminalId, 'echo hello\n');
    });
  });

  describe('sendControlSequence', () => {
    it('should send control sequence to terminal', async () => {
      await service.create();
      service.sendControlSequence('\x1bc'); // Terminal reset
      expect(mockElectronAPI.sendTerminalInput).toHaveBeenCalledWith(terminalId, '\x1bc');
    });
  });

  describe('resize', () => {
    it('should send resize to terminal via IPC', async () => {
      await service.create();
      service.resize(120, 40);
      expect(mockElectronAPI.sendTerminalResize).toHaveBeenCalledWith(terminalId, 120, 40);
    });

    it('should not resize if terminal not created', () => {
      service.resize(120, 40);
      expect(mockElectronAPI.sendTerminalResize).not.toHaveBeenCalled();
    });
  });

  describe('onData subscription', () => {
    it('should call listener when data received for this terminal', async () => {
      await service.initialize();
      const listener = vi.fn();
      service.onData(listener);

      // Simulate IPC data event
      const ipcHandler = mockElectronAPI.onTerminalData.mock.calls[0][0];
      ipcHandler({ terminalId, data: 'test output' });

      expect(listener).toHaveBeenCalledWith('test output');
    });

    it('should not call listener for different terminal', async () => {
      await service.initialize();
      const listener = vi.fn();
      service.onData(listener);

      // Simulate IPC data event for different terminal
      const ipcHandler = mockElectronAPI.onTerminalData.mock.calls[0][0];
      ipcHandler({ terminalId: 'other-terminal', data: 'test output' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should return unsubscribe function', async () => {
      await service.initialize();
      const listener = vi.fn();
      const unsubscribe = service.onData(listener);

      unsubscribe();

      // Simulate IPC data event
      const ipcHandler = mockElectronAPI.onTerminalData.mock.calls[0][0];
      ipcHandler({ terminalId, data: 'test output' });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('onExit subscription', () => {
    it('should call listener when terminal exits', async () => {
      await service.initialize();
      await service.create();
      const listener = vi.fn();
      service.onExit(listener);

      // Simulate IPC exit event
      const ipcHandler = mockElectronAPI.onTerminalExit.mock.calls[0][0];
      ipcHandler({ terminalId, code: 0, signal: undefined });

      expect(listener).toHaveBeenCalledWith(0, undefined);
    });

    it('should mark terminal as not running on exit', async () => {
      await service.initialize();
      await service.create();
      expect(service.isRunning()).toBe(true);

      // Simulate IPC exit event
      const ipcHandler = mockElectronAPI.onTerminalExit.mock.calls[0][0];
      ipcHandler({ terminalId, code: 0, signal: undefined });

      expect(service.isRunning()).toBe(false);
    });
  });

  describe('getBuffer', () => {
    it('should return buffer from IPC', async () => {
      mockTerminalSessionAPI.getTerminalBuffer.mockResolvedValue('line1\nline2\n');
      const buffer = await service.getBuffer();
      expect(buffer).toBe('line1\nline2\n');
      expect(mockTerminalSessionAPI.getTerminalBuffer).toHaveBeenCalledWith(terminalId);
    });

    it('should return null if buffer is empty', async () => {
      mockTerminalSessionAPI.getTerminalBuffer.mockResolvedValue('');
      const buffer = await service.getBuffer();
      expect(buffer).toBeNull();
    });

    it('should return null if terminalSessionAPI not available', async () => {
      (global as any).window.terminalSessionAPI = undefined;
      const buffer = await service.getBuffer();
      expect(buffer).toBeNull();
    });
  });

  describe('dispose', () => {
    it('should destroy terminal', async () => {
      await service.create();
      await service.dispose();
      expect(mockElectronAPI.destroyTerminal).toHaveBeenCalledWith(terminalId);
    });

    it('should clear all listeners', async () => {
      await service.initialize();
      const dataListener = vi.fn();
      const exitListener = vi.fn();
      service.onData(dataListener);
      service.onExit(exitListener);

      await service.dispose();

      // Simulate events - listeners should not be called
      const dataHandler = mockElectronAPI.onTerminalData.mock.calls[0][0];
      const exitHandler = mockElectronAPI.onTerminalExit.mock.calls[0][0];
      dataHandler({ terminalId, data: 'test' });
      exitHandler({ terminalId, code: 0 });

      expect(dataListener).not.toHaveBeenCalled();
      expect(exitListener).not.toHaveBeenCalled();
    });
  });

  describe('ITerminalService interface compliance', () => {
    it('should implement all required INodeService methods', () => {
      expect(typeof service.nodeId).toBe('string');
      expect(typeof service.initialize).toBe('function');
      expect(typeof service.dispose).toBe('function');
    });

    it('should implement all required ITerminalService methods', () => {
      expect(typeof service.terminalId).toBe('string');
      expect(typeof service.create).toBe('function');
      expect(typeof service.destroy).toBe('function');
      expect(typeof service.restart).toBe('function');
      expect(typeof service.sendUserInput).toBe('function');
      expect(typeof service.executeCommand).toBe('function');
      expect(typeof service.sendControlSequence).toBe('function');
      expect(typeof service.resize).toBe('function');
      expect(typeof service.onData).toBe('function');
      expect(typeof service.onExit).toBe('function');
      expect(typeof service.isRunning).toBe('function');
      expect(typeof service.getBuffer).toBe('function');
    });
  });
});
