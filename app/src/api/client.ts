// API client rule (Minh, app shell): one client, and it reads the same shared rules
// and the same code table as the server, so a message cannot differ between sides.
// Paths are written as the route table writes them, with the trailing slash, so a screen
// and the report name the same path.
import codes from '../../../shared/codes.json';

export type Envelope = { code: string; message: string; data: unknown | null };

const DEFAULT_BASE = 'http://127.0.0.1:5000/it4788';

// The base is a device setting, not a build constant. The dev route to the phone is a tunnel
// whose address changes every run, so a value fixed at build time cannot reach the server.
let base = process.env.API_BASE || DEFAULT_BASE;

export function baseUrl(): string {
  return base;
}

export function setBase(next: string): void {
  base = next && next.trim() ? next.trim() : DEFAULT_BASE;
}

export function messageFor(code: string): string {
  return (codes as Record<string, string>)[code] || (codes as Record<string, string>)['00114'];
}

// The one notice rule (D108): a screen shows a sentence, never a code. Rule 9 of the
// course's Mobile HCI list words an error in plain language and says to avoid overusing
// codes, and Bài tập 06 lists "use the interface to debug" as not a design principle.
// The code stays where it is read as data: the Postman collection, the integration log,
// the admin page. `bad` is the colour rule (rule 2): red for a call that did not work.
export type Note = { text: string; bad: boolean };

export function notice(out: { code: string; message?: string; status?: number }): Note {
  const text = out.message && out.message.trim() ? out.message.trim() : messageFor(out.code);
  const bad = out.status === undefined ? false : out.status === 0 || out.status >= 400;
  return { text, bad };
}

export type RequestOptions = {
  method?: 'get' | 'post' | 'put' | 'delete';
  body?: unknown;
  token?: string | null;
  offline?: boolean;
  requestId?: string | null;
};

// Offline rule (D38): read only. A write is queued by the caller, not sent here.
// A server that cannot be reached answers the same code as the offline switch, so the
// caller has one rule to follow, not two.
export async function request(path: string, options: RequestOptions = {}): Promise<Envelope & { status: number; queued?: boolean }> {
  const method = options.method || 'get';
  if (options.offline && method !== 'get') {
    return { code: '00008', message: messageFor('00008'), data: null, status: 0, queued: true };
  }
  try {
    const response = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...(options.token ? { authorization: `Bearer ${options.token}` } : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const envelope = (await response.json()) as Envelope;
    return { ...envelope, status: response.status, message: envelope.message || messageFor(envelope.code) };
  } catch {
    return { code: '00008', message: messageFor('00008'), data: null, status: 0 };
  }
}

export { DEFAULT_BASE };
