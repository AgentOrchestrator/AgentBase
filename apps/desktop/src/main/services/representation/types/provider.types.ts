import type { AudioFormat, ImageFormat, RepresentationOutput } from './representation.types';

/**
 * Image representation output
 */
export interface ImageRepresentationOutput extends RepresentationOutput {
  type: 'image';
  /** The image data (base64 encoded or URL) */
  data: string;
  /** How the data is encoded */
  encoding: 'base64' | 'url';
  /** Image format */
  format: ImageFormat;
  /** Image dimensions */
  dimensions?: {
    width: number;
    height: number;
  };
  /** Alternative text description */
  altText?: string;
}

/**
 * Summary representation output
 */
export interface SummaryRepresentationOutput extends RepresentationOutput {
  type: 'summary';
  /** The generated summary text */
  summary: string;
  /** Key highlights extracted */
  highlights?: string[];
  /** Confidence score (0-1) */
  confidence?: number;
  /** Word count */
  wordCount: number;
}

/**
 * Audio representation output
 */
export interface AudioRepresentationOutput extends RepresentationOutput {
  type: 'audio';
  /** The audio data (base64 encoded or URL) */
  data: string;
  /** How the data is encoded */
  encoding: 'base64' | 'url';
  /** Audio format */
  format: AudioFormat;
  /** Duration in seconds */
  durationSeconds: number;
  /** Sample rate */
  sampleRate?: number;
}

/**
 * Union type for all representation outputs
 */
export type AnyRepresentationOutput =
  | ImageRepresentationOutput
  | SummaryRepresentationOutput
  | AudioRepresentationOutput;

/**
 * Configuration for a provider
 */
export interface ProviderConfig {
  /** Unique identifier for this provider instance */
  id: string;
  /** Human-readable name */
  name: string;
  /** Default timeout in milliseconds */
  defaultTimeout?: number;
  /** Provider-specific settings */
  settings?: Record<string, unknown>;
}
