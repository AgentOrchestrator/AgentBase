import { z } from 'zod';
import { getIpcBridge } from '../ipc-bridge';
import type { Tool } from '../tool-registry';

const inputSchema = z.object({
  sourceNodeId: z.string().describe('ID of the source node'),
  targetNodeId: z.string().describe('ID of the target node'),
  sourceHandle: z.string().optional().describe('Source handle ID (optional)'),
  targetHandle: z.string().optional().describe('Target handle ID (optional)'),
});

type Input = z.infer<typeof inputSchema>;

interface Output {
  success: boolean;
  edgeId?: string;
  edge?: {
    id: string;
    source: string;
    target: string;
  };
  error?: string;
}

export const canvasConnectTool: Tool<Input, Output> = {
  name: 'canvas_connect',
  description: 'Create an edge connecting two nodes on the canvas',
  inputSchema,
  handler: async (params) => {
    const bridge = getIpcBridge();

    try {
      const result = await bridge.invoke<{
        success: boolean;
        edgeId?: string;
        edge?: {
          id: string;
          source: string;
          target: string;
        };
        error?: string;
      }>('test-bridge:canvas-connect', {
        sourceNodeId: params.sourceNodeId,
        targetNodeId: params.targetNodeId,
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
      });

      if (!result.success) {
        return { success: false, error: result.error ?? 'Failed to connect nodes' };
      }

      return {
        success: true,
        edgeId: result.edgeId,
        edge: result.edge,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect nodes',
      };
    }
  },
};
