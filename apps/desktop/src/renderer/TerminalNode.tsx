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
            ? (startContainer.parentElement?.closest('.xterm'))
            : (startContainer as HTMLElement).closest('.xterm')) !== null ||
          (endContainer.nodeType === Node.TEXT_NODE
            ? (endContainer.parentElement?.closest('.xterm'))
            : (endContainer as HTMLElement).closest('.xterm')) !== null;

        if (!isInXterm && selection.toString().length > 0) {
          console.log('[TerminalNode] ⚠️ Active selection detected outside xterm on hover:', {
            text: selection.toString().substring(0, 50),
            startContainer: startContainer.nodeName,
            endContainer: endContainer.nodeName,
            startParent: startContainer.nodeType === Node.TEXT_NODE ? startContainer.parentElement?.className : (startContainer as HTMLElement).className,
            endParent: endContainer.nodeType === Node.TEXT_NODE ? endContainer.parentElement?.className : (endContainer as HTMLElement).className
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
        ...additionalInfo
      });
    };

    // Prevent text selection on the wrapper element
    const preventSelection = (e: Event) => {
      const target = e.target as HTMLElement;
      const isXterm = target.closest('.xterm') !== null;
      
      logEvent('selectstart', e, { 
        isXterm, 
        willPrevent: !isXterm,
        defaultPrevented: e.defaultPrevented 
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
        shiftKey: e.shiftKey
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      logEvent('mouseup', e, { 
        button: e.button,
        isMouseDown 
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
            focusNode: selection.focusNode?.nodeName
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
            rangeCount: selection.rangeCount
          });
        }
      } else {
        // Log hover events even when not dragging
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && selection.toString().length > 0) {
          logEvent('mousemove (hovering with selection)', e, {
            selectionLength: selection.toString().length,
            rangeCount: selection.rangeCount
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
        rangeCount: selection?.rangeCount || 0
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
          targetClass: target?.className
        });
      }
    };

    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      const isXterm = target.closest('.xterm') !== null;
      
      logEvent('dragstart', e, { 
        isXterm,
        willPrevent: !isXterm 
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

    // Log initial state
    console.log('[TerminalNode] Terminal mounted', {
      wrapperClass: wrapper.className,
      wrapperUserSelect: window.getComputedStyle(wrapper).userSelect,
      xtermElement: wrapper.querySelector('.xterm')?.className,
      xtermUserSelect: wrapper.querySelector('.xterm') ? window.getComputedStyle(wrapper.querySelector('.xterm')!).userSelect : 'not found'
    });

    // Focus terminal
    terminal.focus();

    // Store refs
    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Capture xterm selection events
    const handleXtermSelectionChange = () => {
      const selection = terminal.getSelection();
      const buffer = terminal.buffer.active;
      const hasSelection = selection.length > 0;
      const isWhitespaceOnly = hasSelection && /^[\n\r\s]+$/.test(selection);
      
      let selectionInfo: any = {
        hasSelection,
        selectionLength: selection.length,
        selectionText: selection.substring(0, 100),
        isWhitespaceOnly,
        terminalId
      };

      if (hasSelection) {
        // Try to get selection position (xterm API may vary by version)
        try {
          const selectionStart = (terminal as any).getSelectionPosition?.();
          if (selectionStart) {
            selectionInfo.selectionPosition = selectionStart;
          }
        } catch (e) {
          // Position API might not be available
        }

        // Get buffer dimensions
        try {
          selectionInfo.bufferDimensions = {
            base: buffer.base,
            length: buffer.length,
            cursorX: buffer.cursorX,
            cursorY: buffer.cursorY
          };
        } catch (e) {
          // Buffer API might vary
        }

        if (isWhitespaceOnly) {
          selectionInfo.warning = '⚠️ Whitespace-only selection detected - this is likely causing the visual selection issue!';
          selectionInfo.newlineCount = (selection.match(/\n/g) || []).length;
        }
      }

      console.log('[TerminalNode] 🔵 Xterm Selection Changed', selectionInfo);
      
      // If it's whitespace only, try to clear it to prevent visual selection
      // This handles the case where xterm creates selections from false drag detection
      if (isWhitespaceOnly && selection.length > 0) {
        console.log('[TerminalNode] ⚠️ Attempting to clear whitespace-only selection (false drag detection)');
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
    let selectionCheckInterval: NodeJS.Timeout | null = null;
    const startSelectionMonitoring = () => {
      if (selectionCheckInterval) return;
      
      selectionCheckInterval = setInterval(() => {
        const selection = terminal.getSelection();
        if (selection.length > 0) {
          // Filter out selections that are only whitespace/newlines
          const trimmedSelection = selection.trim();
          if (trimmedSelection.length === 0) {
            // This is a whitespace-only selection - this is likely the issue!
            console.log('[TerminalNode] ⚠️ Xterm Whitespace-Only Selection Detected (this causes visual selection!)', {
              length: selection.length,
              isOnlyNewlines: /^[\n\r\s]+$/.test(selection),
              newlineCount: (selection.match(/\n/g) || []).length,
              terminalId
            });
          } else {
            // This is a meaningful selection with actual content
            console.log('[TerminalNode] 🔵 Xterm Selection Active (periodic check)', {
              length: selection.length,
              text: selection.substring(0, 100),
              terminalId
            });
          }
        }
      }, 200); // Check every 200ms
    };

    const stopSelectionMonitoring = () => {
      if (selectionCheckInterval) {
        clearInterval(selectionCheckInterval);
        selectionCheckInterval = null;
      }
    };

    // Start monitoring when terminal gets focus
    wrapper.addEventListener('focusin', () => {
      console.log('[TerminalNode] Terminal focused - starting selection monitoring');
      startSelectionMonitoring();
    });

    wrapper.addEventListener('focusout', () => {
      console.log('[TerminalNode] Terminal blurred - stopping selection monitoring');
      stopSelectionMonitoring();
    });

    // Also log when selection is cleared
    const originalClearSelection = terminal.clearSelection.bind(terminal);
    terminal.clearSelection = function() {
      console.log('[TerminalNode] 🔵 Xterm Selection Cleared', { terminalId });
      originalClearSelection();
    };

    // Add mouse event listeners specifically to xterm element
    const xtermElement = wrapper.querySelector('.xterm');
    if (xtermElement) {
      let xtermIsMouseDown = false;
      let mouseDownX = 0;
      let mouseDownY = 0;
      let mouseDownTime = 0;
      let hasDragged = false;
      const DRAG_THRESHOLD = 3; // pixels - movement less than this is considered a click
      const CLICK_MAX_DURATION = 200; // ms - clicks should be quick

      const handleXtermMouseDown = (e: MouseEvent) => {
        xtermIsMouseDown = true;
        mouseDownX = e.clientX;
        mouseDownY = e.clientY;
        mouseDownTime = Date.now();
        hasDragged = false;
        
        console.log('[TerminalNode] 🔵 Xterm mousedown', {
          button: e.button,
          clientX: e.clientX,
          clientY: e.clientY,
          target: (e.target as HTMLElement).className,
          terminalId
        });
      };

      const handleXtermMouseUp = (e: MouseEvent) => {
        const mouseUpTime = Date.now();
        const timeSinceMouseDown = mouseUpTime - mouseDownTime;
        const distanceX = Math.abs(e.clientX - mouseDownX);
        const distanceY = Math.abs(e.clientY - mouseDownY);
        const totalDistance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
        const isActualDrag = totalDistance >= DRAG_THRESHOLD;
        const isQuickClick = timeSinceMouseDown < CLICK_MAX_DURATION && !isActualDrag;

        xtermIsMouseDown = false;
        
        // Check selection after a short delay to allow xterm to process
        setTimeout(() => {
          const selection = terminal.getSelection();
          const browserSelection = window.getSelection();
          const isWhitespaceOnly = selection.length > 0 && /^[\n\r\s]+$/.test(selection);
          
          console.log('[TerminalNode] 🔵 Xterm mouseup', {
            button: e.button,
            distance: totalDistance.toFixed(2),
            isActualDrag,
            isQuickClick,
            timeSinceMouseDown,
            hasDragged,
            xtermSelection: selection.substring(0, 100),
            xtermSelectionLength: selection.length,
            isWhitespaceOnly,
            browserSelection: browserSelection?.toString().substring(0, 100) || 'none',
            browserSelectionLength: browserSelection?.toString().length || 0,
            terminalId
          });

          // Always clear whitespace-only selections, regardless of whether it's a drag or click
          // Also clear if it's a quick click (not an actual drag)
          if (isWhitespaceOnly || (isQuickClick && e.button === 0)) {
            console.log('[TerminalNode] ⚠️ Clearing selection', {
              reason: isWhitespaceOnly ? 'whitespace-only selection' : 'quick click (not a drag)',
              distance: totalDistance.toFixed(2),
              timeSinceMouseDown,
              isActualDrag
            });
            setTimeout(() => {
              terminal.clearSelection();
            }, 20);
          }
        }, 10);
      };

      const handleXtermMouseMove = (e: MouseEvent) => {
        if (xtermIsMouseDown) {
          const distanceX = Math.abs(e.clientX - mouseDownX);
          const distanceY = Math.abs(e.clientY - mouseDownY);
          const totalDistance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
          
          if (totalDistance >= DRAG_THRESHOLD) {
            hasDragged = true;
          }

          const selection = terminal.getSelection();
          if (selection.length > 0) {
            const isWhitespaceOnly = /^[\n\r\s]+$/.test(selection);
            const isActualDrag = totalDistance >= DRAG_THRESHOLD;
            
            console.log('[TerminalNode] 🔵 Xterm mousemove', {
              distance: totalDistance.toFixed(2),
              isActualDrag,
              hasDragged,
              selectionLength: selection.length,
              selectionText: selection.substring(0, 50),
              isWhitespaceOnly,
              clientX: e.clientX,
              clientY: e.clientY,
              terminalId
            });

            // Always clear whitespace-only selections, even during real drags
            // Xterm shouldn't be selecting empty lines/whitespace
            if (isWhitespaceOnly) {
              console.log('[TerminalNode] ⚠️ Clearing whitespace-only selection during drag', {
                distance: totalDistance.toFixed(2),
                isActualDrag,
                selectionLength: selection.length
              });
              terminal.clearSelection();
            }
          }
        }
      };

      xtermElement.addEventListener('mousedown', handleXtermMouseDown);
      xtermElement.addEventListener('mouseup', handleXtermMouseUp);
      xtermElement.addEventListener('mousemove', handleXtermMouseMove);

      // Cleanup xterm event listeners
      const cleanupXtermListeners = () => {
        xtermElement.removeEventListener('mousedown', handleXtermMouseDown);
        xtermElement.removeEventListener('mouseup', handleXtermMouseUp);
        xtermElement.removeEventListener('mousemove', handleXtermMouseMove);
      };

      // Store cleanup function to call in main cleanup
      (wrapper as any)._cleanupXtermListeners = cleanupXtermListeners;
    }

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
      stopSelectionMonitoring();
      // Cleanup xterm-specific listeners if they were added
      if ((wrapper as any)._cleanupXtermListeners) {
        (wrapper as any)._cleanupXtermListeners();
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

