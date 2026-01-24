import { z } from 'zod';
import { getIpcBridge } from '../ipc-bridge';
import type { Tool } from '../tool-registry';

const inputSchema = z.object({
  nodeId: z.string().describe('ID of the node to remove'),
});

type Input = z.infer<typeof inputSchema>;

interface Output {
  success: boolean;
  removed?: boolean;
  error?: string;
}

export const canvasRemoveNodeTool: Tool<Input, Output> = {
  name: 'canvas_remove_node',
  description: 'Remove a node from the canvas by its ID',
  inputSchema,
  handler: async (params) => {
    const bridge = getIpcBridge();

    try {
      const result = await bridge.invoke<{
        success: boolean;
        removed?: boolean;
        error?: string;
      }>('test-bridge:canvas-remove-node', {
        nodeId: params.nodeId,
      });

      if (!result.success) {
        return { success: false, error: result.error ?? 'Failed to remove node' };
      }

      return {
        success: true,
        removed: result.removed,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove node',
      };
    }
  },
};
