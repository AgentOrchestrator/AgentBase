/**
 * useAgentViewMode Hook
 *
 * Manages view mode switching between terminal and chat views.
 * Coordinates terminal lifecycle to avoid Claude Code session conflicts.
 *
 * Key responsibilities:
 * 1. Track active view mode (overview | terminal | chat)
 * 2. Gracefully exit REPL and destroy terminal PTY when switching to chat
 * 3. Terminal recreated on mount when switching back
 *
 * Uses ITerminalService and IAgentService (not direct window.electronAPI calls)
 * following the boundary abstraction architecture.
 */

import { useCallback, useRef, useState } from 'react';
import type { AgentNodeView } from '../../types/agent-node';
import type { UseAgentViewModeInput, UseAgentViewModeReturn } from './types';

export function useAgentViewMode({
  terminalService,
  agentService: _agentService,
  initialView = 'overview',
  onViewChange,
}: UseAgentViewModeInput): UseAgentViewModeReturn {
  const [activeView, setActiveViewInternal] = useState<AgentNodeView>(initialView);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const previousViewRef = useRef<AgentNodeView>(initialView);

  const setActiveView = useCallback(
    async (newView: AgentNodeView) => {
      const previousView = previousViewRef.current;

      // Skip if same view
      if (newView === previousView) return;

      setIsTransitioning(true);

      try {
        // RULE: Terminal and Chat cannot be active simultaneously
        // because Claude Code doesn't allow resuming the same session
        // from the same working directory at the same time.

        // Case 1: Switching FROM terminal TO chat
        // Must gracefully exit REPL and destroy terminal PTY to release session lock
        if (previousView === 'terminal' && newView === 'chat') {
          console.log('[useAgentViewMode] Exiting REPL and destroying terminal for chat view');
        }

        // Case 2: Switching FROM chat TO terminal
        // No action needed here - terminal will be recreated when
        // AgentTerminalView mounts and calls createTerminal in its useEffect

        // Case 3: Switching FROM terminal TO overview
        // Keep terminal running (overview doesn't use session)

        // Case 4: Switching FROM overview TO chat
        // Terminal might still be running if user went overview→terminal→overview→chat
        // Need to exit REPL and destroy terminal to be safe
        if (previousView === 'overview' && newView === 'chat' && terminalService.isRunning()) {
          console.log(
            '[useAgentViewMode] Exiting REPL and destroying terminal (was running) for chat view'
          );
        }

        // Update state
        previousViewRef.current = newView;
        setActiveViewInternal(newView);
        onViewChange?.(newView);
      } finally {
        setIsTransitioning(false);
      }
    },
    [terminalService, onViewChange]
  );

  return {
    activeView,
    setActiveView,
    isTerminalActive: activeView === 'terminal',
    isChatActive: activeView === 'chat',
    isTransitioning,
  };
}
