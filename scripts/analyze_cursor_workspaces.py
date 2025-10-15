#!/usr/bin/env python3
"""
Analyze Cursor workspaces to find conversation/session data.

This script:
1. Enumerates all workspace directories in Cursor's workspaceStorage
2. For each workspace, reads workspace.json to identify the project (local folder, remote, container, etc.)
3. Queries the workspace database for interactive.sessions
4. Reports findings
"""

import os
import json
import sqlite3
from pathlib import Path
from urllib.parse import unquote

# Cursor storage paths
CURSOR_USER_DIR = Path.home() / "Library" / "Application Support" / "Cursor" / "User"
WORKSPACE_STORAGE_DIR = CURSOR_USER_DIR / "workspaceStorage"
GLOBAL_DB = CURSOR_USER_DIR / "globalStorage" / "state.vscdb"

def parse_workspace_location(folder_uri):
    """
    Parse workspace location URI to human-readable format.

    Handles:
    - file:///path/to/folder (local folders)
    - vscode-remote://... (remote machines, containers, WSL, etc.)
    """
    if not folder_uri:
        return "Unknown"

    if folder_uri.startswith("file://"):
        # Local folder
        return folder_uri.replace("file://", "")

    if folder_uri.startswith("vscode-remote://"):
        # Remote workspace - parse the complex URI
        # Example: vscode-remote://attached-container%2B7b22636f6e7461696e65724e616d65223a222f6d6572637572615f6465762d6170695f676174657761792d32227d@ssh-remote%2Bmercura-server/app

        try:
            # Remove vscode-remote:// prefix
            remote_part = folder_uri.replace("vscode-remote://", "")

            # Split by @ to separate container/remote info from path
            if "@" in remote_part:
                connection_info, path = remote_part.split("@", 1)
                # Extract remote host/container name
                if "ssh-remote" in path:
                    host = path.split("/")[0].replace("ssh-remote%2B", "")
                    path_part = "/" + "/".join(path.split("/")[1:])
                    return f"[SSH Remote: {unquote(host)}] {path_part}"
                else:
                    return f"[Remote] {unquote(path)}"
            else:
                return f"[Remote] {unquote(remote_part)}"
        except Exception as e:
            return f"[Remote/Container] {folder_uri}"

    return folder_uri

def get_workspace_info(workspace_dir):
    """Get workspace information from workspace.json"""
    workspace_json = workspace_dir / "workspace.json"
    if not workspace_json.exists():
        return None

    try:
        with open(workspace_json, 'r') as f:
            data = json.load(f)
            folder_uri = data.get('folder', 'Unknown')
            return parse_workspace_location(folder_uri)
    except Exception as e:
        return f"Error: {e}"

def query_workspace_db(workspace_dir, key):
    """Query workspace database for a specific key"""
    db_path = workspace_dir / "state.vscdb"
    if not db_path.exists():
        return None

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM ItemTable WHERE key = ?", (key,))
        result = cursor.fetchone()
        conn.close()

        if result:
            return json.loads(result[0])
        return None
    except Exception as e:
        return f"Error: {e}"

def get_all_conversation_keys(workspace_dir):
    """Get all keys related to conversations/sessions"""
    db_path = workspace_dir / "state.vscdb"
    if not db_path.exists():
        return []

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT key FROM ItemTable
            WHERE key LIKE '%conversation%'
               OR key LIKE '%composer%'
               OR key LIKE '%session%'
               OR key LIKE '%interactive%'
        """)
        results = cursor.fetchall()
        conn.close()
        return [r[0] for r in results]
    except Exception as e:
        return [f"Error: {e}"]

def analyze_workspaces():
    """Analyze all workspace directories"""
    if not WORKSPACE_STORAGE_DIR.exists():
        print(f"Workspace storage directory not found: {WORKSPACE_STORAGE_DIR}")
        return

    workspace_dirs = [d for d in WORKSPACE_STORAGE_DIR.iterdir() if d.is_dir()]
    print(f"Found {len(workspace_dirs)} workspace directories\n")

    results = []

    for workspace_dir in sorted(workspace_dirs):
        workspace_id = workspace_dir.name
        location = get_workspace_info(workspace_dir)

        # Get all conversation-related keys
        keys = get_all_conversation_keys(workspace_dir)

        # Get interactive sessions if available
        sessions = query_workspace_db(workspace_dir, 'interactive.sessions')

        result = {
            'id': workspace_id,
            'location': location,
            'conversation_keys': keys,
            'has_sessions': sessions is not None and len(sessions) > 0 if isinstance(sessions, list) else False,
            'session_count': len(sessions) if isinstance(sessions, list) else 0,
        }

        results.append(result)

    # Print summary
    print("=" * 80)
    print("WORKSPACE ANALYSIS SUMMARY")
    print("=" * 80)

    workspaces_with_sessions = [r for r in results if r['has_sessions']]
    print(f"\nTotal workspaces: {len(results)}")
    print(f"Workspaces with sessions: {len(workspaces_with_sessions)}")
    print()

    # Print detailed results
    print("=" * 80)
    print("DETAILED RESULTS")
    print("=" * 80)

    for result in results:
        print(f"\nWorkspace ID: {result['id']}")
        print(f"Location: {result['location']}")
        print(f"Conversation keys: {len(result['conversation_keys'])}")
        if result['conversation_keys']:
            for key in result['conversation_keys']:
                print(f"  - {key}")
        print(f"Has sessions: {result['has_sessions']}")
        print(f"Session count: {result['session_count']}")

        if result['has_sessions']:
            print(f"  ✓ This workspace contains conversation data!")
        print("-" * 80)

    # Print workspaces with sessions
    if workspaces_with_sessions:
        print("\n" + "=" * 80)
        print("WORKSPACES WITH ACTIVE SESSIONS")
        print("=" * 80)

        for result in workspaces_with_sessions:
            print(f"\n{result['location']}")
            print(f"  ID: {result['id']}")
            print(f"  Sessions: {result['session_count']}")
            print(f"  Database: {WORKSPACE_STORAGE_DIR / result['id'] / 'state.vscdb'}")

if __name__ == "__main__":
    analyze_workspaces()
