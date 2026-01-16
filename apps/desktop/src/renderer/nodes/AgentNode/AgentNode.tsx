/**
 * AgentNode (Container)
 *
 * Container component that sets up NodeContext for the agent node.
 * Uses useAgentState() as the single source of truth for all agent state.
 */

import { useCallback, useEffect, useState } from 'react';
import { NodeProps } from '@xyflow/react';
import type { AgentNodeData } from '../../types/agent-node';
import { NodeContextProvider } from '../../context';
import { AgentNodePresentation } from './AgentNodePresentation';
import { WorkspaceSelectionModal } from '../../components/WorkspaceSelectionModal';
import { useAgentState } from '../../hooks/useAgentState';

/**
 * AgentNode
 *
 * Container component that:
 * 1. Uses useAgentState() for all state management
 * 2. Sets up NodeContextProvider with agent-specific services
 * 3. Handles workspace selection modal (UI state only)
 */
function AgentNode({ data, id, selected }: NodeProps) {
  const initialNodeData = data as unknown as AgentNodeData;

  // ---------------------------------------------------------------------------
  // Single Source of Truth: useAgentState()
  // ---------------------------------------------------------------------------
  const agent = useAgentState({
    nodeId: id,
    initialNodeData,
  });

  // ---------------------------------------------------------------------------
  // UI State (modal visibility - not domain state)
  // ---------------------------------------------------------------------------
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);

// Use workspace path from node data (from Command+T modal or locked folder)
  const prefilledWorkspacePath = initialNodeData.workspacePath || undefined;

  // Automatically set workspace from prefilled path (from Command+T modal)
  useEffect(() => {
    if (prefilledWorkspacePath && !agent.workspace.path) {
      agent.actions.setWorkspace(prefilledWorkspacePath);
    }
  }, [prefilledWorkspacePath, agent.workspace.path, agent.actions]);

  // Show modal if no workspace is available and no prefilled path (auto-open on mount)
  useEffect(() => {
    if (!agent.workspace.path && !prefilledWorkspacePath && !showWorkspaceModal) {
      setShowWorkspaceModal(true);
    }
  }, [agent.workspace.path, prefilledWorkspacePath, showWorkspaceModal]);

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
      agent.actions.updateNodeData(updates);
    },
    [agent.actions]
  );

  // ---------------------------------------------------------------------------
  // Debug Logging
  // ---------------------------------------------------------------------------
  useEffect(() => {
    console.log('[AgentNode] State updated', {
      agentId: agent.config.agentId,
      workspace: {
        path: agent.workspace.path,
        source: agent.workspace.source,
        isProvisioning: agent.workspace.isProvisioning,
      },
      session: {
        id: agent.session.id,
      },
      isInitialized: agent.isInitialized,
    });
  }, [agent.config.agentId, agent.workspace, agent.session, agent.isInitialized]);

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
      autoStartCli={!!agent.workspace.path}
      initialPrompt={agent.config.initialPrompt}
    >
      <AgentNodePresentation
        data={agent.nodeData}
        onDataChange={handleDataChange}
        selected={selected}
        sessionReadiness={agent.session.readiness}
        nodeId={id}
      />
      {/* Modal overlay - UI state managed locally */}
      {/* Don't show modal if workspace is already set or if prefilled path exists (will be auto-set) */}
      <WorkspaceSelectionModal
        isOpen={showWorkspaceModal && !agent.workspace.path && !prefilledWorkspacePath}
        onSelect={handleWorkspaceSelect}
        onCancel={handleWorkspaceCancel}
        initialPath={prefilledWorkspacePath || null}
      />
    </NodeContextProvider>
  );
}

export default AgentNode;
