import * as crypto from 'node:crypto';
import { RingBuffer } from './ring-buffer';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogSource = 'console' | 'ipc' | 'state' | 'mcp' | 'injected';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  source: LogSource;
  message: string;
  meta?: Record<string, unknown>;
}

export interface LogReadOptions {
  level?: LogLevel;
  source?: LogSource;
  since?: number;
  limit?: number;
  pattern?: string;
}

type LogSubscriber = (entry: LogEntry) => void;

/**
 * Centralized log server for the instrumentation system.
 * Stores logs in a fixed-size ring buffer and supports subscriptions.
 */
export class LogServer {
  private buffer: RingBuffer<LogEntry>;
  private subscribers: Set<LogSubscriber> = new Set();

  constructor(capacity = 1000) {
    this.buffer = new RingBuffer<LogEntry>(capacity);
  }

  /**
   * Inject a log entry (used by MCP tools for test injection)
   */
  inject(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      level,
      source: 'injected',
      message,
      meta,
    };

    this.addEntry(entry);
    return entry.id;
  }

  /**
   * Add a log entry from any source
   */
  log(level: LogLevel, source: LogSource, message: string, meta?: Record<string, unknown>): string {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      level,
      source,
      message,
      meta,
    };

    this.addEntry(entry);
    return entry.id;
  }

  private addEntry(entry: LogEntry): void {
    this.buffer.push(entry);
    this.notifySubscribers(entry);
  }

  private notifySubscribers(entry: LogEntry): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(entry);
      } catch (error) {
        console.error('[LogServer] Subscriber error:', error);
      }
    }
  }

  /**
   * Read logs with optional filters
   */
  read(options?: LogReadOptions): LogEntry[] {
    let entries = this.buffer.toArray();

    if (options?.level) {
      const levelPriority: Record<LogLevel, number> = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3,
      };
      const minPriority = levelPriority[options.level];
      entries = entries.filter((e) => levelPriority[e.level] >= minPriority);
    }

    if (options?.source) {
      entries = entries.filter((e) => e.source === options.source);
    }

    if (options?.since) {
      entries = entries.filter((e) => e.timestamp >= options.since!);
    }

    if (options?.pattern) {
      try {
        const regex = new RegExp(options.pattern, 'i');
        entries = entries.filter((e) => regex.test(e.message));
      } catch {
        // Invalid regex pattern - skip filtering rather than throw
      }
    }

    if (options?.limit && options.limit > 0) {
      entries = entries.slice(-options.limit);
    }

    return entries;
  }

  /**
   * Subscribe to real-time log entries
   */
  subscribe(callback: LogSubscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.buffer.clear();
  }

  /**
   * Get buffer statistics
   */
  getStats(): { size: number; capacity: number } {
    return {
      size: this.buffer.size,
      capacity: this.buffer.maxSize,
    };
  }
}

// Global singleton instance
let logServerInstance: LogServer | null = null;

export function getLogServer(): LogServer {
  if (!logServerInstance) {
    logServerInstance = new LogServer();
  }
  return logServerInstance;
}

export function disposeLogServer(): void {
  logServerInstance = null;
}
