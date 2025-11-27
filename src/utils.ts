/**
 * Creates a debounced version of a function
 * @param fn Function to debounce
 * @param delay Delay in milliseconds
 * @returns Debounced function with cancel method
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number,
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  }) as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * Simple LRU-like cache for document blocks
 */
export class DocumentCache<T> {
  private readonly cache = new Map<string, { data: T; version: number }>();
  private readonly maxSize: number;

  constructor(maxSize = 10) {
    this.maxSize = maxSize;
  }

  get(uri: string, version: number): T | undefined {
    const entry = this.cache.get(uri);
    if (entry?.version === version) {
      return entry.data;
    }
    return undefined;
  }

  set(uri: string, version: number, data: T): void {
    // Simple eviction: remove oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(uri)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(uri, { data, version });
  }

  delete(uri: string): void {
    this.cache.delete(uri);
  }

  clear(): void {
    this.cache.clear();
  }
}
