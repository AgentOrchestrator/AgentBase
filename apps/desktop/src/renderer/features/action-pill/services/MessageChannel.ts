/**
 * Message Channel Abstraction
 *
 * Provides a unified interface for sending messages to agents,
 * abstracting away the transport mechanism (terminal vs SDK).
 *
 * MessagePill only needs to call channel.send(message) without
 * knowing whether it's communicating via terminal or SDK API.
 *
 * For SDK agents, messages are dispatched via the global MessageDispatcher
 * so that AgentChatView can receive them and display in the chat UI.
 *
 * For terminal agents, messages are sent directly to the terminal PTY.
 */

import type { AgentAction } from '@agent-orchestrator/shared';

/**
 * Event dispatched when a message should be sent to an SDK agent.
 * AgentChatView listens for these events to trigger sendMessage.
 */
export interface AgentMessageEvent {
  agentId: string;
  sessionId: string;
  workspacePath: string;
  message: string;
}

type MessageEventCallback = (event: AgentMessageEvent) => void;

/**
 * Global message dispatcher for SDK agent messages.
 * Allows MessagePill to send messages that AgentChatView receives.
 */
class MessageDispatcher {
  private static instance: MessageDispatcher | null = null;
  private listeners = new Map<string, Set<MessageEventCallback>>();

  static getInstance(): MessageDispatcher {
    if (!MessageDispatcher.instance) {
      MessageDispatcher.instance = new MessageDispatcher();
    }
    return MessageDispatcher.instance;
  }

  /**
   * Subscribe to messages for a specific agent.
   * @param agentId The agent ID to listen for
   * @param callback Called when a message is dispatched to this agent
   * @returns Unsubscribe function
   */
  subscribe(agentId: string, callback: MessageEventCallback): () => void {
    if (!this.listeners.has(agentId)) {
      this.listeners.set(agentId, new Set());
    }
    this.listeners.get(agentId)?.add(callback);

    return () => {
      this.listeners.get(agentId)?.delete(callback);
      if (this.listeners.get(agentId)?.size === 0) {
        this.listeners.delete(agentId);
      }
    };
  }

  /**
   * Dispatch a message to an agent.
   * All subscribers for that agentId will be notified.
   */
  dispatch(event: AgentMessageEvent): void {
    const callbacks = this.listeners.get(event.agentId);
    if (!callbacks || callbacks.size === 0) {
      console.warn(
        `[MessageDispatcher] No listeners for agent ${event.agentId}. Message not delivered.`
      );
      return;
    }

    callbacks.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error('[MessageDispatcher] Error in message callback:', err);
      }
    });
  }
}

export const messageDispatcher = MessageDispatcher.getInstance();

/**
 * Abstract interface for message delivery to agents
 */
export interface MessageChannel {
  /** Send a message to the agent */
  send(message: string): Promise<void>;
  /** Channel type for debugging/logging */
  readonly type: 'terminal' | 'sdk';
}

/**
 * Terminal-based message channel
 *
 * Sends messages directly to the agent's terminal via electronAPI.
 * Used for Claude Code CLI and other terminal-based agents.
 */
class TerminalChannel implements MessageChannel {
  readonly type = 'terminal' as const;

  constructor(private readonly terminalId: string) {}

  async send(message: string): Promise<void> {
    if (!window.electronAPI?.sendTerminalInput) {
      throw new Error('electronAPI.sendTerminalInput not available');
    }
    // Send message followed by newline to submit
    window.electronAPI.sendTerminalInput(this.terminalId, `${message}\n`);
  }
}

/**
 * SDK-based message channel
 *
 * Dispatches messages via the MessageDispatcher so that
 * AgentChatView can receive them and display in the chat UI.
 */
class SdkChannel implements MessageChannel {
  readonly type = 'sdk' as const;

  constructor(
    private readonly agentId: string,
    private readonly sessionId: string,
    private readonly workspacePath: string
  ) {}

  async send(message: string): Promise<void> {
    messageDispatcher.dispatch({
      agentId: this.agentId,
      sessionId: this.sessionId,
      workspacePath: this.workspacePath,
      message,
    });
  }
}

/**
 * Factory function to create the appropriate message channel
 *
 * Determines channel type based on action data:
 * - Terminal-based agents have terminalId
 * - SDK-based agents have sessionId + workspacePath
 *
 * @param action The agent action containing routing information
 * @returns MessageChannel instance or null if no valid channel can be created
 */
export function createMessageChannel(action: AgentAction): MessageChannel | null {
  // Terminal-based agent: has terminalId
  if (action.terminalId) {
    return new TerminalChannel(action.terminalId);
  }

  // SDK-based agent: has sessionId and workspacePath
  if (action.sessionId && action.workspacePath) {
    return new SdkChannel(action.agentId, action.sessionId, action.workspacePath);
  }

  // No valid routing information
  return null;
}
