import { z } from 'zod';
import { getIpcBridge } from '../ipc-bridge';
import type { Tool } from '../tool-registry';

const inputSchema = z.object({
  nodeId: z.string().optional().describe('Get specific node by ID. Omit for full canvas state.'),
});

type Input = z.infer<typeof inputSchema>;

interface NodeInfo {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  selected?: boolean;
}

interface EdgeInfo {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface Output {
  success: boolean;
  node?: NodeInfo;
  nodes?: NodeInfo[];
  edges?: EdgeInfo[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
  error?: string;
}

export const canvasQueryTool: Tool<Input, Output> = {
  name: 'canvas_query',
  description: 'Query the current canvas state - nodes, edges, and viewport',
  inputSchema,
  handler: async (params) => {
    const bridge = getIpcBridge();

    try {
      const result = await bridge.invoke<Output>('test-bridge:canvas-query', {
        nodeId: params.nodeId,
      });

      if (!result.success) {
        return { success: false, error: result.error ?? 'Query failed' };
      }

      return {
        success: true,
        node: result.node,
        nodes: result.nodes,
        edges: result.edges,
        viewport: result.viewport,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query failed',
      };
    }
  },
};
