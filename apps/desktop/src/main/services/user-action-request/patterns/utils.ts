/**
 * Utility functions for terminal pattern processing
 */

/**
 * Regex pattern to match ANSI escape sequences
 *
 * Matches:
 * - CSI (Control Sequence Introducer) sequences: \x1b[...
 * - SGR (Select Graphic Rendition) for colors/styling
 * - Cursor movement and other control codes
 * - OSC (Operating System Command) sequences: \x1b]...\x07
 */
const ANSI_PATTERN =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Required for ANSI detection
  /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]|[\u001b\u009b]\].*?(?:\u0007|\u001b\\)/g;

/**
 * Strip ANSI escape codes from a string
 *
 * This is essential for pattern matching on terminal output,
 * as prompts often include color codes and formatting.
 *
 * @param text - Input text potentially containing ANSI escape codes
 * @returns Text with all ANSI escape sequences removed
 *
 * @example
 * ```ts
 * // Bold red text: "\x1b[1m\x1b[31mError:\x1b[0m"
 * stripAnsi('\x1b[1m\x1b[31mError:\x1b[0m Something wrong')
 * // Returns: "Error: Something wrong"
 * ```
 */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}
