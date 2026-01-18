/**
 * SimpleTitleComputer
 *
 * Simple title computation by extracting from the first user message.
 * Can be replaced with LLM-powered implementation later.
 */

import type { ITitleComputer } from '../../../../types/coding-agent-status';

const MAX_TITLE_LENGTH = 50;
const DEFAULT_TITLE = 'Untitled Session';

/**
 * Extracts a title from the first user message.
 * Truncates at word boundary with ellipsis if too long.
 */
export class SimpleTitleComputer implements ITitleComputer {
  async computeTitle(messages: string[]): Promise<string> {
    if (messages.length === 0) {
      return DEFAULT_TITLE;
    }

    const firstMessage = messages[0].trim();
    if (!firstMessage) {
      return DEFAULT_TITLE;
    }

    // Remove common prefixes that don't add value
    const cleaned = this.removeCommonPrefixes(firstMessage);

    // Truncate at word boundary
    return this.truncateAtWordBoundary(cleaned, MAX_TITLE_LENGTH);
  }

  private removeCommonPrefixes(text: string): string {
    const prefixes = [
      /^(hey|hi|hello),?\s*/i,
      /^(please|pls|can you|could you)\s*/i,
      /^(help me|i need|i want)\s*/i,
    ];

    let result = text;
    for (const prefix of prefixes) {
      result = result.replace(prefix, '');
    }

    // Capitalize first letter
    return result.charAt(0).toUpperCase() + result.slice(1);
  }

  private truncateAtWordBoundary(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }

    // Find last space before maxLength
    const truncated = text.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.5) {
      // Only truncate at word boundary if we keep at least half the content
      return `${truncated.slice(0, lastSpace)}...`;
    }

    return `${truncated}...`;
  }
}
