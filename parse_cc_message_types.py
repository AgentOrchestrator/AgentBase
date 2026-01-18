from pathlib import Path
import json


"""
ContentBlock =
Accepts one of the following:
== TextBlock {}
citations: Array<TextCitation> | null
text: string
type: "text"
Accepts one of the following:
"text"
== ThinkingBlock {}
signature: string
thinking: string
type: "thinking"
Accepts one of the following:
"thinking"
== RedactedThinkingBlock {}
data: string
type: "redacted_thinking"
Accepts one of the following:
"redacted_thinking"
== ToolUseBlock {}
id: string
input: Record<string, unknown>
name: string
type: "tool_use"
Accepts one of the following:
"tool_use"
== ServerToolUseBlock {}
id: string
input: Record<string, unknown>
name: "web_search"
Accepts one of the following:
"web_search"
type: "server_tool_use"
Accepts one of the following:
"server_tool_use"
== WebSearchToolResultBlock {}
content: WebSearchToolResultBlockContent
Accepts one of the following:
WebSearchToolResultError {}
error_code:
Accepts one of the following:
"invalid_tool_input"
"unavailable"
"max_uses_exceeded"
"too_many_requests"
"query_too_long"
type: "web_search_tool_result_error"
Accepts one of the following:
"web_search_tool_result_error"
== Array<WebSearchResultBlock {} >
encrypted_content: string
page_age: string | null
title: string
type: "web_search_result"
Accepts one of the following:
"web_search_result"
url: string
tool_use_id: string
type: "web_search_tool_result"
Accepts one of the following:
"web_search_tool_result"
"""

messages_types = []
with open(Path('/Users/duonghaidang/.claude/projects/-Users-duonghaidang-Developer-agent-orchestrator/ea7755c5-ad92-444e-8023-ca03ca715ab8.jsonl'), 'r') as f:
    for line in f.readlines():
        data = json.loads(line)
        if 'message' in data and 'content' in data['message']:
            for item in data['message']['content']:
                if 'type' in item:
                    messages_types.append(item['type'])

print(set(messages_types))


