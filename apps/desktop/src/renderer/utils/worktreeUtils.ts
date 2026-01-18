import type { Node } from '@xyflow/react';
import type { AgentNodeData } from '../types/agent-node';

// Helper functions to work with paths (since we can't use Node.js path module directly in renderer)
function basename(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

function join(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/');
}

function normalize(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/\/+/g, '/');
}

/**
 * Check if a URL or path is a local file
 * Returns the file path if it's local, null otherwise
 */
export function extractLocalFilePath(urlOrPath: string): string | null {
  if (!urlOrPath) {
    return null;
  }

  // Strip localhost prefixes that Electron might add (e.g., http://localhost:xxxx/file://...)
  let cleanedUrl = urlOrPath;
  const localhostMatch = cleanedUrl.match(/^https?:\/\/localhost(?::\d+)?\/(.+)$/);
  if (localhostMatch) {
    cleanedUrl = localhostMatch[1];
  }

  // Check if it's a file:// URL
  if (cleanedUrl.startsWith('file://')) {
    try {
      // Remove file:// prefix
      let pathPart = cleanedUrl.substring(7);

      // Handle Windows paths: file:///C:/path or file://C:/path
      // After removing file://, we might have /C:/path or C:/path
      if (pathPart.match(/^\/[A-Za-z]:/)) {
        // Remove leading slash for Windows absolute paths
        pathPart = pathPart.substring(1);
      }

      // Decode URI encoding
      const decoded = decodeURIComponent(pathPart);

      // Normalize path separators (handle both / and \)
      const filePath = decoded.replace(/\\/g, '/');

      return filePath;
    } catch {
      return null;
    }
  }

  // Check if it's a direct file path (starts with / on Unix or C:/ on Windows)
  // Also handle paths like /Users/... or C:\Users\...
  if (cleanedUrl.startsWith('/') || cleanedUrl.match(/^[A-Za-z]:[\\/]/)) {
    // Normalize path separators
    return cleanedUrl.replace(/\\/g, '/');
  }

  // Check if it looks like an absolute path (contains path separators and doesn't look like a URL)
  if (cleanedUrl.includes('/') && !cleanedUrl.includes('://') && !cleanedUrl.startsWith('http')) {
    // Might be a relative or absolute path - try to resolve it
    // For now, if it starts with a common absolute path pattern, treat it as absolute
    if (cleanedUrl.startsWith('/') || cleanedUrl.match(/^[A-Za-z]:/)) {
      return cleanedUrl.replace(/\\/g, '/');
    }
  }

  return null;
}

/**
 * Get the relative path from a git repository root to a file
 * Returns null if the file is not within the repo
 */
export async function getRelativePathFromRepo(
  filePath: string,
  repoRoot: string
): Promise<string | null> {
  try {
    const normalizedFile = path.normalize(filePath);
    const normalizedRepo = path.normalize(repoRoot);

    if (!normalizedFile.startsWith(normalizedRepo)) {
      return null;
    }

    const relative = path.relative(normalizedRepo, normalizedFile);
    return relative.startsWith('..') ? null : relative;
  } catch {
    return null;
  }
}

/**
 * Get git repository root for a given path
 * Uses IPC to call main process
 */
