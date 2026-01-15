/**
 * Session File Watcher Service
 *
 * Monitors session JSONL files for changes and emits IPC events
 * to enable real-time synchronization between terminal and chat views.
 */

export { SessionFileWatcher } from './SessionFileWatcher';
export type { SessionFileWatcherConfig } from './SessionFileWatcher';
export {
  registerSessionWatcherIpcHandlers,
  disposeSessionWatcher,
} from './ipc';
