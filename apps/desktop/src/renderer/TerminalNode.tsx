import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Handle, Position, NodeProps } from '@xyflow/react';
import 'xterm/css/xterm.css';
import './TerminalNode.css';

interface TerminalNodeData {
  terminalId: string;
}

function TerminalNode({ data, id }: NodeProps<TerminalNodeData>) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const terminalId = data.terminalId;

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal instance
    const terminal = new Terminal({
      theme: {
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
        brightWhite: '#e5e5e5'
      },
      fontSize: 12,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
      cursorStyle: 'block'
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // Open terminal in DOM
    terminal.open(terminalRef.current);
    fitAddon.fit();

    // Focus terminal
    terminal.focus();

    // Store refs
    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Create terminal process in main process
    if (window.electronAPI) {
      window.electronAPI.createTerminal(terminalId);
    }

    // Send terminal input to main process (if API is available)
    terminal.onData((inputData: string) => {
      if (window.electronAPI) {
        window.electronAPI.sendTerminalInput(terminalId, inputData);
      }
    });

    // Receive terminal output from main process (if API is available)
    let handleTerminalData: ((data: { terminalId: string; data: string }) => void) | null = null;
    let handleTerminalExit: ((data: { terminalId: string; code: number; signal?: number }) => void) | null = null;

    if (window.electronAPI) {
      handleTerminalData = ({ terminalId: dataTerminalId, data: outputData }: { terminalId: string; data: string }) => {
        // Only process data for this specific terminal
        if (dataTerminalId === terminalId) {
          terminal.write(outputData);
        }
      };

      handleTerminalExit = ({ terminalId: dataTerminalId, code, signal }: { terminalId: string; code: number; signal?: number }) => {
        // Only process exit for this specific terminal
        if (dataTerminalId === terminalId) {
          terminal.write(`\r\n\n[Process exited with code ${code}${signal ? ` and signal ${signal}` : ''}]`);
          terminal.write('\r\n[Terminal closed. Creating new session...]\r\n');
          // Automatically restart the terminal
          if (window.electronAPI) {
            setTimeout(() => {
              window.electronAPI.createTerminal(terminalId);
            }, 100);
          }
        }
      };

      window.electronAPI.onTerminalData(handleTerminalData);
      window.electronAPI.onTerminalExit(handleTerminalExit);
    } else {
      // Fallback: write welcome message if no API
      terminal.writeln('Terminal Node');
      terminal.writeln('Right-click canvas to add more terminals');
      terminal.write('$ ');
    }

    // Handle resize
    const handleResize = () => {
      if (fitAddon && terminal) {
        fitAddon.fit();
        const dimensions = fitAddon.proposeDimensions();
        if (dimensions && window.electronAPI) {
          window.electronAPI.sendTerminalResize(terminalId, dimensions.cols, dimensions.rows);
        }
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    // Initial resize
    setTimeout(() => {
      fitAddon.fit();
      const dimensions = fitAddon.proposeDimensions();
      if (dimensions && window.electronAPI) {
        window.electronAPI.sendTerminalResize(terminalId, dimensions.cols, dimensions.rows);
      }
    }, 100);

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
      if (window.electronAPI) {
        window.electronAPI.destroyTerminal(terminalId);
      }
    };
  }, [terminalId]);

  return (
    <div className="terminal-node">
      <Handle type="target" position={Position.Top} />
      <div className="terminal-node-header">
        <span className="terminal-node-title">Terminal</span>
        <span className="terminal-node-id">{data.terminalId}</span>
      </div>
      <div 
        ref={terminalRef} 
        className="terminal-node-content"
        onClick={() => terminalInstanceRef.current?.focus()}
      />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default TerminalNode;