export async function getGitRepoRoot(filePath: string): Promise<string | null> {
  if (!window.gitAPI?.getRepoRoot) {
    return null;
  }

  try {
    const result = await window.gitAPI.getRepoRoot(filePath);
    return result.success && result.data ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Check if two paths are from the same git repository
 * Compares git repository roots
 */
export async function arePathsFromSameRepo(path1: string, path2: string): Promise<boolean> {
  try {
    const repoRoot1 = await getGitRepoRoot(path1);
    const repoRoot2 = await getGitRepoRoot(path2);

    if (!repoRoot1 || !repoRoot2) {
      return false;
    }

    return path.normalize(repoRoot1) === path.normalize(repoRoot2);
  } catch {
    return false;
  }
}

/**
 * Find matching worktrees from canvas nodes for a given file path
 * Simple approach: check if the same filename exists in any opened workspace folder
 */
export async function findMatchingWorktrees(
  nodes: Node[],
  currentFilePath: string,
  _currentRepoRoot: string | null // Not used in simplified approach
): Promise<
  Array<{ workspacePath: string; branch: string | undefined; nodeId: string; relativePath: string }>
> {
  // Extract just the filename from the current file path
  const fileName = basename(currentFilePath);
  console.log('[findMatchingWorktrees] Looking for file:', fileName, 'in opened workspaces');

  // Determine which workspace the current file is in (if any)
  // Check if the file path starts with any workspace path
  let currentFileWorkspace: string | null = null;
  const normalizedCurrentFilePath = normalize(currentFilePath);

  console.log('[findMatchingWorktrees] Current file path:', normalizedCurrentFilePath);

  for (const node of nodes) {
    if (node.type !== 'agent') continue;
    const agentData = node.data as unknown as AgentNodeData;
    if (!agentData.workspacePath) continue;

    const normalizedWorkspacePath = normalize(agentData.workspacePath);

    console.log('[findMatchingWorktrees] Checking if file is in workspace:', {
      filePath: normalizedCurrentFilePath,
      workspacePath: normalizedWorkspacePath,
      startsWith: normalizedCurrentFilePath.startsWith(`${normalizedWorkspacePath}/`),
      equals: normalizedCurrentFilePath === normalizedWorkspacePath,
    });

    // Check if current file is within this agent's workspace
    if (
      normalizedCurrentFilePath.startsWith(`${normalizedWorkspacePath}/`) ||
      normalizedCurrentFilePath === normalizedWorkspacePath
    ) {
      currentFileWorkspace = agentData.workspacePath;
      console.log('[findMatchingWorktrees] ✓ Current file is in workspace:', currentFileWorkspace);
      break;
    }
  }

  if (!currentFileWorkspace) {
    console.log('[findMatchingWorktrees] Current file is not in any known workspace');
  }

  const matches: Array<{
    workspacePath: string;
    branch: string | undefined;
    nodeId: string;
    relativePath: string;
  }> = [];

  // Check fileAPI availability
  const fileAPI = (window as any).fileAPI;
  if (!fileAPI || !fileAPI.exists) {
    console.warn('[findMatchingWorktrees] fileAPI.exists not available');
    return [];
  }

  console.log('[findMatchingWorktrees] Checking', nodes.length, 'nodes for filename:', fileName);
  console.log('[findMatchingWorktrees] Current file workspace:', currentFileWorkspace);

  for (const node of nodes) {
    // Only check agent nodes
    if (node.type !== 'agent') {
      continue;
    }

    const agentData = node.data as unknown as AgentNodeData;
    if (!agentData.workspacePath) {
      console.log('[findMatchingWorktrees] Skipping node - no workspacePath:', node.id);
      continue;
    }

    const normalizedAgentPath = normalize(agentData.workspacePath);
    const normalizedCurrentWorkspace = currentFileWorkspace
      ? normalize(currentFileWorkspace)
      : null;

    console.log('[findMatchingWorktrees] Checking node:', {
      nodeId: node.id,
      workspacePath: agentData.workspacePath,
      normalizedAgentPath,
      currentFileWorkspace: normalizedCurrentWorkspace,
      branch: agentData.gitInfo?.branch,
    });

    // Skip if it's the same workspace as the current file
    if (normalizedCurrentWorkspace && normalizedAgentPath === normalizedCurrentWorkspace) {
      console.log('[findMatchingWorktrees] ⏭️ Skipping - same workspace as current file');
      continue;
    }

    // Also check if the current file path itself is in this workspace (more precise check)
    if (
      normalizedCurrentFilePath.startsWith(`${normalizedAgentPath}/`) ||
      normalizedCurrentFilePath === normalizedAgentPath
    ) {
      console.log('[findMatchingWorktrees] ⏭️ Skipping - current file is in this workspace', {
        filePath: normalizedCurrentFilePath,
        workspace: normalizedAgentPath,
      });
      continue;
    }

    // Check if the file exists in this workspace (just check for the filename in the workspace root)
    const potentialFilePath = join(agentData.workspacePath, fileName);

    console.log('[findMatchingWorktrees] Checking file existence:', potentialFilePath);

    try {
      const fileExists = await fileAPI.exists(potentialFilePath);
      console.log('[findMatchingWorktrees] File exists?', fileExists, 'at:', potentialFilePath);

      if (fileExists) {
        // Extract folder name from workspace path
        const folderName = basename(agentData.workspacePath);

        console.log('[findMatchingWorktrees] ✓ Found file in workspace:', {
          workspacePath: agentData.workspacePath,
          folderName,
          fileName,
          potentialFilePath,
        });

        matches.push({
          workspacePath: agentData.workspacePath,
          branch: undefined, // Not using branch names
          nodeId: node.id,
          relativePath: fileName, // Just the filename
        });
      }
    } catch (error) {
      console.error('[findMatchingWorktrees] Error checking file existence:', error, {
        potentialFilePath,
        workspacePath: agentData.workspacePath,
        fileName,
      });
    }
  }

  console.log('[findMatchingWorktrees] Found', matches.length, 'matching worktrees');
  return matches;
}
