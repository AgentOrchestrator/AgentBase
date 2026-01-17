import { ipcMain } from 'electron';
import { LLMServiceFactory } from './factory/LLMServiceFactory';
import type { ChatRequest, VendorId } from './types';

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
 * Register IPC handlers for LLM operations.
 * Must be called after LLMServiceFactory.configure().
 */
export function registerLLMIpcHandlers(): void {
  // Chat completion
  ipcMain.handle(
    'llm:chat',
    async (_event, request: ChatRequest): Promise<IPCResponse<unknown>> => {
      try {
        const service = await LLMServiceFactory.getService();
        const result = await service.chat(request);

        if (!result.success) {
          return errorResponse(result.error.message);
        }

        return successResponse(result.data);
      } catch (error) {
        console.error('[Main] LLM chat error', { error });
        return errorResponse((error as Error).message);
      }
    }
  );

  // Streaming chat (uses IPC events for chunks)
  ipcMain.handle(
    'llm:chat-stream',
    async (event, requestId: string, request: ChatRequest): Promise<IPCResponse<unknown>> => {
      try {
        const service = await LLMServiceFactory.getService();
        const result = await service.chatStream(request, (chunk) => {
          event.sender.send('llm:stream-chunk', { requestId, chunk });
        });

        if (!result.success) {
          return errorResponse(result.error.message);
        }

        return successResponse(result.data);
      } catch (error) {
        console.error('[Main] LLM stream error', { error });
        return errorResponse((error as Error).message);
      }
    }
  );

  // Chat with tools (agentic loop)
  ipcMain.handle(
    'llm:chat-with-tools',
    async (_event, request: ChatRequest, maxIterations?: number): Promise<IPCResponse<unknown>> => {
      try {
        const service = await LLMServiceFactory.getService();
        const result = await service.chatWithTools(request, maxIterations);

        if (!result.success) {
          return errorResponse(result.error.message);
        }

        return successResponse(result.data);
      } catch (error) {
        console.error('[Main] LLM chat-with-tools error', { error });
        return errorResponse((error as Error).message);
      }
    }
  );

  // API key management
  ipcMain.handle(
    'llm:set-api-key',
    async (_event, vendor: VendorId, apiKey: string): Promise<IPCResponse<void>> => {
      try {
        const repo = LLMServiceFactory.getApiKeyRepository();
        const result = await repo.setApiKey(vendor, apiKey);

        if (!result.success) {
          return errorResponse(result.error.message);
        }

        return successResponse(undefined);
      } catch (error) {
        return errorResponse((error as Error).message);
      }
    }
  );

  ipcMain.handle(
    'llm:delete-api-key',
    async (_event, vendor: VendorId): Promise<IPCResponse<void>> => {
      try {
        const repo = LLMServiceFactory.getApiKeyRepository();
        const result = await repo.deleteApiKey(vendor);

        if (!result.success) {
          return errorResponse(result.error.message);
        }

        return successResponse(undefined);
      } catch (error) {
        return errorResponse((error as Error).message);
      }
    }
  );

  ipcMain.handle(
    'llm:has-api-key',
    async (_event, vendor: VendorId): Promise<IPCResponse<boolean>> => {
      try {
        const repo = LLMServiceFactory.getApiKeyRepository();
        const hasKey = await repo.hasApiKey(vendor);
        return successResponse(hasKey);
      } catch (error) {
        return errorResponse((error as Error).message);
      }
    }
  );

  ipcMain.handle('llm:list-vendors-with-keys', async (): Promise<IPCResponse<VendorId[]>> => {
    try {
      const repo = LLMServiceFactory.getApiKeyRepository();
      const result = await repo.listStoredVendors();

      if (!result.success) {
        return errorResponse(result.error.message);
      }

      return successResponse(result.data);
    } catch (error) {
      return errorResponse((error as Error).message);
    }
  });

  // Available models
  ipcMain.handle('llm:get-available-models', async (): Promise<IPCResponse<unknown>> => {
    try {
      const service = await LLMServiceFactory.getService();
      const result = await service.getAvailableModels();

      if (!result.success) {
        return errorResponse(result.error.message);
      }

      return successResponse(result.data);
    } catch (error) {
      return errorResponse((error as Error).message);
    }
  });

  // Check if configured
  ipcMain.handle('llm:is-configured', async (): Promise<IPCResponse<boolean>> => {
    try {
      const service = await LLMServiceFactory.getService();
      const configured = await service.isConfigured();
      return successResponse(configured);
    } catch (error) {
      return errorResponse((error as Error).message);
    }
  });

  // Get capabilities
  ipcMain.handle('llm:get-capabilities', async (): Promise<IPCResponse<unknown>> => {
    try {
      const service = await LLMServiceFactory.getService();
      const capabilities = service.getCapabilities();
      return successResponse(capabilities);
    } catch (error) {
      return errorResponse((error as Error).message);
    }
  });

  console.log('[Main] LLM IPC handlers registered');
}
