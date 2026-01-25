/**
 * Fixed-size circular buffer for efficient log storage.
 * Automatically evicts oldest entries when capacity is reached.
 */
export class RingBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0;
  private tail = 0;
  private count = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('RingBuffer capacity must be positive');
    }
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;

    if (this.count < this.capacity) {
      this.count++;
    } else {
      // Buffer is full, move head forward (evicting oldest)
      this.head = (this.head + 1) % this.capacity;
    }
  }

  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.count; i++) {
      const index = (this.head + i) % this.capacity;
      const item = this.buffer[index];
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  get size(): number {
    return this.count;
  }

  get maxSize(): number {
    return this.capacity;
  }

  isEmpty(): boolean {
    return this.count === 0;
  }

  isFull(): boolean {
    return this.count === this.capacity;
  }
}
