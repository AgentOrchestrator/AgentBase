import { ipcMain } from 'electron';
import type { OrchestratorService } from './OrchestratorService';

/**
 * IPC response wrapper for consistent error handling
 */
interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function successResponse<T>(data: T): IPCResponse<T> {
  return { success: true, data };
}

function errorResponse(error: string): IPCResponse<never> {
  return { success: false, error };
}

/**
 * Register IPC handlers for orchestrator operations.
 * Must be called after OrchestratorService is initialized.
 *
 * @param service - The initialized OrchestratorService instance
 */
export function registerOrchestratorIpcHandlers(service: OrchestratorService): void {
  // Get health status
  ipcMain.handle('orchestrator:get-health', async (): Promise<IPCResponse<unknown>> => {
    try {
      const health = await service.getHealth();
      return successResponse(health);
    } catch (error) {
      console.error('[Main] Orchestrator get-health error', { error });
      return errorResponse((error as Error).message);
    }
  });

  // Create a new conversation
  ipcMain.handle('orchestrator:create-conversation', async (): Promise<IPCResponse<unknown>> => {
    try {
      const conversation = await service.createConversation();
      console.log('[Main] Orchestrator conversation created', { id: conversation.id });
      return successResponse(conversation);
    } catch (error) {
      console.error('[Main] Orchestrator create-conversation error', { error });
      return errorResponse((error as Error).message);
    }
  });

  // Get messages for a conversation
  ipcMain.handle(
    'orchestrator:get-messages',
    async (_event, conversationId: string): Promise<IPCResponse<unknown>> => {
      try {
        const messages = await service.getMessages(conversationId);
        return successResponse(messages);
      } catch (error) {
        console.error('[Main] Orchestrator get-messages error', { conversationId, error });
        return errorResponse((error as Error).message);
      }
    }
  );

  // Get most recent conversation
  ipcMain.handle('orchestrator:get-recent', async (): Promise<IPCResponse<unknown>> => {
    try {
      const conversation = await service.getMostRecentConversation();
      return successResponse(conversation);
    } catch (error) {
      console.error('[Main] Orchestrator get-recent error', { error });
      return errorResponse((error as Error).message);
    }
  });

  // Send message with streaming chunks
  ipcMain.handle(
    'orchestrator:send-message',
    async (
      event,
      requestId: string,
      conversationId: string,
      message: string
    ): Promise<IPCResponse<unknown>> => {
      const startTime = Date.now();
      let chunksSent = 0;
      let totalBytesSent = 0;

      console.log('[Main] Orchestrator send-message', {
        requestId,
        conversationId,
        messagePreview: message.slice(0, 100),
        messageLength: message.length,
      });

      try {
        const response = await service.sendMessage(conversationId, message, (chunk: string) => {
          chunksSent++;
          totalBytesSent += chunk.length;

          if (chunksSent === 1) {
            console.log('[Main] Orchestrator first chunk received', {
              requestId,
              chunkLength: chunk.length,
              timeSinceStart: `${Date.now() - startTime}ms`,
            });
          }

          // Send chunk to renderer
          event.sender.send('orchestrator:chunk', { requestId, chunk });
        });

        const duration = Date.now() - startTime;

        console.log('[Main] Orchestrator send-message complete', {
          requestId,
          contentLength: response.content.length,
          toolCallsCount: response.toolCalls?.length ?? 0,
          durationMs: duration,
          chunksSent,
          totalBytesSent,
        });

        return successResponse(response);
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error('[Main] Orchestrator send-message error', {
          requestId,
          conversationId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          durationMs: duration,
          chunksSent,
          totalBytesSent,
        });
        return errorResponse((error as Error).message);
      }
    }
  );

  console.log('[Main] Orchestrator IPC handlers registered');
}
