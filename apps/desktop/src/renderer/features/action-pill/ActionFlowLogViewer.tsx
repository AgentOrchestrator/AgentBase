/**
 * ActionFlowLogViewer Component
 *
 * Displays a real-time log of action flow events, showing step-by-step
 * what happens with agentIds throughout the action lifecycle.
 */

import { useEffect, useRef } from 'react';
import { useActionFlowLogger } from './store/actionFlowLogger';
import './ActionFlowLogViewer.css';

export function ActionFlowLogViewer() {
  const logs = useActionFlowLogger((state) => state.logs);
  const clearLogs = useActionFlowLogger((state) => state.clearLogs);
  const addLog = useActionFlowLogger((state) => state.addLog);
  const containerRef = useRef<HTMLDivElement>(null);

  // Test log on mount
  useEffect(() => {
    console.log('[ActionFlowLogViewer] Component mounted, adding test log');
    console.log('[ActionFlowLogViewer] Logger state:', useActionFlowLogger.getState());
    addLog('Log Viewer Started', 'Action Flow Log Viewer is now active and ready to receive logs', 'success');
    // Force a re-render by checking logs after a short delay
    setTimeout(() => {
      const currentLogs = useActionFlowLogger.getState().logs;
      console.log('[ActionFlowLogViewer] After adding log, current logs count:', currentLogs.length);
      console.log('[ActionFlowLogViewer] Logs:', currentLogs);
    }, 100);
  }, [addLog]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  const getLevelColor = (level: string): string => {
    switch (level) {
      case 'error':
        return '#ff4444';
      case 'warning':
        return '#ffaa00';
      case 'success':
        return '#44ff44';
      default:
        return '#8888ff';
    }
  };

  return (
    <div className="action-flow-log-viewer">
      <div className="action-flow-log-header">
        <div className="action-flow-log-title">Action Flow Log</div>
        <button className="action-flow-log-clear" onClick={clearLogs} title="Clear logs">
          Clear
        </button>
      </div>
      <div className="action-flow-log-content" ref={containerRef}>
        {logs.length === 0 ? (
          <div className="action-flow-log-empty">No logs yet. Create an agent and trigger an action.</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="action-flow-log-entry" data-level={log.level}>
              <div className="action-flow-log-meta">
                <span className="action-flow-log-time">{formatTimestamp(log.timestamp)}</span>
                <span
                  className="action-flow-log-level"
                  style={{ color: getLevelColor(log.level) }}
                >
                  {log.level.toUpperCase()}
                </span>
                <span className="action-flow-log-step">{log.step}</span>
              </div>
              <div className="action-flow-log-message">{log.message}</div>
              {(log.agentId || log.nodeId || log.actionId) && (
                <div className="action-flow-log-ids">
                  {log.agentId && (
                    <span className="action-flow-log-id">
                      <strong>agentId:</strong> {log.agentId}
                    </span>
                  )}
                  {log.nodeId && (
                    <span className="action-flow-log-id">
                      <strong>nodeId:</strong> {log.nodeId}
                    </span>
                  )}
                  {log.actionId && (
                    <span className="action-flow-log-id">
                      <strong>actionId:</strong> {log.actionId}
                    </span>
                  )}
                </div>
              )}
              {log.details && Object.keys(log.details).length > 0 && (
                <div className="action-flow-log-details">
                  <pre>{JSON.stringify(log.details, null, 2)}</pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
