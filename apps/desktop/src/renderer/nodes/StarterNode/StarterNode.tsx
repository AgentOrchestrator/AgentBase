/**
 * StarterNode (Container)
 *
 * Container component for the starter node.
 * Handles event dispatching to Canvas when user submits a message.
 *
 * Note: StarterNode is lightweight and transient - no NodeContext/services needed.
 * It only exists until the user submits, then gets replaced by an AgentNode.
 */

import type { NodeProps } from '@xyflow/react';
import { useCallback } from 'react';
import { StarterNodePresentation } from './StarterNodePresentation';

/**
 * Data passed to StarterNode
 */
interface StarterNodeData {
  placeholder?: string;
}

/**
 * StarterNode
 *
 * Container component that:
 * 1. Extracts node data and props
 * 2. Handles submit by dispatching custom event to Canvas
 * 3. Renders StarterNodePresentation
 */
function StarterNode({ data, selected, id }: NodeProps) {
  const nodeData = data as unknown as StarterNodeData;

  // Handle submit - dispatch event for Canvas to handle
  const handleSubmit = useCallback(
    (message: string) => {
      window.dispatchEvent(
        new CustomEvent('starter-node-submit', {
          detail: {
            nodeId: id,
            message,
          },
        })
      );
    },
    [id]
  );

  return (
    <StarterNodePresentation
      selected={selected}
      placeholder={nodeData.placeholder}
      onSubmit={handleSubmit}
    />
  );
}

export default StarterNode;
