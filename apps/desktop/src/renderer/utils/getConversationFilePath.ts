/**
 * Get the conversation JSONL file path for a Claude Code session
 *
 * Path format: ~/.claude/projects/<encoded-workspace-path>/<sessionId>.jsonl
 * Encoding: Replace all '/' with '-' and spaces with '-'
 *
 * Note: This function constructs the path but doesn't resolve symlinks.
 * The actual file system check should handle path resolution.
 */
export function getConversationFilePath(sessionId: string, workspacePath: string): string {
  // Get home directory from electronAPI
  const electronAPI = (window as unknown as { electronAPI?: { getHomeDir: () => string } })
    .electronAPI;
  const homeDir = electronAPI?.getHomeDir() || '/';

  // Encode workspace path: replace '/' with '-' and spaces with '-'
  // Note: This matches the encoding used in ClaudeCodeForkAdapter
  const encodedPath = workspacePath.replace(/\//g, '-').replace(/ /g, '-');

  // Construct full path
  const projectsDir = `${homeDir}/.claude/projects`;
  const filePath = `${projectsDir}/${encodedPath}/${sessionId}.jsonl`;

  return filePath;
}
