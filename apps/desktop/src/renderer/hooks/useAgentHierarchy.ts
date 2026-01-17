/**
 * useAgentHierarchy Hook
 *
 * Organizes agent nodes into a hierarchical structure: Project > Branch > Agent[]
 * Reads git info directly from node.data.gitInfo (populated by useAgentState).
 *
 * This hook extracts the hierarchy computation logic from Canvas.tsx,
 * providing a clean separation of concerns.
 */

import type { Edge, Node } from '@xyflow/react';
import { useMemo } from 'react';
import type { AgentNodeData } from '../types/agent-node';

// =============================================================================
// Types
// =============================================================================

/**
 * Entry representing a single agent in the hierarchy
 */
export interface AgentHierarchyEntry {
  /** React Flow node ID */
  nodeId: string;
  /** Agent identifier (from CodingAgentStatusManager) */
  agentId: string;
  /** Display name for the agent */
  name: string;
}

/**
 * Hierarchical structure organizing agents by project and branch
 * Structure: { [projectName]: { [branchName]: AgentHierarchyEntry[] } }
 */
export type AgentHierarchy = Record<string, Record<string, AgentHierarchyEntry[]>>;

/**
 * Return type for the useAgentHierarchy hook
 */
export interface UseAgentHierarchyReturn {
  /** Agents organized by project > branch */
  hierarchy: AgentHierarchy;
  /** Maps project folder names to their full paths */
  folderPathMap: Record<string, string>;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extracts the final folder name from a path
 * Example: "/Users/dev/my-project" -> "my-project"
 */
function getFolderName(path: string): string {
  const normalized = path.replace(/\/$/, '');
  const parts = normalized.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

/**
 * Finds workspace path from a connected workspace node
 */
function findWorkspacePathFromEdges(nodeId: string, nodes: Node[], edges: Edge[]): string | null {
  const connectedEdge = edges.find((e) => e.target === nodeId || e.source === nodeId);
  if (!connectedEdge) return null;

  const connectedNodeId =
    connectedEdge.source === nodeId ? connectedEdge.target : connectedEdge.source;
  const connectedNode = nodes.find((n) => n.id === connectedNodeId);

  if (connectedNode?.type === 'workspace' && connectedNode.data?.path) {
    return connectedNode.data.path as string;
  }

  return null;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook that organizes agent nodes into a hierarchical structure
 *
 * @param nodes - React Flow nodes array
 * @param edges - React Flow edges array
 * @returns Hierarchy structure and folder path mapping
 *
 * @example
 * ```tsx
 * const { hierarchy, folderPathMap } = useAgentHierarchy(nodes, edges);
 *
 * // hierarchy structure:
 * // {
 * //   "my-project": {
 * //     "main": [{ nodeId: "1", agentId: "agent-1", name: "Agent 1" }],
 * //     "feature-branch": [{ nodeId: "2", agentId: "agent-2", name: "Agent 2" }]
 * //   }
 * // }
 *
 * // folderPathMap structure:
 * // { "my-project": "/Users/dev/my-project" }
 * ```
 */
export function useAgentHierarchy(nodes: Node[], edges: Edge[]): UseAgentHierarchyReturn {
  return useMemo(() => {
    const hierarchy: AgentHierarchy = {};
    const folderPathMap: Record<string, string> = {};

    // Filter to agent nodes only
    const agentNodes = nodes.filter((node) => node.type === 'agent');

    for (const node of agentNodes) {
      const agentData = node.data as unknown as AgentNodeData;

      // Get workspace path from node data (single source of truth)
      // Fall back to finding connected workspace node via edges
      const projectPath: string | null =
        agentData.workspacePath || findWorkspacePathFromEdges(node.id, nodes, edges);

      // Get branch from node.data.gitInfo (populated by useAgentState)
      // This is the single source of truth - no need to fetch again
      const branch: string | null = agentData.gitInfo?.branch || null;

      // Extract project name from workspace path
      const project = projectPath ? getFolderName(projectPath) : 'Unknown Project';

      // Store mapping from folder name to full path
      if (projectPath) {
        folderPathMap[project] = projectPath;
      }

      // Use 'main' as fallback only if we truly have no branch info
      const branchName = branch || 'main';

      // Get display name for the agent
      const agentName = agentData.title?.value || agentData.agentId;

      // Build hierarchy structure
      if (!hierarchy[project]) {
        hierarchy[project] = {};
      }
      if (!hierarchy[project][branchName]) {
        hierarchy[project][branchName] = [];
      }

      hierarchy[project][branchName].push({
        nodeId: node.id,
        agentId: agentData.agentId,
        name: agentName,
      });
    }

    return { hierarchy, folderPathMap };
  }, [nodes, edges]);
}
