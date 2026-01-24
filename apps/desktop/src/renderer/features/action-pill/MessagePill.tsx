/**
 * MessagePill Container Component
 *
 * Meta-orchestrator chat interface that sends messages to Claude CLI.
 * Uses orchestratorPillStore for state management.
 */

import { useCallback, useEffect } from 'react';
import { MessagePillPresentation } from './MessagePillPresentation';
import {
  selectCanSend,
  selectCliAvailable,
  useOrchestratorPillStore,
} from './store/orchestratorPillStore';

export function MessagePill() {
  // Store state
  const inputValue = useOrchestratorPillStore((state) => state.inputValue);
  const isSending = useOrchestratorPillStore((state) => state.isSending);
  const canSend = useOrchestratorPillStore(selectCanSend);
  const cliAvailable = useOrchestratorPillStore(selectCliAvailable);

  // Store actions
  const initialize = useOrchestratorPillStore((state) => state.initialize);
  const setInputValue = useOrchestratorPillStore((state) => state.setInputValue);
  const sendMessage = useOrchestratorPillStore((state) => state.sendMessage);

  // Initialize on mount - check CLI health and restore conversation
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Send handler
  const handleSend = useCallback(async () => {
    if (!canSend) return;
    await sendMessage();
  }, [canSend, sendMessage]);

  // Keyboard handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Don't render if CLI is not available
  if (!cliAvailable) {
    return null;
  }

  return (
    <MessagePillPresentation
      inputValue={inputValue}
      isSending={isSending}
      targetAgentId={null} // Orchestrator doesn't target specific agents
      canSend={canSend}
      onInputChange={setInputValue}
      onSend={handleSend}
      onKeyDown={handleKeyDown}
    />
  );
}
