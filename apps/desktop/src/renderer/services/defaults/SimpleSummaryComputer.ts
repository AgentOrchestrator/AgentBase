/**
 * SimpleSummaryComputer
 *
 * Simple summary computation by combining first few user messages.
 * Can be replaced with LLM-powered implementation later.
 */

import type { ISummaryComputer } from '../../../../types/coding-agent-status';

const MAX_SUMMARY_LENGTH = 200;
const MAX_MESSAGES_TO_USE = 3;
const DEFAULT_SUMMARY = 'No task description available.';

/**
 * Creates a summary from the first few user messages.
 * Concatenates messages with length limit.
 */
export class SimpleSummaryComputer implements ISummaryComputer {
  async computeSummary(messages: string[]): Promise<string> {
    if (messages.length === 0) {
      return DEFAULT_SUMMARY;
    }

    // Take first N messages
    const relevantMessages = messages.slice(0, MAX_MESSAGES_TO_USE);

    // Clean and combine messages
    const combined = relevantMessages
      .map((msg) => this.cleanMessage(msg))
      .filter((msg) => msg.length > 0)
      .join(' | ');

    if (!combined) {
      return DEFAULT_SUMMARY;
    }

    // Truncate if needed
    return this.truncate(combined, MAX_SUMMARY_LENGTH);
  }

  private cleanMessage(text: string): string {
    // Remove excessive whitespace
    let cleaned = text.replace(/\s+/g, ' ').trim();

    // Remove code blocks (they don't summarize well)
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '[code]');

    // Remove inline code
    cleaned = cleaned.replace(/`[^`]+`/g, '[code]');

    return cleaned;
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }

    // Find last sentence boundary before maxLength
    const truncated = text.slice(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastQuestion = truncated.lastIndexOf('?');
    const lastExclaim = truncated.lastIndexOf('!');

    const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclaim);

    if (lastSentenceEnd > maxLength * 0.6) {
      return truncated.slice(0, lastSentenceEnd + 1);
    }

    // Fall back to word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.5) {
      return `${truncated.slice(0, lastSpace)}...`;
    }

    return `${truncated}...`;
  }
}
