/**
 * User Action Request Service
 *
 * Detects when terminal-based REPL CLI sessions require user permission,
 * emits Action Requests to the UI, and writes user responses back to the PTY.
 *
 * This service specifically handles terminal-based REPL sessions where users
 * run `claude` CLI directly in the embedded terminal - the SDK hooks don't apply there.
 *
 * Usage:
 * ```typescript
 * import { getTerminalActionDetectorManager } from './services/user-action-request';
 *
 * // In terminal-create handler:
 * const detectorManager = getTerminalActionDetectorManager();
 * detectorManager.attach(terminalId, 'claude_code', (data) => ptyProcess.write(data));
 *
 * // In ptyProcess.onData handler:
 * ptyProcess.onData((data: string) => {
 *   // ... existing buffering logic ...
 *   detectorManager.processOutput(terminalId, data);
 * });
 *
 * // In terminal-destroy handler:
 * detectorManager.detach(terminalId);
 * ```
 */

// Implementations (for advanced use cases)
export { TerminalActionDetector } from './implementations';
// Interfaces
export type {
  ITerminalActionDetector,
  ITerminalPatternProvider,
  TerminalPatterns,
} from './interfaces';
// Patterns (for testing and extension)
export { ClaudeCodePatternProvider, stripAnsi } from './patterns';
// Manager - main entry point
export {
  getTerminalActionDetectorManager,
  TerminalActionDetectorManager,
} from './TerminalActionDetectorManager';
// Types
export type {
  TerminalActionResponse,
  TerminalDetectedAction,
  TerminalResponseMap,
} from './types';
export { DetectorState } from './types';
