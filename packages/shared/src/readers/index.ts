// Project Aggregator

// Claude Code Reader
export {
  ClaudeCodeLoader,
  claudeCodeLoader,
  extractProjectsFromHistories as extractClaudeCodeProjects,
  parseSessionFile as parseClaudeCodeSessionFile,
  readClaudeCodeHistories,
} from './claude-code-reader.js';
// Codex Reader
export {
  CodexLoader,
  calculateDateFoldersToScan,
  codexLoader,
  extractProjectsFromHistories as extractCodexProjects,
  extractUserRequest,
  parseSessionFile as parseCodexSessionFile,
  readCodexHistories,
} from './codex-reader.js';
export type { CursorConversation, CursorMessage } from './cursor-reader.js';
// Cursor Reader
export {
  CursorLoader,
  convertToStandardFormat as convertCursorToStandardFormat,
  cursorLoader,
  detectStorageFormat,
  extractProjectsFromHistories as extractCursorProjects,
  parseComposerData,
  parseCopilotData,
  readCursorHistories,
} from './cursor-reader.js';
// Factory Reader
export {
  extractProjectPathFromSystemReminder,
  extractProjectsFromHistories as extractFactoryProjects,
  FactoryLoader,
  factoryLoader,
  parseSessionFile as parseFactorySessionFile,
  readFactoryHistories,
} from './factory-reader.js';
export type { UnifiedProjectInfo } from './project-aggregator.js';
export { mergeProjects } from './project-aggregator.js';
export type { VSCodeConversation, VSCodeMessage } from './vscode-reader.js';
// VSCode Reader
export {
  convertToStandardFormat as convertVSCodeToStandardFormat,
  extractProjectsFromHistories as extractVSCodeProjects,
  parseChatSessionFile,
  parseWorkspaceInfo,
  readVSCodeHistories,
  VSCodeLoader,
  vscodeLoader,
} from './vscode-reader.js';
