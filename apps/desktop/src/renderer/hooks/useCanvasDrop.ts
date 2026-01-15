import { useCallback } from 'react';
import type { Node } from '@xyflow/react';
import { createLinearIssueAttachment } from '../types/attachments';
import { createDefaultAgentTitle } from '../types/agent-node';

/**
 * Linear issue data structure (from Linear API)
 */
export interface LinearIssue {
  id: string;
  title: string;
  identifier: string;
  state: {
    id: string;
    name: string;
    color: string;
    type?: string;
  };
  priority: number;
  assignee?: {
    name: string;
    avatarUrl?: string;
  };
  project?: {
    id: string;
    name: string;
  };
  projectMilestone?: {
    id: string;
    name: string;
    project?: {
      id: string;
      name: string;
    };
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Return type for the useCanvasDrop hook
 */
export interface UseCanvasDropReturn {
  /** Handler for when a drag starts on an issue card */
  handleIssueDragStart: (event: React.DragEvent, issue: LinearIssue) => void;
  /** Handler for when something is dropped on the canvas */
  handleCanvasDrop: (event: React.DragEvent) => void;
  /** Handler for drag over events on the canvas */
  handleCanvasDragOver: (event: React.DragEvent) => void;
}

/**
 * Options for the useCanvasDrop hook
 */
export interface UseCanvasDropOptions {
  /** Function to convert screen coordinates to flow position */
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number };
  /** React setState function for nodes */
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  /** Whether the pill is currently expanded */
  isPillExpanded: boolean;
  /** Function to collapse the pill */
  collapsePill: () => void;
}

/**
 * Hook for handling drag and drop operations on the canvas
 *
 * Supports:
 * - Dragging Linear issues from the issues pill
 * - Dropping workspace metadata to create agent nodes
 * - Dropping Linear issues to create terminal nodes
 *
 * @param options - Configuration options for the hook
 */
export function useCanvasDrop(options: UseCanvasDropOptions): UseCanvasDropReturn {
  const { screenToFlowPosition, setNodes, isPillExpanded, collapsePill } = options;

  /**
   * Handler for when a drag starts on an issue card
   * Sets up the data transfer with JSON and text fallback
   */
  const handleIssueDragStart = useCallback(
    (e: React.DragEvent, issue: LinearIssue) => {
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('application/json', JSON.stringify(issue));
      e.dataTransfer.setData('text/plain', `${issue.identifier}: ${issue.title}`);
    },
    []
  );

  /**
   * Handler for drag over events to allow dropping
   */
  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  /**
   * Handler for when something is dropped on the canvas
   *
   * Handles two types of drops:
   * 1. workspace-metadata: Creates an agent node with workspacePath
   * 2. Linear issue: Creates a terminal node with the issue attached
   */
  const handleCanvasDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();

      try {
        const jsonData = e.dataTransfer.getData('application/json');
        if (!jsonData) return;

        const data = JSON.parse(jsonData);
        const attachmentType = e.dataTransfer.getData('attachment-type');

        // Get the drop position relative to the ReactFlow canvas
        const position = screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });

        const terminalId = `terminal-${crypto.randomUUID()}`;

        // Handle based on attachment type
        if (attachmentType === 'workspace-metadata') {
          // For workspace drops, create an agent node instead of terminal
          const agentId = crypto.randomUUID();
          const newNode: Node = {
            id: `node-${Date.now()}`,
            type: 'agent',
            position,
            data: {
              agentId,
              terminalId,
              agentType: 'claude_code',
              status: 'idle',
              title: createDefaultAgentTitle(),
              summary: null,
              progress: null,
              workspacePath: data.path,
            },
            style: {
              width: 600,
              height: 400,
            },
          };
          setNodes((nds) => [...nds, newNode]);
        } else {
          // Create Linear issue attachment for terminal node
          const attachment = createLinearIssueAttachment(data);
          const newNode: Node = {
            id: `node-${Date.now()}`,
            type: 'terminal',
            position,
            data: {
              terminalId,
              attachments: [attachment],
            },
            style: {
              width: 600,
              height: 400,
            },
          };
          setNodes((nds) => [...nds, newNode]);
        }

        // Close the issues pill after dropping
        if (isPillExpanded) {
          collapsePill();
        }
      } catch (error) {
        console.error('Error handling drop:', error);
      }
    },
    [screenToFlowPosition, setNodes, isPillExpanded, collapsePill]
  );

  return {
    handleIssueDragStart,
    handleCanvasDrop,
    handleCanvasDragOver,
  };
}
