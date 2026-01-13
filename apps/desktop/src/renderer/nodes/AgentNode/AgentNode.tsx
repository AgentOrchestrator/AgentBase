/**
 * AgentNode (Container)
 *
 * Container component that sets up NodeContext for the agent node.
 * Wraps AgentNodePresentation with the appropriate context provider.
 */

import { useCallback, useEffect, useState } from 'react';
import { NodeProps } from '@xyflow/react';
import type { AgentNodeData } from '../../types/agent-node';
import { NodeContextProvider } from '../../context';
import { agentStore } from '../../stores';
import { AgentNodePresentation } from './AgentNodePresentation';

/**
 * AgentNode
 *
 * Container component that:
 * 1. Sets up NodeContextProvider with agent-specific services
 * 2. Subscribes to the agent store for data updates
 * 3. Dispatches data changes to the canvas
 */
function AgentNode({ data, id }: NodeProps) {
  const nodeData = data as unknown as AgentNodeData;

  // Subscribe to store updates for this agent
  const [agentData, setAgentData] = useState<AgentNodeData>(nodeData);

  useEffect(() => {
    // Try to get data from store first
    const storeData = agentStore.getAgent(nodeData.agentId);
    if (storeData) {
      setAgentData(storeData);
    }

    // Subscribe to updates
    const unsubscribe = agentStore.subscribe(nodeData.agentId, (updatedAgent) => {
      setAgentData(updatedAgent);
    });

    return unsubscribe;
  }, [nodeData.agentId]);

  // Handle data changes from presentation component
  const handleDataChange = useCallback(
    (updates: Partial<AgentNodeData>) => {
      const updatedData = { ...agentData, ...updates };

      // Update local state
      setAgentData(updatedData);

      // Notify canvas of changes
      window.dispatchEvent(
        new CustomEvent('update-node', {
          detail: { nodeId: id, data: updatedData },
        })
      );
    },
    [id, agentData]
  );

  // Extract workspace path from attachments for context config
  const workspacePath = agentData.attachments
    ?.filter((a) => a.type === 'workspace-metadata')
    .map((a) => (a as { path: string }).path)[0];

  return (
    <NodeContextProvider
      nodeId={id}
      nodeType="agent"
      terminalId={agentData.terminalId}
      agentId={agentData.agentId}
      agentType={agentData.agentType}
      workspacePath={workspacePath}
      autoStartCli={true}
    >
      <AgentNodePresentation
        data={agentData}
        onDataChange={handleDataChange}
      />
    </NodeContextProvider>
  );
}

export default AgentNode;
