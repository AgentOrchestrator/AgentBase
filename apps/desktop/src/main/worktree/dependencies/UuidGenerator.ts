import { randomUUID } from 'node:crypto';
import type { IIdGenerator } from './IIdGenerator';

/**
 * Production implementation of IIdGenerator using crypto.randomUUID
 */
export class UuidGenerator implements IIdGenerator {
  generate(): string {
    return randomUUID();
  }
}
