"use strict";
// Public API for the LLM service module
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRegistry = exports.InMemoryApiKeyRepository = exports.KeychainApiKeyRepository = exports.VercelAILLMService = exports.registerLLMIpcHandlers = exports.LLMServiceFactory = void 0;
// Types
__exportStar(require("./types"), exports);
// Interfaces
__exportStar(require("./interfaces"), exports);
// Factory (main entry point)
var LLMServiceFactory_1 = require("./factory/LLMServiceFactory");
Object.defineProperty(exports, "LLMServiceFactory", { enumerable: true, get: function () { return LLMServiceFactory_1.LLMServiceFactory; } });
// IPC handlers
var ipc_1 = require("./ipc");
Object.defineProperty(exports, "registerLLMIpcHandlers", { enumerable: true, get: function () { return ipc_1.registerLLMIpcHandlers; } });
// Implementations (for advanced use cases)
var implementations_1 = require("./implementations");
Object.defineProperty(exports, "VercelAILLMService", { enumerable: true, get: function () { return implementations_1.VercelAILLMService; } });
// Dependencies (for custom configurations)
var dependencies_1 = require("./dependencies");
Object.defineProperty(exports, "KeychainApiKeyRepository", { enumerable: true, get: function () { return dependencies_1.KeychainApiKeyRepository; } });
var dependencies_2 = require("./dependencies");
Object.defineProperty(exports, "InMemoryApiKeyRepository", { enumerable: true, get: function () { return dependencies_2.InMemoryApiKeyRepository; } });
// Registry
var ToolRegistry_1 = require("./registry/ToolRegistry");
Object.defineProperty(exports, "ToolRegistry", { enumerable: true, get: function () { return ToolRegistry_1.ToolRegistry; } });
