import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

/**
 * Get the data directory path for the current platform
 * Currently using ~/.agent-orchestrator for all platforms
 */
export function getAppDataPath(): string {
  // Use ~/.agent-orchestrator for all platforms
  return path.join(os.homedir(), '.agent-orchestrator');
}


interface AuthData {
  id: number;
  access_token: string;
  refresh_token: string;
  user_id: string;
  expires_at: number;
  created_at: number;
  updated_at: number;
}

interface DeviceData {
  id: number;
  device_id: string;
  created_at: number;
}

export interface SyncStateData {
  id: number;
  last_sync_completed_at: number;  // Timestamp of last successful sync
  last_sync_started_at: number;    // Timestamp when current/last sync started
  sync_status: 'idle' | 'syncing' | 'error';
  error_message: string | null;
  sessions_synced_count: number;   // Count from last sync
  sessions_failed_count: number;   // Count from last sync
  updated_at: number;
}

export interface FailedSyncData {
  id: number;
  session_id: string;
  session_source: string;  // 'claude_code' | 'cursor-composer' | 'cursor-copilot'
  error_message: string;
  retry_count: number;
  first_failed_at: number;
  last_retry_at: number | null;
  created_at: number;
}

export class AppDatabase {
  private db: Database.Database;
  private dbPath: string;

  constructor() {
    const appDataDir = getAppDataPath();

    // Ensure the directory exists
    if (!fs.existsSync(appDataDir)) {
      fs.mkdirSync(appDataDir, { recursive: true });
    }

    this.dbPath = path.join(appDataDir, 'app.db');
    this.db = new Database(this.dbPath);

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');

    console.log('[Database] Initialized at:', this.dbPath);

    this.initializeDatabase();
    this.migrateLegacyData();
  }

  /**
   * Initialize database schema
   */
  private initializeDatabase(): void {
    // Create auth table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS auth (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        user_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );
    `);

    // Create device table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS device (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );
    `);

