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
    attachments: initialNodeData.attachments,
  });

  // ---------------------------------------------------------------------------
  // UI State (modal visibility - not domain state)
  // ---------------------------------------------------------------------------
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);

  // Check for prefilled workspace path (from locked folder)
  const prefilledWorkspacePath = (initialNodeData as any).prefilledWorkspacePath as string | undefined;

  // Show modal if no workspace is available (auto-open on mount)
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
        isMatching: agent.session.isMatching,
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
      sessionId={agent.session.id}
      agentType={agent.config.agentType}
      workspacePath={agent.workspace.path ?? undefined}
      autoStartCli={!!agent.workspace.path}
      initialPrompt={agent.config.initialPrompt}
    >
      <AgentNodePresentation
        data={agent.nodeData}
        onDataChange={handleDataChange}
        selected={selected}
        workspaceState={agent.workspace}
      />
      {/* Modal overlay - UI state managed locally */}
      <WorkspaceSelectionModal
        isOpen={showWorkspaceModal && !agent.workspace.path}
        onSelect={handleWorkspaceSelect}
        onCancel={handleWorkspaceCancel}
        initialPath={prefilledWorkspacePath || null}
      />
    </NodeContextProvider>
  );
}

export default AgentNode;
