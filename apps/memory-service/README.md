# Memory Service

Python microservice for processing chat histories and extracting coding rules using [mem0](https://mem0.ai).

## Features

- **Mem0 Integration**: Efficiently process long conversation histories (90% token reduction)
- **Rule Extraction**: Use Claude to extract actionable coding rules from conversations
- **FastAPI Server**: HTTP API for integration with Next.js web app
- **Supabase Integration**: Store extracted rules with approval workflow

## Setup

### Prerequisites

- Python 3.11+
- pip or uv package manager

### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Or using uv (faster)
uv pip install -r requirements.txt

# Copy environment variables
cp .env.example .env
# Edit .env with your credentials
```

### Configuration

Required environment variables (see [.env.example](.env.example)):

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access
- `ANTHROPIC_API_KEY` - Claude API key for rule extraction
- `MEM0_MODE` - Either `self-hosted` or `platform`
- `MEM0_API_KEY` - Only required if using Mem0 Platform

## Usage

### Start the Server

```bash
# Development mode (with auto-reload)
python -m src.main

# Or using uvicorn directly
uvicorn src.main:app --reload --port 8000
```

### API Endpoints

#### Health Check
```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "mem0_mode": "self-hosted"
}
```

#### Extract Rules
```bash
POST /extract-rules
Content-Type: application/json

{
  "chat_history_ids": ["uuid1", "uuid2"],
  "user_id": "user-uuid",
  "prompt_id": "optional-custom-prompt-id"
}
```

Response:
```json
{
  "success": true,
  "rules_count": 3,
  "rules": [
    {
      "rule_text": "Always create migration files before applying database changes",
      "category": "best-practices",
      "confidence": 0.95,
      "evidence": "User said: 'NEVER apply migrations directly...'"
    }
  ],
  "chat_histories_processed": 2
}
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Next.js Web App                  │
│           (User triggers rule extraction)           │
└────────────────────┬────────────────────────────────┘
                     │ HTTP POST /extract-rules
                     ▼
┌─────────────────────────────────────────────────────┐
│              Memory Service (FastAPI)               │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │       SharedMemoryProcessor                   │ │
│  │  - Add conversations to mem0                  │ │
│  │  - Search for similar patterns                │ │
│  │  - Extract rules with Claude                  │ │
│  └───────────────────────────────────────────────┘ │
└────────────┬────────────────────────────┬───────────┘
             │                            │
             ▼                            ▼
    ┌────────────────┐          ┌──────────────────┐
    │     mem0       │          │    Supabase DB   │
    │  (Memory Layer)│          │  (Store Rules)   │
    └────────────────┘          └──────────────────┘
```

## Development

### Run Tests
```bash
pytest
```

### Code Formatting
```bash
# Format with black
black src/

# Lint with ruff
ruff check src/
```

### Type Checking
```bash
mypy src/
```

## Deployment

The memory service can be deployed as:
1. **Docker Container**: See Dockerfile (TODO)
2. **Standalone Service**: Run with systemd or supervisor
3. **Cloud Function**: Deploy to AWS Lambda, Google Cloud Functions, etc.

## Performance

Using mem0 provides significant benefits:
- **90% fewer tokens** compared to sending full conversation history
- **91% faster** response times
- **26% better accuracy** than OpenAI memory

## Troubleshooting

### Mem0 Connection Issues
- Ensure `MEM0_MODE` is set correctly
- For platform mode, verify `MEM0_API_KEY` is valid
- For self-hosted, check local storage permissions

### Database Connection Errors
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Ensure network access to Supabase
- Check RLS policies allow service role access

## License

Same as parent project (Agent Orchestrator)
