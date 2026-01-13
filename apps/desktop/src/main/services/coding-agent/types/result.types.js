"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentErrorCode = void 0;
exports.ok = ok;
exports.err = err;
exports.agentError = agentError;
/**
 * Enumerated error codes for programmatic error handling
 */
var AgentErrorCode;
(function (AgentErrorCode) {
    // Process errors
    AgentErrorCode["PROCESS_SPAWN_FAILED"] = "PROCESS_SPAWN_FAILED";
    AgentErrorCode["PROCESS_TIMEOUT"] = "PROCESS_TIMEOUT";
    AgentErrorCode["PROCESS_KILLED"] = "PROCESS_KILLED";
    AgentErrorCode["PROCESS_OUTPUT_PARSE_ERROR"] = "PROCESS_OUTPUT_PARSE_ERROR";
    // Session errors
    AgentErrorCode["SESSION_NOT_FOUND"] = "SESSION_NOT_FOUND";
    AgentErrorCode["SESSION_INVALID"] = "SESSION_INVALID";
    // Capability errors
    AgentErrorCode["CAPABILITY_NOT_SUPPORTED"] = "CAPABILITY_NOT_SUPPORTED";
    // Agent errors
    AgentErrorCode["AGENT_NOT_AVAILABLE"] = "AGENT_NOT_AVAILABLE";
    AgentErrorCode["AGENT_BUSY"] = "AGENT_BUSY";
    AgentErrorCode["AGENT_NOT_INITIALIZED"] = "AGENT_NOT_INITIALIZED";
    // General
    AgentErrorCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
})(AgentErrorCode || (exports.AgentErrorCode = AgentErrorCode = {}));
/**
 * Helper to create a success result
 */
function ok(data) {
    return { success: true, data };
}
/**
 * Helper to create an error result
 */
function err(error) {
    return { success: false, error };
}
/**
 * Helper to create an AgentError
 */
function agentError(code, message, details, cause) {
    return { code, message, details, cause };
}
