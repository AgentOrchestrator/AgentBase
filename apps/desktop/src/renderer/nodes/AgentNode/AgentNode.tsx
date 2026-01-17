/**
 * AgentNode (Container)
 *
 * Container component that sets up NodeContext for the agent node.
 * Uses useAgentState() as the single source of truth for all agent state.
 */

import { useCallback, useEffect, useState, useRef } from 'react';
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

  // Use a ref to access current nodeData without causing callback recreation
  const nodeDataRef = useRef(agent.nodeData);
  nodeDataRef.current = agent.nodeData;

  const handleDataChange = useCallback(
    (updates: Partial<AgentNodeData>) => {
      // Dispatch update directly to Canvas for node data changes
      // Use ref to get current nodeData to avoid callback recreation on every nodeData change
      console.log('[AgentNode] handleDataChange called:', {
        nodeId: id,
        updateKeys: Object.keys(updates),
        summary: 'summary' in updates ? (updates.summary as string)?.substring(0, 50) : 'NOT_IN_UPDATE',
        lastUserMessage: 'lastUserMessage' in updates ? (updates.lastUserMessage as string)?.substring(0, 50) : 'NOT_IN_UPDATE',
      });
      window.dispatchEvent(
        new CustomEvent('update-node', {
          detail: { nodeId: id, data: { ...nodeDataRef.current, ...updates } },
        })
      );
    },
    [id]
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
