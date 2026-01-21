/**
 * AgentChatNode (Container)
 *
 * Container component for interactive chat with Claude Code via SDK.
 * Uses NodeContextProvider to provide agentService to AgentChatView.
 */

import { Handle, type NodeProps, NodeResizer, Position } from '@xyflow/react';
import { useCallback, useRef } from 'react';
import AgentChatView from '../../AgentChatView';
import { NodeContextProvider } from '../../context';
import { useNodeActions } from '../../features/canvas/context';
import { useAgentState } from '../../hooks/useAgentState';
import type { AgentNodeData } from '../../types/agent-node';
import '../../AgentNode.css';

/**
 * AgentChatNode
 *
 * Container component that:
 * 1. Uses useAgentState() for state management
 * 2. Sets up NodeContextProvider with agent-specific services
 * 3. Renders AgentChatView for chat functionality
 */
function AgentChatNode({ data, id, selected }: NodeProps) {
  const nodeActions = useNodeActions();

  // Capture initial data only once to prevent re-renders from unstable references
  const initialDataRef = useRef<AgentNodeData | null>(null);
  if (!initialDataRef.current) {
    initialDataRef.current = data as unknown as AgentNodeData;
  }
  const initialNodeData = initialDataRef.current;

  // Generate a stable sessionId if none exists (required for stateless API)
  const generatedSessionIdRef = useRef<string | null>(null);
  if (!generatedSessionIdRef.current && !initialNodeData.sessionId) {
    generatedSessionIdRef.current = crypto.randomUUID();
  }

  // ---------------------------------------------------------------------------
  // Single Source of Truth: useAgentState()
  // ---------------------------------------------------------------------------
  const agent = useAgentState({
    nodeId: id,
    initialNodeData,
  });

  // Resolve sessionId: use from state if exists, otherwise use generated one
  const sessionId = agent.session.id ?? generatedSessionIdRef.current ?? '';

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------
  const handleDataChange = useCallback(
    (updates: Partial<AgentNodeData>) => {
      // Update node data via context (not events) to prevent infinite loops
      nodeActions.mergeNodeData(id, updates as Record<string, unknown>);
    },
    [id, nodeActions]
  );

  // If no workspace, show message
  if (!agent.workspace.path) {
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
        {/* Target handle for incoming edges from agent nodes */}
        <Handle
          type="target"
          position={Position.Top}
          id="chat-target"
          className="agent-chat-handle"
        />
        <div style={{ padding: 20, color: '#888' }}>No workspace selected</div>
        {/* Source handle for outgoing edges */}
        <Handle type="source" position={Position.Bottom} className="agent-chat-handle" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <NodeContextProvider
      nodeId={id}
      nodeType="agent"
      terminalId={agent.config.terminalId}
      agentId={agent.config.agentId}
      sessionId={sessionId}
      agentType={agent.config.agentType}
      workspacePath={agent.workspace.path}
    >
      <div className={`agent-node ${selected ? 'selected' : ''}`}>
        <NodeResizer
          minWidth={450}
          minHeight={350}
          isVisible={true}
          lineStyle={{ borderColor: 'transparent' }}
          handleStyle={{ width: 24, height: 24, borderRadius: '50%' }}
          handleClassName="agent-node-resize-handle"
        />
        {/* Target handle for incoming edges from agent nodes */}
        <Handle
          type="target"
          position={Position.Top}
          id="chat-target"
          className="agent-chat-handle"
        />
        <AgentChatView
          nodeId={id}
          sessionId={sessionId}
          workspacePath={agent.workspace.path}
          agentType={agent.config.agentType}
          onSessionCreated={(newSessionId) => handleDataChange({ sessionId: newSessionId })}
          isSessionReady={agent.session.readiness === 'ready'}
          selected={selected}
        />
        {/* Source handle for outgoing edges */}
        <Handle type="source" position={Position.Bottom} className="agent-chat-handle" />
      </div>
    </NodeContextProvider>
  );
}

export default AgentChatNode;
