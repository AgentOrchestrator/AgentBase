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

// Utilities
export * from './utils/capability-checker';
