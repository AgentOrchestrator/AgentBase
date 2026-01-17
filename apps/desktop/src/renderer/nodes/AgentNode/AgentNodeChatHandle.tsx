export interface AgentNodeChatHandleProps {
  nodeId?: string;
  agentId: string;
  sessionId?: string;
  agentType: string;
  workspacePath?: string;
  title: string;
}

export function AgentNodeChatHandle({
  nodeId,
  agentId,
  sessionId,
  agentType,
  workspacePath,
  title,
}: AgentNodeChatHandleProps) {
  return (
    <button
      className="agent-node-chat-button"
      onClick={(e) => {
        e.stopPropagation();
        if (!nodeId) return;
        window.dispatchEvent(
          new CustomEvent('agent-node:create-chat-node', {
            detail: {
              nodeId,
              agentId,
              sessionId,
              agentType,
              workspacePath,
              title,
            },
            bubbles: true,
          })
        );
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      title="Create Chat Node"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12,5 C7.40326,5 4,8.07312 4,11.5 C4,13.5136 5.14136,15.3721 7.0416,16.5964 C7.78041,17.0724 7.98058,17.9987 8.0143,18.8184 C8.76669,18.5086 9.27173,17.6587 10.1858,17.8316 C10.7677,17.9416 11.3749,18 12,18 C16.5967,18 20,14.9269 20,11.5 C20,8.07312 16.5967,5 12,5 Z M2,11.5 C2,6.64261 6.65561,3 12,3 C17.3444,3 22,6.64261 22,11.5 C22,16.3574 17.3444,20 12,20 C11.3472,20 10.708,19.9469 10.0886,19.8452 C9.99597,19.918 9.83571,20.0501 9.63851,20.1891 C9.0713,20.5887 8.24917,21 7,21 C6.44772,21 6,20.5523 6,20 C6,19.4499 6.14332,18.7663 5.90624,18.2438 C3.57701,16.7225 2,14.2978 2,11.5 Z" fill="currentColor"/>
      </svg>
    </button>
  );
}
