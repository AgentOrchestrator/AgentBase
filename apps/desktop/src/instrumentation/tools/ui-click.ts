import { z } from 'zod';
import { getIpcBridge } from '../ipc-bridge';
import type { Tool } from '../tool-registry';

const inputSchema = z.object({
  selector: z.string().optional().describe('CSS selector to click'),
  text: z.string().optional().describe('Text content of element to click'),
  x: z.number().optional().describe('X coordinate for coordinate-based click'),
  y: z.number().optional().describe('Y coordinate for coordinate-based click'),
  button: z.enum(['left', 'right', 'middle']).optional().default('left').describe('Mouse button'),
  doubleClick: z.boolean().optional().default(false).describe('Double-click'),
});

type Input = z.infer<typeof inputSchema>;

interface Output {
  success: boolean;
  clicked?: {
    selector?: string;
    text?: string;
    x: number;
    y: number;
  };
  error?: string;
}

export const uiClickTool: Tool<Input, Output> = {
  name: 'ui_click',
  description: 'Click an element in the app UI by CSS selector, text content, or coordinates',
  inputSchema,
  handler: async (params) => {
    const bridge = getIpcBridge();

    // Validate at least one targeting method is specified
    if (!params.selector && !params.text && (params.x === undefined || params.y === undefined)) {
      return {
        success: false,
        error: 'Must specify selector, text, or both x and y coordinates',
      };
    }

    try {
      const result = await bridge.invoke<{
        success: boolean;
        x?: number;
        y?: number;
        error?: string;
      }>('test-bridge:click', {
        selector: params.selector,
        text: params.text,
        x: params.x,
        y: params.y,
        button: params.button,
        doubleClick: params.doubleClick,
      });

      if (!result.success) {
        return { success: false, error: result.error ?? 'Click failed' };
      }

      return {
        success: true,
        clicked: {
          selector: params.selector,
          text: params.text,
          x: result.x ?? params.x ?? 0,
          y: result.y ?? params.y ?? 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Click failed',
      };
    }
  },
};
