/**
 * Canvas State Request Handler Hook
 *
 * Registers handlers for canvas state requests from the main process.
 * This enables the orchestrator's MCP tools to query and manipulate
 * canvas state via IPC.
 */

import type { Node } from '@xyflow/react';
import { useEffect, useRef } from 'react';
import type {
  AgentSummary,
  CanvasStateHandlers,
  CreateAgentParams,
} from '../../../../main/preload';
import type { AgentNodeData } from '../../../types/agent-node';

// Import global types for window.canvasStateRequestAPI
import '../../../global.d';

/**
 * Props for the canvas state request handler hook
 */
export interface UseCanvasStateRequestHandlerProps {
  /** Function to get current nodes */
  getNodes: () => Node[];
  /** Function to add a new agent node */
  addAgentNode: (params: CreateAgentParams) => Promise<{ agentId: string }>;
  /** Function to delete an agent node */
  deleteAgentNode: (agentId: string) => void;
}

/**
 * Extract agent summary from a node
 */
function nodeToAgentSummary(node: Node): AgentSummary | null {
  if (node.type !== 'agent') {
    return null;
  }

  // Node.data is typed as Record<string, unknown> by React Flow
  // Cast through unknown to access AgentNodeData properties safely
  const data = node.data as unknown as AgentNodeData;
  return {
    id: data.agentId,
    title: data.title?.value || 'Untitled Agent',
    workspacePath: data.workspacePath || '',
    status: data.status,
  };
}

/**
 * Hook to register canvas state request handlers.
 *
 * This hook sets up IPC handlers that allow the main process
 * (specifically the orchestrator service) to query and manipulate
 * the canvas state.
 *
 * @example
 * ```tsx
 * function Canvas() {
 *   const { getNodes } = useReactFlow();
 *
 *   useCanvasStateRequestHandler({
 *     getNodes,
 *     addAgentNode: async (params) => {
 *       // Create agent node logic
 *       return { agentId: newAgent.id };
 *     },
 *     deleteAgentNode: (agentId) => {
 *       // Delete agent node logic
 *     },
 *   });
 *
 *   return <ReactFlow ... />;
 * }
 * ```
 */
export function useCanvasStateRequestHandler({
  getNodes,
  addAgentNode,
  deleteAgentNode,
}: UseCanvasStateRequestHandlerProps): void {
  // Use refs to always have access to latest functions without re-registering handlers
  const getNodesRef = useRef(getNodes);
  const addAgentNodeRef = useRef(addAgentNode);
  const deleteAgentNodeRef = useRef(deleteAgentNode);

  // Update refs on each render
  getNodesRef.current = getNodes;
  addAgentNodeRef.current = addAgentNode;
  deleteAgentNodeRef.current = deleteAgentNode;

  useEffect(() => {
    const api = window.canvasStateRequestAPI;
    if (!api) {
      console.warn('[useCanvasStateRequestHandler] canvasStateRequestAPI not available');
      return;
    }

    const handlers: CanvasStateHandlers = {
      listAgents: async () => {
        const nodes = getNodesRef.current();
        const agents = nodes
          .map(nodeToAgentSummary)
          .filter((agent): agent is AgentSummary => agent !== null);

        console.log('[useCanvasStateRequestHandler] listAgents:', {
          nodeCount: nodes.length,
          agentCount: agents.length,
        });

        return agents;
      },

      createAgent: async (params: CreateAgentParams) => {
        console.log('[useCanvasStateRequestHandler] createAgent:', {
          workspacePath: params.workspacePath,
          title: params.title,
          hasInitialPrompt: !!params.initialPrompt,
        });

        const result = await addAgentNodeRef.current(params);
        return result;
      },

      deleteAgent: async (agentId: string) => {
        console.log('[useCanvasStateRequestHandler] deleteAgent:', { agentId });
        deleteAgentNodeRef.current(agentId);
      },
    };

    const cleanup = api.registerHandlers(handlers);

    console.log('[useCanvasStateRequestHandler] Handlers registered');

    return () => {
      cleanup();
      console.log('[useCanvasStateRequestHandler] Handlers unregistered');
    };
  }, []); // Empty deps - handlers use refs
}
