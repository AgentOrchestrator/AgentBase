import { z } from 'zod';
import { getLogServer, type LogLevel } from '../logging';
import type { Tool } from '../tool-registry';

const inputSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).describe('Log level'),
  message: z.string().describe('Log message'),
  meta: z.record(z.string(), z.unknown()).optional().describe('Optional metadata'),
});

type Input = z.infer<typeof inputSchema>;

interface Output {
  success: boolean;
  logId: string;
}

export const logInjectTool: Tool<Input, Output> = {
  name: 'log_inject',
  description: 'Inject a log entry for testing purposes',
  inputSchema,
  handler: async (params) => {
    const logServer = getLogServer();
    const logId = logServer.inject(
      params.level as LogLevel,
      params.message,
      params.meta as Record<string, unknown> | undefined
    );
    return { success: true, logId };
  },
};
