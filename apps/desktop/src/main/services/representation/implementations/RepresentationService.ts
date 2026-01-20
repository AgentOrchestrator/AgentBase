import type {
  AudioTransformOptions,
  ImageTransformOptions,
  IRepresentationAudioProvider,
  IRepresentationImageProvider,
  IRepresentationProvider,
  IRepresentationService,
  IRepresentationSummaryProvider,
  SummaryStreamCallback,
  SummaryTransformOptions,
} from '../interfaces';
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
import { err, ok, RepresentationErrorCode, representationError } from '../types';
import {
  isAudioProvider,
  isImageProvider,
  isSummaryProvider,
  supportsSummaryStreaming,
} from '../utils/capability-checker';

/**
 * Logger interface for dependency injection
 */
export interface ILogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

/**
 * ID generator interface for dependency injection
 */
export interface IIdGenerator {
  generate(): string;
}

/**
 * Configuration for RepresentationService
 */
export interface RepresentationServiceConfig {
  /** Default timeout for transformations (ms) */
  defaultTimeout?: number;
  /** Whether to initialize providers on service init */
  initializeProvidersOnStart?: boolean;
}

/**
 * Dependencies required by RepresentationService
 */
export interface RepresentationServiceDependencies {
  logger: ILogger;
  idGenerator: IIdGenerator;
}

/**
 * RepresentationService - Main service for managing representation providers
 * and transforming coding history into different formats.
 *
 * Design:
 * - Full constructor dependency injection (no statics/singletons)
 * - Provider registry pattern for extensibility
 * - Type-safe provider access via type guards
 * - Result<T,E> for explicit error handling
 */
export class RepresentationService implements IRepresentationService {
  private readonly providers = new Map<string, IRepresentationProvider>();
  private readonly providersByType = new Map<RepresentationType, Set<string>>();
  private isInitialized = false;

  constructor(
    private readonly config: RepresentationServiceConfig,
    private readonly deps: RepresentationServiceDependencies
  ) {
    // Initialize type index
    this.providersByType.set('image', new Set());
    this.providersByType.set('summary', new Set());
    this.providersByType.set('audio', new Set());
  }

  // ==================== Lifecycle ====================

  async initialize(): Promise<RepresentationResult<void, RepresentationError>> {
    if (this.isInitialized) {
      return ok(undefined);
    }

    if (this.config.initializeProvidersOnStart) {
      for (const provider of this.providers.values()) {
        const result = await provider.initialize();
        if (!result.success) {
          this.deps.logger.error('Failed to initialize provider', {
            providerId: provider.providerId,
            error: result.error.message,
          });
          // Continue initializing other providers
        }
      }
    }

    this.isInitialized = true;
    this.deps.logger.info('RepresentationService initialized', {
      providerCount: this.providers.size,
    });

    return ok(undefined);
  }

  async dispose(): Promise<void> {
    const disposePromises = Array.from(this.providers.values()).map(async (provider) => {
      try {
        await provider.dispose();
      } catch (error) {
        this.deps.logger.error('Error disposing provider', {
          providerId: provider.providerId,
          error: (error as Error).message,
        });
      }
    });

    await Promise.all(disposePromises);
    this.providers.clear();
    for (const set of this.providersByType.values()) {
      set.clear();
    }
    this.isInitialized = false;

    this.deps.logger.info('RepresentationService disposed');
  }

  // ==================== Provider Registry ====================

  registerProvider(
    provider: IRepresentationProvider
  ): RepresentationResult<void, RepresentationError> {
    if (this.providers.has(provider.providerId)) {
      return err(
        representationError(
          RepresentationErrorCode.PROVIDER_ALREADY_REGISTERED,
          `Provider already registered: ${provider.providerId}`
        )
      );
    }

    this.providers.set(provider.providerId, provider);
    this.providersByType.get(provider.representationType)?.add(provider.providerId);

    this.deps.logger.info('Provider registered', {
      providerId: provider.providerId,
      providerName: provider.providerName,
      type: provider.representationType,
    });

    return ok(undefined);
  }

