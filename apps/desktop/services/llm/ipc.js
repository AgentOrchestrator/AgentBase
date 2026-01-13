"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerLLMIpcHandlers = registerLLMIpcHandlers;
const electron_1 = require("electron");
const LLMServiceFactory_1 = require("./factory/LLMServiceFactory");
function successResponse(data) {
    return { success: true, data };
}
function errorResponse(error) {
    return { success: false, error };
}
/**
 * Register IPC handlers for LLM operations.
 * Must be called after LLMServiceFactory.configure().
 */
function registerLLMIpcHandlers() {
    // Chat completion
    electron_1.ipcMain.handle('llm:chat', async (_event, request) => {
        try {
            const service = await LLMServiceFactory_1.LLMServiceFactory.getService();
            const result = await service.chat(request);
            if (!result.success) {
                return errorResponse(result.error.message);
            }
            return successResponse(result.data);
        }
        catch (error) {
            console.error('[Main] LLM chat error', { error });
            return errorResponse(error.message);
        }
    });
    // Streaming chat (uses IPC events for chunks)
    electron_1.ipcMain.handle('llm:chat-stream', async (event, requestId, request) => {
        try {
            const service = await LLMServiceFactory_1.LLMServiceFactory.getService();
            const result = await service.chatStream(request, (chunk) => {
                event.sender.send('llm:stream-chunk', { requestId, chunk });
            });
            if (!result.success) {
                return errorResponse(result.error.message);
            }
            return successResponse(result.data);
        }
        catch (error) {
            console.error('[Main] LLM stream error', { error });
            return errorResponse(error.message);
        }
    });
    // Chat with tools (agentic loop)
    electron_1.ipcMain.handle('llm:chat-with-tools', async (_event, request, maxIterations) => {
        try {
            const service = await LLMServiceFactory_1.LLMServiceFactory.getService();
            const result = await service.chatWithTools(request, maxIterations);
            if (!result.success) {
                return errorResponse(result.error.message);
            }
            return successResponse(result.data);
        }
        catch (error) {
            console.error('[Main] LLM chat-with-tools error', { error });
            return errorResponse(error.message);
        }
    });
    // API key management
    electron_1.ipcMain.handle('llm:set-api-key', async (_event, vendor, apiKey) => {
        try {
            const repo = LLMServiceFactory_1.LLMServiceFactory.getApiKeyRepository();
            const result = await repo.setApiKey(vendor, apiKey);
            if (!result.success) {
                return errorResponse(result.error.message);
            }
            return successResponse(undefined);
        }
        catch (error) {
            return errorResponse(error.message);
        }
    });
    electron_1.ipcMain.handle('llm:delete-api-key', async (_event, vendor) => {
        try {
            const repo = LLMServiceFactory_1.LLMServiceFactory.getApiKeyRepository();
            const result = await repo.deleteApiKey(vendor);
            if (!result.success) {
                return errorResponse(result.error.message);
            }
            return successResponse(undefined);
        }
        catch (error) {
            return errorResponse(error.message);
        }
    });
    electron_1.ipcMain.handle('llm:has-api-key', async (_event, vendor) => {
        try {
            const repo = LLMServiceFactory_1.LLMServiceFactory.getApiKeyRepository();
            const hasKey = await repo.hasApiKey(vendor);
            return successResponse(hasKey);
        }
        catch (error) {
            return errorResponse(error.message);
        }
    });
    electron_1.ipcMain.handle('llm:list-vendors-with-keys', async () => {
        try {
            const repo = LLMServiceFactory_1.LLMServiceFactory.getApiKeyRepository();
            const result = await repo.listStoredVendors();
            if (!result.success) {
                return errorResponse(result.error.message);
            }
            return successResponse(result.data);
        }
        catch (error) {
            return errorResponse(error.message);
        }
    });
    // Available models
    electron_1.ipcMain.handle('llm:get-available-models', async () => {
        try {
            const service = await LLMServiceFactory_1.LLMServiceFactory.getService();
            const result = await service.getAvailableModels();
            if (!result.success) {
                return errorResponse(result.error.message);
            }
            return successResponse(result.data);
        }
        catch (error) {
            return errorResponse(error.message);
        }
    });
    // Check if configured
    electron_1.ipcMain.handle('llm:is-configured', async () => {
        try {
            const service = await LLMServiceFactory_1.LLMServiceFactory.getService();
            const configured = await service.isConfigured();
            return successResponse(configured);
        }
        catch (error) {
            return errorResponse(error.message);
        }
    });
    // Get capabilities
    electron_1.ipcMain.handle('llm:get-capabilities', async () => {
        try {
            const service = await LLMServiceFactory_1.LLMServiceFactory.getService();
            const capabilities = service.getCapabilities();
            return successResponse(capabilities);
        }
        catch (error) {
            return errorResponse(error.message);
        }
    });
    console.log('[Main] LLM IPC handlers registered');
}
