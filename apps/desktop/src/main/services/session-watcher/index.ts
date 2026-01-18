/**
 * Session File Watcher Service
 *
 * Monitors session JSONL files for changes and emits IPC events
 * to enable real-time synchronization between terminal and chat views.
 */

export {
  disposeSessionWatcher,
  registerSessionWatcherIpcHandlers,
} from './ipc';
export type { SessionFileWatcherConfig } from './SessionFileWatcher';
export { SessionFileWatcher } from './SessionFileWatcher';