    // Create sync_state table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_state (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        last_sync_completed_at INTEGER NOT NULL DEFAULT 0,
        last_sync_started_at INTEGER NOT NULL DEFAULT 0,
        sync_status TEXT NOT NULL DEFAULT 'idle' CHECK(sync_status IN ('idle', 'syncing', 'error')),
        error_message TEXT,
        sessions_synced_count INTEGER NOT NULL DEFAULT 0,
        sessions_failed_count INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );
    `);

    // Create failed_syncs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS failed_syncs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        session_source TEXT NOT NULL,
        error_message TEXT NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0,
        first_failed_at INTEGER NOT NULL,
        last_retry_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        UNIQUE(session_id, session_source)
      );
    `);

    // Create index on user_id for faster lookups
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_auth_user_id ON auth(user_id);
    `);

    // Create index on session_id for failed syncs
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_failed_syncs_session_id ON failed_syncs(session_id);
    `);

    // Initialize sync_state with a single row if it doesn't exist
    const syncStateCount = this.db.prepare('SELECT COUNT(*) as count FROM sync_state').get() as { count: number };
    if (syncStateCount.count === 0) {
      this.db.prepare('INSERT INTO sync_state DEFAULT VALUES').run();
    }
  }

  /**
   * Migrate data from legacy file-based storage to SQLite database
   * This runs once when the database is first initialized
   */
  private migrateLegacyData(): void {
    const appDataPath = getAppDataPath();

    // Migrate device_id from legacy file-based storage
    const deviceIdPath = path.join(appDataPath, 'device-id');
    if (fs.existsSync(deviceIdPath)) {
      try {
        const deviceId = fs.readFileSync(deviceIdPath, 'utf-8').trim();
        const existing = this.getDeviceId();

        if (!existing && deviceId) {
          this.setDeviceId(deviceId);
          console.log('[Database] Migrated device_id from file-based storage:', deviceId);
          // Remove the old file after successful migration
          fs.unlinkSync(deviceIdPath);
          console.log('[Database] Removed legacy device-id file');
        }
      } catch (error) {
        console.error('[Database] Error migrating device_id:', error);
      }
    }

    // Migrate auth.json from legacy file-based storage
    const authPath = path.join(appDataPath, 'auth.json');
    if (fs.existsSync(authPath)) {
      try {
        const authData = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
        const existing = this.getAuth();

        if (!existing && authData.accessToken) {
          this.saveAuth({
            access_token: authData.accessToken,
            refresh_token: authData.refreshToken,
            user_id: authData.userId,
            expires_at: authData.expiresAt,
          });
          console.log('[Database] Migrated auth data from file-based storage for user:', authData.userId);
          // Remove the old file after successful migration
          fs.unlinkSync(authPath);
          console.log('[Database] Removed legacy auth.json file');
        }
      } catch (error) {
        console.error('[Database] Error migrating auth data:', error);
      }
    }
  }

  /**
   * Get the device ID
   */
  getDeviceId(): string | null {
    const stmt = this.db.prepare('SELECT device_id FROM device LIMIT 1');
    const row = stmt.get() as DeviceData | undefined;
    return row?.device_id || null;
  }

  /**
   * Set the device ID
   */
  setDeviceId(deviceId: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO device (device_id)
      VALUES (?)
      ON CONFLICT(device_id) DO NOTHING
    `);
    stmt.run(deviceId);
  }

  /**
   * Get the current auth session
   */
  getAuth(): AuthData | null {
    const stmt = this.db.prepare(`
      SELECT * FROM auth
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const row = stmt.get() as AuthData | undefined;
    return row || null;
  }

  /**
   * Save auth session (replaces any existing session)
   */
  saveAuth(auth: {
    access_token: string;
    refresh_token: string;
    user_id: string;
    expires_at: number;
  }): void {
    // Delete old auth sessions
    this.db.prepare('DELETE FROM auth').run();

    // Insert new auth session
    const stmt = this.db.prepare(`
      INSERT INTO auth (access_token, refresh_token, user_id, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const now = Date.now();
    stmt.run(
      auth.access_token,
      auth.refresh_token,
      auth.user_id,
      auth.expires_at,
      now,
      now
    );
  }

  /**
   * Update the auth tokens (for token refresh)
   */
  updateAuth(auth: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  }): void {
    const stmt = this.db.prepare(`
      UPDATE auth
      SET access_token = ?,
          refresh_token = ?,
          expires_at = ?,
          updated_at = ?
      WHERE id = (SELECT id FROM auth ORDER BY created_at DESC LIMIT 1)
    `);
    stmt.run(
      auth.access_token,
      auth.refresh_token,
      auth.expires_at,
      Date.now()
    );
  }

  /**
   * Clear all auth data (logout)
   */
  clearAuth(): void {
    this.db.prepare('DELETE FROM auth').run();
  }

  /**
   * Get the current sync state
   */
  getSyncState(): SyncStateData | null {
    const stmt = this.db.prepare('SELECT * FROM sync_state LIMIT 1');
    return stmt.get() as SyncStateData | null;
  }

  /**
   * Mark sync as started
   */
  startSync(): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      UPDATE sync_state
      SET last_sync_started_at = ?,
          sync_status = 'syncing',
          updated_at = ?
      WHERE id = 1
    `);
    stmt.run(now, now);
  }

  /**
   * Mark sync as completed successfully
   */
  completeSyncSuccess(syncedCount: number, failedCount: number): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      UPDATE sync_state
      SET last_sync_completed_at = ?,
          sync_status = 'idle',
          error_message = NULL,
          sessions_synced_count = ?,
          sessions_failed_count = ?,
          updated_at = ?
      WHERE id = 1
    `);
    stmt.run(now, syncedCount, failedCount, now);
  }

  /**
   * Mark sync as failed with error
   */
  completeSyncError(errorMessage: string): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      UPDATE sync_state
      SET sync_status = 'error',
          error_message = ?,
          updated_at = ?
      WHERE id = 1
    `);
    stmt.run(errorMessage, now);
  }

  /**
   * Add a failed sync entry
   */
  addFailedSync(sessionId: string, sessionSource: string, errorMessage: string): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO failed_syncs (session_id, session_source, error_message, first_failed_at, retry_count)
      VALUES (?, ?, ?, ?, 0)
      ON CONFLICT(session_id, session_source) DO UPDATE SET
        error_message = excluded.error_message,
        retry_count = retry_count + 1,
        last_retry_at = ?
    `);
    stmt.run(sessionId, sessionSource, errorMessage, now, now);
  }

  /**
   * Remove a failed sync entry (after successful retry)
   */
  removeFailedSync(sessionId: string, sessionSource: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM failed_syncs
      WHERE session_id = ? AND session_source = ?
    `);
    stmt.run(sessionId, sessionSource);
  }

  /**
   * Get all failed syncs
   */
  getFailedSyncs(): FailedSyncData[] {
    const stmt = this.db.prepare('SELECT * FROM failed_syncs ORDER BY first_failed_at DESC');
    return stmt.all() as FailedSyncData[];
  }

  /**
   * Get failed syncs for retry (with exponential backoff)
   * Only returns items that haven't been retried recently
   */
  getFailedSyncsForRetry(maxRetries: number = 5): FailedSyncData[] {
    const now = Date.now();
    const stmt = this.db.prepare(`
      SELECT * FROM failed_syncs
      WHERE retry_count < ?
        AND (
          last_retry_at IS NULL
          OR last_retry_at < ?
        )
      ORDER BY first_failed_at ASC
      LIMIT 50
    `);
    // Exponential backoff: wait at least 5 minutes before retrying
    const backoffMs = 5 * 60 * 1000; // 5 minutes
    return stmt.all(maxRetries, now - backoffMs) as FailedSyncData[];
  }

  /**
   * Clear old failed syncs (older than 7 days)
   */
  clearOldFailedSyncs(): void {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const stmt = this.db.prepare(`
      DELETE FROM failed_syncs
      WHERE first_failed_at < ?
    `);
    stmt.run(sevenDaysAgo);
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get the database file path (for debugging)
   */
  getDbPath(): string {
    return this.dbPath;
  }
}

// Singleton instance
let dbInstance: AppDatabase | null = null;

/**
 * Get the singleton database instance
 */
export function getDatabase(): AppDatabase {
  if (!dbInstance) {
    dbInstance = new AppDatabase();
  }
  return dbInstance;
}

/**
 * Close the database connection (for cleanup)
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
