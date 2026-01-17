import type {
  AssistantMessageEntry,
  AssistantMessageGroup,
  ConversationEntry,
  MessageGroup,
} from '../types/conversation';

/**
 * Parse JSONL conversation file into structured message groups
 */
export function parseConversationFile(jsonlContent: string): ConversationEntry[] {
  const lines = jsonlContent.trim().split('\n');
  const entries: ConversationEntry[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as ConversationEntry;
      entries.push(entry);
    } catch (error) {
      console.error('Failed to parse line:', error, line);
    }
  }

  return entries;
}

/**
 * Group conversation entries into user and assistant message groups
 * Assistant messages are grouped together until the next user message
 * User messages with only tool_result content are treated as part of the assistant flow
 */
export function groupConversationMessages(entries: ConversationEntry[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let currentAssistantGroup: AssistantMessageEntry[] | null = null;

  for (const entry of entries) {
    // Skip system entries
    if (entry.type === 'queue-operation' || entry.type === 'file-history-snapshot') {
      continue;
    }

    if (entry.type === 'user') {
      // Check if this is a tool_result user message (part of assistant flow)
      // Handle both array and non-array content
      const content = entry.message.content;
      const contentArray = Array.isArray(content) ? content : [content];
      const isToolResult = contentArray.some(
        (c) => c && typeof c === 'object' && 'type' in c && c.type === 'tool_result'
      );

      // If it's a tool result, skip it (it's part of the assistant's tool use flow)
      if (isToolResult) {
        continue;
      }

      // If we have a pending assistant group, finalize it
      if (currentAssistantGroup && currentAssistantGroup.length > 0) {
        const firstEntry = currentAssistantGroup[0];
        groups.push({
          type: 'assistant',
          uuid: firstEntry.uuid,
          timestamp: firstEntry.timestamp,
          entries: [...currentAssistantGroup],
          parentUuid: firstEntry.parentUuid,
          model: firstEntry.message.model,
        });
        currentAssistantGroup = null;
      }

      // Extract text content from user message
      const textParts: string[] = [];
      for (const contentItem of contentArray as Array<string | { type: string; text?: string }>) {
        // Handle string content directly
        if (typeof contentItem === 'string') {
          const text = contentItem.replace(/<ide_opened_file>.*?<\/ide_opened_file>/g, '').trim();
          if (text) {
            textParts.push(text);
          }
        } else if (contentItem && typeof contentItem === 'object' && 'type' in contentItem) {
          if (contentItem.type === 'text') {
            // Remove IDE event markers for cleaner display
            let text = contentItem.text || '';
            text = text.replace(/<ide_opened_file>.*?<\/ide_opened_file>/g, '').trim();
            if (text) {
              textParts.push(text);
            }
          }
        }
      }

      const userText = textParts.join('\n\n').trim();
      if (userText) {
        groups.push({
          type: 'user',
          uuid: entry.uuid,
          timestamp: entry.timestamp,
          text: userText,
          parentUuid: entry.parentUuid,
          entry,
        });
      }
    } else if (entry.type === 'assistant') {
      // Add to current assistant group or start a new one
      if (!currentAssistantGroup) {
        currentAssistantGroup = [];
      }
      currentAssistantGroup.push(entry);
    }
  }

  // Finalize any remaining assistant group
  if (currentAssistantGroup && currentAssistantGroup.length > 0) {
    const firstEntry = currentAssistantGroup[0];
    groups.push({
      type: 'assistant',
      uuid: firstEntry.uuid,
      timestamp: firstEntry.timestamp,
      entries: currentAssistantGroup,
      parentUuid: firstEntry.parentUuid,
      model: firstEntry.message.model,
    });
  }

  // Debug: Log grouping results
  console.log('[ConversationParser] Grouped messages:', {
    totalGroups: groups.length,
    userGroups: groups.filter((g) => g.type === 'user').length,
    assistantGroups: groups.filter((g) => g.type === 'assistant').length,
    assistantGroupSizes: groups
      .filter((g) => g.type === 'assistant')
      .map((g) => (g as AssistantMessageGroup).entries.length),
  });

  return groups;
}

/**
 * Build a map of UUID to message group for quick lookup
 */
export function buildUuidMap(groups: MessageGroup[]): Map<string, MessageGroup> {
  const map = new Map<string, MessageGroup>();
  for (const group of groups) {
    map.set(group.uuid, group);
  }
  return map;
}
