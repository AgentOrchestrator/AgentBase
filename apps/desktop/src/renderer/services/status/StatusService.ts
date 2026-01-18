/**
 * StatusService
 *
 * Time-based implementation of IStatusService.
 * Determines idle vs running based on time since last message.
 *
 * - idle: Last message is older than threshold OR session is empty
 * - running: Recent activity (within threshold)
 */

import type {
  CodingAgentStatusInfo,
  StatusChangeListener,
} from '../../../../types/coding-agent-status';
import type { IAgentService } from '../../context/node-services/types';
import type { IStatusService } from './IStatusService';

/**
 * Configuration for status service
 */
export interface StatusServiceConfig {
  /** Minutes of inactivity before marking as idle (default: 10) */
  idleThresholdMinutes: number;
}

const DEFAULT_CONFIG: StatusServiceConfig = {
  idleThresholdMinutes: 10,
};

/**
 * Time-based status service implementation.
 * Computes idle status based on time since last message in session.
 */
export class StatusService implements IStatusService {
  private lastKnownMessageTimestamp: number | null = null;

  constructor(
    private readonly agentService: IAgentService,
    private readonly sessionId: string,
    private readonly workspacePath: string,
    private readonly config: StatusServiceConfig = DEFAULT_CONFIG
  ) {}

  getStatus(_agentId: string): CodingAgentStatusInfo | null {
    const baseStatus = this.agentService.getStatus();
    if (!baseStatus) {
      return null;
    }

    // Use cached timestamp for synchronous access
    // The timestamp is updated via refreshLastActivity()
    const isIdle = this.computeIsIdle();

    if (isIdle) {
      return {
        ...baseStatus,
        status: 'idle',
      };
    }

    return baseStatus;
  }

  onStatusChange(listener: StatusChangeListener): () => void {
    return this.agentService.onStatusChange(listener);
  }

  /**
   * Refresh the last activity timestamp from session content.
   * Call this after sending messages or periodically to update idle state.
   */
  async refreshLastActivity(): Promise<void> {
    try {
      const session = await this.agentService.getSession(this.sessionId, this.workspacePath);

      if (!session || session.messages.length === 0) {
        this.lastKnownMessageTimestamp = null;
        return;
      }

      // Find the latest message timestamp
      const latestTimestamp = session.messages.reduce((latest, msg) => {
        const msgTime = new Date(msg.timestamp).getTime();
        return msgTime > latest ? msgTime : latest;
      }, 0);

      this.lastKnownMessageTimestamp = latestTimestamp > 0 ? latestTimestamp : null;
    } catch {
      // On error, keep previous timestamp (don't mark as idle due to fetch failure)
    }
  }

  /**
   * Manually set the last activity timestamp.
   * Useful when you know a message was just sent without re-fetching session.
   */
  setLastActivity(timestamp: number): void {
    this.lastKnownMessageTimestamp = timestamp;
  }

  private computeIsIdle(): boolean {
    // No known activity → idle
    if (this.lastKnownMessageTimestamp === null) {
      return true;
    }

    const now = Date.now();
    const idleThresholdMs = this.config.idleThresholdMinutes * 60 * 1000;
    const timeSinceLastActivity = now - this.lastKnownMessageTimestamp;

    return timeSinceLastActivity > idleThresholdMs;
  }
}

/**
 * Factory function for creating StatusService instances.
 * @param agentService - The agent service to wrap
 * @param sessionId - Session ID to monitor
 * @param workspacePath - Workspace path for session queries
 * @param config - Optional configuration
 */
export function createStatusService(
  agentService: IAgentService,
  sessionId: string,
  workspacePath: string,
  config?: Partial<StatusServiceConfig>
): StatusService {
  return new StatusService(agentService, sessionId, workspacePath, {
    ...DEFAULT_CONFIG,
    ...config,
  });
}
