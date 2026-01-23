/**
 * Debug utilities for testing ActionPill permission requests and clarifying questions
 *
 * These utilities add actions directly to the agentActionStore, simulating
 * what happens when permission:request events flow through the system.
 *
 * Event flow in production:
 *   Main (emitAgentEvent) -> IPC -> Renderer (codingAgentAPI.onAgentEvent)
 *   -> ClaudeCodeAdapter -> useAgentState -> agentActionStore -> ActionPill
 *
 * For debugging, we inject directly into agentActionStore since we can't
 * easily simulate the IPC layer from the renderer.
 *
 * Usage in browser console:
 *   window.debugActions.firePermissionRequest()
 *   window.debugActions.fireClarifyingQuestion()
 *   window.debugActions.fireMultipleActions()
 *   window.debugActions.clearAllActions()
 *   window.debugActions.getActions()
 */

function generateId(): string {
  return `debug-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Fire a permission request (tool approval) event
 * Adds a tool_approval action directly to the ActionPill store
 */
export function firePermissionRequest(options?: {
  toolName?: string;
  command?: string;
  filePath?: string;
  workingDirectory?: string;
  workspacePath?: string;
  gitBranch?: string;
  reason?: string;
  agentId?: string;
  sessionId?: string;
  toolUseId?: string;
}): void {
  import('../features/action-pill').then(({ useActionPillStore }) => {
    const action = {
      id: generateId(),
      type: 'tool_approval' as const,
      toolName: options?.toolName ?? 'Bash',
      command: options?.command ?? 'rm -rf /tmp/test-directory',
      filePath: options?.filePath,
      workingDirectory: options?.workingDirectory ?? '/Users/test/project',
      reason: options?.reason ?? 'The agent wants to execute this shell command',
      agentId: options?.agentId ?? 'debug-agent-1',
      sessionId: options?.sessionId ?? 'debug-session-1',
      workspacePath: options?.workspacePath ?? '/Users/test/project',
      gitBranch: options?.gitBranch ?? 'main',
      toolUseId: options?.toolUseId ?? `tool-${generateId()}`,
      createdAt: new Date().toISOString(),
    };

    useActionPillStore.getState().addAction(action);
    console.log('[ActionPill Debug] Fired permission request (tool_approval):', action);
  });
}

/**
 * Fire an ask question (clarifying question) event
 * Note: This would normally come from a different event type
 * For now, we fire it directly to the store since AskQuestion may use different flow
 */
export function fireClarifyingQuestion(options?: {
  questions?: Array<{
    header?: string;
    question: string;
    options?: Array<{ label: string; description?: string }>;
    multiSelect?: boolean;
  }>;
  agentId?: string;
  sessionId?: string;
  workspacePath?: string;
  gitBranch?: string;
  toolUseId?: string;
}): void {
  // Import the store directly for clarifying questions
  // as they may not go through the same IPC channel
  import('../features/action-pill').then(({ useActionPillStore }) => {
    const action = {
      id: generateId(),
      type: 'clarifying_question' as const,
      questions: options?.questions ?? [
        {
          header: 'Authentication',
          question: 'Which authentication method should I use?',
          options: [
            { label: 'JWT', description: 'JSON Web Tokens for stateless auth' },
            { label: 'Session', description: 'Server-side session cookies' },
            { label: 'OAuth', description: 'Third-party OAuth provider' },
          ],
        },
      ],
      agentId: options?.agentId ?? 'debug-agent-1',
      sessionId: options?.sessionId ?? 'debug-session-1',
      workspacePath: options?.workspacePath ?? '/Users/test/project',
      gitBranch: options?.gitBranch ?? 'main',
      toolUseId: options?.toolUseId ?? `tool-${generateId()}`,
      createdAt: new Date().toISOString(),
    };

    useActionPillStore.getState().addAction(action);
    console.log('[ActionPill Debug] Fired clarifying question:', action);
  });
}

/**
 * Fire multiple test actions at once
 */
export function fireMultipleActions(): void {
  // Permission request 1
  firePermissionRequest({
    toolName: 'Edit',
    filePath: '/src/components/App.tsx',
    reason: 'Modifying the main application component',
    agentId: 'agent-alpha',
  });

  // Permission request 2
  setTimeout(() => {
    firePermissionRequest({
      toolName: 'Write',
      filePath: '/src/utils/helpers.ts',
      reason: 'Creating new utility file',
      agentId: 'agent-beta',
    });
  }, 100);

  // Clarifying question 1
  setTimeout(() => {
    fireClarifyingQuestion({
      questions: [
        {
          header: 'Database',
          question: 'Which database should I configure?',
          options: [
            { label: 'PostgreSQL', description: 'Relational database' },
            { label: 'MongoDB', description: 'Document database' },
            { label: 'SQLite', description: 'Embedded database' },
          ],
        },
      ],
      agentId: 'agent-alpha',
    });
  }, 200);

  // Clarifying question 2 with multiple questions
  setTimeout(() => {
    fireClarifyingQuestion({
      questions: [
        {
          header: 'Framework',
          question: 'Which UI framework would you prefer?',
          options: [
            { label: 'React', description: 'Component-based library' },
            { label: 'Vue', description: 'Progressive framework' },
          ],
        },
        {
          header: 'Styling',
          question: 'How should I style the components?',
          options: [
            { label: 'CSS Modules', description: 'Scoped CSS' },
            { label: 'Tailwind', description: 'Utility-first CSS' },
            { label: 'Styled Components', description: 'CSS-in-JS' },
          ],
        },
      ],
      agentId: 'agent-gamma',
    });
  }, 300);

  console.log('[ActionPill Debug] Firing 4 test actions...');
}

/**
 * Clear all pending actions
 */
export function clearAllActions(): void {
  import('../features/action-pill').then(({ useActionPillStore }) => {
    const state = useActionPillStore.getState();
    const actions = state.actions;
    for (const action of actions) {
      state.removeAction(action.id);
    }
    console.log('[ActionPill Debug] Cleared all actions');
  });
}

/**
 * Get current pending actions
 */
export function getActions(): void {
  import('../features/action-pill').then(({ useActionPillStore }) => {
    const actions = useActionPillStore.getState().actions;
    console.log('[ActionPill Debug] Current actions:', actions);
    console.table(
      actions.map((a) => ({
        id: a.id,
        type: a.type,
        agentId: a.agentId,
        createdAt: a.createdAt,
        ...(a.type === 'tool_approval' ? { toolName: (a as any).toolName } : {}),
      }))
    );
  });
}

// Export debug functions
const debugActions = {
  firePermissionRequest,
  fireClarifyingQuestion,
  fireMultipleActions,
  clearAllActions,
  getActions,
};

// Attach to window object for console access
if (typeof window !== 'undefined') {
  (window as unknown as { debugActions: typeof debugActions }).debugActions = debugActions;
}

export default debugActions;
