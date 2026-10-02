const STORAGE_PREFIX = 'busCache:'

export const CATALOG_TTL_MS = 24 * 60 * 60 * 1000
export const ETA_TTL_MS = 20 * 1000

interface CacheOptions {
  ttlMs: number
  persist?: boolean
  force?: boolean
}

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const memory = new Map<string, CacheEntry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()

const isFresh = <T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> => {
  return !!entry && entry.expiresAt > Date.now()
}

const readPersist = <T>(key: string): CacheEntry<T> | undefined => {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    if (!raw) {
      return undefined
    }
    const parsed = JSON.parse(raw) as CacheEntry<T>
    if (!parsed || typeof parsed.expiresAt !== 'number') {
      return undefined
    }
    return parsed
  } catch {
    return undefined
  }
}

const writePersist = <T>(key: string, entry: CacheEntry<T>) => {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry))
  } catch {
    // Quota or private mode — keep the in-memory hit only.
  }
}

export const cachedGet = async <T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions
): Promise<T> => {
  if (!options.force) {
    const memoryHit = memory.get(key) as CacheEntry<T> | undefined
    if (isFresh(memoryHit)) {
      return memoryHit.value
    }

    if (options.persist) {
      const persisted = readPersist<T>(key)
      if (isFresh(persisted)) {
        memory.set(key, persisted)
        return persisted.value
      }
    }

    const pending = inflight.get(key)
    if (pending) {
      return pending as Promise<T>
    }
  }

  const slot: { current: Promise<T> | null } = { current: null }
  const promise = (async () => {
    try {
      const value = await fetcher()
      const entry: CacheEntry<T> = { value, expiresAt: Date.now() + options.ttlMs }
      memory.set(key, entry)
      if (options.persist) {
        writePersist(key, entry)
      }
      return value
    } finally {
      if (inflight.get(key) === slot.current) {
        inflight.delete(key)
      }
    }
  })()

  slot.current = promise
  inflight.set(key, promise)
  return promise
}

export const invalidatePrefix = (prefix: string) => {
  Array.from(memory.keys()).forEach((key) => {
    if (key.startsWith(prefix)) {
      memory.delete(key)
    }
  })

  Array.from(inflight.keys()).forEach((key) => {
    if (key.startsWith(prefix)) {
      inflight.delete(key)
    }
  })

  const toRemove: string[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const storageKey = localStorage.key(i)
    if (storageKey && storageKey.startsWith(STORAGE_PREFIX + prefix)) {
      toRemove.push(storageKey)
    }
  }
  toRemove.forEach((storageKey) => localStorage.removeItem(storageKey))
}
