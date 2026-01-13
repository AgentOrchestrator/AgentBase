"""
FastAPI server for the memory processing service.

This service provides HTTP endpoints for extracting rules from chat histories
using mem0 for intelligent memory management.
"""

import structlog
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from supabase import create_client, Client as SupabaseClient

from .config import settings
from .memory_processor import SharedMemoryProcessor

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer(),
    ]
)
logger = structlog.get_logger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="Agent Orchestrator Memory Service",
    description="Extract and manage coding rules from chat histories using mem0",
    version="0.1.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure based on environment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances
supabase: SupabaseClient = create_client(settings.supabase_url, settings.supabase_service_role_key)
memory_processor = SharedMemoryProcessor()


# ============================================================================
# Request/Response Models
# ============================================================================


class ExtractRulesRequest(BaseModel):
    """Request to extract rules from chat histories."""

    chat_history_ids: List[str] = Field(..., description="List of chat_history UUIDs to process")
    user_id: str = Field(..., description="User ID for memory association")
    prompt_id: Optional[str] = Field(None, description="Optional custom extraction prompt ID")


class ExtractedRule(BaseModel):
    """A single extracted rule."""

    rule_text: str
    category: str
    confidence: float
    evidence: str


class ExtractRulesResponse(BaseModel):
    """Response from rule extraction."""

    success: bool
    rules_count: int
    rules: List[ExtractedRule]
    chat_histories_processed: int


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    version: str
    mem0_mode: str


# ============================================================================
# API Endpoints
# ============================================================================


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy", version="0.1.0", mem0_mode=settings.mem0_mode
    )


@app.post("/extract-rules", response_model=ExtractRulesResponse)
async def extract_rules(request: ExtractRulesRequest, background_tasks: BackgroundTasks):
    """
    Extract coding rules from chat histories.

    This endpoint:
    1. Fetches chat histories from Supabase
    2. Processes them through mem0 for context extraction
    3. Uses Claude to extract structured rules
    4. Stores rules in extracted_rules and rule_approvals tables

    The extraction runs synchronously but rule storage can be backgrounded.
    """
    logger.info(
        "Rule extraction requested",
        chat_history_count=len(request.chat_history_ids),
        user_id=request.user_id,
    )

    try:
        # 1. Fetch chat histories from Supabase
        messages_by_id = await _fetch_chat_histories(request.chat_history_ids)

        if not messages_by_id:
            raise HTTPException(
                status_code=404, detail="No chat histories found with provided IDs"
            )

        # 2. Process through mem0 and extract rules
        results = await memory_processor.batch_process_histories(
            chat_history_ids=request.chat_history_ids,
            user_id=request.user_id,
            messages_by_id=messages_by_id,
        )

        # 3. Aggregate all extracted rules
        all_rules = []
        for result in results:
            all_rules.extend(result.get("rules", []))

        # 4. Store rules in database (can be backgrounded)
        background_tasks.add_task(
            _store_extracted_rules,
            rules=all_rules,
            user_id=request.user_id,
            source_session_ids=request.chat_history_ids,
        )

        logger.info(
            "Rule extraction completed",
            total_rules=len(all_rules),
            histories_processed=len(results),
        )

        return ExtractRulesResponse(
            success=True,
            rules_count=len(all_rules),
            rules=[ExtractedRule(**rule) for rule in all_rules],
            chat_histories_processed=len(results),
        )

    except Exception as e:
        logger.error("Rule extraction failed", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


# ============================================================================
# Helper Functions
# ============================================================================


async def _fetch_chat_histories(chat_history_ids: List[str]) -> Dict[str, List[Dict[str, Any]]]:
    """Fetch chat histories from Supabase."""
    messages_by_id = {}

    for chat_id in chat_history_ids:
        response = supabase.table("chat_histories").select("messages").eq("id", chat_id).execute()

        if response.data and len(response.data) > 0:
            messages = response.data[0].get("messages", [])
            messages_by_id[chat_id] = messages

    logger.info("Fetched chat histories", count=len(messages_by_id))
    return messages_by_id


async def _store_extracted_rules(
    rules: List[Dict[str, Any]], user_id: str, source_session_ids: List[str]
):
    """Store extracted rules in the database."""
    logger.info("Storing extracted rules", count=len(rules))

    for rule in rules:
        try:
            # Insert into extracted_rules table
            rule_data = {
                "rule_text": rule["rule_text"],
                "rule_category": rule["category"],
                "confidence_score": rule["confidence"],
                "source_session_ids": source_session_ids,
                "extracted_by": user_id,
                # mem0_memory_id will be added later
            }

            rule_response = supabase.table("extracted_rules").insert(rule_data).execute()

            if rule_response.data and len(rule_response.data) > 0:
                rule_id = rule_response.data[0]["id"]

                # Create approval record
                approval_data = {
                    "rule_id": rule_id,
                    "status": "pending",
                    "required_approvals": 1,
                    "current_approvals": 0,
                }

                supabase.table("rule_approvals").insert(approval_data).execute()

                logger.debug("Stored rule", rule_id=rule_id, category=rule["category"])

        except Exception as e:
            logger.error("Failed to store rule", error=str(e), rule=rule)

    logger.info("Rule storage completed")


# ============================================================================
# Application Startup
# ============================================================================


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    logger.info(
        "Memory service starting",
        port=settings.service_port,
        mem0_mode=settings.mem0_mode,
    )


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("Memory service shutting down")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host=settings.service_host,
        port=settings.service_port,
        reload=True,
        log_level=settings.log_level.lower(),
    )
