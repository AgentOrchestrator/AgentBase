# API Key Management with Database Fallback

## Overview

The memory service now supports **dual-source API key resolution**:
1. **Primary**: Environment variables (`.env` file)
2. **Fallback**: Supabase `public.llm_api_keys` table

This allows the service to run even when API keys are not in the environment, by fetching them from the database instead.

---

## How It Works

### API Key Resolution Order

For each provider (Anthropic, OpenAI, mem0):

1. **Check environment variable** first
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY`
   - `MEM0_API_KEY`

2. **Query Supabase database** if environment variable is empty
   ```sql
   SELECT api_key
   FROM llm_api_keys
   WHERE provider = 'anthropic'
     AND is_active = true
   ORDER BY is_default DESC, created_at DESC
   LIMIT 1;
   ```

3. **Use the first found key**, cache it for performance

---

## Files Modified

### 1. **New File: `src/api_keys.py`**

Contains the `APIKeyManager` class that handles:
- Checking environment variables
- Querying Supabase database
- Caching keys for performance
- Logging key sources

**Key Methods:**
- `get_api_key(provider, env_var_name)` - Generic key getter
- `get_anthropic_key()` - Get Anthropic API key
- `get_openai_key()` - Get OpenAI API key
- `get_mem0_key()` - Get mem0 API key
- `clear_cache()` - Clear cached keys

### 2. **Modified: `src/config.py`**

**Changed:**
```python
# Before
anthropic_api_key: str  # Required

# After
anthropic_api_key: Optional[str] = None  # Optional, falls back to DB
```

All LLM API keys are now **optional** in the environment, allowing the service to start without them if they exist in the database.

### 3. **Modified: `src/memory_processor.py`**

**Added:**
```python
from .api_keys import APIKeyManager

# In __init__:
self.api_key_manager = APIKeyManager(
    supabase_url=settings.supabase_url,
    supabase_service_key=settings.supabase_service_role_key
)

# Get keys with fallback
anthropic_key = settings.anthropic_api_key or self.api_key_manager.get_anthropic_key()
openai_key = settings.openai_api_key or self.api_key_manager.get_openai_key()
mem0_key = settings.mem0_api_key or self.api_key_manager.get_mem0_key()
```

---

## Database Schema

The `public.llm_api_keys` table has the following structure:

```sql
CREATE TABLE llm_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES auth.users(id),
    provider TEXT NOT NULL,  -- 'anthropic', 'openai', 'mem0', etc.
    api_key TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Provider Names:**
- `anthropic` - For Claude API
- `openai` - For OpenAI API (used by mem0 embeddings)
- `mem0` - For mem0 platform mode

---

## Usage Examples

### Scenario 1: Environment Variables Only

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx
```

**Result:** Service uses environment variables, no database queries.

---

### Scenario 2: Database Fallback

```bash
# .env
# No API keys defined
```

**Database:**
```sql
INSERT INTO llm_api_keys (account_id, provider, api_key, is_active, is_default)
VALUES
  ('user-uuid', 'anthropic', 'sk-ant-xxx', true, true),
  ('user-uuid', 'openai', 'sk-xxx', true, true);
```

**Result:** Service fetches keys from database on startup.

---

### Scenario 3: Mixed (Preferred)

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-xxx
# No OpenAI key
```

**Database:**
```sql
INSERT INTO llm_api_keys (account_id, provider, api_key, is_active, is_default)
VALUES ('user-uuid', 'openai', 'sk-xxx', true, true);
```

**Result:**
- Anthropic key from environment ✅
- OpenAI key from database ✅

---

## Logging

The service logs where each API key is loaded from:

```
INFO: Using anthropic API key from environment variable
INFO: Checking Supabase for openai API key
INFO: Found openai API key in database
```

---

## Error Handling

### Missing Required Keys

If Anthropic API key is not found in either source:

```python
ValueError: ANTHROPIC_API_KEY required for rule extraction (check .env or database)
```

### Optional Keys (OpenAI)

If OpenAI key is missing:
- mem0 self-hosted mode will be disabled
- Service continues running (limited functionality)
- Warning logged

---

## Performance

### Caching

API keys are cached after first retrieval:
- Environment variables: No database query needed
- Database keys: Cached after first fetch
- Cache persists for service lifetime

### Cache Invalidation

To refresh keys without restarting:
```python
memory_processor.api_key_manager.clear_cache()
```

---

## Security Considerations

1. **Database Access**: Uses service role key to query `llm_api_keys`
2. **Encryption**: API keys should be encrypted at rest in database (not implemented yet)
3. **RLS Policies**: Ensure `llm_api_keys` has proper row-level security
4. **Logging**: API keys are never logged (only provider names)

---

## Testing

### Test Database Fallback

1. Remove API keys from `.env`
2. Add keys to database:
```sql
INSERT INTO llm_api_keys (account_id, provider, api_key, is_active, is_default)
VALUES
  (auth.uid(), 'anthropic', 'your-key-here', true, true);
```
3. Restart service
4. Check logs for "Found anthropic API key in database"

### Test Environment Priority

1. Set key in both `.env` and database (different values)
2. Restart service
3. Environment variable should be used

---

## Migration Guide

### Existing Deployments

If you have API keys in `.env`:
- **No changes needed** - Service continues using environment variables
- Keys in environment always take priority over database

### New Deployments

Option 1: Use environment variables (traditional)
```bash
ANTHROPIC_API_KEY=sk-ant-xxx
```

Option 2: Use database (easier for teams)
```sql
INSERT INTO llm_api_keys ...
```

Option 3: Use both (recommended for flexibility)

---

## Benefits

1. **Easier Key Management**: Update keys in database without redeploying
2. **Team Sharing**: Multiple users can use same keys (with proper permissions)
3. **Key Rotation**: Easier to rotate keys without touching deployment configs
4. **Multi-tenancy**: Different users can have different keys
5. **Backward Compatible**: Existing environment-based deployments continue working

---

## Future Enhancements

1. **Key Encryption**: Encrypt API keys at rest in database
2. **Key Rotation**: Automatic key rotation support
3. **Usage Tracking**: Track which key was used for billing
4. **Per-User Keys**: Support user-specific API keys
5. **Key Validation**: Validate keys before caching

---

## Troubleshooting

### Service won't start

**Error:** `ANTHROPIC_API_KEY required`

**Solution:**
1. Check `.env` file
2. Check database: `SELECT * FROM llm_api_keys WHERE provider = 'anthropic' AND is_active = true;`
3. Add key to either location

### Keys not updating

**Problem:** Changed key in database but service still uses old one

**Solution:**
- Restart service (cache persists for lifetime)
- Or call `clear_cache()` if available

### Database connection error

**Error:** Cannot connect to Supabase

**Solution:**
- Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
- Check network connectivity
- Service will fall back to environment variables if database fails

---

**Summary:** The memory service now flexibly loads API keys from environment variables first, then falls back to the Supabase database. This provides better key management for teams while maintaining backward compatibility.
