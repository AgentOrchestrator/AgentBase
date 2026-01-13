"use strict";
/**
 * Coding Agent Service
 *
 * A protocol-based service for interacting with CLI coding agents.
 * Designed with Interface Segregation to prevent god objects.
 *
 * Usage:
 * ```typescript
 * import {
 *   CodingAgentFactory,
 *   isSessionResumable,
 *   sessionById,
 * } from './services/coding-agent';
 *
 * // Get an agent
 * const result = await CodingAgentFactory.getAgent('claude_code');
 * if (!result.success) {
 *   console.error(result.error);
 *   return;
 * }
 *
 * const agent = result.data;
 *
 * // Generate a response
 * const response = await agent.generate({ prompt: 'Hello, world!' });
 *
 * // Resume a session (if supported)
 * if (isSessionResumable(agent)) {
 *   await agent.continueSession(sessionById('abc123'), 'Follow up prompt');
 * }
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeCodeAgent = exports.getMissingCapabilities = exports.supportsStreaming = exports.hasSessionManager = exports.isSessionForkable = exports.isSessionResumable = exports.latestSession = exports.sessionByName = exports.sessionById = exports.DEFAULT_AGENT_CONFIG = exports.agentError = exports.err = exports.ok = exports.AgentErrorCode = exports.CodingAgentFactory = void 0;
// Factory - main entry point
var CodingAgentFactory_1 = require("./factory/CodingAgentFactory");
Object.defineProperty(exports, "CodingAgentFactory", { enumerable: true, get: function () { return CodingAgentFactory_1.CodingAgentFactory; } });
// Error codes and helpers
var types_1 = require("./types");
Object.defineProperty(exports, "AgentErrorCode", { enumerable: true, get: function () { return types_1.AgentErrorCode; } });
Object.defineProperty(exports, "ok", { enumerable: true, get: function () { return types_1.ok; } });
Object.defineProperty(exports, "err", { enumerable: true, get: function () { return types_1.err; } });
Object.defineProperty(exports, "agentError", { enumerable: true, get: function () { return types_1.agentError; } });
Object.defineProperty(exports, "DEFAULT_AGENT_CONFIG", { enumerable: true, get: function () { return types_1.DEFAULT_AGENT_CONFIG; } });
Object.defineProperty(exports, "sessionById", { enumerable: true, get: function () { return types_1.sessionById; } });
Object.defineProperty(exports, "sessionByName", { enumerable: true, get: function () { return types_1.sessionByName; } });
Object.defineProperty(exports, "latestSession", { enumerable: true, get: function () { return types_1.latestSession; } });
// Capability checking utilities
var capability_checker_1 = require("./utils/capability-checker");
Object.defineProperty(exports, "isSessionResumable", { enumerable: true, get: function () { return capability_checker_1.isSessionResumable; } });
Object.defineProperty(exports, "isSessionForkable", { enumerable: true, get: function () { return capability_checker_1.isSessionForkable; } });
Object.defineProperty(exports, "hasSessionManager", { enumerable: true, get: function () { return capability_checker_1.hasSessionManager; } });
Object.defineProperty(exports, "supportsStreaming", { enumerable: true, get: function () { return capability_checker_1.supportsStreaming; } });
Object.defineProperty(exports, "getMissingCapabilities", { enumerable: true, get: function () { return capability_checker_1.getMissingCapabilities; } });
// Concrete implementations - exported for advanced use cases
// Prefer using CodingAgentFactory.getAgent() instead of direct instantiation
var implementations_1 = require("./implementations");
Object.defineProperty(exports, "ClaudeCodeAgent", { enumerable: true, get: function () { return implementations_1.ClaudeCodeAgent; } });
