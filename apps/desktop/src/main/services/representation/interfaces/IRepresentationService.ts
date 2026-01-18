import type {
  AnyRepresentationOutput,
  AudioRepresentationOutput,
  ImageRepresentationOutput,
  RepresentationError,
  RepresentationInput,
  RepresentationResult,
  RepresentationType,
  SummaryRepresentationOutput,
} from '../types';
import type { AudioTransformOptions } from './IRepresentationAudioProvider';
import type { ImageTransformOptions } from './IRepresentationImageProvider';
import type { IRepresentationProvider } from './IRepresentationProvider';
import type {
  SummaryStreamCallback,
  SummaryTransformOptions,
} from './IRepresentationSummaryProvider';

/**
 * Service lifecycle interface
 */
export interface IRepresentationServiceLifecycle {
  /**
   * Initialize the service and all registered providers
   */
  initialize(): Promise<RepresentationResult<void, RepresentationError>>;

  /**
   * Dispose of all resources
   */
  dispose(): Promise<void>;
}

/**
 * Provider registry interface
 */
export interface IRepresentationProviderRegistry {
  /**
   * Register a provider
   *
   * @param provider - The provider to register
   * @returns Success or error if provider already registered
   */
  registerProvider(
    provider: IRepresentationProvider
  ): RepresentationResult<void, RepresentationError>;

  /**
   * Unregister a provider
   *
   * @param providerId - The provider's unique ID
   */
  unregisterProvider(providerId: string): RepresentationResult<void, RepresentationError>;

  /**
   * Get a specific provider by ID
   */
  getProvider(providerId: string): IRepresentationProvider | undefined;

  /**
   * Get all providers for a representation type
   */
  getProvidersByType(type: RepresentationType): IRepresentationProvider[];

  /**
   * Get all registered providers
   */
  getAllProviders(): IRepresentationProvider[];

  /**
   * Check if a provider is registered
   */
  hasProvider(providerId: string): boolean;
}

/**
 * Main representation service interface
 *
 * Combines provider registry with transformation capabilities.
 * Uses full dependency injection - all dependencies via constructor.
 */
export interface IRepresentationService
  extends IRepresentationServiceLifecycle,
    IRepresentationProviderRegistry {
  /**
   * Transform input using a specific provider
   *
   * @param providerId - The provider to use
   * @param input - The transformation input
   * @returns The transformation result
   */
  transform(
    providerId: string,
    input: RepresentationInput
  ): Promise<RepresentationResult<AnyRepresentationOutput, RepresentationError>>;

  /**
   * Transform to image using the first available image provider
   */
  transformToImage(
    input: RepresentationInput,
    options?: ImageTransformOptions
  ): Promise<RepresentationResult<ImageRepresentationOutput, RepresentationError>>;

  /**
   * Transform to summary using the first available summary provider
   */
  transformToSummary(
    input: RepresentationInput,
    options?: SummaryTransformOptions
  ): Promise<RepresentationResult<SummaryRepresentationOutput, RepresentationError>>;

  /**
   * Transform to summary with streaming
   */
  transformToSummaryStreaming(
    input: RepresentationInput,
    onChunk: SummaryStreamCallback,
    options?: SummaryTransformOptions
  ): Promise<RepresentationResult<SummaryRepresentationOutput, RepresentationError>>;

  /**
   * Transform to audio using the first available audio provider
   */
  transformToAudio(
    input: RepresentationInput,
    options?: AudioTransformOptions
  ): Promise<RepresentationResult<AudioRepresentationOutput, RepresentationError>>;

  /**
   * Get available representation types based on registered providers
   */
  getAvailableTypes(): RepresentationType[];
}
