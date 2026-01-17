import type { IRepresentationAudioProvider } from '../interfaces/IRepresentationAudioProvider';
import type { IRepresentationImageProvider } from '../interfaces/IRepresentationImageProvider';
import type { IRepresentationProvider } from '../interfaces/IRepresentationProvider';
import type { IRepresentationSummaryProvider } from '../interfaces/IRepresentationSummaryProvider';

/**
 * Type guard to check if a provider produces images
 */
export function isImageProvider(
  provider: IRepresentationProvider
): provider is IRepresentationImageProvider {
  return provider.representationType === 'image';
}

/**
 * Type guard to check if a provider produces summaries
 */
export function isSummaryProvider(
  provider: IRepresentationProvider
): provider is IRepresentationSummaryProvider {
  return provider.representationType === 'summary';
}

/**
 * Type guard to check if a provider produces audio
 */
export function isAudioProvider(
  provider: IRepresentationProvider
): provider is IRepresentationAudioProvider {
  return provider.representationType === 'audio';
}

/**
 * Check if a provider supports streaming
 */
export function supportsStreaming(provider: IRepresentationProvider): boolean {
  return provider.getCapabilities().supportsStreaming;
}

/**
 * Check if a summary provider supports streaming output
 */
export function supportsSummaryStreaming(
  provider: IRepresentationProvider
): provider is IRepresentationSummaryProvider & {
  transformToSummaryStreaming: NonNullable<
    IRepresentationSummaryProvider['transformToSummaryStreaming']
  >;
} {
  return (
    isSummaryProvider(provider) &&
    provider.getCapabilities().supportsStreaming &&
    typeof provider.transformToSummaryStreaming === 'function'
  );
}

/**
 * Get the maximum input length across all providers
 */
export function getMaxInputLength(providers: IRepresentationProvider[]): number | undefined {
  const lengths = providers
    .map((p) => p.getCapabilities().maxInputLength)
    .filter((l): l is number => l !== undefined);

  return lengths.length > 0 ? Math.max(...lengths) : undefined;
}