  unregisterProvider(providerId: string): RepresentationResult<void, RepresentationError> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return err(
        representationError(
          RepresentationErrorCode.PROVIDER_NOT_FOUND,
          `Provider not found: ${providerId}`
        )
      );
    }

    this.providers.delete(providerId);
    this.providersByType.get(provider.representationType)?.delete(providerId);

    this.deps.logger.info('Provider unregistered', { providerId });

    return ok(undefined);
  }

  getProvider(providerId: string): IRepresentationProvider | undefined {
    return this.providers.get(providerId);
  }

  getProvidersByType(type: RepresentationType): IRepresentationProvider[] {
    const providerIds = this.providersByType.get(type) ?? new Set();
    return Array.from(providerIds)
      .map((id) => this.providers.get(id))
      .filter((p): p is IRepresentationProvider => p !== undefined);
  }

  getAllProviders(): IRepresentationProvider[] {
    return Array.from(this.providers.values());
  }

  hasProvider(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  getAvailableTypes(): RepresentationType[] {
    const types: RepresentationType[] = [];

    for (const [type, providerIds] of this.providersByType) {
      if (providerIds.size > 0) {
        types.push(type);
      }
    }

    return types;
  }

  // ==================== Transformation ====================

  async transform(
    providerId: string,
    input: RepresentationInput
  ): Promise<RepresentationResult<AnyRepresentationOutput, RepresentationError>> {
    const initCheck = this.ensureInitialized();
    if (!initCheck.success) {
      return initCheck;
    }

    const provider = this.providers.get(providerId);
    if (!provider) {
      return err(
        representationError(
          RepresentationErrorCode.PROVIDER_NOT_FOUND,
          `Provider not found: ${providerId}`
        )
      );
    }

    const isAvailable = await provider.isAvailable();
    if (!isAvailable) {
      return err(
        representationError(
          RepresentationErrorCode.PROVIDER_NOT_AVAILABLE,
          `Provider not available: ${providerId}`
        )
      );
    }

    this.deps.logger.info('Starting transformation', {
      providerId,
      inputLength: input.text.length,
    });

    const startTime = Date.now();
    const result = await provider.transform(input);
    const durationMs = Date.now() - startTime;

    if (result.success) {
      this.deps.logger.info('Transformation completed', {
        providerId,
        durationMs,
        outputType: result.data.type,
      });
    } else {
      this.deps.logger.error('Transformation failed', {
        providerId,
        durationMs,
        error: result.error.message,
      });
    }

    return result as RepresentationResult<AnyRepresentationOutput, RepresentationError>;
  }

  async transformToImage(
    input: RepresentationInput,
    options?: ImageTransformOptions
  ): Promise<RepresentationResult<ImageRepresentationOutput, RepresentationError>> {
    const initCheck = this.ensureInitialized();
    if (!initCheck.success) {
      return initCheck;
    }

    const imageProviders = this.getProvidersByType('image');
    const provider = imageProviders.find((p) => isImageProvider(p)) as
      | IRepresentationImageProvider
      | undefined;

    if (!provider) {
      return err(
        representationError(
          RepresentationErrorCode.PROVIDER_NOT_FOUND,
          'No image provider registered'
        )
      );
    }

    return provider.transformToImage(input, options);
  }

  async transformToSummary(
    input: RepresentationInput,
    options?: SummaryTransformOptions
  ): Promise<RepresentationResult<SummaryRepresentationOutput, RepresentationError>> {
    const initCheck = this.ensureInitialized();
    if (!initCheck.success) {
      return initCheck;
    }

    const summaryProviders = this.getProvidersByType('summary');
    const provider = summaryProviders.find((p) => isSummaryProvider(p)) as
      | IRepresentationSummaryProvider
      | undefined;

    if (!provider) {
      return err(
        representationError(
          RepresentationErrorCode.PROVIDER_NOT_FOUND,
          'No summary provider registered'
        )
      );
    }

    return provider.transformToSummary(input, options);
  }

  async transformToSummaryStreaming(
    input: RepresentationInput,
    onChunk: SummaryStreamCallback,
    options?: SummaryTransformOptions
  ): Promise<RepresentationResult<SummaryRepresentationOutput, RepresentationError>> {
    const initCheck = this.ensureInitialized();
    if (!initCheck.success) {
      return initCheck;
    }

    const summaryProviders = this.getProvidersByType('summary');
    const provider = summaryProviders.find((p) => supportsSummaryStreaming(p));

    if (!provider || !supportsSummaryStreaming(provider)) {
      return err(
        representationError(
          RepresentationErrorCode.CAPABILITY_NOT_SUPPORTED,
          'No summary provider with streaming support registered'
        )
      );
    }

    return provider.transformToSummaryStreaming(input, onChunk, options);
  }

  async transformToAudio(
    input: RepresentationInput,
    options?: AudioTransformOptions
  ): Promise<RepresentationResult<AudioRepresentationOutput, RepresentationError>> {
    const initCheck = this.ensureInitialized();
    if (!initCheck.success) {
      return initCheck;
    }

    const audioProviders = this.getProvidersByType('audio');
    const provider = audioProviders.find((p) => isAudioProvider(p)) as
      | IRepresentationAudioProvider
      | undefined;

    if (!provider) {
      return err(
        representationError(
          RepresentationErrorCode.PROVIDER_NOT_FOUND,
          'No audio provider registered'
        )
      );
    }

    return provider.transformToAudio(input, options);
  }

  // ==================== Private Helpers ====================

  private ensureInitialized(): RepresentationResult<void, RepresentationError> {
    if (!this.isInitialized) {
      return err(
        representationError(
          RepresentationErrorCode.SERVICE_NOT_INITIALIZED,
          'RepresentationService not initialized. Call initialize() first.'
        )
      );
    }
    return ok(undefined);
  }
}
