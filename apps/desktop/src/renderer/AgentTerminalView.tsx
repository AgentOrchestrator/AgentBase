import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal } from '@xterm/xterm';
import { useEffect, useRef } from 'react';
import '@xterm/xterm/css/xterm.css';
import './AgentTerminalView.css';
import { useAgentService, useNodeInitialized, useTerminalService } from './context';

interface AgentTerminalViewProps {
  /** Workspace path for agent REPL */
  workspacePath: string;
  /** Session ID for agent REPL */
  sessionId: string;
  /** Optional initial prompt to send on start */
  initialPrompt?: string;
  /** Whether the node is selected (for scroll handling) */
  selected?: boolean;
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
 * Terminal component for embedding within AgentNode.
 * Uses ITerminalService from context for all terminal operations.
 * Parent controls lifecycle via useAgentViewMode hook.
 */
export default function AgentTerminalView({
  workspacePath,
  sessionId,
  initialPrompt,
  selected = false,
}: AgentTerminalViewProps) {
  const terminalService = useTerminalService();
  const agentService = useAgentService();
  const isServicesInitialized = useNodeInitialized();
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // Wait for services to be fully initialized before setting up terminal
    // This ensures agentService.initialize() has completed, which restores
    // session state from main process and sets isRunning if CLI is already active
    if (!isServicesInitialized || !terminalRef.current) return;

    // Guard against double initialization (React StrictMode)
    const existingXterm = terminalRef.current.querySelector('.xterm');
    if (isInitializedRef.current || existingXterm) {
      return;
    }

    isInitializedRef.current = true;

    // Create xterm.js instance (UI layer)
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
    } catch (_error) {
      console.warn('[AgentTerminalView] WebGL addon failed, using canvas renderer');
    }

    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Initial fit
    try {
      fitAddon.fit();
    } catch (_error) {
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
        } catch (retryError) {
          console.error('[AgentTerminalView] Failed to fit terminal', retryError);
        }
      }, 100);
    }

    terminal.focus();

    // Create terminal process and start agent REPL
    // Pass workspacePath to enable agent hooks env var injection
    console.log('[AgentTerminalView] Creating terminal and starting agent REPL', {
      terminalId: terminalService.terminalId,
      workspacePath,
      sessionId,
      hasInitialPrompt: !!initialPrompt,
    });
    terminalService
      .create(workspacePath)
      .then(async () => {
        // Restore terminal buffer after process creation
        const buffer = await terminalService.getBuffer();
        if (buffer) {
          console.log('[AgentTerminalView] Restoring terminal buffer', {
            terminalId: terminalService.terminalId,
            bufferLength: buffer.length,
          });
          terminal.write(buffer);
        }

        // Start agent REPL in the terminal
        // agent.start() is idempotent - it checks if already running
        console.log('[AgentTerminalView] Starting agent REPL', {
          workspacePath,
          sessionId,
          hasInitialPrompt: !!initialPrompt,
          initialPromptLength: initialPrompt?.length,
        });
        await agentService.start(workspacePath, sessionId, initialPrompt);
      })
      .catch((error) => {
        console.warn('[AgentTerminalView] Failed to create terminal or start agent', error);
      });

    // Connect xterm.js input to terminal service
    terminal.onData((inputData: string) => {
      terminalService.sendUserInput(inputData);
    });

    // Connect terminal service output to xterm.js
    const unsubscribeData = terminalService.onData((data: string) => {
      terminal.write(data);
    });

    // Handle terminal exit events
    const unsubscribeExit = terminalService.onExit((code: number, signal?: number) => {
      const isImmediateExit = code === 1 && signal === 1;

      if (!isImmediateExit) {
        terminal.write(
          `\r\n\n[Process exited with code ${code}${signal ? ` and signal ${signal}` : ''}]`
        );
      }

      // DO NOT auto-restart - parent (AgentNodePresentation) controls terminal lifecycle
      // via useAgentViewMode hook. This allows proper coordination with chat view
      // to avoid Claude Code session conflicts.
      console.log('[AgentTerminalView] Terminal exited, awaiting parent direction');
    });

    // Handle resize via service
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
          if (dimensions && dimensions.cols > 0 && dimensions.rows > 0) {
            if (
              !lastResizeDimensions ||
              lastResizeDimensions.cols !== dimensions.cols ||
              lastResizeDimensions.rows !== dimensions.rows
            ) {
              lastResizeDimensions = { cols: dimensions.cols, rows: dimensions.rows };
              terminalService.resize(dimensions.cols, dimensions.rows);
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

    // Cleanup on unmount
    // NOTE: Terminal PTY lifecycle is managed externally:
    // - useAgentViewMode.setActiveView('chat') destroys PTY when switching to chat
    // - AgentNodePresentation unmount stops the agent
    // This cleanup only disposes the xterm.js UI, not the PTY process.
    // This is intentional to support React StrictMode (double mount/unmount).
    return () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeObserver.disconnect();

      // Unsubscribe from service events
      unsubscribeData();
      unsubscribeExit();

      // Only dispose xterm.js UI if it was initialized
      if (isInitializedRef.current) {
        terminal.dispose();
      }

      isInitializedRef.current = false;
    };
  }, [
    terminalService,
    agentService,
    workspacePath,
    sessionId,
    initialPrompt,
    isServicesInitialized,
  ]);

  // Handle scroll events when node is selected
  // Only prevent canvas scrolling when node is selected (clicked)
  // This matches the behavior of other nodes like UserMessageNode and AssistantMessageNode
  useEffect(() => {
    const terminalElement = terminalRef.current;
    if (!terminalElement || !selected) return;

    const handleWheel = (e: WheelEvent) => {
      // Always prevent canvas scrolling when node is selected
      // This prevents the "snap" effect when reaching boundaries
      e.stopPropagation();
    };

    terminalElement.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      terminalElement.removeEventListener('wheel', handleWheel);
    };
  }, [selected]);

  const handleClick = () => {
    terminalInstanceRef.current?.focus();
  };

  return <div ref={terminalRef} className="agent-terminal-view" onClick={handleClick} />;
}
