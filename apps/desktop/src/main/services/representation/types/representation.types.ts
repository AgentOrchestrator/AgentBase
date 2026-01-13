/**
 * Supported representation output types
 */
export type RepresentationType = 'image' | 'summary' | 'audio';

/**
 * Provider capabilities for runtime checking
 */
export interface RepresentationCapabilities {
  /** Supported output formats for images */
  supportedImageFormats?: ImageFormat[];
  /** Supported audio formats */
  supportedAudioFormats?: AudioFormat[];
  /** Supports streaming output */
  supportsStreaming: boolean;
  /** Maximum input length (characters) */
  maxInputLength?: number;
  /** Estimated processing time hint */
  estimatedProcessingMs?: number;
}

/**
 * Image output formats
 */
export type ImageFormat = 'png' | 'jpeg' | 'svg' | 'webp';

/**
 * Audio output formats
 */
export type AudioFormat = 'mp3' | 'wav' | 'ogg';

/**
 * Input for representation transformation
 */
export interface RepresentationInput {
  /** The source text to transform (e.g., coding session history) */
  text: string;
  /** Optional metadata about the source */
  metadata?: RepresentationMetadata;
  /** Request-specific options */
  options?: RepresentationOptions;
}

/**
 * Metadata about the input source
 */
export interface RepresentationMetadata {
  /** Source type (e.g., 'coding_session', 'chat_history') */
  sourceType?: string;
  /** Identifier for the source (e.g., session ID) */
  sourceId?: string;
  /** Timestamp range covered */
  timeRange?: {
    start: string;
    end: string;
  };
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Options for transformation requests
 */
export interface RepresentationOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Priority hint (higher = more important) */
  priority?: number;
  /** Format-specific options */
  formatOptions?: Record<string, unknown>;
}

/**
 * Base output from any representation transformation
 */
export interface RepresentationOutput {
  /** Unique identifier for this representation */
  id: string;
  /** Type of representation */
  type: RepresentationType;
  /** When the transformation was completed */
  createdAt: string;
  /** Source input reference */
  sourceMetadata?: RepresentationMetadata;
  /** Processing metrics */
  metrics?: TransformationMetrics;
}

/**
 * Metrics about the transformation process
 */
export interface TransformationMetrics {
  /** Processing duration in milliseconds */
  durationMs: number;
  /** Input character count */
  inputLength: number;
  /** Output size in bytes */
  outputSizeBytes?: number;
}
