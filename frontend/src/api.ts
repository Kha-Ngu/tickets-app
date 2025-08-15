// Small helper that always talks to the backend via the Vite proxy (/api → :3000)
const API_BASE = '/api';

const TOKEN_KEY = 'tickets.token';
export const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
export const setToken = (t: string) => {
  if (!t) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, t);
};

type Opts = RequestInit & { json?: any };

export async function api(path: string, opts: Opts = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const body =
    opts.body ?? (opts.json !== undefined ? JSON.stringify(opts.json) : undefined);

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers, body });

  // Try JSON first; if not JSON, surface text (useful for 4xx from server)
  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }

  if (!res.ok) throw new Error(data?.error || data?.message || res.statusText);
  return data;
}
