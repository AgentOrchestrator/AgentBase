/**
 * Automation Module
 *
 * Expose component bindings for agent automation.
 * Like console.log for debugging, but bidirectional.
 *
 * @example
 * // In a React component
 * import { useExpose } from '@agent-orchestrator/shared/automation';
 *
 * function ChatInput({ onSend }) {
 *   const [value, setValue] = useState('');
 *   useExpose('chat-input', { value, setValue, send: () => onSend(value) });
 *   return <input value={value} onChange={e => setValue(e.target.value)} />;
 * }
 *
 * @example
 * // For DOM-backed bindings (third-party components)
 * import { useExpose, domBinding } from '@agent-orchestrator/shared/automation';
 *
 * function ThirdPartyWrapper() {
 *   const ref = useRef<HTMLInputElement>(null);
 *   useExpose('third-party-input', { value: domBinding(ref) });
 *   return <ThirdPartyInput ref={ref} />;
 * }
 */

export type { DomAccessor } from './dom.js';
// DOM helpers
export {
  domBinding,
  domBlur,
  domClick,
  domFocus,
  domQuery,
  domScrollTo,
  domScrollToBottom,
  domScrollToTop,
} from './dom.js';
// Registry
export { ExposeRegistry, getExposeRegistry, resetExposeRegistry } from './registry.js';
// Core types
export type {
  AutomationRequest,
  AutomationResponse,
  AutomationTransport,
  Bindings,
  BindingValue,
  CallResult,
  ExposeEntry,
  ExposeInfo,
  GetResult,
  SetResult,
} from './types.js';
// React hook
export { expose, useExpose, useExposeId } from './useExpose.js';
