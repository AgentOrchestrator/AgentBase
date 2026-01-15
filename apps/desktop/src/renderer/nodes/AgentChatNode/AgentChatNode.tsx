/**
 * AgentChatNode (Container)
 *
 * Container component for interactive chat with Claude Code via SDK.
 * Uses AgentChatView (same as agent node) wrapped in node container.
 */

import { useCallback } from 'react';
import { NodeProps, NodeResizer } from '@xyflow/react';
import AgentChatView from '../../AgentChatView';
import type { CodingAgentMessage } from '@agent-orchestrator/shared';
import '../../AgentNode.css';

interface AgentChatNodeData {
  sessionId?: string;
  agentType: string;
  workspacePath?: string;
  title?: string;
  isExpanded?: boolean;
  messages: CodingAgentMessage[];
  isDraft: boolean;
  agentId?: string;
}

function AgentChatNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as AgentChatNodeData;

  const dispatchNodeUpdate = useCallback(
    (updates: Partial<AgentChatNodeData>) => {
      const updatedData = { ...nodeData, ...updates };
      window.dispatchEvent(
        new CustomEvent('update-node', {
          detail: { nodeId: id, data: updatedData },
        })
      );
    },
    [id, nodeData]
  );

  const handleMessagesChange = useCallback(
    (messages: CodingAgentMessage[]) => {
      dispatchNodeUpdate({ messages });
    },
    [dispatchNodeUpdate]
  );

  const handleSessionCreated = useCallback(
    (sessionId: string) => {
      dispatchNodeUpdate({ sessionId, isDraft: false });
    },
    [dispatchNodeUpdate]
  );

  // Use agentId from data or generate one from nodeId
  const agentId = nodeData.agentId || `agent-${id}`;

  return (
    <div className={`agent-node ${selected ? 'selected' : ''}`}>
      <NodeResizer
        minWidth={450}
        minHeight={350}
        isVisible={true}
        lineStyle={{ borderColor: 'transparent' }}
        handleStyle={{ width: 24, height: 24, borderRadius: '50%' }}
        handleClassName="agent-node-resize-handle"
      />
      <AgentChatView
        agentId={agentId}
        sessionId={nodeData.sessionId}
        agentType={nodeData.agentType}
        workspacePath={nodeData.workspacePath}
        initialMessages={nodeData.messages || []}
        onMessagesChange={handleMessagesChange}
        onSessionCreated={handleSessionCreated}
        isSessionReady={true}
        selected={selected}
      />
    </div>
  );
}

export default AgentChatNode;
