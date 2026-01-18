/**
 * Canvas Node Service
 *
 * Business logic for creating different types of canvas nodes.
 * Extracts node creation logic from Canvas.tsx for better testability
 * and separation of concerns.
 */

import type { GitInfo, TerminalAttachment } from '@agent-orchestrator/shared';
import type { Node } from '@xyflow/react';
import { type AgentNodeData, type AgentTitle, createDefaultAgentTitle } from '../types/agent-node';

// =============================================================================
// Types
// =============================================================================

/**
 * Base options for creating any node
 */
export interface CreateNodeOptions {
  /** Explicit position for the node */
  position?: { x: number; y: number };
  /** Position from context menu (will be converted to flow position) */
  contextMenuPosition?: { x: number; y: number } | null;
  /** Function to convert screen coordinates to flow coordinates */
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number };
}

/**
 * Options for creating an agent node
 */
export interface CreateAgentOptions extends CreateNodeOptions {
  /** Git info for the workspace (required - only git directories allowed) */
  gitInfo: GitInfo;
  /** Pre-filled workspace path */
  workspacePath?: string;
  /** Locked folder path from canvas settings */
  lockedFolderPath?: string | null;
  /** Data from the new agent modal */
  modalData?: {
    title: string;
    description: string;
    workspacePath?: string;
    todo?: string;
    priority?: string;
    assignee?: string;
    project?: string;
    labels?: string[];
  };
  /** Initial attachments to attach to the agent (e.g., Linear issues) */
  initialAttachments?: TerminalAttachment[];
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Service for creating canvas nodes
 *
 * @example
 * ```tsx
 * const nodeService = new CanvasNodeService();
 *
 * const agentNode = nodeService.createAgentNode({
 *   screenToFlowPosition,
 *   lockedFolderPath: '/my/project',
 *   modalData: { title: 'My Agent', description: 'Does stuff' }
 * });
 *
 * setNodes(nds => [...nds, agentNode]);
 * ```
 */
export class CanvasNodeService {
  /**
   * Resolve the position for a new node
   * Priority: explicit position > context menu > viewport center
   */
  private resolvePosition(options: CreateNodeOptions): { x: number; y: number } {
    const { position, contextMenuPosition, screenToFlowPosition } = options;

    // Use explicit position if provided
    if (position) {
      return position;
    }

    // Convert context menu position to flow coordinates
    if (contextMenuPosition) {
      return screenToFlowPosition({
        x: contextMenuPosition.x,
        y: contextMenuPosition.y,
      });
    }

    // Default to center of viewport
    return screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
  }

  /**
   * Create an agent node
   */
  createAgentNode(options: CreateAgentOptions): Node {
    const nodePosition = this.resolvePosition(options);
    const { gitInfo, workspacePath, lockedFolderPath, modalData, initialAttachments } = options;

    // Generate unique IDs
    const agentId = `agent-${crypto.randomUUID()}`;
    const terminalId = `terminal-${crypto.randomUUID()}`;
    const sessionId = crypto.randomUUID();
    const createdAt = Date.now();

    console.log('[CanvasNodeService] Creating agent node', {
      agentId,
      terminalId,
      createdAt: new Date(createdAt).toISOString(),
      gitInfo,
      modalData,
    });

    // Use title from modal if provided, otherwise use default
    const nodeTitle: AgentTitle = modalData?.title
      ? { value: modalData.title, isManuallySet: true }
      : createDefaultAgentTitle();

    // Determine workspace path: modal > explicit > locked folder
    const selectedWorkspacePath =
      modalData?.workspacePath || workspacePath || lockedFolderPath || '';

    // Store description in initialPrompt if provided (for auto-sending as first message)
    const description = modalData?.description?.trim();
    const initialPrompt = description || undefined;

    const data: AgentNodeData = {
      agentId,
      terminalId,
      agentType: 'claude_code',
      status: 'idle',
      title: nodeTitle,
      summary: description || null,
      progress: null,
      attachments: initialAttachments || [],
      activeView: 'overview',
      sessionId,
      createdAt,
      forking: false,
      workspacePath: selectedWorkspacePath,
      gitInfo,
      initialPrompt,
    };

    return {
      id: `node-${createdAt}`,
      type: 'agent',
      position: nodePosition,
      data: data as unknown as Record<string, unknown>,
      style: {
        width: 500,
        height: 450,
      },
    };
  }

  /**
   * Create a terminal node
   */
  createTerminalNode(options: CreateNodeOptions): Node {
    const nodePosition = this.resolvePosition(options);
    const terminalId = `terminal-${crypto.randomUUID()}`;

    return {
      id: `node-${Date.now()}`,
      type: 'terminal',
      position: nodePosition,
      data: {
        terminalId,
      },
      style: {
        width: 600,
        height: 400,
      },
    };
  }

  /**
   * Create a starter node
   */
  createStarterNode(options: CreateNodeOptions): Node {
    const nodePosition = this.resolvePosition(options);

    return {
      id: `node-${Date.now()}`,
      type: 'starter',
      position: nodePosition,
      data: {
        placeholder: 'Ask Claude anything... (Enter to send)',
      },
      style: {
        width: 500,
        height: 180,
      },
    };
  }

  /**
   * Create a Claude Code terminal node (auto-starts claude command)
   */
  createClaudeCodeTerminalNode(options: CreateNodeOptions): Node {
    const nodePosition = this.resolvePosition(options);
    const terminalId = `terminal-${crypto.randomUUID()}`;

    return {
      id: `node-${Date.now()}`,
      type: 'terminal',
      position: nodePosition,
      data: {
        terminalId,
        autoStartClaude: true,
      },
      style: {
        width: 600,
        height: 400,
      },
    };
  }

  /**
   * Create a browser node
   */
  createBrowserNode(options: CreateNodeOptions): Node {
    const nodePosition = this.resolvePosition(options);
    const browserId = `browser-${crypto.randomUUID()}`;

    return {
      id: `node-${Date.now()}`,
      type: 'browser',
      position: nodePosition,
      data: {
        browserId,
      },
      style: {
        width: 800,
        height: 600,
      },
    };
  }

  /**
   * Create an agent node from a starter node submission
   */
  createAgentNodeFromStarter(
    message: string,
    starterPosition: { x: number; y: number },
    workingDirectory: string,
    gitInfo: GitInfo
  ): Node {
    const terminalId = `terminal-${crypto.randomUUID()}`;
    const agentId = `agent-${Date.now()}`;
    const sessionId = crypto.randomUUID();
    const createdAt = Date.now();

    console.log('[CanvasNodeService] Creating agent node from starter', {
      agentId,
      terminalId,
      createdAt: new Date(createdAt).toISOString(),
      workingDirectory,
      gitInfo,
    });

    const data: AgentNodeData = {
      agentId,
      terminalId,
      agentType: 'claude_code',
      status: 'idle',
      title: {
        value: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
        isManuallySet: false,
      },
      summary: null,
      progress: null,
      initialPrompt: message,
      workspacePath: workingDirectory,
      sessionId,
      createdAt,
      gitInfo,
    };

    return {
      id: `node-${createdAt}`,
      type: 'agent',
      position: {
        x: starterPosition.x,
        y: starterPosition.y + 150,
      },
      data: data as unknown as Record<string, unknown>,
      style: { width: 600 },
    };
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

/**
 * Singleton instance of CanvasNodeService
 */
export const canvasNodeService = new CanvasNodeService();
