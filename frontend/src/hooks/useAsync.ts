import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { parseApiError } from '@/services/api';

/** Load data on mount / when deps change, with loading + error + reload. */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const reload = useCallback(async (silent = false) => {
    const id = ++seq.current;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const r = await run();
      if (id === seq.current) setData(r);
    } catch (e) {
      if (id === seq.current) setError(parseApiError(e).message);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [run]);

  useEffect(() => { reload(); }, [reload]);

  return { data, loading, error, reload, setData };
}
