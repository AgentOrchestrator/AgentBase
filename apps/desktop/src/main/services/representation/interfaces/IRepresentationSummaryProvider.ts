import type {
  RepresentationError,
  RepresentationInput,
  RepresentationResult,
  SummaryRepresentationOutput,
} from '../types';
import type { IRepresentationProvider } from './IRepresentationProvider';

/**
 * Extended options for summary transformation
 */
export interface SummaryTransformOptions {
  /** Target summary length (word count) */
  targetLength?: number;
  /** Include key highlights */
  includeHighlights?: boolean;
  /** Summary style */
  style?: 'brief' | 'detailed' | 'bullet_points';
  /** Focus areas for the summary */
  focusAreas?: string[];
}

/**
 * Streaming callback for summary generation
 */
export type SummaryStreamCallback = (chunk: string, isComplete: boolean) => void;

/**
 * Interface for providers that produce summary representations
 */
export interface IRepresentationSummaryProvider
  extends IRepresentationProvider<SummaryRepresentationOutput> {
  readonly representationType: 'summary';

  /**
   * Transform with summary-specific options
   */
  transformToSummary(
    input: RepresentationInput,
    options?: SummaryTransformOptions
  ): Promise<RepresentationResult<SummaryRepresentationOutput, RepresentationError>>;

  /**
   * Stream summary generation (if supported)
   */
  transformToSummaryStreaming?(
    input: RepresentationInput,
    onChunk: SummaryStreamCallback,
    options?: SummaryTransformOptions
  ): Promise<RepresentationResult<SummaryRepresentationOutput, RepresentationError>>;
}
