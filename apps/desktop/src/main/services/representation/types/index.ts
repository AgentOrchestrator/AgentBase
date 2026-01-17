// Result types

// Provider types
export type {
  AnyRepresentationOutput,
  AudioRepresentationOutput,
  ImageRepresentationOutput,
  ProviderConfig,
  SummaryRepresentationOutput,
} from './provider.types';

// Representation types
export type {
  AudioFormat,
  ImageFormat,
  RepresentationCapabilities,
  RepresentationInput,
  RepresentationMetadata,
  RepresentationOptions,
  RepresentationOutput,
  RepresentationType,
  TransformationMetrics,
} from './representation.types';
export {
  err,
  ok,
  type RepresentationError,
  RepresentationErrorCode,
  type RepresentationResult,
  representationError,
} from './result.types';
