import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { TokenPair } from '@/types';
import { storage } from '@/utils/storage';

export const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const ACCESS = 'gc.access';
const REFRESH = 'gc.refresh';

export const tokens = {
  get access() { return storage.get(ACCESS); },
  get refresh() { return storage.get(REFRESH); },
  set(pair: Pick<TokenPair, 'access_token' | 'refresh_token'>) {
    storage.set(ACCESS, pair.access_token);
    storage.set(REFRESH, pair.refresh_token);
  },
  clear() {
    storage.remove(ACCESS);
    storage.remove(REFRESH);
  },
};

export const api = axios.create({ baseURL: API_URL, timeout: 90_000 });

api.interceptors.request.use((config) => {
  const t = tokens.access;
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;
let onAuthFailure: () => void = () => {};
export const setAuthFailureHandler = (fn: () => void) => { onAuthFailure = fn; };

async function refreshAccess(): Promise<string | null> {
  const rt = tokens.refresh;
  if (!rt) return null;
  try {
    const { data } = await axios.post<TokenPair>(`${API_URL}/auth/refresh`, { refresh_token: rt });
    tokens.set(data);
    return data.access_token;
  } catch {
    tokens.clear();
    return null;
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const url = original?.url || '';
    if (error.response?.status === 401 && original && !original._retry && !url.includes('/auth/')) {
      original._retry = true;
      refreshing = refreshing || refreshAccess().finally(() => { refreshing = null; });
      const fresh = await refreshing;
      if (fresh) {
        original.headers.Authorization = `Bearer ${fresh}`;
        return api(original);
      }
      onAuthFailure();
    }
    return Promise.reject(error);
  },
);

/** Turn any API error into a human message, plus scheduling conflicts if present. */
export function parseApiError(err: unknown): { message: string; conflicts: string[]; status?: number } {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail;
    if (!err.response) return { message: 'Cannot reach the server. Check your connection and that the API is running.', conflicts: [] };
    if (typeof detail === 'string') return { message: detail, conflicts: [], status };
    if (Array.isArray(detail)) {
      const msg = detail
        .map((d: { loc?: (string | number)[]; msg?: string }) => {
          const field = d.loc?.filter((l) => l !== 'body').join('.');
          return field ? `${field}: ${d.msg}` : d.msg;
        })
        .join('; ');
      return { message: msg || 'Validation failed', conflicts: [], status };
    }
    if (detail && typeof detail === 'object') {
      const d = detail as { message?: string; conflicts?: string[] };
      return { message: d.message || 'Request failed', conflicts: d.conflicts || [], status };
    }
    if (status === 429) return { message: 'Too many requests — please wait a moment and try again.', conflicts: [], status };
    if (status && status >= 500) return { message: 'Something went wrong on the server. Please try again.', conflicts: [], status };
    return { message: err.message, conflicts: [], status };
  }
  return { message: err instanceof Error ? err.message : 'Unexpected error', conflicts: [] };
}

/** Drop empty values so they don't become `?x=` query params. */
export function clean<T extends Record<string, unknown>>(params: T): Partial<T> {
  const out: Record<string, unknown> = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  });
  return out as Partial<T>;
}
