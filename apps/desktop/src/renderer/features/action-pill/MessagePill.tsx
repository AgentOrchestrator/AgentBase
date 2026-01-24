/**
 * MessagePill Container Component
 *
 * Connects the MessagePill feature to the Zustand store.
 * Uses the channel abstraction to send messages without knowing
 * the underlying transport (terminal vs SDK).
 */

import { useCallback, useEffect } from 'react';
import { useActionPillHighlight, useSelectedAgent } from './hooks';
import { MessagePillPresentation } from './MessagePillPresentation';
import { selectCanSend, useMessagePillStore } from './store/messagePillStore';

export function MessagePill() {
  // Store state
  const inputValue = useMessagePillStore((state) => state.inputValue);
  const isSending = useMessagePillStore((state) => state.isSending);
  const targetAgentId = useMessagePillStore((state) => state.targetAgentId);
  const canSend = useMessagePillStore(selectCanSend);

  // Store actions
  const setInputValue = useMessagePillStore((state) => state.setInputValue);
  const setTargetAgent = useMessagePillStore((state) => state.setTargetAgent);
  const setSending = useMessagePillStore((state) => state.setSending);
  const clearInput = useMessagePillStore((state) => state.clearInput);
  const addToHistory = useMessagePillStore((state) => state.addToHistory);

  // Get selected agent and channel from ActionPill (uses selectedActionIndex)
  const { agentId, channel } = useSelectedAgent();

  // Get highlighted agent for pill display
  const { highlightedAgentId } = useActionPillHighlight();

  // Sync target agent with ActionPill's highlighted agent
  useEffect(() => {
    setTargetAgent(highlightedAgentId);
  }, [highlightedAgentId, setTargetAgent]);

  // Send handler - unified via channel abstraction
  const handleSend = useCallback(async () => {
    if (!canSend || !channel) {
      if (!channel) {
        console.warn('[MessagePill] No valid channel for sending');
      }
      return;
    }

    setSending(true);

    try {
      await channel.send(inputValue);

      addToHistory({
        id: `msg-${Date.now()}`,
        content: inputValue,
        targetAgentId: agentId,
        timestamp: Date.now(),
      });

      clearInput();
    } catch (error) {
      console.error(`[MessagePill] Failed to send via ${channel.type}:`, error);
    } finally {
      setSending(false);
    }
  }, [canSend, channel, inputValue, agentId, clearInput, addToHistory, setSending]);

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

  return (
    <MessagePillPresentation
      inputValue={inputValue}
      isSending={isSending}
      targetAgentId={targetAgentId}
      canSend={canSend}
      onInputChange={setInputValue}
      onSend={handleSend}
      onKeyDown={handleKeyDown}
    />
  );
}
