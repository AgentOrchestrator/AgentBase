/**
 * Canvas State Request Handler Hook
 *
 * Registers handlers for canvas state requests from the main process.
 * This enables the orchestrator's MCP tools to query and manipulate
 * canvas state via IPC.
 */

import type { AgentProgress } from '@agent-orchestrator/shared';
import type { Node } from '@xyflow/react';
import { useEffect, useRef } from 'react';
import type {
  AgentSessionData,
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
  /** Function to get session data for an agent */
  getAgentSession?: (agentId: string, maxMessages?: number) => Promise<AgentSessionData | null>;
}

/**
 * Format progress as a human-readable string
 * Returns null if no progress info available
 */
function formatProgressInfo(progress: AgentProgress | null | undefined): string | null {
  if (!progress) {
    return null;
  }

  if (progress.type === 'percentage') {
    return `${progress.value}%${progress.label ? ` - ${progress.label}` : ''}`;
  }

  if (progress.type === 'todoList') {
    const completed = progress.items.filter((item) => item.completed).length;
    const total = progress.items.length;
    const currentTask = progress.items.find((item) => !item.completed);
    const taskInfo = currentTask ? ` - ${currentTask.content}` : '';
    return `${completed}/${total} tasks${taskInfo}`;
  }

  // Unknown progress type - should not happen with discriminated unions
  return null;
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
    summary: data.summary,
    initialPrompt: data.initialPrompt,
    progressInfo: formatProgressInfo(data.progress) ?? undefined,
    sessionId: data.sessionId,
    agentType: data.agentType,
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
  getAgentSession,
}: UseCanvasStateRequestHandlerProps): void {
  // Use refs to always have access to latest functions without re-registering handlers
  const getNodesRef = useRef(getNodes);
  const addAgentNodeRef = useRef(addAgentNode);
  const deleteAgentNodeRef = useRef(deleteAgentNode);
  const getAgentSessionRef = useRef(getAgentSession);

  // Update refs on each render
  getNodesRef.current = getNodes;
  addAgentNodeRef.current = addAgentNode;
  deleteAgentNodeRef.current = deleteAgentNode;
  getAgentSessionRef.current = getAgentSession;

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

      getAgentSession: async (agentId: string, maxMessages?: number) => {
        console.log('[useCanvasStateRequestHandler] getAgentSession:', { agentId, maxMessages });

        const handler = getAgentSessionRef.current;
        if (!handler) {
          console.warn('[useCanvasStateRequestHandler] getAgentSession handler not provided');
          return null;
        }

        return handler(agentId, maxMessages);
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
