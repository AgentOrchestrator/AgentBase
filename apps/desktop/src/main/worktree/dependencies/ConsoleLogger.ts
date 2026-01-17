import type { ILogger } from './ILogger';

/**
 * Production implementation of ILogger using console
 */
export class ConsoleLogger implements ILogger {
  constructor(private readonly prefix: string) {}

  info(message: string, context?: Record<string, unknown>): void {
    if (context) {
      console.log(`${this.prefix} ${message}`, context);
    } else {
      console.log(`${this.prefix} ${message}`);
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (context) {
      console.warn(`${this.prefix} ${message}`, context);
    } else {
      console.warn(`${this.prefix} ${message}`);
    }
  }

  error(message: string, context?: Record<string, unknown>): void {
    if (context) {
      console.error(`${this.prefix} ${message}`, context);
    } else {
      console.error(`${this.prefix} ${message}`);
    }
  }
}
