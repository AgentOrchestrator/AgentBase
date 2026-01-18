import type {
  AudioFormat,
  AudioRepresentationOutput,
  RepresentationError,
  RepresentationInput,
  RepresentationResult,
} from '../types';
import type { IRepresentationProvider } from './IRepresentationProvider';

/**
 * Extended options for audio transformation
 */
export interface AudioTransformOptions {
  /** Desired output format */
  format?: AudioFormat;
  /** Voice selection (provider-specific) */
  voice?: string;
  /** Speaking rate (0.5 = slow, 1.0 = normal, 2.0 = fast) */
  rate?: number;
  /** Sample rate in Hz */
  sampleRate?: number;
}

/**
 * Interface for providers that produce audio representations
 */
export interface IRepresentationAudioProvider
  extends IRepresentationProvider<AudioRepresentationOutput> {
  readonly representationType: 'audio';

  /**
   * Transform with audio-specific options
   */
  transformToAudio(
    input: RepresentationInput,
    options?: AudioTransformOptions
  ): Promise<RepresentationResult<AudioRepresentationOutput, RepresentationError>>;

  /**
   * Get available voices
   */
  getAvailableVoices(): Promise<string[]>;

  /**
   * Get supported audio formats
   */
  getSupportedFormats(): AudioFormat[];
}
