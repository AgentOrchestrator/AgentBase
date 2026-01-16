/**
 * useChatMessageFork Hook
 *
 * Listens for 'chat-message-fork' events and creates a lightweight fork
 * of the agent conversation. Unlike the worktree fork, this keeps the same
 * workspace directory and git branch but creates a new session.
 *
 * The new node is positioned to the RIGHT of the source node.
 */

import { useEffect, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { AgentNodeData } from '../types/agent-node';
import { createDefaultAgentTitle } from '../types/agent-node';
import type { ChatMessageForkEventDetail } from '../components/TextSelectionButton';

/**
 * Input parameters for useChatMessageFork hook
 */
export interface UseChatMessageForkInput {
  /** Current nodes in the canvas */
  nodes: Node[];
  /** Callback to add a new node */
  onAddNode: (node: Node) => void;
  /** Callback to add a new edge */
  onAddEdge: (edge: Edge) => void;
}

/**
 * Hook for handling chat message fork events
 *
 * Creates a lightweight fork that:
 * - Keeps the same workspace directory
 * - Keeps the same git branch
 * - Creates a new session ID
 * - Positions the new node to the RIGHT of the source
 */
export function useChatMessageFork({
  nodes,
  onAddNode,
  onAddEdge,
}: UseChatMessageForkInput): void {
  const handleChatMessageFork = useCallback(
    (event: Event) => {
      const customEvent = event as CustomEvent<ChatMessageForkEventDetail>;
      const { nodeId, sessionId, selectedText } = customEvent.detail;

      console.log('[useChatMessageFork] Fork event received:', {
        nodeId,
        sessionId,
        selectedText: selectedText.slice(0, 50) + (selectedText.length > 50 ? '...' : ''),
      });

      // Find the source node
      const sourceNode = nodes.find((n) => n.id === nodeId);
      if (!sourceNode) {
        console.error('[useChatMessageFork] Source node not found:', nodeId);
        return;
      }

      const sourceData = sourceNode.data as unknown as AgentNodeData;

      // Calculate position to the RIGHT of source node
      const nodeWidth = (sourceNode.width as number) || (sourceNode.style?.width as number) || 600;
      const horizontalSpacing = 100;
      const forkPosition = {
        x: sourceNode.position.x + nodeWidth + horizontalSpacing,
        y: sourceNode.position.y, // Same Y coordinate
      };

      // Generate new IDs
      const timestamp = Date.now();
      const newNodeId = `node-${timestamp}`;
      const newAgentId = `agent-${crypto.randomUUID()}`;
      const newTerminalId = `terminal-${crypto.randomUUID()}`;
      const newSessionId = crypto.randomUUID();

      // Create forked node data - same workspace, same git branch, new session
      const forkedData: AgentNodeData = {
        agentId: newAgentId,
        terminalId: newTerminalId,
        agentType: sourceData.agentType,
        status: 'idle',
        title: createDefaultAgentTitle(`Fork: ${selectedText.slice(0, 30)}${selectedText.length > 30 ? '...' : ''}`),
        summary: null,
        progress: null,
        sessionId: newSessionId,
        parentSessionId: sessionId,
        workspacePath: sourceData.workspacePath,
        gitInfo: sourceData.gitInfo,
        createdAt: timestamp,
        // Keep attachments from parent (Linear issues, etc.)
        attachments: sourceData.attachments || [],
      };

      // Create the new forked node
      const forkedNode: Node = {
        id: newNodeId,
        type: sourceNode.type,
        position: forkPosition,
        data: forkedData as unknown as Record<string, unknown>,
        style: sourceNode.style,
      };

      // Create edge from source to forked node
      const newEdge: Edge = {
        id: `edge-${timestamp}`,
        source: nodeId,
        target: newNodeId,
        sourceHandle: null,
        targetHandle: null,
      };

      console.log('[useChatMessageFork] Creating forked node:', {
        newNodeId,
        newSessionId,
        position: forkPosition,
        workspacePath: forkedData.workspacePath,
      });

      // Add the new node and edge
      onAddNode(forkedNode);
      onAddEdge(newEdge);
    },
    [nodes, onAddNode, onAddEdge]
  );

  useEffect(() => {
    window.addEventListener('chat-message-fork', handleChatMessageFork);
    return () => {
      window.removeEventListener('chat-message-fork', handleChatMessageFork);
    };
  }, [handleChatMessageFork]);
}
