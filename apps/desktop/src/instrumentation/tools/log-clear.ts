import { z } from 'zod';
import { getLogServer } from '../logging';
import type { Tool } from '../tool-registry';

const inputSchema = z.object({});

type Input = z.infer<typeof inputSchema>;

interface Output {
  success: boolean;
  message: string;
}

export const logClearTool: Tool<Input, Output> = {
  name: 'log_clear',
  description: 'Clear all logs from the instrumentation log buffer',
  inputSchema,
  handler: async () => {
    const logServer = getLogServer();
    const stats = logServer.getStats();
    const clearedCount = stats.size;
    logServer.clear();

    return {
      success: true,
      message: `Cleared ${clearedCount} log entries`,
    };
  },
};
