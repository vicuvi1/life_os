"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// A tiny stale-while-revalidate cache shared across the app. Re-opening a page
// renders its last snapshot instantly (no skeleton) and revalidates in the
// background — the generalised version of the per-page module caches used by
// Finance / Goals / the dashboard.
const cache = new Map<string, unknown>();

/** Drop a specific key (or everything) — e.g. on sign-out. */
export function invalidateCache(key?: string) {
  if (key) cache.delete(key);
  else cache.clear();
}

export interface CachedResource<T> {
  data: T | undefined;
  /** True only on the very first load of an uncached key. */
  loading: boolean;
  /** Re-fetch; never flashes the skeleton once something is cached. */
  refresh: () => Promise<void>;
}

/**
 * @param key     Stable cache key (include the user id). `null` disables the
 *                hook until it's ready (e.g. before auth resolves).
 * @param fetcher Async loader. Its latest closure is always used, so it can
 *                capture fresh props without changing the effect's identity.
 */
export function useCachedResource<T>(
  key: string | null,
  fetcher: () => Promise<T>
): CachedResource<T> {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const initial = key != null && cache.has(key) ? (cache.get(key) as T) : undefined;
  const [data, setData] = useState<T | undefined>(initial);
  const [loading, setLoading] = useState<boolean>(key != null && !cache.has(key));

  const load = useCallback(async () => {
    if (key == null) return;
    if (!cache.has(key)) setLoading(true);
    try {
      const result = await fetcherRef.current();
      cache.set(key, result);
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    if (key == null) return;
    // Paint the cached snapshot immediately, then revalidate.
    if (cache.has(key)) {
      setData(cache.get(key) as T);
      setLoading(false);
    }
    void load();
  }, [key, load]);

  return { data, loading, refresh: load };
}
