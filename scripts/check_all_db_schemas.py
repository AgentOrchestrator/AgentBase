#!/usr/bin/env python3
"""
Check schema of all .vscdb files in Cursor directory.
Verifies if all databases have the same schema or if there are variations.
"""

import os
import sqlite3
import hashlib
from pathlib import Path
from collections import defaultdict

CURSOR_DIR = Path.home() / "Library" / "Application Support" / "Cursor"

def get_schema(db_path):
    """Get the schema of a SQLite database"""
    try:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        cursor = conn.cursor()
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' ORDER BY name;")
        schema = cursor.fetchall()
        conn.close()
        return schema
    except Exception as e:
        return f"Error: {e}"

def get_table_info(db_path):
    """Get detailed information about tables in a database"""
    try:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        cursor = conn.cursor()

        # Get all table names
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]

        table_info = {}
        for table in tables:
            # Get row count
            cursor.execute(f"SELECT COUNT(*) FROM {table};")
            count = cursor.fetchone()[0]

            # Get sample keys
            sample_keys = []
            try:
                cursor.execute(f"SELECT key FROM {table} LIMIT 5;")
                sample_keys = [row[0] for row in cursor.fetchall()]
            except:
                pass  # Table might not have a 'key' column

            table_info[table] = {
                'count': count,
                'sample_keys': sample_keys
            }

        conn.close()
        return table_info
    except Exception as e:
        return {'error': str(e)}

def main():
    print("=== Cursor Database Schema Analysis ===")
    print()

    # Find all .vscdb files
    db_files = list(CURSOR_DIR.glob("**/*.vscdb"))
    print(f"Found {len(db_files)} databases")
    print()

    # Group databases by schema
    schema_groups = defaultdict(list)

    for db_path in db_files:
        schema = get_schema(db_path)
        schema_str = str(schema)
        schema_hash = hashlib.md5(schema_str.encode()).hexdigest()
        schema_groups[schema_hash].append((db_path, schema))

    print(f"Unique schema variants found: {len(schema_groups)}")
    print()

    # Display each schema variant
    for i, (schema_hash, db_list) in enumerate(schema_groups.items(), 1):
        print(f"=== SCHEMA VARIANT #{i} ===")
        print(f"Found in {len(db_list)} database(s)")
        print()

        # Show the schema from the first database
        first_db, schema = db_list[0]
        print(f"Example database: {first_db.name}")
        print(f"Full path: {first_db}")
        print()

        print("Schema:")
        for table_def in schema:
            if isinstance(table_def, tuple):
                print(f"  {table_def[0]}")
        print()

        # Get detailed info from first database
        table_info = get_table_info(first_db)
        print("Table Details:")
        for table_name, info in table_info.items():
            if 'error' in info:
                print(f"  {table_name}: Error - {info['error']}")
            else:
                print(f"  {table_name}:")
                print(f"    Rows: {info['count']}")
                if info['sample_keys']:
                    print(f"    Sample keys:")
                    for key in info['sample_keys']:
                        print(f"      - {key}")
        print()

        # Show which databases have this schema
        print(f"Databases with this schema ({len(db_list)} total):")
        for db_path, _ in db_list[:5]:  # Show first 5
            relative_path = db_path.relative_to(CURSOR_DIR)
            print(f"  - {relative_path}")
        if len(db_list) > 5:
            print(f"  ... and {len(db_list) - 5} more")
        print()
        print("-" * 80)
        print()

    # Check for any differences in keys between databases
    print("=== KEY ANALYSIS ===")
    print()

    # Check global database keys
    global_db = CURSOR_DIR / "User" / "globalStorage" / "state.vscdb"
    if global_db.exists():
        print("Checking global database keys...")
        conn = sqlite3.connect(f"file:{global_db}?mode=ro", uri=True)
        cursor = conn.cursor()

        # Get all unique key patterns from cursorDiskKV
        cursor.execute("""
            SELECT DISTINCT
                substr(key, 1, instr(key || ':', ':') - 1) as key_prefix,
                COUNT(*) as count
            FROM cursorDiskKV
            GROUP BY key_prefix
            ORDER BY count DESC
            LIMIT 20;
        """)
        print("\nTop key patterns in cursorDiskKV (global):")
        for prefix, count in cursor.fetchall():
            print(f"  {prefix}: {count}")

        # Get all unique keys from ItemTable
        cursor.execute("""
            SELECT key
            FROM ItemTable
            ORDER BY key
            LIMIT 20;
        """)
        item_keys = cursor.fetchall()
        if item_keys:
            print("\nSample keys in ItemTable (global):")
            for (key,) in item_keys:
                print(f"  - {key}")

        conn.close()
        print()

    # Check a workspace database with sessions
    workspace_db = CURSOR_DIR / "User" / "workspaceStorage" / "9f8a01fdc63a2fe7eeac2e055b575f84" / "state.vscdb"
    if workspace_db.exists():
        print("Checking workspace database keys (paper_writer)...")
        conn = sqlite3.connect(f"file:{workspace_db}?mode=ro", uri=True)
        cursor = conn.cursor()

        # Get all keys from ItemTable
        cursor.execute("""
            SELECT key
            FROM ItemTable
            WHERE key LIKE '%conversation%'
               OR key LIKE '%composer%'
               OR key LIKE '%session%'
               OR key LIKE '%chat%'
            ORDER BY key;
        """)
        workspace_keys = cursor.fetchall()
        if workspace_keys:
            print("\nConversation-related keys in ItemTable (workspace):")
            for (key,) in workspace_keys:
                print(f"  - {key}")

        conn.close()
        print()

    print("=== ANALYSIS COMPLETE ===")

if __name__ == "__main__":
    main()
