import type {
  IChatHistoryProvider,
  ICodingAgentProvider,
  ISessionForkable,
  ISessionManager,
  ISessionResumable,
  ISessionValidator,
} from '../interfaces';
import type { AgentCapabilities } from '../types';

/**
 * Type guard to check if an agent supports session resumption
 *
 * Usage:
 * ```typescript
 * if (isSessionResumable(agent)) {
 *   await agent.continueSession(sessionId, prompt);
 * }
 * ```
 */
export function isSessionResumable(
  agent: ICodingAgentProvider
): agent is ICodingAgentProvider & ISessionResumable {
  return agent.getCapabilities().canResumeSession;
}

/**
 * Type guard to check if an agent supports session forking
 */
export function isSessionForkable(
  agent: ICodingAgentProvider
): agent is ICodingAgentProvider & ISessionForkable {
  return agent.getCapabilities().canForkSession;
}

/**
 * Type guard to check if an agent supports session management
 */
export function hasSessionManager(
  agent: ICodingAgentProvider
): agent is ICodingAgentProvider & ISessionManager {
  return agent.getCapabilities().canListSessions;
}

/**
 * Type guard to check if an agent supports streaming
 */
export function supportsStreaming(agent: ICodingAgentProvider): boolean {
  return agent.getCapabilities().supportsStreaming;
}

/**
 * Type guard to check if an agent provides chat history access
 */
export function isChatHistoryProvider(
  agent: ICodingAgentProvider
): agent is ICodingAgentProvider & IChatHistoryProvider {
  const maybeProvider = agent as unknown as IChatHistoryProvider;
  return (
    'listSessionSummaries' in agent &&
    typeof maybeProvider.listSessionSummaries === 'function' &&
    'getFilteredSession' in agent &&
    typeof maybeProvider.getFilteredSession === 'function'
  );
}

/**
 * Type guard to check if an agent supports session validation
 */
export function isSessionValidator(
  agent: ICodingAgentProvider
): agent is ICodingAgentProvider & ISessionValidator {
  const maybeValidator = agent as unknown as ISessionValidator;
  return 'checkSessionActive' in agent && typeof maybeValidator.checkSessionActive === 'function';
}

/**
 * Get capabilities that the agent is missing
 *
 * Useful for informing users what features aren't available.
 */
export function getMissingCapabilities(
  agent: ICodingAgentProvider,
  required: Array<keyof AgentCapabilities>
): Array<keyof AgentCapabilities> {
  const capabilities = agent.getCapabilities();
  return required.filter((cap) => !capabilities[cap]);
}
