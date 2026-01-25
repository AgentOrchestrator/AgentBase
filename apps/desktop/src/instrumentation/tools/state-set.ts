import { z } from 'zod';
import { getIpcBridge } from '../ipc-bridge';
import type { Tool } from '../tool-registry';

const inputSchema = z.object({
  path: z.string().describe('Dot-notation path to state (e.g., "canvas.nodes")'),
  value: z.unknown().describe('Value to set'),
});

type Input = z.infer<typeof inputSchema>;

interface Output {
  success: boolean;
  path: string;
  previousValue?: unknown;
  error?: string;
}

export const stateSetTool: Tool<Input, Output> = {
  name: 'state_set',
  description: 'Set application state at a specific path. Use for testing scenarios.',
  inputSchema,
  handler: async (params) => {
    const bridge = getIpcBridge();

    try {
      const result = await bridge.invoke<{
        success: boolean;
        previousValue?: unknown;
        error?: string;
      }>('test-bridge:state-set', {
        path: params.path,
        value: params.value,
      });

      if (!result.success) {
        return {
          success: false,
          path: params.path,
          error: result.error ?? 'State set failed',
        };
      }

      return {
        success: true,
        path: params.path,
        previousValue: result.previousValue,
      };
    } catch (error) {
      return {
        success: false,
        path: params.path,
        error: error instanceof Error ? error.message : 'State set failed',
      };
    }
  },
};
