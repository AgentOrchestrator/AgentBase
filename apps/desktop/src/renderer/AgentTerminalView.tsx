import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';
import './AgentTerminalView.css';

interface AgentTerminalViewProps {
  terminalId: string;
}

/**
 * Terminal theme configuration
 */
const TERMINAL_THEME = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#aeafad',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5',
};

/**
 * Agent Terminal View
 *
 * Simplified terminal component for embedding within AgentNode.
 * Handles terminal lifecycle and IPC communication with main process.
 */
export default function AgentTerminalView({ terminalId }: AgentTerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const isInitializedRef = useRef(false);
  const terminalProcessCreatedRef = useRef(false);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Guard against double initialization (React StrictMode)
    const existingXterm = terminalRef.current.querySelector('.xterm');
    if (isInitializedRef.current || existingXterm) {
      return;
    }

    isInitializedRef.current = true;

    // Create terminal instance
    const terminal = new Terminal({
      theme: TERMINAL_THEME,
      fontSize: 12,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
      cursorStyle: 'block',
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);

    // Load WebGL addon for better rendering performance
    try {
      const webglAddon = new WebglAddon();
      terminal.loadAddon(webglAddon);
    } catch (error) {
      console.warn('[AgentTerminalView] WebGL addon failed, using canvas renderer');
    }

    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Initial fit
    try {
      fitAddon.fit();
    } catch (error) {
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
        } catch (retryError) {
          console.error('[AgentTerminalView] Failed to fit terminal', retryError);
        }
      }, 100);
    }

    terminal.focus();

    // Create terminal process in main process
    if (window.electronAPI && !terminalProcessCreatedRef.current) {
      terminalProcessCreatedRef.current = true;
      window.electronAPI.createTerminal(terminalId);
    }

    // Send terminal input to main process
    terminal.onData((inputData: string) => {
      if (window.electronAPI) {
        window.electronAPI.sendTerminalInput(terminalId, inputData);
      }
    });

    // Receive terminal output from main process
    let handleTerminalData: ((data: { terminalId: string; data: string }) => void) | null =
      null;
    let handleTerminalExit:
      | ((data: { terminalId: string; code: number; signal?: number }) => void)
      | null = null;

    if (window.electronAPI) {
      handleTerminalData = ({
        terminalId: dataTerminalId,
        data: outputData,
      }: {
        terminalId: string;
        data: string;
      }) => {
        if (dataTerminalId === terminalId) {
          terminal.write(outputData);
        }
      };

      handleTerminalExit = ({
        terminalId: dataTerminalId,
        code,
        signal,
      }: {
        terminalId: string;
        code: number;
        signal?: number;
      }) => {
        if (dataTerminalId === terminalId) {
          const isImmediateExit = code === 1 && signal === 1;

          if (!isImmediateExit) {
            terminal.write(
              `\r\n\n[Process exited with code ${code}${signal ? ` and signal ${signal}` : ''}]`
            );
          }

          // Restart terminal
          if (window.electronAPI) {
            setTimeout(() => {
              terminalProcessCreatedRef.current = false;
              window.electronAPI?.createTerminal(terminalId);
              terminalProcessCreatedRef.current = true;
            }, isImmediateExit ? 1000 : 100);
          }
        }
      };

      window.electronAPI.onTerminalData(handleTerminalData);
      window.electronAPI.onTerminalExit(handleTerminalExit);
    } else {
      // Fallback when no API available
      terminal.writeln('Agent Terminal');
      terminal.write('$ ');
    }

    // Handle resize
    let resizeTimeout: NodeJS.Timeout | null = null;
    let lastResizeDimensions: { cols: number; rows: number } | null = null;

    const handleResize = () => {
      if (!fitAddonRef.current || !terminalInstanceRef.current) return;

      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }

      resizeTimeout = setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
          const dimensions = fitAddonRef.current?.proposeDimensions();
          // Validate dimensions are positive (required by node-pty)
          // This can be 0 when terminal is hidden via display:none
          if (dimensions && dimensions.cols > 0 && dimensions.rows > 0 && window.electronAPI) {
            if (
              !lastResizeDimensions ||
              lastResizeDimensions.cols !== dimensions.cols ||
              lastResizeDimensions.rows !== dimensions.rows
            ) {
              lastResizeDimensions = { cols: dimensions.cols, rows: dimensions.rows };
              window.electronAPI.sendTerminalResize(terminalId, dimensions.cols, dimensions.rows);
            }
          }
        } catch (error) {
          console.warn('[AgentTerminalView] Error handling resize', error);
        }
      }, 50);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    // Initial resize
    setTimeout(handleResize, 100);

    // Cleanup
    return () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeObserver.disconnect();

      // Only destroy terminal if it had time to run
      if (isInitializedRef.current) {
        if (window.electronAPI) {
          window.electronAPI.removeTerminalDataListener?.(handleTerminalData);
          window.electronAPI.removeTerminalExitListener?.(handleTerminalExit);
        }
        terminal.dispose();
      }

      isInitializedRef.current = false;
    };
  }, [terminalId]);

  const handleClick = () => {
    terminalInstanceRef.current?.focus();
  };

  return (
    <div
      ref={terminalRef}
      className="agent-terminal-view"
      onClick={handleClick}
    />
  );
}
