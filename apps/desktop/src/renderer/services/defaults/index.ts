/**
 * Default implementations for CodingAgentStatusManager dependencies.
 */

export { SimpleTitleComputer } from './SimpleTitleComputer';
export { SimpleSummaryComputer } from './SimpleSummaryComputer';
export {
  CanvasDatabasePersistence,
  InMemoryPersistence,
  type AgentStatusAPI,
} from './CanvasDatabasePersistence';
