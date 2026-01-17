/**
 * Default implementations for CodingAgentStatusManager dependencies.
 */

export {
  type AgentStatusAPI,
  CanvasDatabasePersistence,
  InMemoryPersistence,
} from './CanvasDatabasePersistence';
export { SimpleSummaryComputer } from './SimpleSummaryComputer';
export { SimpleTitleComputer } from './SimpleTitleComputer';
