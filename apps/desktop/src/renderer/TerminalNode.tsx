import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal } from '@xterm/xterm';
import { type NodeProps, NodeResizer } from '@xyflow/react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import '@xterm/xterm/css/xterm.css';
import './TerminalNode.css';
import AttachmentHeader from './AttachmentHeader';
import { useNodeActions } from './features/canvas/context';
import IssueDetailsModal from './IssueDetailsModal';
import {
  createLinearIssueAttachment,
  isLinearIssueAttachment,
  type TerminalAttachment,
} from './types/attachments';

interface TerminalNodeData {
  terminalId: string;
  /** Workspace path for agent context - enables hook env injection */
  workspacePath?: string;
  attachments?: TerminalAttachment[];
  autoStartClaude?: boolean; // Flag to auto-start claude command
  // Legacy support - will be migrated to attachments array
  issue?: {
    id?: string;
    identifier: string;
    title: string;
    url: string;
  };
}

function TerminalNode({ data, id, selected }: NodeProps) {
  const nodeActions = useNodeActions();
  const nodeData = data as unknown as TerminalNodeData;
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const webglAddonRef = useRef<WebglAddon | null>(null);
  const isInitializedRef = useRef(false); // Guard against double initialization (React StrictMode)
  const terminalProcessCreatedRef = useRef(false); // Guard against multiple process creations
  const terminalId = nodeData.terminalId;

  const count = useRef(0);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Handle wheel events when node is selected - prevent canvas scrolling
  useEffect(() => {
    const contentElement = terminalRef.current;
    if (!contentElement || !selected) return;

    const handleWheel = (e: WheelEvent) => {
      // Always prevent canvas scrolling when node is selected
      e.stopPropagation();
    };

    contentElement.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      contentElement.removeEventListener('wheel', handleWheel);
    };
  }, [selected]);

  // Focus/blur terminal based on selection state
  useEffect(() => {
    if (terminalInstanceRef.current) {
      if (selected) {
        terminalInstanceRef.current.focus();
      } else {
        terminalInstanceRef.current.blur();
      }
    }
  }, [selected]);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Guard against double initialization (React StrictMode in development)
    // Check both the ref flag AND if an xterm already exists in the DOM
    const existingXterm = terminalRef.current.querySelector('.xterm');
    if (isInitializedRef.current || existingXterm) {
      console.log('[TerminalNode] ⚠️ Terminal already initialized, skipping duplicate mount', {
        terminalId,
        refFlag: isInitializedRef.current,
        hasXtermInDOM: !!existingXterm,
      });
      return;
    }

    count.current++;

    // Track mount time to detect StrictMode unmounts
    if (!(window as any).__terminalMountTimes) {
      (window as any).__terminalMountTimes = {};
    }
    (window as any).__terminalMountTimes[terminalId] = Date.now();

    console.log('[TerminalNode] TerminalNode initializing', { terminalId, count: count.current });
    isInitializedRef.current = true;

    const wrapper = terminalRef.current;
    let isMouseDown = false;
    let mouseDownTarget: HTMLElement | null = null;
    let lastHoverCheck: number = 0;

    // Periodic check for active selections (every 100ms when hovering)
    const checkSelectionOnHover = () => {
      const now = Date.now();
      if (now - lastHoverCheck < 100) return; // Throttle to every 100ms
      lastHoverCheck = now;

      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const startContainer = range.startContainer;
        const endContainer = range.endContainer;
        const isInXterm =
          (startContainer.nodeType === Node.TEXT_NODE
            ? startContainer.parentElement?.closest('.xterm')
            : (startContainer as HTMLElement).closest('.xterm')) !== null ||
          (endContainer.nodeType === Node.TEXT_NODE
            ? endContainer.parentElement?.closest('.xterm')
            : (endContainer as HTMLElement).closest('.xterm')) !== null;

        if (!isInXterm && selection.toString().length > 0) {
          console.log('[TerminalNode] ⚠️ Active selection detected outside xterm on hover:', {
            text: selection.toString().substring(0, 50),
            startContainer: startContainer.nodeName,
            endContainer: endContainer.nodeName,
            startParent:
              startContainer.nodeType === Node.TEXT_NODE
                ? startContainer.parentElement?.className
                : (startContainer as HTMLElement).className,
            endParent:
              endContainer.nodeType === Node.TEXT_NODE
                ? endContainer.parentElement?.className
                : (endContainer as HTMLElement).className,
          });
        }
      }
    };

    // Comprehensive logging for debugging selection issues
    const logEvent = (eventName: string, e: Event | MouseEvent, additionalInfo?: any) => {
      const target = e.target as HTMLElement;
      const isXterm = target.closest('.xterm') !== null;
      const computedStyle = window.getComputedStyle(target);
      const userSelect = computedStyle.userSelect || computedStyle.webkitUserSelect || 'not set';
      const selection = window.getSelection();
      const selectionText = selection?.toString() || '';

      console.log(`[TerminalNode] ${eventName}`, {
        target: target.tagName,
        targetClass: target.className,
        isXterm,
        userSelect,
        selectionText: selectionText.substring(0, 50),
        selectionRangeCount: selection?.rangeCount || 0,
        mouseDownTarget: mouseDownTarget?.tagName,
        ...additionalInfo,
      });
    };

    // Prevent text selection on the wrapper element
    const preventSelection = (e: Event) => {
      const target = e.target as HTMLElement;
      const isXterm = target.closest('.xterm') !== null;

      logEvent('selectstart', e, {
        isXterm,
        willPrevent: !isXterm,
        defaultPrevented: e.defaultPrevented,
      });

      if (!isXterm) {
        e.preventDefault();
        console.log('[TerminalNode] Prevented selectstart on wrapper');
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      mouseDownTarget = e.target as HTMLElement;
      logEvent('mousedown', e, {
        button: e.button,
        buttons: e.buttons,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      logEvent('mouseup', e, {
        button: e.button,
        isMouseDown,
      });
      isMouseDown = false;

      // Check selection after mouseup
      setTimeout(() => {
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
          console.log('[TerminalNode] Selection detected after mouseup:', {
            text: selection.toString().substring(0, 100),
            rangeCount: selection.rangeCount,
            anchorNode: selection.anchorNode?.nodeName,
            focusNode: selection.focusNode?.nodeName,
          });
        }
      }, 0);
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Check for selections on hover (even when not dragging)
      checkSelectionOnHover();

      if (isMouseDown) {
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
          logEvent('mousemove (dragging)', e, {
            selectionLength: selection.toString().length,
            rangeCount: selection.rangeCount,
          });
        }
      } else {
        // Log hover events even when not dragging
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && selection.toString().length > 0) {
          logEvent('mousemove (hovering with selection)', e, {
            selectionLength: selection.toString().length,
            rangeCount: selection.rangeCount,
          });
        }
      }
    };

    const handleClick = (e: MouseEvent) => {
      logEvent('click', e);
    };

    const handleSelect = (e: Event) => {
      const selection = window.getSelection();
      logEvent('select', e, {
        selectionText: selection?.toString().substring(0, 100),
        rangeCount: selection?.rangeCount || 0,
      });
    };

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        const target = selection.anchorNode?.parentElement;
        const isXterm = target?.closest('.xterm') !== null;
        console.log('[TerminalNode] selectionchange', {
          text: selection.toString().substring(0, 100),
          rangeCount: selection.rangeCount,
          anchorNode: selection.anchorNode?.nodeName,
          focusNode: selection.focusNode?.nodeName,
          isXterm,
          targetClass: target?.className,
        });
      }
    };

    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      const isXterm = target.closest('.xterm') !== null;

      logEvent('dragstart', e, {
        isXterm,
        willPrevent: !isXterm,
      });

      if (!isXterm) {
        e.preventDefault();
        console.log('[TerminalNode] Prevented dragstart on wrapper');
      }
    };

    // Add all event listeners
    wrapper.addEventListener('selectstart', preventSelection);
    wrapper.addEventListener('dragstart', handleDragStart);
    wrapper.addEventListener('mousedown', handleMouseDown);
    wrapper.addEventListener('mouseup', handleMouseUp);
    wrapper.addEventListener('mousemove', handleMouseMove);
    wrapper.addEventListener('click', handleClick);
    wrapper.addEventListener('select', handleSelect);
    document.addEventListener('selectionchange', handleSelectionChange);

    // Create terminal instance
    const terminal = new Terminal({
      theme: {
        background: '#2a2c36',
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
      },
      fontSize: 12,
      fontFamily:
        '"SF Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
      cursorStyle: 'block',
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // Open terminal in DOM
    terminal.open(terminalRef.current);

    // Load WebGL addon for better rendering performance
    // WebGL must be loaded AFTER terminal.open()
    try {
      const webglAddon = new WebglAddon();
      terminal.loadAddon(webglAddon);
      webglAddonRef.current = webglAddon;
      console.log('[TerminalNode] ✅ WebGL renderer enabled', { terminalId });
    } catch (error) {
      console.warn(
        '[TerminalNode] ⚠️ WebGL addon failed to load, falling back to canvas renderer',
        error
      );
      // Terminal will continue to work with default canvas renderer
    }

    // Store refs BEFORE fit() to ensure they're available
    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Fit terminal - wrap in try-catch to handle timing issues
    try {
      fitAddon.fit();
    } catch (error) {
      console.warn('[TerminalNode] Error fitting terminal initially, retrying...', error);
      // Retry after a short delay
      setTimeout(() => {
        try {
          if (fitAddonRef.current && terminalInstanceRef.current) {
            fitAddonRef.current.fit();
          }
        } catch (retryError) {
          console.error('[TerminalNode] Failed to fit terminal on retry', retryError);
        }
      }, 100);
    }

    // Log initial state
    console.log('[TerminalNode] ✅ Terminal mounted successfully', {
      terminalId,
      wrapperClass: wrapper.className,
      wrapperUserSelect: window.getComputedStyle(wrapper).userSelect,
      xtermElement: wrapper.querySelector('.xterm')?.className,
      xtermUserSelect: wrapper.querySelector('.xterm')
        ? window.getComputedStyle(wrapper.querySelector('.xterm')!).userSelect
        : 'not found',
    });

    // Focus terminal
    terminal.focus();

    // Capture xterm selection events
    const handleXtermSelectionChange = () => {
      const selection = terminal.getSelection();
      const buffer = terminal.buffer.active;
      const hasSelection = selection.length > 0;
      const isWhitespaceOnly = hasSelection && /^[\n\r\s]+$/.test(selection);

      const selectionInfo: any = {
        hasSelection,
        selectionLength: selection.length,
        selectionText: selection.substring(0, 100),
        isWhitespaceOnly,
        terminalId,
      };

      if (hasSelection) {
        // Try to get selection position (xterm API may vary by version)
        try {
          const selectionStart = (terminal as any).getSelectionPosition?.();
          if (selectionStart) {
            selectionInfo.selectionPosition = selectionStart;
          }
        } catch (_e) {
          // Position API might not be available
        }

        // Get buffer dimensions
        try {
          selectionInfo.bufferDimensions = {
            baseY: buffer.baseY,
            length: buffer.length,
            cursorX: buffer.cursorX,
            cursorY: buffer.cursorY,
          };
        } catch (_e) {
          // Buffer API might vary
        }

        if (isWhitespaceOnly) {
          selectionInfo.warning =
            '⚠️ Whitespace-only selection detected - this is likely causing the visual selection issue!';
          selectionInfo.newlineCount = (selection.match(/\n/g) || []).length;
        }
      }

      console.log('[TerminalNode] 🔵 Xterm Selection Changed', selectionInfo);

      // If it's whitespace only, try to clear it to prevent visual selection
      // This handles the case where xterm creates selections from false drag detection
      if (isWhitespaceOnly && selection.length > 0) {
        console.log(
          '[TerminalNode] ⚠️ Attempting to clear whitespace-only selection (false drag detection)'
        );
        // Small delay to see if it clears naturally, otherwise we'll clear it
        setTimeout(() => {
          const currentSelection = terminal.getSelection();
          if (currentSelection.length > 0 && /^[\n\r\s]+$/.test(currentSelection)) {
            terminal.clearSelection();
            console.log('[TerminalNode] ✅ Cleared whitespace-only selection (false drag)');
          }
        }, 50);
      }
    };

    // Listen to xterm selection changes
    terminal.onSelectionChange(handleXtermSelectionChange);

    // Also monitor selection periodically when terminal is active
    // Track the last selection to only log when it changes
    let lastSelectionText = '';
    let lastSelectionLength = 0;
    let selectionCheckInterval: NodeJS.Timeout | null = null;
    const startSelectionMonitoring = () => {
      if (selectionCheckInterval) return;

      selectionCheckInterval = setInterval(() => {
        const selection = terminal.getSelection();
        const currentSelectionText = selection;
        const currentSelectionLength = selection.length;

        // Only log if selection changed (new selection or cleared)
        const selectionChanged =
          currentSelectionLength !== lastSelectionLength ||
          currentSelectionText !== lastSelectionText;

        if (selection.length > 0 && selectionChanged) {
          // Filter out selections that are only whitespace/newlines
          const trimmedSelection = selection.trim();
          if (trimmedSelection.length === 0) {
            // This is a whitespace-only selection - this is likely the issue!
            console.log(
              '[TerminalNode] ⚠️ Xterm Whitespace-Only Selection Detected (this causes visual selection!)',
              {
                length: selection.length,
                isOnlyNewlines: /^[\n\r\s]+$/.test(selection),
                newlineCount: (selection.match(/\n/g) || []).length,
                terminalId,
              }
            );
          } else {
            // This is a meaningful selection with actual content (only log when it's NEW)
            console.log(
              '[TerminalNode] 🔵 Xterm Selection Active (periodic check - NEW selection detected)',
              {
                length: selection.length,
                text: selection.substring(0, 100),
                terminalId,
              }
            );
          }
        } else if (selection.length === 0 && lastSelectionLength > 0) {
          // Selection was cleared
          console.log('[TerminalNode] 🔵 Xterm Selection Cleared (periodic check)', { terminalId });
        }

        // Update tracked values
        lastSelectionText = currentSelectionText;
        lastSelectionLength = currentSelectionLength;
      }, 200); // Check every 200ms
    };

    const stopSelectionMonitoring = () => {
      if (selectionCheckInterval) {
        clearInterval(selectionCheckInterval);
        selectionCheckInterval = null;
        // Reset tracking when stopping
        lastSelectionText = '';
        lastSelectionLength = 0;
      }
    };

    // Start monitoring when terminal gets focus
    wrapper.addEventListener('focusin', () => {
      console.log('[TerminalNode] Terminal focused - starting selection monitoring');
      // Reset tracking on focus
      lastSelectionText = '';
      lastSelectionLength = 0;
      startSelectionMonitoring();
    });

    wrapper.addEventListener('focusout', () => {
      console.log('[TerminalNode] Terminal blurred - stopping selection monitoring');
      // Clear any lingering selection when blurring
      const selection = terminal.getSelection();
      if (selection.length > 0) {
        console.log('[TerminalNode] Clearing lingering selection on blur');
        terminal.clearSelection();
      }
      stopSelectionMonitoring();
    });

    // Add logging to debug selection offset
    const xtermElement = wrapper.querySelector('.xterm') as HTMLElement | null;
    if (xtermElement) {
      let mouseDownPos = { x: 0, y: 0 };

      const handleDebugMouseDown = (e: MouseEvent) => {
        mouseDownPos = { x: e.clientX, y: e.clientY };
        const rect = xtermElement.getBoundingClientRect();
        const relativeX = e.clientX - rect.left;
        const relativeY = e.clientY - rect.top;

        console.log('[TerminalNode] 🔍 Mouse Down Debug', {
          clientX: e.clientX,
          clientY: e.clientY,
          xtermRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
          relativeToXterm: { x: relativeX, y: relativeY },
          terminalId,
        });
      };

      const handleDebugMouseMove = (_e: MouseEvent) => {
        // Event captured for future debugging if needed
      };

      const handleDebugMouseUp = (e: MouseEvent) => {
        const rect = xtermElement.getBoundingClientRect();
        const mouseUpRelativeX = e.clientX - rect.left;
        const mouseUpRelativeY = e.clientY - rect.top;
        const mouseDownRelativeX = mouseDownPos.x - rect.left;
        const mouseDownRelativeY = mouseDownPos.y - rect.top;

        // Get xterm selection info
        setTimeout(() => {
          const selection = terminal.getSelection();
          const hasSelection = terminal.hasSelection();

          // Try to get the selection buffer range if available
          let selectionRange = null;
          try {
            // @ts-expect-error - accessing internal API for debugging
            if (terminal._core?.buffer?.active && terminal._core?.selectionManager) {
              // @ts-expect-error
              const selectionModel = terminal._core?.selectionManager?.model;
              if (selectionModel) {
                selectionRange = {
                  // @ts-expect-error
                  start: selectionModel.finalSelectionStart
                    ? [...selectionModel.finalSelectionStart]
                    : null,
                  // @ts-expect-error
                  end: selectionModel.finalSelectionEnd
                    ? [...selectionModel.finalSelectionEnd]
                    : null,
                };
              }
            }
          } catch (err) {
            console.warn('[TerminalNode] Could not access selection range', err);
          }

          console.log('[TerminalNode] 🔍 Selection Debug', {
            hasSelection,
            selectionText: selection.substring(0, 100),
            selectionLength: selection.length,
            mousePositions: {
              down: {
                client: mouseDownPos,
                relative: { x: mouseDownRelativeX, y: mouseDownRelativeY },
              },
              up: {
                client: { x: e.clientX, y: e.clientY },
                relative: { x: mouseUpRelativeX, y: mouseUpRelativeY },
              },
              dragDistance: {
                x: Math.abs(e.clientX - mouseDownPos.x),
                y: Math.abs(e.clientY - mouseDownPos.y),
              },
            },
            xtermRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
            selectionRange,
            terminalId,
          });
        }, 50); // Wait a bit for xterm to finalize selection
      };

      xtermElement.addEventListener('mousedown', handleDebugMouseDown);
      xtermElement.addEventListener('mousemove', handleDebugMouseMove);
      xtermElement.addEventListener('mouseup', handleDebugMouseUp);

      // Store cleanup function
      (wrapper as any)._cleanupDebugListeners = () => {
        xtermElement.removeEventListener('mousedown', handleDebugMouseDown);
        xtermElement.removeEventListener('mousemove', handleDebugMouseMove);
        xtermElement.removeEventListener('mouseup', handleDebugMouseUp);
      };
    }

    // Create terminal process in main process (only once)
    if (window.electronAPI && !terminalProcessCreatedRef.current) {
      terminalProcessCreatedRef.current = true;
      console.log('[TerminalNode] Creating terminal process', {
        terminalId,
        workspacePath: nodeData.workspacePath,
        autoStartClaude: nodeData.autoStartClaude,
      });
      // Pass workspacePath to enable hook env injection for agent lifecycle events
      window.electronAPI.createTerminal(terminalId, nodeData.workspacePath);

      // Auto-start claude command if flag is set
      if (nodeData.autoStartClaude) {
        // Wait for terminal to initialize, then send claude command
        setTimeout(() => {
          if (window.electronAPI) {
            console.log('[TerminalNode] Auto-starting claude command', { terminalId });
            // Send claude command with newline to execute
            window.electronAPI.sendTerminalInput(terminalId, 'claude\n');
          }
        }, 500); // Delay to ensure terminal is ready
      }
    } else if (terminalProcessCreatedRef.current) {
      console.log('[TerminalNode] Terminal process already created, skipping', { terminalId });
    }

    // Send terminal input to main process (if API is available)
    terminal.onData((inputData: string) => {
      if (window.electronAPI) {
        window.electronAPI.sendTerminalInput(terminalId, inputData);
      }
    });

    // Receive terminal output from main process (if API is available)
    let handleTerminalData: ((data: { terminalId: string; data: string }) => void) | null = null;
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
        // Only process data for this specific terminal
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
        // Only process exit for this specific terminal
        if (dataTerminalId === terminalId) {
          // Don't show exit message if it exited immediately on startup (likely a configuration issue)
          // Exit code 1 with signal often indicates the shell couldn't start properly
          const isImmediateExit = code === 1 && signal === 1;

          if (!isImmediateExit) {
            terminal.write(
              `\r\n\n[Process exited with code ${code}${signal ? ` and signal ${signal}` : ''}]`
            );
            terminal.write('\r\n[Terminal closed. Creating new session...]\r\n');
          } else {
            terminal.write(`\r\n\n[Shell exited immediately - check shell configuration]\r\n`);
            terminal.write(`[Shell: ${process.env.SHELL || '/bin/bash'}]\r\n`);
          }

          // Automatically restart the terminal (but delay longer for immediate exits to avoid loop)
          if (window.electronAPI) {
            setTimeout(
              () => {
                // Reset the flag to allow recreation
                terminalProcessCreatedRef.current = false;
                console.log('[TerminalNode] Restarting terminal process', { terminalId });
                window.electronAPI?.createTerminal(terminalId, nodeData.workspacePath);
                terminalProcessCreatedRef.current = true;
              },
              isImmediateExit ? 1000 : 100
            );
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

    // Handle resize with optimized throttling for smooth React Flow resizing
    let resizeTimeout: NodeJS.Timeout | null = null;
    let lastResizeDimensions: { cols: number; rows: number } | null = null;
    let lastContainerSize: { width: number; height: number } | null = null;
    let isFitting = false; // Flag to prevent feedback loop during fit()
    let isResizing = false; // Track if actively resizing
    let resizeStartTime = 0;

    // Declare resizeObserver variable first so it can be referenced in handleResize
    let resizeObserver: ResizeObserver;

    const performFit = () => {
      if (!fitAddonRef.current || !terminalInstanceRef.current || !terminalRef.current) return;

      try {
        isFitting = true;
        fitAddonRef.current.fit();
        const dimensions = fitAddonRef.current.proposeDimensions();
        if (dimensions && window.electronAPI) {
          // Only send resize if dimensions actually changed
          if (
            !lastResizeDimensions ||
            lastResizeDimensions.cols !== dimensions.cols ||
            lastResizeDimensions.rows !== dimensions.rows
          ) {
            lastResizeDimensions = { cols: dimensions.cols, rows: dimensions.rows };
            window.electronAPI.sendTerminalResize(terminalId, dimensions.cols, dimensions.rows);
          }
        }
      } finally {
        isFitting = false;
      }
    };

    const handleResize = () => {
      if (!fitAddonRef.current || !terminalInstanceRef.current || !terminalRef.current) return;
      if (isFitting) return; // Prevent feedback loop

      // Get current container size
      const container = terminalRef.current;
      const currentWidth = container.clientWidth;
      const currentHeight = container.clientHeight;

      // Only proceed if container size actually changed (prevents unnecessary fits)
      if (
        lastContainerSize &&
        lastContainerSize.width === currentWidth &&
        lastContainerSize.height === currentHeight
      ) {
        return; // Container size hasn't changed, skip resize
      }

      // Update tracked container size
      lastContainerSize = { width: currentWidth, height: currentHeight };

      const now = Date.now();

      // If this is the start of a resize, mark it
      if (!isResizing) {
        isResizing = true;
        resizeStartTime = now;
      }

      // Clear any pending timeout
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }

      // For smooth resizing during drag: use shorter delay (50ms)
      // For final resize after drag ends: use longer delay (150ms)
      const timeSinceStart = now - resizeStartTime;
      const isDragging = timeSinceStart < 2000; // Assume dragging if resize started less than 2s ago
      const delay = isDragging ? 50 : 150;

      resizeTimeout = setTimeout(() => {
        try {
          if (fitAddonRef.current && terminalInstanceRef.current && terminalRef.current) {
            // Use requestAnimationFrame for smooth rendering
            requestAnimationFrame(() => {
              performFit();
            });
          }
        } catch (error) {
          console.warn('[TerminalNode] Error handling resize', error);
        } finally {
          // Reset resizing flag after delay
          setTimeout(() => {
            isResizing = false;
          }, 300);
        }
      }, delay);
    };

    resizeObserver = new ResizeObserver(handleResize);
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    // Initial resize (use the throttled handler)
    setTimeout(() => {
      handleResize();
    }, 100);

    // Cleanup
    return () => {
      const cleanupTime = Date.now();
      const mountTime = (window as any).__terminalMountTimes?.[terminalId];
      const componentLifetime = mountTime ? cleanupTime - mountTime : null;

      console.log('[TerminalNode] 🧹 Cleanup triggered', {
        terminalId,
        componentLifetime: componentLifetime ? `${componentLifetime}ms` : 'unknown',
        wasInitialized: isInitializedRef.current,
        stackTrace: new Error().stack?.split('\n').slice(2, 6).join('\n'),
      });

      // In React StrictMode, cleanup runs immediately after mount - don't destroy terminal process
      // Only destroy if component was actually initialized and had time to run
      const isStrictModeUnmount =
        !isInitializedRef.current || (componentLifetime !== null && componentLifetime < 500);

      if (isStrictModeUnmount) {
        console.log('[TerminalNode] ⚠️ Skipping terminal destroy - likely StrictMode unmount', {
          terminalId,
          componentLifetime,
          wasInitialized: isInitializedRef.current,
        });
        // Clean up DOM and listeners but don't destroy the terminal process
        if (webglAddonRef.current) {
          try {
            webglAddonRef.current.dispose();
            webglAddonRef.current = null;
          } catch (e) {
            console.warn('[TerminalNode] Error disposing WebGL addon in cleanup', e);
          }
        }
        if (terminalInstanceRef.current) {
          try {
            terminalInstanceRef.current.dispose();
          } catch (e) {
            console.warn('[TerminalNode] Error disposing terminal in cleanup', e);
          }
        }
        stopSelectionMonitoring();
        // Cleanup debug listeners
        if ((wrapper as any)._cleanupDebugListeners) {
          (wrapper as any)._cleanupDebugListeners();
        }
        wrapper.removeEventListener('selectstart', preventSelection);
        wrapper.removeEventListener('dragstart', handleDragStart);
        wrapper.removeEventListener('mousedown', handleMouseDown);
        wrapper.removeEventListener('mouseup', handleMouseUp);
        wrapper.removeEventListener('mousemove', handleMouseMove);
        wrapper.removeEventListener('click', handleClick);
        wrapper.removeEventListener('select', handleSelect);
        document.removeEventListener('selectionchange', handleSelectionChange);
        resizeObserver.disconnect();
        isInitializedRef.current = false;
        terminalProcessCreatedRef.current = false; // Reset flag but don't destroy process
        return; // Early return - don't destroy the terminal process
      }

      isInitializedRef.current = false; // Reset on cleanup
      terminalProcessCreatedRef.current = false; // Reset process creation flag

      // Clear resize timeout
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
        resizeTimeout = null;
      }

      stopSelectionMonitoring();
      // Cleanup debug listeners
      if ((wrapper as any)._cleanupDebugListeners) {
        (wrapper as any)._cleanupDebugListeners();
      }
      wrapper.removeEventListener('selectstart', preventSelection);
      wrapper.removeEventListener('dragstart', handleDragStart);
      wrapper.removeEventListener('mousedown', handleMouseDown);
      wrapper.removeEventListener('mouseup', handleMouseUp);
      wrapper.removeEventListener('mousemove', handleMouseMove);
      wrapper.removeEventListener('click', handleClick);
      wrapper.removeEventListener('select', handleSelect);
      document.removeEventListener('selectionchange', handleSelectionChange);
      resizeObserver.disconnect();

      if (webglAddonRef.current) {
        try {
          webglAddonRef.current.dispose();
          webglAddonRef.current = null;
        } catch (e) {
          console.warn('[TerminalNode] Error disposing WebGL addon', e);
        }
      }

      if (terminalInstanceRef.current) {
        terminalInstanceRef.current.dispose();
      }

      console.log('[TerminalNode] 🗑️ Destroying terminal process', { terminalId });
      if (window.electronAPI) {
        window.electronAPI.destroyTerminal(terminalId);
      }
    };
  }, [terminalId, nodeData.autoStartClaude, nodeData.workspacePath]);

  // Migrate legacy issue to attachments array
  const attachments = nodeData.attachments || [];
  if (nodeData.issue && attachments.length === 0) {
    // Legacy format - convert to new format
    attachments.push({
      type: 'linear-issue',
      id: nodeData.issue.id || nodeData.issue.identifier,
      identifier: nodeData.issue.identifier,
      title: nodeData.issue.title,
      url: nodeData.issue.url,
    });
  }

  // Find the first Linear issue for the modal
  const linearIssue = attachments.find(isLinearIssueAttachment);

  // Handle drag-and-drop to attach items to this terminal
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
      const jsonData = e.dataTransfer.getData('application/json');
      if (!jsonData) return;

      const data = JSON.parse(jsonData);
      const attachmentType = e.dataTransfer.getData('attachment-type');

      // Terminal nodes only support Linear issue attachments
      // Workspace drops are handled by creating agent nodes instead
      if (attachmentType === 'workspace-metadata') {
        console.log('[TerminalNode] Workspace drops not supported on terminal nodes');
        return;
      }

      // Create Linear issue attachment
      const newAttachment = createLinearIssueAttachment(data);

      // Add to existing attachments
      const currentAttachments = nodeData.attachments || [];
      const updatedAttachments = [...currentAttachments, newAttachment];

      // Update attachments via context (not events) to prevent infinite loops
      nodeActions.updateAttachments(id, updatedAttachments);
    } catch (error) {
      console.error('Error handling drop on terminal:', error);
    }
  };

  return (
    <div
      className={`terminal-node ${isDragOver ? 'drag-over' : ''} ${selected ? 'selected' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <NodeResizer
        minWidth={400}
        minHeight={300}
        isVisible={true}
        lineStyle={{ borderColor: 'transparent' }}
        handleStyle={{
          width: 8,
          height: 8,
          borderRadius: '50%',
        }}
      />

      {/* Render all attachments */}
      {attachments.map((attachment, index) => (
        <AttachmentHeader
          key={`${attachment.type}-${attachment.id}-${index}`}
          attachment={attachment}
          onDetailsClick={
            isLinearIssueAttachment(attachment) && attachment.id
              ? () => setShowIssueModal(true)
              : undefined
          }
        />
      ))}

      <div
        ref={terminalRef}
        className={`terminal-node-content ${selected ? 'active' : ''}`}
        onClick={() => terminalInstanceRef.current?.focus()}
      />

      {/* Issue Details Modal */}
      {showIssueModal && linearIssue?.id && (
        <IssueDetailsModal issueId={linearIssue.id} onClose={() => setShowIssueModal(false)} />
      )}
    </div>
  );
}

export default TerminalNode;
