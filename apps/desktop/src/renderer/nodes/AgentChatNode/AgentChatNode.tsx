/**
 * AgentChatNode (Container)
 *
 * Container component for interactive chat with Claude Code via SDK.
 * Manages node data persistence and wraps presentation.
 */

import { useCallback } from 'react';
import { NodeProps } from '@xyflow/react';
import { AgentChatNodePresentation } from './AgentChatNodePresentation';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  messageType?: string;
}

interface AgentChatNodeData {
  sessionId?: string;
  agentType: string;
  workspacePath?: string;
  title?: string;
  isExpanded?: boolean;
  messages: ChatMessage[];
  isDraft: boolean;
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
    (messages: ChatMessage[]) => {
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

  return (
    <AgentChatNodePresentation
      selected={selected}
      sessionId={nodeData.sessionId}
      agentType={nodeData.agentType}
      workspacePath={nodeData.workspacePath}
      title={nodeData.title}
      initialMessages={nodeData.messages || []}
      isDraft={nodeData.isDraft ?? true}
      initialExpanded={nodeData.isExpanded}
      onMessagesChange={handleMessagesChange}
      onSessionCreated={handleSessionCreated}
      onExpandedChange={(isExpanded) => dispatchNodeUpdate({ isExpanded })}
    />
  );
}

export default AgentChatNode;
