// API client rule (Minh, app shell): one client, and it reads the same shared rules
// and the same code table as the server, so a message cannot differ between sides.
import codes from '../../../shared/codes.json';

export type Envelope = { code: string; message: string; data: unknown | null };

const BASE = process.env.API_BASE || 'http://127.0.0.1:5000/it4788';

export function messageFor(code: string): string {
  return (codes as Record<string, string>)[code] || (codes as Record<string, string>)['00114'];
}

export type RequestOptions = {
  method?: 'get' | 'post' | 'put' | 'delete';
  body?: unknown;
  token?: string | null;
  offline?: boolean;
  requestId?: string | null;
};

// Offline rule (D38): read only. A write is queued by the caller, not sent here.
export async function request(path: string, options: RequestOptions = {}): Promise<Envelope & { status: number; queued?: boolean }> {
  const method = options.method || 'get';
  if (options.offline && method !== 'get') {
    return { code: '00008', message: messageFor('00008'), data: null, status: 0, queued: true };
  }
  const response = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(options.token ? { authorization: `Bearer ${options.token}` } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const envelope = (await response.json()) as Envelope;
  return { ...envelope, status: response.status, message: envelope.message || messageFor(envelope.code) };
}

export { BASE };
