// Admin page (Hòa): the page reads the admin endpoints only, and every line it prints is the
// message the server answered, taken from the shared code table. The page decides no rule.
import codes from '../../shared/codes.json';

const BASE = process.env.API_BASE || 'http://127.0.0.1:5000/it4788';

export type Envelope = { code: string; message: string; data: unknown };

export function messageFor(code: string): string {
  return (codes as Record<string, string>)[code] || (codes as Record<string, string>)['00114'];
}

export async function call(
  path: string,
  options: { method?: 'get' | 'post' | 'put' | 'delete'; body?: unknown; token?: string } = {},
): Promise<Envelope> {
  const method = options.method || 'get';
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const envelope = (await res.json()) as Envelope;
  return { ...envelope, message: envelope.message || messageFor(envelope.code) };
}

export async function login(email: string, password: string) {
  const out = await call('/user/login/', { method: 'post', body: { email, password } });
  return { token: out.code === '00047' ? String((out.data as { accessToken: string }).accessToken) : null, out };
}

// One view for the whole page: the users, the logs, and the two admin lists.
export async function adminView(token: string, level?: string) {
  const [users, logs, categories, units] = await Promise.all([
    call('/admin/users/', { token }),
    call(`/admin/logs/${level ? `?level=${encodeURIComponent(level)}` : ''}`, { token }),
    call('/admin/category/', { token }),
    call('/admin/unit/', { token }),
  ]);
  return {
    users: (users.data as { users: Record<string, unknown>[] })?.users || [],
    logs: (logs.data as { logs: Record<string, unknown>[] })?.logs || [],
    categories: (categories.data as { categories: Record<string, unknown>[] })?.categories || [],
    units: (units.data as { units: Record<string, unknown>[] })?.units || [],
    denied: users.code === '00017',
    message: users.message || messageFor(users.code),
  };
}

export const setRole = (token: string, userId: string, role: string) =>
  call('/admin/users/role/', { method: 'post', body: { userId, role }, token });

export const forceLogout = (token: string, userId: string) =>
  call('/admin/sessions/logout/', { method: 'post', body: { userId }, token });

export const addCategory = (token: string, name: string) => call('/admin/category/', { method: 'post', body: { name }, token });
export const renameCategory = (token: string, oldName: string, newName: string) =>
  call('/admin/category/', { method: 'put', body: { oldName, newName }, token });
// A delete carries its name in the query, because a body on a delete is not read the same way
// by every client; the server merges the query into the same input.
export const removeCategory = (token: string, name: string) =>
  call(`/admin/category/?name=${encodeURIComponent(name)}`, { method: 'delete', token });

export const addUnit = (token: string, name: string) => call('/admin/unit/', { method: 'post', body: { name }, token });
export const renameUnit = (token: string, oldName: string, newName: string) =>
  call('/admin/unit/', { method: 'put', body: { oldName, newName }, token });
export const removeUnit = (token: string, unitName: string) =>
  call(`/admin/unit/?unitName=${encodeURIComponent(unitName)}`, { method: 'delete', token });
