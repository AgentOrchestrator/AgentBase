"""
API Key management with fallback to Supabase llm_api_keys table.

This module provides functions to fetch API keys from environment variables
first, and if not found, falls back to querying the Supabase database.
"""

import os
import structlog
from typing import Optional
from supabase import create_client, Client as SupabaseClient

logger = structlog.get_logger(__name__)


class APIKeyManager:
    """Manages API keys with environment variable and database fallbacks."""

    def __init__(self, supabase_url: str, supabase_service_key: str):
        """
        Initialize the API key manager.

        Args:
            supabase_url: Supabase project URL
            supabase_service_key: Service role key for database access
        """
        self._supabase: Optional[SupabaseClient] = None
        self._supabase_url = supabase_url
        self._supabase_service_key = supabase_service_key
        self._cache: dict[str, str] = {}

    @property
    def supabase(self) -> SupabaseClient:
        """Lazy initialize Supabase client."""
        if self._supabase is None:
            self._supabase = create_client(self._supabase_url, self._supabase_service_key)
        return self._supabase

    def get_api_key(self, provider: str, env_var_name: Optional[str] = None) -> Optional[str]:
        """
        Get API key for a provider, checking environment first, then database.

        Args:
            provider: Provider name (e.g., 'anthropic', 'openai', 'mem0')
            env_var_name: Optional environment variable name to check first

        Returns:
            API key string or None if not found
        """
        # Check cache first
        cache_key = f"{provider}:{env_var_name}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        # 1. Check environment variable if provided
        if env_var_name:
            env_value = os.getenv(env_var_name)
            if env_value:
                logger.info(f"Using {provider} API key from environment variable", provider=provider)
                self._cache[cache_key] = env_value
                return env_value

        # 2. Fall back to database
        try:
            logger.info(f"Checking Supabase for {provider} API key", provider=provider)
            response = self.supabase.table("llm_api_keys").select("api_key").eq("provider", provider).eq(
                "is_active", True
            ).order("is_default", desc=True).order("created_at", desc=True).limit(1).execute()

            if response.data and len(response.data) > 0:
                api_key = response.data[0]["api_key"]
                logger.info(f"Found {provider} API key in database", provider=provider)
                self._cache[cache_key] = api_key
                return api_key
            else:
                logger.warning(f"No {provider} API key found in database", provider=provider)

        except Exception as e:
            logger.error(f"Error fetching {provider} API key from database", error=str(e), provider=provider)

        # 3. Not found
        logger.warning(f"No {provider} API key found in environment or database", provider=provider)
        return None

    def get_anthropic_key(self) -> Optional[str]:
        """Get Anthropic API key (required for rule extraction)."""
        return self.get_api_key("anthropic", "ANTHROPIC_API_KEY")

    def get_openai_key(self) -> Optional[str]:
        """Get OpenAI API key (optional, used for mem0 embeddings)."""
        return self.get_api_key("openai", "OPENAI_API_KEY")

    def get_mem0_key(self) -> Optional[str]:
        """Get mem0 API key (optional, only needed for platform mode)."""
        return self.get_api_key("mem0", "MEM0_API_KEY")

    def clear_cache(self):
        """Clear the API key cache (useful for testing or key rotation)."""
        self._cache.clear()
        logger.info("API key cache cleared")
