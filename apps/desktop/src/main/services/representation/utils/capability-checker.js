"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isImageProvider = isImageProvider;
exports.isSummaryProvider = isSummaryProvider;
exports.isAudioProvider = isAudioProvider;
exports.supportsStreaming = supportsStreaming;
exports.supportsSummaryStreaming = supportsSummaryStreaming;
exports.getMaxInputLength = getMaxInputLength;
/**
 * Type guard to check if a provider produces images
 */
function isImageProvider(provider) {
    return provider.representationType === 'image';
}
/**
 * Type guard to check if a provider produces summaries
 */
function isSummaryProvider(provider) {
    return provider.representationType === 'summary';
}
/**
 * Type guard to check if a provider produces audio
 */
function isAudioProvider(provider) {
    return provider.representationType === 'audio';
}
/**
 * Check if a provider supports streaming
 */
function supportsStreaming(provider) {
    return provider.getCapabilities().supportsStreaming;
}
/**
 * Check if a summary provider supports streaming output
 */
function supportsSummaryStreaming(provider) {
    return (isSummaryProvider(provider) &&
        provider.getCapabilities().supportsStreaming &&
        typeof provider.transformToSummaryStreaming === 'function');
}
/**
 * Get the maximum input length across all providers
 */
function getMaxInputLength(providers) {
    const lengths = providers
        .map((p) => p.getCapabilities().maxInputLength)
        .filter((l) => l !== undefined);
    return lengths.length > 0 ? Math.max(...lengths) : undefined;
}
