"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepresentationErrorCode = void 0;
exports.ok = ok;
exports.err = err;
exports.representationError = representationError;
/**
 * Enumerated error codes for representation operations
 */
var RepresentationErrorCode;
(function (RepresentationErrorCode) {
    // Provider errors
    RepresentationErrorCode["PROVIDER_NOT_FOUND"] = "PROVIDER_NOT_FOUND";
    RepresentationErrorCode["PROVIDER_NOT_AVAILABLE"] = "PROVIDER_NOT_AVAILABLE";
    RepresentationErrorCode["PROVIDER_ALREADY_REGISTERED"] = "PROVIDER_ALREADY_REGISTERED";
    // Transformation errors
    RepresentationErrorCode["TRANSFORMATION_FAILED"] = "TRANSFORMATION_FAILED";
    RepresentationErrorCode["TRANSFORMATION_TIMEOUT"] = "TRANSFORMATION_TIMEOUT";
    RepresentationErrorCode["INVALID_INPUT"] = "INVALID_INPUT";
    RepresentationErrorCode["UNSUPPORTED_FORMAT"] = "UNSUPPORTED_FORMAT";
    // Capability errors
    RepresentationErrorCode["CAPABILITY_NOT_SUPPORTED"] = "CAPABILITY_NOT_SUPPORTED";
    // Service errors
    RepresentationErrorCode["SERVICE_NOT_INITIALIZED"] = "SERVICE_NOT_INITIALIZED";
    // General
    RepresentationErrorCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
})(RepresentationErrorCode || (exports.RepresentationErrorCode = RepresentationErrorCode = {}));
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
 * Helper to create a RepresentationError
 */
function representationError(code, message, details, cause) {
    return { code, message, details, cause };
}
