// Result types
export {
  type RepresentationResult,
  type RepresentationError,
  RepresentationErrorCode,
  ok,
  err,
  representationError,
} from './result.types';

// Representation types
export {
  type RepresentationType,
  type RepresentationCapabilities,
  type ImageFormat,
  type AudioFormat,
  type RepresentationInput,
  type RepresentationMetadata,
  type RepresentationOptions,
  type RepresentationOutput,
  type TransformationMetrics,
} from './representation.types';

// Provider types
export {
  type ImageRepresentationOutput,
  type SummaryRepresentationOutput,
  type AudioRepresentationOutput,
  type ExplanationRepresentationOutput,
  type AnyRepresentationOutput,
  type ProviderConfig,
} from './provider.types';
