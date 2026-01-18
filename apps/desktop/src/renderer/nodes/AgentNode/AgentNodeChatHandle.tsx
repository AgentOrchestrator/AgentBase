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
      className="agent-view-button"
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
      <svg
        width="16"
        height="16"
        viewBox="0 0 228 205"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g clipPath="url(#clip0_1020_226)">
          <path
            d="M113.574 190.137C179.199 190.137 227.148 150.098 227.148 95.0195C227.148 39.7461 179.102 0 113.574 0C47.9492 0 0 39.7461 0 95.0195C0 113.281 5.37109 130.273 14.7461 144.043C19.3359 150.879 20.9961 155.664 20.9961 159.668C20.9961 164.844 19.4336 169.043 14.9414 172.949C7.22656 179.492 11.2305 190.137 21.3867 190.137C33.5938 190.137 47.168 185.938 57.2266 179.004C73.7305 186.23 92.9688 190.137 113.574 190.137ZM113.574 174.414C94.9219 174.414 78.2227 170.898 64.0625 164.551C57.8125 161.816 53.3203 162.598 47.3633 166.113C43.1641 168.75 38.2812 170.996 33.3008 172.07C35.3516 168.652 36.7188 164.746 36.7188 159.668C36.7188 152.441 34.082 144.531 27.832 135.156C20.0195 123.828 15.7227 110.059 15.7227 95.0195C15.7227 49.2188 56.1523 15.7227 113.574 15.7227C170.996 15.7227 211.426 49.2188 211.426 95.0195C211.426 140.82 170.996 174.414 113.574 174.414Z"
            fill="currentColor"
            fillOpacity="0.85"
          />
          <path
            d="M121.68 131.836V58.0078C121.68 52.9297 118.359 49.6094 113.379 49.6094C108.691 49.6094 105.371 53.0273 105.371 58.0078V131.836C105.371 136.719 108.691 140.137 113.379 140.137C118.359 140.137 121.68 136.816 121.68 131.836ZM76.6602 103.027H150.488C155.371 103.027 158.789 99.8047 158.789 95.0195C158.789 90.0391 155.469 86.7188 150.488 86.7188H76.6602C71.6797 86.7188 68.2617 90.0391 68.2617 95.0195C68.2617 99.8047 71.6797 103.027 76.6602 103.027Z"
            fill="currentColor"
            fillOpacity="0.85"
          />
        </g>
        <defs>
          <clipPath id="clip0_1020_226">
            <rect width="227.148" height="204.59" fill="white" />
          </clipPath>
        </defs>
      </svg>
    </button>
  );
}
