/**
 * Daemon Loaders - pre-configured LoaderRegistry with all available loaders
 *
 * Usage:
 * ```typescript
 * import { loaderRegistry } from './loaders/index.js';
 *
 * // Read from all available loaders
 * const histories = await loaderRegistry.readAllHistories({ lookbackDays: 7 });
 *
 * // Get status
 * const status = await loaderRegistry.getStatus();
 * console.log(`${status.available}/${status.registered} loaders available`);
 * ```
 */

import { LoaderRegistry } from '@agent-orchestrator/shared';
import { claudeCodeLoader } from '../claude-code-reader.js';
import { cursorLoader, CursorLoader } from '../cursor-reader.js';
import { vscodeLoader } from '../vscode-reader.js';
import { codexLoader } from '../codex-reader.js';
import { factoryLoader } from '../factory-reader.js';
import type { IRepositoryFactory } from '../interfaces/repositories.js';

/**
 * Create a LoaderRegistry with all daemon loaders pre-registered
 */
export function createDaemonLoaderRegistry(options?: {
  repositoryFactory?: IRepositoryFactory;
  accessToken?: string;
  refreshToken?: string;
}): LoaderRegistry {
  const registry = new LoaderRegistry();

  // Register file-based loaders
  registry.register(claudeCodeLoader);
  registry.register(codexLoader);
  registry.register(factoryLoader);

  // Register database-based loaders
  registry.register(vscodeLoader);

  // Register Cursor with optional authentication for heuristic timestamps
  if (options?.repositoryFactory && options?.accessToken && options?.refreshToken) {
    const authenticatedCursorLoader = new CursorLoader({
      repositoryFactory: options.repositoryFactory,
      accessToken: options.accessToken,
      refreshToken: options.refreshToken,
    });
    registry.register(authenticatedCursorLoader);
  } else {
    registry.register(cursorLoader);
  }

  return registry;
}

/**
 * Default registry with all loaders (unauthenticated)
 * For authenticated Cursor loader, use createDaemonLoaderRegistry() with options
 */
export const loaderRegistry = createDaemonLoaderRegistry();

// Re-export individual loaders for direct access
export { claudeCodeLoader } from '../claude-code-reader.js';
export { cursorLoader, CursorLoader } from '../cursor-reader.js';
export { vscodeLoader, VSCodeLoader } from '../vscode-reader.js';
export { codexLoader, CodexLoader } from '../codex-reader.js';
export { factoryLoader, FactoryLoader } from '../factory-reader.js';

// Re-export registry class for custom registries
export { LoaderRegistry, createLoaderRegistry } from '@agent-orchestrator/shared';
