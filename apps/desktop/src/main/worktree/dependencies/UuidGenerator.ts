import { randomUUID } from 'crypto';
import { IIdGenerator } from './IIdGenerator';

/**
 * Production implementation of IIdGenerator using crypto.randomUUID
 */
export class UuidGenerator implements IIdGenerator {
  generate(): string {
    return randomUUID();
  }
}
