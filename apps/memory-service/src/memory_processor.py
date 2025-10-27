"""
SharedMemoryProcessor: Extract coding rules from chat histories using mem0.

This module uses mem0 to efficiently process long conversation histories and
extract actionable coding rules that can be maintained in rule files.
"""

import json
import structlog
from typing import Any
from mem0 import Memory, MemoryClient
from anthropic import Anthropic

from .config import settings
from .api_keys import APIKeyManager

logger = structlog.get_logger(__name__)


class SharedMemoryProcessor:
    """
    Process chat histories using mem0 for intelligent memory management.

    mem0 provides:
    - 90% token reduction for long conversations
    - Automatic summarization and compression
    - Multi-level memory (user, session, agent)
    - Fast retrieval with vector search
    """

    def __init__(self):
        """Initialize mem0 and LLM clients with fallback to database for API keys."""
        # Initialize API key manager
        self.api_key_manager = APIKeyManager(
            supabase_url=settings.supabase_url,
            supabase_service_key=settings.supabase_service_role_key
        )

        # Get API keys with fallback to database
        anthropic_key = settings.anthropic_api_key or self.api_key_manager.get_anthropic_key()
        openai_key = settings.openai_api_key or self.api_key_manager.get_openai_key()
        mem0_key = settings.mem0_api_key or self.api_key_manager.get_mem0_key()

        # Initialize mem0 based on mode
        if settings.mem0_mode == "platform":
            logger.info("Initializing mem0 in platform mode")
            if not mem0_key:
                raise ValueError("MEM0_API_KEY required for platform mode (check .env or database)")
            self.memory = MemoryClient(api_key=mem0_key)
        else:
            logger.info("Initializing mem0 in self-hosted mode")
            # Self-hosted mode - set OpenAI key in environment if available
            if openai_key:
                import os
                os.environ['OPENAI_API_KEY'] = openai_key
                logger.info("Using OpenAI embeddings for mem0")
                self.memory = Memory()
            else:
                logger.warning("No OpenAI API key configured - skipping mem0 initialization")
                logger.warning("Memory service will run but extraction features will be limited")
                self.memory = None  # Will skip mem0 operations

        # Initialize Claude for rule extraction
        if not anthropic_key:
            raise ValueError("ANTHROPIC_API_KEY required for rule extraction (check .env or database)")

        self.anthropic = Anthropic(api_key=anthropic_key)

        logger.info("SharedMemoryProcessor initialized", mode=settings.mem0_mode)

    async def process_chat_history(
        self,
        chat_history_id: str,
        messages: list[dict[str, Any]],
        user_id: str,
    ) -> dict[str, Any]:
        """
        Process a single chat history and extract rules.

        Args:
            chat_history_id: UUID of the chat_history record
            messages: Array of message objects [{role, content, ...}]
            user_id: User ID for memory association

        Returns:
            Dictionary with extracted rules and metadata
        """
        logger.info(
            "Processing chat history",
            chat_history_id=chat_history_id,
            message_count=len(messages),
        )

        # 1. Add conversation to mem0 (it handles compression automatically)
        # mem0 will extract and store key insights from the conversation
        similar_memories = {"results": []}

        if self.memory is not None:
            # Transform messages to mem0 format (role + content)
            mem0_messages = self._transform_messages_for_mem0(messages)


            add_result = self.memory.add(mem0_messages, user_id=user_id)

            # 2. Search for similar patterns across other conversations
            # This provides context from previous sessions
            search_query = "coding conventions, repeated corrections, workflow preferences"

            similar_memories = self.memory.search(
                query=search_query,
                user_id=user_id,
                limit=10,
            )

            logger.info(
                "Retrieved similar memories",
                count=len(similar_memories.get("results", [])),
            )

        else:
            logger.warning("mem0 not initialized - skipping memory operations")

        # 3. Extract rules using LLM with context from mem0
        rules = await self._extract_rules_with_context(
            messages=messages, similar_memories=similar_memories
        )

        logger.info("Extracted rules", count=len(rules))

        return {
            "chat_history_id": chat_history_id,
            "rules": rules,
            "similar_memory_count": len(similar_memories.get("results", [])),
        }

    def get_all_memories(self, user_id: str) -> list[dict[str, Any]]:
        """
        Get all memories for a user (for debugging).

        Args:
            user_id: User ID to fetch memories for

        Returns:
            List of all memories for the user
        """
        if self.memory is None:
            logger.warning("mem0 not initialized")
            return []

        try:
            # Use mem0's get_all method
            all_memories = self.memory.get_all(user_id=user_id)
            logger.info("Retrieved all memories for user", user_id=user_id, count=len(all_memories))
            return all_memories
        except Exception as e:
            logger.error("Failed to retrieve memories", error=str(e), user_id=user_id)
            return []

    async def batch_process_histories(
        self,
        chat_history_ids: list[str],
        user_id: str,
        messages_by_id: dict[str, list[dict[str, Any]]],
    ) -> list[dict[str, Any]]:
        """
        Process multiple chat histories in batch.

        Args:
            chat_history_ids: List of chat_history UUIDs
            user_id: User ID for memory association
            messages_by_id: Mapping of chat_history_id to messages array

        Returns:
            List of extraction results
        """
        logger.info("Batch processing histories", count=len(chat_history_ids))

        # Debug: Check existing memories before processing
        if self.memory is not None:
            existing_memories = self.get_all_memories(user_id)
            logger.debug(
                "Existing memories before batch",
                user_id=user_id,
                memory_count=len(existing_memories)
            )

        results = []
        for chat_id in chat_history_ids:
            messages = messages_by_id.get(chat_id, [])
            if not messages:
                logger.warning("No messages found for chat history", chat_id=chat_id)
                continue

            result = await self.process_chat_history(chat_id, messages, user_id)
            results.append(result)

        logger.info("Batch processing complete", processed=len(results))
        return results

    async def _extract_rules_with_context(
        self,
        messages: list[dict[str, Any]],
        similar_memories: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """
        Use Claude to extract structured rules from conversation + mem0 context.

        Args:
            messages: Raw conversation messages
            similar_memories: Context from mem0 search results

        Returns:
            List of extracted rules with metadata
        """
        # Format conversation for LLM
        conversation_text = self._format_conversation(messages)

        # Format mem0 memories for context
        mem0_context = self._format_memories(similar_memories)

        # Get extraction prompt from database (will be passed in)
        # For now, use a hardcoded prompt
        prompt_template = self._get_default_prompt()

        # Replace placeholders
        full_prompt = prompt_template.replace("{conversation_text}", conversation_text).replace(
            "{mem0_context}", mem0_context
        )

        logger.debug("Sending extraction request to Claude", prompt_length=len(full_prompt))

        # Call Claude
        response = self.anthropic.messages.create(
            model="claude-haiku-4-5",
            max_tokens=4096,
            temperature=0.2,  # Lower temperature for more consistent extraction
            messages=[{"role": "user", "content": full_prompt}],
        )

        # Parse JSON response
        content = response.content[0].text if response.content else "[]"

        # Strip markdown code blocks if present
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]  # Remove ```json
        elif content.startswith("```"):
            content = content[3:]  # Remove ```

        if content.endswith("```"):
            content = content[:-3]  # Remove trailing ```

        content = content.strip()

        try:
            rules = json.loads(content)
            if not isinstance(rules, list):
                logger.error("Invalid response format, expected array", response=content)
                return []
            return rules
        except json.JSONDecodeError as e:
            logger.error("Failed to parse LLM response as JSON", error=str(e), response=content[:500])
            return []

    def _transform_messages_for_mem0(self, messages: list[dict[str, Any]]) -> list[dict[str, str]]:
        """
        Transform our message format to mem0's expected format.

        Our format: {role, display, timestamp, ...}
        mem0 format: {role, content}
        """
        transformed = []
        for msg in messages:
            role = msg.get("role", "user")
            # Use 'content' if present, otherwise fall back to 'display'
            content = msg.get("content") or msg.get("display", "")

            if content:  # Only include messages with actual content
                transformed.append({
                    "role": role,
                    "content": content
                })

        return transformed

    def _format_conversation(self, messages: list[dict[str, Any]]) -> str:
        """Format messages into readable conversation text."""
        lines = []
        for msg in messages:
            role = msg.get("role", "unknown")
            content = msg.get("content") or msg.get("display", "")
            lines.append(f"{role.upper()}: {content}")
        return "\n\n".join(lines)

    def _format_memories(self, similar_memories: dict[str, Any]) -> str:
        """Format mem0 memories into context string."""
        if not similar_memories or "results" not in similar_memories:
            return "No similar memories found."

        lines = []
        for idx, memory in enumerate(similar_memories["results"], 1):
            memory_text = memory.get("memory", "")
            lines.append(f"{idx}. {memory_text}")

        return "\n".join(lines) if lines else "No similar memories found."

    def _get_default_prompt(self) -> str:
        """
        Get default extraction prompt.

        In production, this will be fetched from the extraction_prompts table.
        """
        return """Analyze the following conversation between a developer and an AI coding assistant.

Extract actionable coding rules that should be remembered for future sessions. Focus on:

1. **Repeated Corrections:** Patterns where the developer corrects the AI multiple times (e.g., "use X instead of Y", "always do Z before W")
2. **Workflow Preferences:** Steps the developer explicitly wants followed (e.g., "always create migration files first", "test locally before pushing")
3. **Technical Constraints:** Architecture decisions, technology choices, or technical limitations (e.g., "never use 'use client' with async", "must use pnpm not npm")
4. **Style Preferences:** Code formatting, naming conventions, file organization (e.g., "prefer functional components", "use kebab-case for file names")

For each rule you extract, provide:
- **rule_text**: Clear, actionable statement starting with a verb (e.g., "Use pnpm for all package management")
- **category**: One of: git-workflow, code-style, architecture, best-practices, testing, documentation
- **confidence**: Score from 0-1 based on:
  - 0.9-1.0: Explicitly stated by user multiple times
  - 0.7-0.9: Clearly implied or stated once emphatically
  - 0.5-0.7: Inferred from context
  - Below 0.5: Don't include
- **evidence**: Brief quote from conversation showing where this rule came from

Return JSON array format:
[
  {{
    "rule_text": "Always create migration files before applying database changes",
    "category": "best-practices",
    "confidence": 0.95,
    "evidence": "User said: 'NEVER apply migrations directly without creating local migration files first'"
  }}
]

Conversation:
{conversation_text}

Context from similar sessions (via mem0):
{mem0_context}

Extract only high-quality, actionable rules. When in doubt, err on the side of caution.
Return ONLY valid JSON array, no markdown formatting."""
