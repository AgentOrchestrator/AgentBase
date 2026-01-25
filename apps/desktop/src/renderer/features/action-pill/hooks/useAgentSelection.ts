/**
 * useAgentSelection Hook
 *
 * Provides the highlighted agent's information and message channel
 * based on the currently highlighted action and the agent node's active view.
 *
 * Used by MessagePill to send messages to the correct agent
 * without knowing the underlying transport mechanism.
 *
 * The channel type is determined by:
 * 1. The agent node's currently visible view (terminal vs chat)
 * 2. Fallback to available routing info if view is not set
 */

import type { AgentNodeData, AgentNodeView } from '@agent-orchestrator/shared';
import { useMemo, useSyncExternalStore } from 'react';
import { nodeStore } from '../../../stores';
import { createMessageChannel, type MessageChannel } from '../services/MessageChannel';
import { useActionPillStore } from '../store';

export interface AgentSelectionState {
  /** The agent ID of the currently highlighted agent */
  agentId: string | null;
  /** Message channel for sending to this agent (null if no valid target) */
  channel: MessageChannel | null;
  /** The active view of the agent node (used to determine channel type) */
  activeView: AgentNodeView | null;
}

/**
 * Agent node info extracted from the node store.
 * Contains routing information needed for message delivery.
 */
interface AgentNodeInfo {
  activeView: AgentNodeView;
  terminalId: string | null;
  sessionId: string | null;
  workspacePath: string | null;
}

// Subscribe to node store changes
function subscribeToNodeStore(callback: () => void): () => void {
  return nodeStore.subscribe(callback);
}

// Get current snapshot of nodes
function getNodeStoreSnapshot(): ReturnType<typeof nodeStore.getAllNodes> {
  return nodeStore.getAllNodes();
}

/**
 * Hook to get the highlighted agent's information and message channel.
 *
 * The highlighted agent is determined by highlightedAgentId in the store,
 * which is set when the pill is expanded and points to the currently selected action.
 *
 * The channel type is determined by the agent node's currently visible view:
 * - Terminal view → TerminalChannel (sends to PTY)
 * - Chat view → SdkChannel (sends via MessageDispatcher)
 *
 * @example
 * ```tsx
 * const { agentId, channel, activeView } = useAgentSelection();
 *
 * const handleSend = async () => {
 *   if (channel) {
 *     await channel.send(message);
 *   }
 * };
 * ```
 */
export function useAgentSelection(): AgentSelectionState {
  // Get the highlighted agent ID from the action pill store
  // This is set when the pill is expanded and the user cycles through actions
  const highlightedAgentId = useActionPillStore((s) => s.highlightedAgentId);
  const actions = useActionPillStore((s) => s.actions);

  // Subscribe to node store changes to get updated activeView
  const nodes = useSyncExternalStore(subscribeToNodeStore, getNodeStoreSnapshot);

  // Find the highlighted agent's node and extract routing info
  const nodeInfo = useMemo((): AgentNodeInfo | null => {
    if (!highlightedAgentId) return null;

    // Find the agent node by agentId
    const agentNode = nodes.find(
      (node) =>
        node.type === 'agent' && (node.data as AgentNodeData)?.agentId === highlightedAgentId
    );

    if (!agentNode) {
      console.warn(
        '[useAgentSelection] Node not found for highlightedAgentId:',
        highlightedAgentId
      );
      return null;
    }

    const data = agentNode.data as AgentNodeData;
    return {
      activeView: data.activeView ?? 'overview',
      terminalId: data.terminalId ?? null,
      sessionId: data.sessionId ?? null,
      workspacePath: data.workspacePath ?? null,
    };
  }, [highlightedAgentId, nodes]);

  // Find the action for the highlighted agent
  const highlightedAction = useMemo(() => {
    if (!highlightedAgentId) return null;
    return actions.find((a) => a.agentId === highlightedAgentId) ?? null;
  }, [highlightedAgentId, actions]);

  // Create channel for sending messages to the highlighted agent's visible view
  const channel = useMemo(() => {
    if (!highlightedAgentId || !nodeInfo) {
      return null;
    }

    // Use the action if available, otherwise create a synthetic action for channel creation
    const actionForChannel = highlightedAction ?? {
      id: `synthetic-${highlightedAgentId}`,
      agentId: highlightedAgentId,
      type: 'tool_approval' as const,
      createdAt: new Date().toISOString(),
      terminalId: nodeInfo.terminalId ?? undefined,
      sessionId: nodeInfo.sessionId ?? undefined,
      workspacePath: nodeInfo.workspacePath ?? undefined,
    };

    const createdChannel = createMessageChannel(
      actionForChannel as Parameters<typeof createMessageChannel>[0],
      {
        activeView: nodeInfo.activeView,
        terminalId: nodeInfo.terminalId ?? undefined,
        sessionId: nodeInfo.sessionId ?? undefined,
        workspacePath: nodeInfo.workspacePath ?? undefined,
      }
    );

    if (!createdChannel) {
      console.warn('[useAgentSelection] Failed to create channel:', {
        highlightedAgentId,
        activeView: nodeInfo.activeView,
        terminalId: nodeInfo.terminalId,
        sessionId: nodeInfo.sessionId,
        workspacePath: nodeInfo.workspacePath,
      });
    }

    return createdChannel;
  }, [highlightedAgentId, highlightedAction, nodeInfo]);

  if (!highlightedAgentId) {
    return {
      agentId: null,
      channel: null,
      activeView: null,
    };
  }

  return {
    agentId: highlightedAgentId,
    channel,
    activeView: nodeInfo?.activeView ?? null,
  };
}
