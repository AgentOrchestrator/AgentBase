import { z } from 'zod';
import { getIpcBridge } from '../ipc-bridge';
import type { Tool } from '../tool-registry';

const inputSchema = z.object({
  type: z.enum(['agent', 'starter', 'conversation', 'browser']).describe('Type of node to add'),
  x: z.number().describe('X position on canvas'),
  y: z.number().describe('Y position on canvas'),
  data: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Additional node data (type-specific)'),
});

type Input = z.infer<typeof inputSchema>;

interface Output {
  success: boolean;
  nodeId?: string;
  node?: {
    id: string;
    type: string;
    position: { x: number; y: number };
  };
  error?: string;
}

export const canvasAddNodeTool: Tool<Input, Output> = {
  name: 'canvas_add_node',
  description: 'Add a new node to the canvas at the specified position',
  inputSchema,
  handler: async (params) => {
    const bridge = getIpcBridge();

    try {
      const result = await bridge.invoke<{
        success: boolean;
        nodeId?: string;
        node?: {
          id: string;
          type: string;
          position: { x: number; y: number };
        };
        error?: string;
      }>('test-bridge:canvas-add-node', {
        type: params.type,
        x: params.x,
        y: params.y,
        data: params.data,
      });

      if (!result.success) {
        return { success: false, error: result.error ?? 'Failed to add node' };
      }

      return {
        success: true,
        nodeId: result.nodeId,
        node: result.node,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add node',
      };
    }
  },
};
