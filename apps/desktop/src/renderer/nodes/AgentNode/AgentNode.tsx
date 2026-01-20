/**
 * AgentNode (Container)
 *
 * Container component that sets up NodeContext for the agent node.
 * Uses useAgentState() as the single source of truth for all agent state.
 */

import { type NodeProps, useUpdateNodeInternals } from '@xyflow/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { WorkspaceSelectionModal } from '../../components/WorkspaceSelectionModal';
import { NodeContextProvider } from '../../context';
import { useNodeActions } from '../../features/canvas/context';
import { useAgentState } from '../../hooks/useAgentState';
import type { AgentNodeData } from '../../types/agent-node';
import { AgentNodePresentation } from './AgentNodePresentation';

/**
 * AgentNode
 *
 * Container component that:
 * 1. Uses useAgentState() for all state management
 * 2. Sets up NodeContextProvider with agent-specific services
 * 3. Handles workspace selection modal (UI state only)
 */
function AgentNode({ data, id, selected }: NodeProps) {
  const updateNodeInternals = useUpdateNodeInternals();
  const nodeActions = useNodeActions();

  // Capture initial data only once to prevent re-renders from unstable references
  const initialDataRef = useRef<AgentNodeData | null>(null);
  if (!initialDataRef.current) {
    initialDataRef.current = data as unknown as AgentNodeData;
  }
  const initialNodeData = initialDataRef.current;

  // Sync with React Flow node data updates (e.g., from Canvas update-node events)
  // This ensures useAgentState receives the latest data when Canvas updates the node
  const currentData = data as unknown as AgentNodeData;
  const [syncedData, setSyncedData] = useState<AgentNodeData>(initialNodeData);

  useEffect(() => {
    // Update synced data when React Flow node data changes
    // This happens when Canvas dispatches update-node events
    setSyncedData(currentData);
  }, [currentData]);

  // Update React Flow's internal handle position tracking after mount
  // This ensures handles on all sides are properly registered for edge connections
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, updateNodeInternals]);

  // ---------------------------------------------------------------------------
  // Single Source of Truth: useAgentState()
  // ---------------------------------------------------------------------------
  const agent = useAgentState({
    nodeId: id,
    initialNodeData: syncedData,
  });

  // ---------------------------------------------------------------------------
  // UI State (modal visibility - not domain state)
  // ---------------------------------------------------------------------------
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);

  // Show modal if no workspace is available (auto-open on mount)
  // Workspace path should already be set in initialNodeData if created with one
  useEffect(() => {
    if (!agent.workspace.path && !showWorkspaceModal) {
      setShowWorkspaceModal(true);
    }
  }, [agent.workspace.path, showWorkspaceModal]);

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------
  const handleWorkspaceSelect = useCallback(
    (path: string) => {
      setShowWorkspaceModal(false);
      agent.actions.setWorkspace(path);
    },
    [agent.actions]
  );

  const handleWorkspaceCancel = useCallback(() => {
    agent.actions.deleteNode();
  }, [agent.actions]);

  const handleDataChange = useCallback(
    (updates: Partial<AgentNodeData>) => {
      // Update node data via context (not events) to prevent infinite loops
      nodeActions.mergeNodeData(id, updates as Record<string, unknown>);
    },
    [id, nodeActions]
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <NodeContextProvider
      nodeId={id}
      nodeType="agent"
      terminalId={agent.config.terminalId}
      agentId={agent.config.agentId}
      sessionId={agent.session.id ?? undefined}
      agentType={agent.config.agentType}
      workspacePath={agent.workspace.path ?? undefined}
      initialPrompt={agent.config.initialPrompt}
    >
      <AgentNodePresentation
        data={agent.nodeData}
        onDataChange={handleDataChange}
        selected={selected}
        sessionReadiness={agent.session.readiness}
        nodeId={id}
        sessionCreatedAgo={agent.session.createdAgo}
      />
      {/* Modal overlay - UI state managed locally */}
      <WorkspaceSelectionModal
        isOpen={showWorkspaceModal && !agent.workspace.path}
        onSelect={handleWorkspaceSelect}
        onCancel={handleWorkspaceCancel}
        initialPath={null}
      />
    </NodeContextProvider>
  );
}

export default AgentNode;
