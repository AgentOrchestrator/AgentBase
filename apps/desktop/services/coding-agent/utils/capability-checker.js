"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSessionResumable = isSessionResumable;
exports.isSessionForkable = isSessionForkable;
exports.hasSessionManager = hasSessionManager;
exports.supportsStreaming = supportsStreaming;
exports.getMissingCapabilities = getMissingCapabilities;
/**
 * Type guard to check if an agent supports session resumption
 *
 * Usage:
 * ```typescript
 * if (isSessionResumable(agent)) {
 *   await agent.continueSession(sessionId, prompt);
 * }
 * ```
 */
function isSessionResumable(agent) {
    return agent.getCapabilities().canResumeSession;
}
/**
 * Type guard to check if an agent supports session forking
 */
function isSessionForkable(agent) {
    return agent.getCapabilities().canForkSession;
}
/**
 * Type guard to check if an agent supports session management
 */
function hasSessionManager(agent) {
    return agent.getCapabilities().canListSessions;
}
/**
 * Type guard to check if an agent supports streaming
 */
function supportsStreaming(agent) {
    return agent.getCapabilities().supportsStreaming;
}
/**
 * Get capabilities that the agent is missing
 *
 * Useful for informing users what features aren't available.
 */
function getMissingCapabilities(agent, required) {
    const capabilities = agent.getCapabilities();
    return required.filter((cap) => !capabilities[cap]);
}
