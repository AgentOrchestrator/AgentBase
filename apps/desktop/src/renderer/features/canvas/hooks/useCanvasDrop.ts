import type { Node } from '@xyflow/react';
import { useCallback } from 'react';
import { createDefaultAgentTitle } from '../../../types/agent-node';
import { createLinearIssueAttachment } from '../../../types/attachments';

/**
 * Linear issue data structure (from Linear API)
 */
export interface LinearIssue {
  id: string;
  title: string;
  identifier: string;
  description?: string;
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
  /** Callback to open agent modal with position and Linear issue data */
  onOpenAgentModal?: (position: { x: number; y: number }, linearIssue: LinearIssue) => void;
}

/**
 * Hook for handling drag and drop operations on the canvas
 *
 * Supports:
 * - Dragging Linear issues from the issues pill
 * - Dropping workspace metadata to create agent nodes
 * - Dropping Linear issues to open agent modal (instead of creating terminal nodes)
 *
 * @param options - Configuration options for the hook
 */
export function useCanvasDrop(options: UseCanvasDropOptions): UseCanvasDropReturn {
  const { screenToFlowPosition, setNodes, isPillExpanded, collapsePill, onOpenAgentModal } =
    options;

  /**
   * Handler for when a drag starts on an issue card
   * Sets up the data transfer with JSON and text fallback
   */
  const handleIssueDragStart = useCallback((e: React.DragEvent, issue: LinearIssue) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify(issue));
    e.dataTransfer.setData('text/plain', `${issue.identifier}: ${issue.title}`);
  }, []);

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
   * 2. Linear issue: Opens agent modal with the issue data (user can then create agent)
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

        // Handle based on attachment type
        if (attachmentType === 'workspace-metadata') {
          // For workspace drops, create an agent node instead of terminal
          const terminalId = `terminal-${crypto.randomUUID()}`;
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
          // For Linear issues, open the agent modal instead of creating a terminal node
          // Check if this looks like a Linear issue (has identifier field)
          if (data.identifier && onOpenAgentModal) {
            onOpenAgentModal(position, data as LinearIssue);
          } else {
            // Fallback: if no callback provided, create terminal node (backward compatibility)
            const attachment = createLinearIssueAttachment(data);
            const terminalId = `terminal-${crypto.randomUUID()}`;
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
        }

        // Close the issues pill after dropping
        if (isPillExpanded) {
          collapsePill();
        }
      } catch (error) {
        console.error('Error handling drop:', error);
      }
    },
    [screenToFlowPosition, setNodes, isPillExpanded, collapsePill, onOpenAgentModal]
  );

  return {
    handleIssueDragStart,
    handleCanvasDrop,
    handleCanvasDragOver,
  };
}
