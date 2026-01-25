import { z } from 'zod';
import { getLogServer, type LogEntry } from '../logging';
import type { Tool } from '../tool-registry';

const inputSchema = z.object({
  level: z
    .enum(['debug', 'info', 'warn', 'error'])
    .optional()
    .describe('Filter by minimum log level'),
  source: z
    .enum(['console', 'ipc', 'state', 'mcp', 'injected'])
    .optional()
    .describe('Filter by log source'),
  since: z.number().optional().describe('Only show logs after this timestamp'),
  limit: z.number().optional().describe('Maximum number of logs to return'),
  pattern: z.string().optional().describe('Regex pattern to match log messages'),
});

type Input = z.infer<typeof inputSchema>;

interface Output {
  success: boolean;
  logs: LogEntry[];
  stats: {
    totalInBuffer: number;
    bufferCapacity: number;
    returned: number;
  };
}

export const logReadTool: Tool<Input, Output> = {
  name: 'log_read',
  description: 'Read logs from the instrumentation log buffer with optional filters',
  inputSchema,
  handler: async (params) => {
    const logServer = getLogServer();
    const logs = logServer.read({
      level: params.level,
      source: params.source,
      since: params.since,
      limit: params.limit,
      pattern: params.pattern,
    });
    const stats = logServer.getStats();

    return {
      success: true,
      logs,
      stats: {
        totalInBuffer: stats.size,
        bufferCapacity: stats.capacity,
        returned: logs.length,
      },
    };
  },
};
