"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepresentationService = void 0;
const types_1 = require("../types");
const capability_checker_1 = require("../utils/capability-checker");
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
class RepresentationService {
    constructor(config, deps) {
        this.config = config;
        this.deps = deps;
        this.providers = new Map();
        this.providersByType = new Map();
        this.isInitialized = false;
        // Initialize type index
        this.providersByType.set('image', new Set());
        this.providersByType.set('summary', new Set());
        this.providersByType.set('audio', new Set());
    }
    // ==================== Lifecycle ====================
    async initialize() {
        if (this.isInitialized) {
            return (0, types_1.ok)(undefined);
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
        return (0, types_1.ok)(undefined);
    }
    async dispose() {
        const disposePromises = Array.from(this.providers.values()).map(async (provider) => {
            try {
                await provider.dispose();
            }
            catch (error) {
                this.deps.logger.error('Error disposing provider', {
                    providerId: provider.providerId,
                    error: error.message,
                });
            }
        });
        await Promise.all(disposePromises);
        this.providers.clear();
        this.providersByType.forEach((set) => set.clear());
        this.isInitialized = false;
        this.deps.logger.info('RepresentationService disposed');
    }
    // ==================== Provider Registry ====================
    registerProvider(provider) {
        if (this.providers.has(provider.providerId)) {
            return (0, types_1.err)((0, types_1.representationError)(types_1.RepresentationErrorCode.PROVIDER_ALREADY_REGISTERED, `Provider already registered: ${provider.providerId}`));
        }
        this.providers.set(provider.providerId, provider);
        this.providersByType.get(provider.representationType)?.add(provider.providerId);
        this.deps.logger.info('Provider registered', {
            providerId: provider.providerId,
            providerName: provider.providerName,
            type: provider.representationType,
        });
        return (0, types_1.ok)(undefined);
    }
    unregisterProvider(providerId) {
        const provider = this.providers.get(providerId);
        if (!provider) {
            return (0, types_1.err)((0, types_1.representationError)(types_1.RepresentationErrorCode.PROVIDER_NOT_FOUND, `Provider not found: ${providerId}`));
        }
        this.providers.delete(providerId);
        this.providersByType.get(provider.representationType)?.delete(providerId);
        this.deps.logger.info('Provider unregistered', { providerId });
        return (0, types_1.ok)(undefined);
    }
    getProvider(providerId) {
        return this.providers.get(providerId);
    }
    getProvidersByType(type) {
        const providerIds = this.providersByType.get(type) ?? new Set();
        return Array.from(providerIds)
            .map((id) => this.providers.get(id))
            .filter((p) => p !== undefined);
    }
    getAllProviders() {
        return Array.from(this.providers.values());
    }
    hasProvider(providerId) {
        return this.providers.has(providerId);
    }
    getAvailableTypes() {
        const types = [];
        for (const [type, providerIds] of this.providersByType) {
            if (providerIds.size > 0) {
                types.push(type);
            }
        }
        return types;
    }
    // ==================== Transformation ====================
    async transform(providerId, input) {
        const initCheck = this.ensureInitialized();
        if (!initCheck.success) {
            return initCheck;
        }
        const provider = this.providers.get(providerId);
        if (!provider) {
            return (0, types_1.err)((0, types_1.representationError)(types_1.RepresentationErrorCode.PROVIDER_NOT_FOUND, `Provider not found: ${providerId}`));
        }
        const isAvailable = await provider.isAvailable();
        if (!isAvailable) {
            return (0, types_1.err)((0, types_1.representationError)(types_1.RepresentationErrorCode.PROVIDER_NOT_AVAILABLE, `Provider not available: ${providerId}`));
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
        }
        else {
            this.deps.logger.error('Transformation failed', {
                providerId,
                durationMs,
                error: result.error.message,
            });
        }
        return result;
    }
    async transformToImage(input, options) {
        const initCheck = this.ensureInitialized();
        if (!initCheck.success) {
            return initCheck;
        }
        const imageProviders = this.getProvidersByType('image');
        const provider = imageProviders.find((p) => (0, capability_checker_1.isImageProvider)(p));
        if (!provider) {
            return (0, types_1.err)((0, types_1.representationError)(types_1.RepresentationErrorCode.PROVIDER_NOT_FOUND, 'No image provider registered'));
        }
        return provider.transformToImage(input, options);
    }
    async transformToSummary(input, options) {
        const initCheck = this.ensureInitialized();
        if (!initCheck.success) {
            return initCheck;
        }
        const summaryProviders = this.getProvidersByType('summary');
        const provider = summaryProviders.find((p) => (0, capability_checker_1.isSummaryProvider)(p));
        if (!provider) {
            return (0, types_1.err)((0, types_1.representationError)(types_1.RepresentationErrorCode.PROVIDER_NOT_FOUND, 'No summary provider registered'));
        }
        return provider.transformToSummary(input, options);
    }
    async transformToSummaryStreaming(input, onChunk, options) {
        const initCheck = this.ensureInitialized();
        if (!initCheck.success) {
            return initCheck;
        }
        const summaryProviders = this.getProvidersByType('summary');
        const provider = summaryProviders.find((p) => (0, capability_checker_1.supportsSummaryStreaming)(p));
        if (!provider || !(0, capability_checker_1.supportsSummaryStreaming)(provider)) {
            return (0, types_1.err)((0, types_1.representationError)(types_1.RepresentationErrorCode.CAPABILITY_NOT_SUPPORTED, 'No summary provider with streaming support registered'));
        }
        return provider.transformToSummaryStreaming(input, onChunk, options);
    }
    async transformToAudio(input, options) {
        const initCheck = this.ensureInitialized();
        if (!initCheck.success) {
            return initCheck;
        }
        const audioProviders = this.getProvidersByType('audio');
        const provider = audioProviders.find((p) => (0, capability_checker_1.isAudioProvider)(p));
        if (!provider) {
            return (0, types_1.err)((0, types_1.representationError)(types_1.RepresentationErrorCode.PROVIDER_NOT_FOUND, 'No audio provider registered'));
        }
        return provider.transformToAudio(input, options);
    }
    // ==================== Private Helpers ====================
    ensureInitialized() {
        if (!this.isInitialized) {
            return (0, types_1.err)((0, types_1.representationError)(types_1.RepresentationErrorCode.SERVICE_NOT_INITIALIZED, 'RepresentationService not initialized. Call initialize() first.'));
        }
        return (0, types_1.ok)(undefined);
    }
}
exports.RepresentationService = RepresentationService;
