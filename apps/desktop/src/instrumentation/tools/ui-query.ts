import { z } from 'zod';
import { getIpcBridge } from '../ipc-bridge';
import type { Tool } from '../tool-registry';

const inputSchema = z.object({
  selector: z.string().describe('CSS selector to query'),
  properties: z
    .array(z.string())
    .optional()
    .describe('Specific properties to retrieve (e.g., ["textContent", "value", "className"])'),
  all: z
    .boolean()
    .optional()
    .default(false)
    .describe('Query all matching elements instead of just the first'),
});

type Input = z.infer<typeof inputSchema>;

interface ElementInfo {
  exists: boolean;
  tagName?: string;
  id?: string;
  className?: string;
  textContent?: string;
  value?: string;
  attributes?: Record<string, string>;
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  visible?: boolean;
  enabled?: boolean;
  properties?: Record<string, unknown>;
}

interface Output {
  success: boolean;
  element?: ElementInfo;
  elements?: ElementInfo[];
  error?: string;
}

export const uiQueryTool: Tool<Input, Output> = {
  name: 'ui_query',
  description: 'Query DOM elements and retrieve their properties',
  inputSchema,
  handler: async (params) => {
    const bridge = getIpcBridge();

    try {
      const result = await bridge.invoke<{
        success: boolean;
        element?: ElementInfo;
        elements?: ElementInfo[];
        error?: string;
      }>('test-bridge:query', {
        selector: params.selector,
        properties: params.properties,
        all: params.all,
      });

      if (!result.success) {
        return { success: false, error: result.error ?? 'Query failed' };
      }

      return {
        success: true,
        element: result.element,
        elements: result.elements,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query failed',
      };
    }
  },
};
