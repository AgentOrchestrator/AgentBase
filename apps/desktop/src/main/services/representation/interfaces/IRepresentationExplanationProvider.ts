import type { IRepresentationProvider } from './IRepresentationProvider';
import type {
  RepresentationResult,
  RepresentationError,
  RepresentationInput,
  ExplanationRepresentationOutput,
} from '../types';

/**
 * Extended options for explanation transformation
 */
export interface ExplanationTransformOptions {
  /** Target audience expertise level */
  targetAudience?: 'beginner' | 'intermediate' | 'expert';
  /** How verbose the explanation should be */
  verbosityLevel?: 'concise' | 'standard' | 'detailed';
  /** Include practical examples in the explanation */
  includeExamples?: boolean;
  /** Specific areas to focus on (e.g., ['security', 'performance']) */
  focusAreas?: string[];
}

/**
 * Streaming callback for explanation generation
 */
export type ExplanationStreamCallback = (chunk: string, isComplete: boolean) => void;

/**
 * Interface for providers that produce explanation representations
 * Transforms cryptic code or CLI commands into human-understandable explanations
 */
export interface IRepresentationExplanationProvider
  extends IRepresentationProvider<ExplanationRepresentationOutput> {
  readonly representationType: 'explanation';

  /**
   * Transform with explanation-specific options
   */
  transformToExplanation(
    input: RepresentationInput,
    options?: ExplanationTransformOptions
  ): Promise<RepresentationResult<ExplanationRepresentationOutput, RepresentationError>>;

  /**
   * Stream explanation generation (if supported)
   */
  transformToExplanationStreaming?(
    input: RepresentationInput,
    onChunk: ExplanationStreamCallback,
    options?: ExplanationTransformOptions
  ): Promise<RepresentationResult<ExplanationRepresentationOutput, RepresentationError>>;
}
