import type { ICodingAgentProvider } from '../../coding-agent';
import type {
  IRepresentationExplanationProvider,
  ExplanationTransformOptions,
  ExplanationStreamCallback,
} from '../interfaces/IRepresentationExplanationProvider';
import type {
  RepresentationResult,
  RepresentationError,
  RepresentationInput,
  RepresentationCapabilities,
  ExplanationRepresentationOutput,
} from '../types';
import { ok, err, representationError, RepresentationErrorCode } from '../types';

/**
 * ID generator interface for dependency injection
 */
export interface IIdGenerator {
  generate(): string;
}

/**
 * ClaudeExplanationProvider - Transforms cryptic code/CLI commands into human-understandable explanations
 *
 * Uses ICodingAgentProvider (ClaudeCodeAgent) to generate explanations via LLM.
 */
export class ClaudeExplanationProvider implements IRepresentationExplanationProvider {
  readonly providerId = 'claude-explanation';
  readonly providerName = 'Claude Code Explanation';
  readonly representationType = 'explanation' as const;

  private initialized = false;

  constructor(
    private readonly codingAgent: ICodingAgentProvider,
    private readonly idGenerator: IIdGenerator
  ) {}

  getCapabilities(): RepresentationCapabilities {
    return {
      supportsStreaming: true,
      maxInputLength: 100_000,
      estimatedProcessingMs: 5000,
    };
  }

  async isAvailable(): Promise<boolean> {
    return this.codingAgent.getCapabilities().canGenerate;
  }

  async initialize(): Promise<RepresentationResult<void, RepresentationError>> {
    this.initialized = true;
    return ok(undefined);
  }

  async dispose(): Promise<void> {
    this.initialized = false;
  }

  async transform(
    input: RepresentationInput
  ): Promise<RepresentationResult<ExplanationRepresentationOutput, RepresentationError>> {
    return this.transformToExplanation(input);
  }

  async transformToExplanation(
    input: RepresentationInput,
    options?: ExplanationTransformOptions
  ): Promise<RepresentationResult<ExplanationRepresentationOutput, RepresentationError>> {
    const startTime = Date.now();

    const prompt = this.buildExplanationPrompt(input.text, options);
    const result = await this.codingAgent.generate({ prompt });

    if (!result.success) {
      return err(
        representationError(
          RepresentationErrorCode.TRANSFORMATION_FAILED,
          `Failed to generate explanation: ${result.error.message}`,
          { agentError: result.error }
        )
      );
    }

    return ok(this.parseResponse(result.data.content, input, startTime));
  }

  async transformToExplanationStreaming(
    input: RepresentationInput,
    onChunk: ExplanationStreamCallback,
    options?: ExplanationTransformOptions
  ): Promise<RepresentationResult<ExplanationRepresentationOutput, RepresentationError>> {
    const startTime = Date.now();

    const prompt = this.buildExplanationPrompt(input.text, options);
    const result = await this.codingAgent.generateStreaming({ prompt }, (chunk) => {
      onChunk(chunk, false);
    });

    if (!result.success) {
      return err(
        representationError(
          RepresentationErrorCode.TRANSFORMATION_FAILED,
          `Failed to stream explanation: ${result.error.message}`,
          { agentError: result.error }
        )
      );
    }

    onChunk('', true);
    return ok(this.parseResponse(result.data.content, input, startTime));
  }

  private buildExplanationPrompt(code: string, options?: ExplanationTransformOptions): string {
    const audience = options?.targetAudience ?? 'intermediate';
    const verbosity = options?.verbosityLevel ?? 'standard';
    const includeExamples = options?.includeExamples ?? false;
    const focusAreas = options?.focusAreas ?? [];

    const audienceInstruction = {
      beginner:
        'Explain this to someone new to programming. Use simple terms and avoid jargon.',
      intermediate:
        'Explain this to a developer with some experience. You can use technical terms but explain complex concepts.',
      expert:
        'Provide a technical explanation suitable for an experienced developer. Focus on nuances and edge cases.',
    }[audience];

    const verbosityInstruction = {
      concise: 'Keep the explanation brief and to the point.',
      standard: 'Provide a balanced explanation with sufficient detail.',
      detailed:
        'Provide a comprehensive explanation covering all aspects.',
    }[verbosity];

    const examplesInstruction = includeExamples
      ? 'Include practical examples to illustrate key concepts.'
      : '';

    const focusInstruction =
      focusAreas.length > 0
        ? `Pay special attention to these aspects: ${focusAreas.join(', ')}.`
        : '';

    return `You are an expert code explainer. Analyze the following code or command and explain what it does in plain language.

${audienceInstruction}
${verbosityInstruction}
${examplesInstruction}
${focusInstruction}

Respond with a JSON object containing:
- "explanation": The human-readable explanation
- "language": The detected programming language or "bash" for CLI commands
- "complexity": One of "simple", "moderate", or "complex"
- "relatedConcepts": An array of key concepts referenced (max 5)

Code/Command to explain:
\`\`\`
${code}
\`\`\`

Respond only with valid JSON, no markdown formatting.`;
  }

  private parseResponse(
    content: string,
    input: RepresentationInput,
    startTime: number
  ): ExplanationRepresentationOutput {
    let explanation = content;
    let language: string | undefined;
    let complexity: 'simple' | 'moderate' | 'complex' | undefined;
    let relatedConcepts: string[] | undefined;

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        explanation = parsed.explanation || content;
        language = parsed.language;
        complexity = parsed.complexity;
        relatedConcepts = parsed.relatedConcepts;
      }
    } catch {
      // If JSON parsing fails, use the raw content as the explanation
    }

    const wordCount = explanation.split(/\s+/).filter(Boolean).length;

    return {
      id: this.idGenerator.generate(),
      type: 'explanation',
      createdAt: new Date().toISOString(),
      explanation,
      codeSnippet: input.text,
      language,
      complexity,
      relatedConcepts,
      wordCount,
      sourceMetadata: input.metadata,
      metrics: {
        durationMs: Date.now() - startTime,
        inputLength: input.text.length,
        outputSizeBytes: new TextEncoder().encode(explanation).length,
      },
    };
  }
}
