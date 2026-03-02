type CacheEntry = {
  expiresAt: number;
  payload: unknown;
};

const providerQueue = new Map<string, Promise<unknown>>();
const providerCache = new Map<string, CacheEntry>();

export async function runProviderSerialized<T>(provider: string, task: () => Promise<T>): Promise<T> {
  const previous = providerQueue.get(provider) ?? Promise.resolve();

  const current = previous
    .catch(() => undefined)
    .then(task)
    .finally(() => {
      if (providerQueue.get(provider) === current) {
        providerQueue.delete(provider);
      }
    });

  providerQueue.set(provider, current);
  return current;
}

export function getProviderCache<T>(key: string): T | null {
  const cached = providerCache.get(key);
  if (!cached) {
    return null;
  }

  if (Date.now() >= cached.expiresAt) {
    providerCache.delete(key);
    return null;
  }

  return cached.payload as T;
}

export function setProviderCache(key: string, payload: unknown, ttlMs: number) {
  providerCache.set(key, {
    payload,
    expiresAt: Date.now() + Math.max(ttlMs, 0)
  });
}

export function clearProviderRuntimeCache() {
  providerCache.clear();
}
