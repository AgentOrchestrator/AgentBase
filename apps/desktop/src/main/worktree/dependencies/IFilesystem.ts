/**
 * Filesystem operations abstraction
 */
export interface IFilesystem {
  /**
   * Check if a path exists
   * @param path - Path to check
   */
  exists(path: string): Promise<boolean>;

  /**
   * Create a directory recursively
   * @param path - Directory path to create
   */
  mkdir(path: string): Promise<void>;

  /**
   * Remove a directory recursively
   * @param path - Directory path to remove
   */
  rmdir(path: string): Promise<void>;

  /**
   * List directory entries (names only)
   * @param path - Directory path to list
   */
  readdir(path: string): Promise<string[]>;
}
