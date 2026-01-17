import * as fs from 'node:fs/promises';
import type { IFilesystem } from './IFilesystem';

/**
 * Production implementation of IFilesystem using fs/promises
 */
export class Filesystem implements IFilesystem {
  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(path: string): Promise<void> {
    await fs.mkdir(path, { recursive: true });
  }

  async rmdir(path: string): Promise<void> {
    await fs.rm(path, { recursive: true, force: true });
  }

  async readdir(path: string): Promise<string[]> {
    const entries = await fs.readdir(path);
    return entries;
  }
}
