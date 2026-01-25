/**
 * Expose Tools
 *
 * MCP tools for interacting with exposed component bindings.
 * The "read side" of the automation system.
 */

import { z } from 'zod';
import { getIpcBridge } from '../ipc-bridge';
import type { Tool } from '../tool-registry';

// ============================================================================
// expose_list - List all exposed components
// ============================================================================

const listInputSchema = z.object({
  tag: z.string().optional().describe('Filter by tag (e.g., "critical-path", "session:abc123")'),
});

type ListInput = z.infer<typeof listInputSchema>;

interface ListOutput {
  success: boolean;
  entries?: Array<{
    id: string;
    keys: string[];
    tags: string[];
  }>;
  error?: string;
}

export const exposeListTool: Tool<ListInput, ListOutput> = {
  name: 'expose_list',
  description:
    'List all exposed components and their available keys. Use this to discover what can be automated.',
  inputSchema: listInputSchema,
  handler: async (params) => {
    const bridge = getIpcBridge();

    try {
      const result = await bridge.invoke<ListOutput>('automation:list', {
        filter: params.tag ? { tag: params.tag } : undefined,
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'List failed',
      };
    }
  },
};

// ============================================================================
// expose_get - Get a value from an exposed component
// ============================================================================

const getInputSchema = z.object({
  id: z.string().describe('Component ID (e.g., "chat-input", "message-list:node-123")'),
  key: z.string().describe('Key to get (e.g., "value", "messages", "isLoading")'),
});

type GetInput = z.infer<typeof getInputSchema>;

interface GetOutput {
  success: boolean;
  value?: unknown;
  error?: string;
}

export const exposeGetTool: Tool<GetInput, GetOutput> = {
  name: 'expose_get',
  description:
    'Get a value from an exposed component. Use expose_list first to see available keys.',
  inputSchema: getInputSchema,
  handler: async (params) => {
    const bridge = getIpcBridge();

    try {
      const result = await bridge.invoke<GetOutput>('automation:get', {
        id: params.id,
        key: params.key,
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Get failed',
      };
    }
  },
};

// ============================================================================
// expose_set - Set a value on an exposed component
// ============================================================================

const setInputSchema = z.object({
  id: z.string().describe('Component ID'),
  key: z.string().describe('Key to set (must be a setter like "setValue" or an accessor)'),
  value: z.unknown().describe('Value to set'),
});

type SetInput = z.infer<typeof setInputSchema>;

interface SetOutput {
  success: boolean;
  error?: string;
}

export const exposeSetTool: Tool<SetInput, SetOutput> = {
  name: 'expose_set',
  description:
    'Set a value on an exposed component. The key must be a setter function (setXxx) or an accessor with set.',
  inputSchema: setInputSchema,
  handler: async (params) => {
    const bridge = getIpcBridge();

    try {
      const result = await bridge.invoke<SetOutput>('automation:set', {
        id: params.id,
        key: params.key,
        value: params.value,
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Set failed',
      };
    }
  },
};

// ============================================================================
// expose_call - Call an action on an exposed component
// ============================================================================

const callInputSchema = z.object({
  id: z.string().describe('Component ID'),
  key: z.string().describe('Action to call (e.g., "send", "clear", "scrollToBottom")'),
  args: z.array(z.unknown()).optional().describe('Arguments to pass to the action'),
});

type CallInput = z.infer<typeof callInputSchema>;

interface CallOutput {
  success: boolean;
  result?: unknown;
  error?: string;
}

export const exposeCallTool: Tool<CallInput, CallOutput> = {
  name: 'expose_call',
  description:
    'Call an action on an exposed component. Use for functions like send(), clear(), etc.',
  inputSchema: callInputSchema,
  handler: async (params) => {
    const bridge = getIpcBridge();

    try {
      const result = await bridge.invoke<CallOutput>('automation:call', {
        id: params.id,
        key: params.key,
        args: params.args ?? [],
      });
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Call failed',
      };
    }
  },
};
