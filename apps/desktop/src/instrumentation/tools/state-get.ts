import { z } from 'zod';
import { getIpcBridge } from '../ipc-bridge';
import type { Tool } from '../tool-registry';

const inputSchema = z.object({
  path: z
    .string()
    .optional()
    .describe(
      'Dot-notation path to state (e.g., "canvas.nodes" or "agents.list"). Omit for entire state.'
    ),
});

type Input = z.infer<typeof inputSchema>;

interface Output {
  success: boolean;
  path?: string;
  value?: unknown;
  error?: string;
}

export const stateGetTool: Tool<Input, Output> = {
  name: 'state_get',
  description: 'Get application state by path. Use dot notation for nested values.',
  inputSchema,
  handler: async (params) => {
    const bridge = getIpcBridge();

    try {
      const result = await bridge.invoke<{
        success: boolean;
        value?: unknown;
        error?: string;
      }>('test-bridge:state-get', {
        path: params.path,
      });

      if (!result.success) {
        return { success: false, error: result.error ?? 'State get failed' };
      }

      return {
        success: true,
        path: params.path,
        value: result.value,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'State get failed',
      };
    }
  },
};
