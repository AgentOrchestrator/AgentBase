// Types
export * from './types';

// Interfaces
export * from './interfaces';

// Implementations
export { RepresentationService } from './implementations/RepresentationService';
export type {
  RepresentationServiceConfig,
  RepresentationServiceDependencies,
  ILogger,
  IIdGenerator,
} from './implementations/RepresentationService';

// Providers
export { ClaudeExplanationProvider } from './providers';
export type { IIdGenerator as IExplanationIdGenerator } from './providers';

// Utilities
export * from './utils/capability-checker';
