import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import type {
  CodingAgentType,
  SessionFileChangeEvent,
  SessionFileChangeType,
} from '@agent-orchestrator/shared';

/**
 * Configuration for SessionFileWatcher
 */
export interface SessionFileWatcherConfig {
  /** Base debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
  /** Maximum debounce delay for rapid writes (default: 1000) */
  maxDebounceMs?: number;
}

/**
 * Internal entry for tracking a file watcher
 */
interface WatcherEntry {
  watcher: fs.FSWatcher;
  agentType: CodingAgentType;
  basePath: string;
}

/**
 * Internal entry for tracking pending (debounced) changes
 */
interface PendingChange {
  type: SessionFileChangeType;
  filePath: string;
  timeout: NodeJS.Timeout;
  firstSeen: number;
}

/**
 * SessionFileWatcher monitors session JSONL files for changes.
 * Emits 'change' events that can be forwarded via IPC to the renderer.
 *
 * Design decisions:
 * - Uses Node.js built-in fs.watch (no external dependencies)
 * - Debounces rapid writes during streaming (300ms base, 1000ms max)
 * - Vendor-agnostic: works with any file-based agent storage
 */
export class SessionFileWatcher extends EventEmitter {
  private readonly config: Required<SessionFileWatcherConfig>;
  private readonly watchers = new Map<string, WatcherEntry>();
  private readonly pendingChanges = new Map<string, PendingChange>();
  private isInitialized = false;

  constructor(config: SessionFileWatcherConfig = {}) {
    super();
    this.config = {
      debounceMs: config.debounceMs ?? 300,
      maxDebounceMs: config.maxDebounceMs ?? 1000,
    };
  }

  /**
   * Initialize the watcher service
   */
  initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
    console.log('[SessionFileWatcher] Initialized');
  }

  /**
   * Start watching session files for a specific agent type
   * @param agentType The agent type to watch
   * @param dataPaths Array of paths to watch (from IChatHistoryProvider.getDataPaths())
   */
  watchAgent(agentType: CodingAgentType, dataPaths: string[]): void {
    for (const basePath of dataPaths) {
      if (!fs.existsSync(basePath)) {
        console.log('[SessionFileWatcher] Path does not exist, skipping:', basePath);
        continue;
      }

      const watchKey = `${agentType}:${basePath}`;
      if (this.watchers.has(watchKey)) {
        console.log('[SessionFileWatcher] Already watching:', watchKey);
        continue;
      }

      try {
        // Watch recursively for nested project directories
        const watcher = fs.watch(
          basePath,
          { recursive: true },
          (eventType, filename) => {
            if (!filename || !filename.endsWith('.jsonl')) return;

            const fullPath = path.join(basePath, filename);
            this.handleFileChange(eventType, fullPath, agentType, basePath);
          }
        );

        watcher.on('error', (error) => {
          console.error('[SessionFileWatcher] Watcher error:', { watchKey, error });
        });

        this.watchers.set(watchKey, { watcher, agentType, basePath });
        console.log('[SessionFileWatcher] Started watching:', watchKey);
      } catch (error) {
        console.error('[SessionFileWatcher] Failed to start watcher:', {
          basePath,
          error,
        });
      }
    }
  }

  /**
   * Stop watching session files for a specific agent type
   * @param agentType The agent type to stop watching
   */
  unwatchAgent(agentType: CodingAgentType): void {
    for (const [key, entry] of this.watchers) {
      if (entry.agentType === agentType) {
        entry.watcher.close();
        this.watchers.delete(key);
        console.log('[SessionFileWatcher] Stopped watching:', key);
      }
    }
  }

  /**
   * Check if currently watching any paths
   */
  isWatching(): boolean {
    return this.watchers.size > 0;
  }

  /**
   * Get current watch status
   */
  getWatchStatus(): {
    isActive: boolean;
    watchedAgents: CodingAgentType[];
    watchedPaths: string[];
  } {
    const watchedAgents = new Set<CodingAgentType>();
    const watchedPaths: string[] = [];

    for (const entry of this.watchers.values()) {
      watchedAgents.add(entry.agentType);
      watchedPaths.push(entry.basePath);
    }

    return {
      isActive: this.watchers.size > 0,
      watchedAgents: Array.from(watchedAgents),
      watchedPaths,
    };
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    // Clear all pending debounces
    for (const pending of this.pendingChanges.values()) {
      clearTimeout(pending.timeout);
    }
    this.pendingChanges.clear();

    // Close all watchers
    for (const entry of this.watchers.values()) {
      entry.watcher.close();
    }
    this.watchers.clear();
    this.isInitialized = false;

    console.log('[SessionFileWatcher] Disposed');
  }

  /**
   * Handle a file system change event
   */
  private handleFileChange(
    eventType: 'rename' | 'change',
    filePath: string,
    agentType: CodingAgentType,
    basePath: string
  ): void {
    const sessionId = path.basename(filePath, '.jsonl');
    const changeKey = `${agentType}:${sessionId}`;

    // Determine change type
    const fileExists = fs.existsSync(filePath);
    let changeType: SessionFileChangeType;

    if (eventType === 'rename') {
      changeType = fileExists ? 'created' : 'deleted';
    } else {
      changeType = 'updated';
    }

    // Cancel any pending debounce for this file
    const pending = this.pendingChanges.get(changeKey);
    if (pending) {
      clearTimeout(pending.timeout);
      // Check if we've hit max debounce time
      const elapsed = Date.now() - pending.firstSeen;
      if (elapsed >= this.config.maxDebounceMs) {
        // Force emit now
        this.emitChange(changeType, filePath, agentType, basePath);
        this.pendingChanges.delete(changeKey);
        return;
      }
    }

    // Set up debounced emit
    const timeout = setTimeout(() => {
      this.emitChange(changeType, filePath, agentType, basePath);
      this.pendingChanges.delete(changeKey);
    }, this.config.debounceMs);

    this.pendingChanges.set(changeKey, {
      type: changeType,
      filePath,
      timeout,
      firstSeen: pending?.firstSeen ?? Date.now(),
    });
  }

  /**
   * Emit a change event
   */
  private emitChange(
    type: SessionFileChangeType,
    filePath: string,
    agentType: CodingAgentType,
    basePath: string
  ): void {
    const sessionId = path.basename(filePath, '.jsonl');
    const relativePath = path.relative(basePath, filePath);
    const projectDir = path.dirname(relativePath);
    const projectPath = this.decodeProjectPath(projectDir);

    const event: SessionFileChangeEvent = {
      type,
      sessionId,
      filePath,
      projectPath,
      timestamp: Date.now(),
      agentType,
    };

    this.emit('change', event);

    console.log('[SessionFileWatcher] File change detected:', {
      type,
      sessionId,
      projectPath,
      agentType,
    });
  }

  /**
   * Decode Claude Code's encoded project path
   * Claude Code encodes paths: /foo/bar -> -foo-bar
   */
  private decodeProjectPath(encodedPath: string): string {
    // Handle empty path (file directly in projects dir)
    if (!encodedPath || encodedPath === '.') {
      return '';
    }
    // Claude Code encodes: /Users/foo/bar -> -Users-foo-bar
    return encodedPath.replace(/^-/, '/').replace(/-/g, '/');
  }
}
