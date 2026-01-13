"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMErrorCode = void 0;
exports.ok = ok;
exports.err = err;
exports.llmError = llmError;
/**
 * Enumerated error codes for programmatic error handling
 */
var LLMErrorCode;
(function (LLMErrorCode) {
    // Configuration errors
    LLMErrorCode["API_KEY_NOT_FOUND"] = "API_KEY_NOT_FOUND";
    LLMErrorCode["API_KEY_INVALID"] = "API_KEY_INVALID";
    LLMErrorCode["KEYCHAIN_ACCESS_DENIED"] = "KEYCHAIN_ACCESS_DENIED";
    LLMErrorCode["KEYCHAIN_ERROR"] = "KEYCHAIN_ERROR";
    // Provider errors
    LLMErrorCode["PROVIDER_NOT_SUPPORTED"] = "PROVIDER_NOT_SUPPORTED";
    LLMErrorCode["MODEL_NOT_AVAILABLE"] = "MODEL_NOT_AVAILABLE";
    // Request errors
    LLMErrorCode["RATE_LIMITED"] = "RATE_LIMITED";
    LLMErrorCode["CONTEXT_LENGTH_EXCEEDED"] = "CONTEXT_LENGTH_EXCEEDED";
    LLMErrorCode["INVALID_REQUEST"] = "INVALID_REQUEST";
    // Tool errors
    LLMErrorCode["TOOL_NOT_FOUND"] = "TOOL_NOT_FOUND";
    LLMErrorCode["TOOL_ALREADY_REGISTERED"] = "TOOL_ALREADY_REGISTERED";
    LLMErrorCode["TOOL_EXECUTION_FAILED"] = "TOOL_EXECUTION_FAILED";
    // Network/Runtime errors
    LLMErrorCode["NETWORK_ERROR"] = "NETWORK_ERROR";
    LLMErrorCode["TIMEOUT"] = "TIMEOUT";
    LLMErrorCode["SERVICE_UNAVAILABLE"] = "SERVICE_UNAVAILABLE";
    // General
    LLMErrorCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
})(LLMErrorCode || (exports.LLMErrorCode = LLMErrorCode = {}));
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
 * Helper to create an LLMError
 */
function llmError(code, message, details, cause) {
    return { code, message, details, cause };
}
