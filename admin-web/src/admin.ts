// Admin page (Hòa): reads the admin endpoints only, one page per block, and shows the
// code message from the shared table instead of a page-written text.
import codes from '../../shared/codes.json';

const BASE = process.env.API_BASE || 'http://127.0.0.1:5000/it4788';

export async function adminView(token: string) {
  const users = await fetchJson('/admin/users', token);
  const logs = await fetchJson('/admin/logs', token);
  return {
    users: (users.data as { users: Record<string, unknown>[] })?.users || [],
    logs: (logs.data as { logs: Record<string, unknown>[] })?.logs || [],
    denied: users.code === '00017',
    message: (codes as Record<string, string>)[users.code] || '',
  };
}

async function fetchJson(path: string, token: string) {
  const res = await fetch(BASE + path, { headers: { authorization: `Bearer ${token}` } });
  return res.json();
}
