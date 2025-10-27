"""Configuration settings for the memory service."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Supabase
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: str

    # LLM APIs
    anthropic_api_key: str
    openai_api_key: str | None = None

    # Mem0
    mem0_api_key: str | None = None
    mem0_mode: str = "self-hosted"  # 'self-hosted' or 'platform'

    # Service
    service_port: int = 8000
    service_host: str = "0.0.0.0"
    log_level: str = "INFO"


# Global settings instance
settings = Settings()
