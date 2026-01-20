import { useState, useCallback, useRef, useEffect } from 'react';
import { ImpactAnalysis } from '../types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  isStale: boolean;
}

interface CacheConfig {
  ttl: number;
  staleWhileRevalidate: boolean;
}

const DEFAULT_CONFIG: CacheConfig = {
  ttl: 5 * 60 * 1000,
  staleWhileRevalidate: true,
};

class DataCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private config: CacheConfig;
  private pendingRequests: Map<string, Promise<any>> = new Map();
  private fetchVersions: Map<string, number> = new Map();

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  private getNextVersion(key: string): number {
    const current = this.fetchVersions.get(key) || 0;
    const next = current + 1;
    this.fetchVersions.set(key, next);
    return next;
  }
  
  private isCurrentVersion(key: string, version: number): boolean {
    return this.fetchVersions.get(key) === version;
  }

  get<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > this.config.ttl;
    if (isExpired && !this.config.staleWhileRevalidate) {
      this.cache.delete(key);
      return null;
    }

    return {
      ...entry,
      isStale: isExpired,
    };
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      isStale: false,
    });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: { forceRefresh?: boolean }
  ): Promise<{ data: T; fromCache: boolean }> {
    if (options?.forceRefresh) {
      const version = this.getNextVersion(key);
      this.cache.delete(key);
      this.pendingRequests.delete(key);
      
      const fetchPromise = fetcher();
      this.pendingRequests.set(key, fetchPromise);
      try {
        const data = await fetchPromise;
        if (this.isCurrentVersion(key, version)) {
          this.set(key, data);
        }
        return { data, fromCache: false };
      } finally {
        this.pendingRequests.delete(key);
      }
    }
    
    const cached = this.get<T>(key);
    if (cached && !cached.isStale) {
      return { data: cached.data, fromCache: true };
    }

    if (cached && cached.isStale && this.config.staleWhileRevalidate) {
      this.revalidate(key, fetcher);
      return { data: cached.data, fromCache: true };
    }

    const pending = this.pendingRequests.get(key);
    if (pending) {
      const data = await pending;
      return { data, fromCache: false };
    }

    const version = this.getNextVersion(key);
    const fetchPromise = fetcher();
    this.pendingRequests.set(key, fetchPromise);

    try {
      const data = await fetchPromise;
      if (this.isCurrentVersion(key, version)) {
        this.set(key, data);
      }
      return { data, fromCache: false };
    } finally {
      this.pendingRequests.delete(key);
    }
  }

  private async revalidate<T>(key: string, fetcher: () => Promise<T>): Promise<void> {
    if (this.pendingRequests.has(key)) return;

    const version = this.getNextVersion(key);
    const fetchPromise = fetcher();
    this.pendingRequests.set(key, fetchPromise);

    try {
      const data = await fetchPromise;
      if (this.isCurrentVersion(key, version)) {
        this.set(key, data);
      }
    } catch (error) {
      console.error(`[Cache] Revalidation failed for key: ${key}`, error);
    } finally {
      this.pendingRequests.delete(key);
    }
  }
}

const globalCache = new DataCache();

export const CACHE_KEYS = {
  ANALYSES_LIST: 'analyses:list',
  ANALYSIS_DETAIL: (id: string) => `analyses:detail:${id}`,
  PROJECTS_LIST: 'projects:list',
  PROJECT_DETAIL: (id: string) => `projects:detail:${id}`,
  TEMPLATES_LIST: 'templates:list',
  DASHBOARD_STATS: 'dashboard:stats',
};

interface UseDataCacheOptions<T> {
  key: string;
  fetcher: () => Promise<T>;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface UseDataCacheResult<T> {
  data: T | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refetch: (forceRefresh?: boolean) => Promise<void>;
  invalidate: () => void;
}

export function useDataCache<T>({
  key,
  fetcher,
  enabled = true,
  onSuccess,
  onError,
}: UseDataCacheOptions<T>): UseDataCacheResult<T> {
  const [data, setData] = useState<T | null>(() => {
    const cached = globalCache.get<T>(key);
    return cached?.data ?? null;
  });
  const [isLoading, setIsLoading] = useState(!data && enabled);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const fetch = useCallback(async (forceRefresh = false) => {
    if (!enabled) return;

    const hasData = data !== null;
    if (forceRefresh && hasData) {
      setIsRefreshing(true);
    } else if (!hasData) {
      setIsLoading(true);
    }

    try {
      const result = await globalCache.getOrFetch(key, fetcher, { forceRefresh });
      if (mountedRef.current) {
        setData(result.data);
        setError(null);
        onSuccess?.(result.data);
      }
    } catch (err) {
      if (mountedRef.current) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        onError?.(error);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [key, fetcher, enabled, data, onSuccess, onError]);

  const refetch = useCallback(async (forceRefresh = false) => {
    await fetch(forceRefresh);
  }, [fetch]);

  const invalidate = useCallback(() => {
    globalCache.invalidate(key);
    setData(null);
  }, [key]);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    return () => {
      mountedRef.current = false;
    };
  }, [key, enabled]);

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    refetch,
    invalidate,
  };
}

export function invalidateCache(key: string): void {
  globalCache.invalidate(key);
}

export function invalidateCachePattern(pattern: string): void {
  globalCache.invalidatePattern(pattern);
}

export function invalidateAllCache(): void {
  globalCache.invalidateAll();
}

export function prefetchData<T>(key: string, fetcher: () => Promise<T>): Promise<void> {
  return globalCache.getOrFetch(key, fetcher).then(() => {});
}

export { globalCache };
