import type {
  RepresentationCapabilities,
  RepresentationError,
  RepresentationInput,
  RepresentationOutput,
  RepresentationResult,
  RepresentationType,
} from '../types';

/**
 * Base interface for all representation providers
 *
 * Design rationale:
 * - Minimal interface that ALL providers must implement
 * - Type-specific output handled by discriminated union
 * - Capabilities allow runtime feature checking
 * - dispose() ensures proper resource cleanup
 */
export interface IRepresentationProvider<
  TOutput extends RepresentationOutput = RepresentationOutput,
> {
  /**
   * Unique identifier for this provider
   */
  readonly providerId: string;

  /**
   * Human-readable provider name
   */
  readonly providerName: string;

  /**
   * The type of representation this provider produces
   */
  readonly representationType: RepresentationType;

  /**
   * Get the provider's capabilities
   * Used for runtime capability checking
   */
  getCapabilities(): RepresentationCapabilities;

  /**
   * Check if the provider is available and ready
   */
  isAvailable(): Promise<boolean>;

  /**
   * Initialize the provider (load models, establish connections, etc.)
   */
  initialize(): Promise<RepresentationResult<void, RepresentationError>>;

  /**
   * Transform text input into the provider's representation type
   *
   * @param input - The transformation input
   * @returns The transformed representation or an error
   */
  transform(
    input: RepresentationInput
  ): Promise<RepresentationResult<TOutput, RepresentationError>>;

  /**
   * Dispose of resources
   * The provider should not be used after this is called.
   */
  dispose(): Promise<void>;
}
