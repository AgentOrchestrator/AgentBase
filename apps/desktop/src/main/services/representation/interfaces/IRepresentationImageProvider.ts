import type {
  ImageFormat,
  ImageRepresentationOutput,
  RepresentationError,
  RepresentationInput,
  RepresentationResult,
} from '../types';
import type { IRepresentationProvider } from './IRepresentationProvider';

/**
 * Extended options for image transformation
 */
export interface ImageTransformOptions {
  /** Desired output format */
  format?: ImageFormat;
  /** Target width (maintains aspect ratio if height not specified) */
  width?: number;
  /** Target height */
  height?: number;
  /** Visual style hint */
  style?: 'diagram' | 'timeline' | 'mindmap' | 'flowchart';
}

/**
 * Interface for providers that produce image representations
 *
 * Extends the base provider with image-specific methods.
 */
export interface IRepresentationImageProvider
  extends IRepresentationProvider<ImageRepresentationOutput> {
  readonly representationType: 'image';

  /**
   * Transform with image-specific options
   */
  transformToImage(
    input: RepresentationInput,
    options?: ImageTransformOptions
  ): Promise<RepresentationResult<ImageRepresentationOutput, RepresentationError>>;

  /**
   * Get supported image formats
   */
  getSupportedFormats(): ImageFormat[];
}
