/**
 * ConversationNode (Container)
 *
 * Container component that sets up NodeContext for the conversation node.
 * Wraps ConversationNodePresentation with the appropriate context provider.
 */

import type { NodeProps } from '@xyflow/react';
import { useCallback } from 'react';
import { NodeContextProvider } from '../../context';
import type { ConversationNodeData } from '../schemas';
import { ConversationNodePresentation } from './ConversationNodePresentation';

/**
 * ConversationNode
 *
 * Container component that:
 * 1. Sets up NodeContextProvider with conversation-specific services
 * 2. Dispatches data changes to the canvas for persistence
 * 3. Renders ConversationNodePresentation
 */
function ConversationNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as ConversationNodeData;
  const {
    sessionId,
    agentType,
    title,
    projectName,
    messageCount,
    timestamp,
    isExpanded: initialExpanded,
  } = nodeData;

  // Dispatch node update for persistence
  const dispatchNodeUpdate = useCallback(
    (updates: Partial<ConversationNodeData>) => {
      const updatedData = { ...nodeData, ...updates };
      window.dispatchEvent(
        new CustomEvent('update-node', {
          detail: { nodeId: id, data: updatedData },
        })
      );
    },
    [id, nodeData]
  );

  // Handle expanded state change
  const handleExpandedChange = useCallback(
    (isExpanded: boolean) => {
      dispatchNodeUpdate({ isExpanded });
    },
    [dispatchNodeUpdate]
  );

  return (
    <NodeContextProvider
      nodeId={id}
      nodeType="conversation"
      sessionId={sessionId}
      agentType={agentType}
    >
      <ConversationNodePresentation
        selected={selected}
        title={title}
        projectName={projectName}
        messageCount={messageCount}
        timestamp={timestamp}
        initialExpanded={initialExpanded}
        onExpandedChange={handleExpandedChange}
      />
    </NodeContextProvider>
  );
}

export default ConversationNode;
