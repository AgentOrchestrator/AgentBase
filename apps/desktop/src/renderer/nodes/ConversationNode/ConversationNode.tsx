/**
 * ConversationNode (Container)
 *
 * Container component that sets up NodeContext for the conversation node.
 * Wraps ConversationNodePresentation with the appropriate context provider.
 */

import type { NodeProps } from '@xyflow/react';
import { useCallback } from 'react';
import { NodeContextProvider } from '../../context';
import { useNodeActions } from '../../features/canvas/context';
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
  const nodeActions = useNodeActions();
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

  // Update node data via context (not events) to prevent infinite loops
  const dispatchNodeUpdate = useCallback(
    (updates: Partial<ConversationNodeData>) => {
      nodeActions.mergeNodeData(id, updates as Record<string, unknown>);
    },
    [id, nodeActions]
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
