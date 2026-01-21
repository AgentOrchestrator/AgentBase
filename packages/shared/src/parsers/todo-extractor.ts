/**
 * Todo extraction utilities for Claude Code JSONL files
 *
 * Extracts the latest TodoWrite tool_use block from session content
 * and converts it to TodoListProgress format for UI rendering.
 */

import type { TodoItem, TodoListProgress } from '../types/agent-node.js';
import { parseJsonlLineString } from './claude-code-jsonl.js';
import type { ClaudeCodeJsonlLine, ExtractedTodoList, RawTodoItem } from './types.js';

/**
 * Extract the latest todo list from an array of JSONL lines.
 *
 * Scans from the END of the array since we want the most recent TodoWrite call.
 * Each TodoWrite call is cumulative - it replaces the previous todo state.
 *
 * @param lines - Raw JSONL line strings (in chronological order)
 * @returns The extracted todo list or null if no TodoWrite found
 */
export function extractLatestTodoList(lines: string[]): ExtractedTodoList | null {
  // Scan from end to find most recent TodoWrite
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line || !line.trim()) continue;

    const data = parseJsonlLineString(line);
    if (!data) continue;

    const todos = extractTodosFromJsonlLine(data);
    if (todos && todos.length > 0) {
      return {
        items: todos,
        timestamp: normalizeTimestamp(data.timestamp),
      };
    }
  }
  return null;
}

/**
 * Extract todos from a single JSONL line.
 *
 * Looks for assistant messages containing a tool_use block with name "TodoWrite".
 *
 * @param data - Parsed JSONL line object
 * @returns Array of raw todo items or null if no TodoWrite found
 */
export function extractTodosFromJsonlLine(data: ClaudeCodeJsonlLine): RawTodoItem[] | null {
  // Only assistant messages can contain tool_use blocks
  if (data.type !== 'assistant' || !data.message?.content) {
    return null;
  }

  const content = data.message.content;
  if (!Array.isArray(content)) {
    return null;
  }

  // Find TodoWrite tool_use block
  for (const block of content) {
    if (
      typeof block === 'object' &&
      block !== null &&
      (block as Record<string, unknown>).type === 'tool_use' &&
      (block as Record<string, unknown>).name === 'TodoWrite'
    ) {
      const input = (block as Record<string, unknown>).input;
      if (
        input &&
        typeof input === 'object' &&
        Array.isArray((input as Record<string, unknown>).todos)
      ) {
        return parseTodoItems((input as { todos: unknown[] }).todos);
      }
    }
  }

  return null;
}

/**
 * Parse raw todo items from TodoWrite input.
 *
 * @param todos - Raw todos array from TodoWrite input
 * @returns Parsed RawTodoItem array
 */
function parseTodoItems(todos: unknown[]): RawTodoItem[] {
  const items: RawTodoItem[] = [];

  for (const todo of todos) {
    if (!todo || typeof todo !== 'object') continue;

    const obj = todo as Record<string, unknown>;
    const content = typeof obj.content === 'string' ? obj.content : '';
    const status = isValidStatus(obj.status) ? obj.status : 'pending';
    const activeForm = typeof obj.activeForm === 'string' ? obj.activeForm : undefined;

    if (content) {
      items.push({ content, status, activeForm });
    }
  }

  return items;
}

/**
 * Type guard for valid todo status values
 */
function isValidStatus(value: unknown): value is 'pending' | 'in_progress' | 'completed' {
  return value === 'pending' || value === 'in_progress' || value === 'completed';
}

/**
 * Normalize timestamp to ISO string format
 */
function normalizeTimestamp(ts: string | number | undefined): string | undefined {
  if (!ts) return;
  if (typeof ts === 'number') {
    return new Date(ts).toISOString();
  }
  return ts;
}

/**
 * Convert extracted raw todos to TodoListProgress for UI rendering.
 *
 * Transforms the raw status-based format to the UI's completed boolean format.
 * Status mapping:
 * - 'completed' -> completed: true
 * - 'in_progress' -> completed: false
 * - 'pending' -> completed: false
 *
 * @param extracted - The extracted todo list from JSONL
 * @returns TodoListProgress object ready for AgentOverviewView
 */
export function toTodoListProgress(extracted: ExtractedTodoList): TodoListProgress {
  return {
    type: 'todoList',
    items: extracted.items.map(
      (item, index): TodoItem => ({
        id: `todo-${index}`,
        content: item.content,
        completed: item.status === 'completed',
        activeForm: item.activeForm,
      })
    ),
  };
}
