/**
 * ID generation abstraction
 */
export interface IIdGenerator {
  /**
   * Generate a unique identifier
   */
  generate(): string;
}
