#!/usr/bin/env python3
"""
Ephemeral script to test mem0 add and retrieval functionality.
This helps debug why mem0 is returning empty results.
"""

import os
import sys
from mem0 import Memory

# Add src directory to path to import config and api_keys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from config import settings
from api_keys import APIKeyManager

def test_mem0():
    print("=" * 60)
    print("Testing mem0 Memory System")
    print("=" * 60)

    # Get API keys from database
    print("\n1. Loading API keys from database...")
    api_key_manager = APIKeyManager(
        supabase_url=settings.supabase_url,
        supabase_service_key=settings.supabase_service_role_key
    )

    openai_key = settings.openai_api_key or api_key_manager.get_openai_key()
    if not openai_key:
        print("❌ OPENAI_API_KEY not found in environment or database")
        print("Please add it to the database using the daemon setup")
        sys.exit(1)

    print(f"✓ OpenAI API key found: {openai_key[:10]}...")

    # Set in environment for mem0
    os.environ['OPENAI_API_KEY'] = openai_key

    # Initialize mem0
    print("\n2. Initializing mem0 Memory...")
    try:
        memory = Memory()
        print("✓ mem0 initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize mem0: {e}")
        sys.exit(1)

    # Test user ID
    test_user_id = "test-user-123"

    # Test 1: Add a simple conversation
    print(f"\n2. Adding simple test conversation (user_id={test_user_id})...")
    simple_messages = [
        {"role": "user", "content": "Hello, I prefer using Python for backend services"},
        {"role": "assistant", "content": "I'll remember that you prefer Python for backend development."}
    ]

    try:
        result1 = memory.add(simple_messages, user_id=test_user_id)
        print(f"✓ Add result: {result1}")
        print(f"  - Memories created: {len(result1.get('results', []))}")
        if result1.get('results'):
            for idx, mem in enumerate(result1['results']):
                print(f"    [{idx+1}] {mem}")
    except Exception as e:
        print(f"❌ Failed to add messages: {e}")
        return

    # Test 2: Add a more detailed conversation
    print(f"\n3. Adding detailed conversation with coding preferences...")
    detailed_messages = [
        {"role": "user", "content": "I always want to use pnpm instead of npm for package management"},
        {"role": "assistant", "content": "Understood, I'll use pnpm for all package management tasks."},
        {"role": "user", "content": "Also, never use 'use client' directive with async components in Next.js"},
        {"role": "assistant", "content": "Got it, I'll avoid using 'use client' with async components."}
    ]

    try:
        result2 = memory.add(detailed_messages, user_id=test_user_id)
        print(f"✓ Add result: {result2}")
        print(f"  - Memories created: {len(result2.get('results', []))}")
        if result2.get('results'):
            for idx, mem in enumerate(result2['results']):
                print(f"    [{idx+1}] {mem}")
    except Exception as e:
        print(f"❌ Failed to add detailed messages: {e}")
        return

    # Test 3: Get all memories
    print(f"\n4. Getting all memories for user...")
    try:
        all_memories = memory.get_all(user_id=test_user_id)
        print(f"✓ Total memories stored: {len(all_memories)}")
        if all_memories:
            for idx, mem in enumerate(all_memories):
                print(f"  [{idx+1}] {mem}")
        else:
            print("  ⚠️  No memories found!")
    except Exception as e:
        print(f"❌ Failed to get all memories: {e}")
        return

    # Test 4: Search for specific content
    print(f"\n5. Searching for 'package management' preferences...")
    try:
        search_results = memory.search(
            query="package management tools and preferences",
            user_id=test_user_id,
            limit=5
        )
        print(f"✓ Search completed")
        print(f"  - Results found: {len(search_results.get('results', []))}")
        if search_results.get('results'):
            for idx, result in enumerate(search_results['results']):
                print(f"  [{idx+1}] Memory: {result.get('memory', 'N/A')}")
                print(f"      Score: {result.get('score', 'N/A')}")
        else:
            print("  ⚠️  No search results!")
    except Exception as e:
        print(f"❌ Search failed: {e}")
        return

    # Test 5: Search for Next.js preferences
    print(f"\n6. Searching for 'Next.js coding rules'...")
    try:
        search_results = memory.search(
            query="Next.js async components client directive",
            user_id=test_user_id,
            limit=5
        )
        print(f"✓ Search completed")
        print(f"  - Results found: {len(search_results.get('results', []))}")
        if search_results.get('results'):
            for idx, result in enumerate(search_results['results']):
                print(f"  [{idx+1}] Memory: {result.get('memory', 'N/A')}")
                print(f"      Score: {result.get('score', 'N/A')}")
        else:
            print("  ⚠️  No search results!")
    except Exception as e:
        print(f"❌ Search failed: {e}")
        return

    print("\n" + "=" * 60)
    print("Test Complete!")
    print("=" * 60)

if __name__ == "__main__":
    test_mem0()
