import { z } from 'zod';
import { getIpcBridge } from '../ipc-bridge';
import type { Tool } from '../tool-registry';

const inputSchema = z.object({
  text: z.string().describe('Text to type'),
  selector: z
    .string()
    .optional()
    .describe('CSS selector of input element (uses focused element if not specified)'),
  clear: z.boolean().optional().default(false).describe('Clear existing content before typing'),
});

type Input = z.infer<typeof inputSchema>;

interface Output {
  success: boolean;
  typed?: {
    text: string;
    selector?: string;
  };
  error?: string;
}

export const uiTypeTool: Tool<Input, Output> = {
  name: 'ui_type',
  description: 'Type text into an input element or the currently focused element',
  inputSchema,
  handler: async (params) => {
    const bridge = getIpcBridge();

    try {
      const result = await bridge.invoke<{
        success: boolean;
        error?: string;
      }>('test-bridge:type', {
        text: params.text,
        selector: params.selector,
        clear: params.clear,
      });

      if (!result.success) {
        return { success: false, error: result.error ?? 'Type failed' };
      }

      return {
        success: true,
        typed: {
          text: params.text,
          selector: params.selector,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Type failed',
      };
    }
  },
};
