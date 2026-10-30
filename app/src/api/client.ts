// API client rule (Minh, app shell): one client, and it reads the same shared rules
// and the same code table as the server, so a message cannot differ between sides.
// Paths are written as the route table writes them, with the trailing slash, so a screen
// and the report name the same path.
import codes from '../../../shared/codes.json';

export type Envelope = { code: string; message: string; data: unknown | null };

const DEFAULT_BASE = 'http://127.0.0.1:5000/it4788';

// The base is the client's, not the person's (D100, patched 2026-10-30). A screen has no field
// for it: a person testing the app cannot know which host the server sits on, and a wrong one
// only produces a message they cannot act on. The phone reaches this machine through the
// forwarded ports, so the loopback address is the right default (D110); a run that needs another
// host sets API_BASE before the client starts.
const base = process.env.API_BASE || DEFAULT_BASE;

export function baseUrl(): string {
  return base;
}

export function messageFor(code: string): string {
  return (codes as Record<string, string>)[code] || (codes as Record<string, string>)['00114'];
}

// The one notice rule (D108): a screen shows a sentence, never a code. Rule 9 of the
// course's Mobile HCI list words an error in plain language and says to avoid overusing
// codes, and Bài tập 06 lists "use the interface to debug" as not a design principle.
// The code stays where it is read as data: the Postman collection, the integration log,
// the admin page. `bad` is the colour rule (rule 2): red for a call that did not work.
//
// A notice is an event, not a sentence left standing on the screen (rule added 2026-10-30):
// `at` is the moment the message was made. The same sentence twice still gives two different
// notes, so the line a person reads is the answer to what they just typed, and the shared
// Notice runs its fade again for each one. Without this, a second wrong password leaves the
// first error on screen and nothing tells the person the app read the new one.
export type Note = { text: string; bad: boolean; at: number };

let lastStamp = 0;

// One way to write a notice, for the server's sentence and for the screen's own: every message
// that appears carries the moment it was made. The stamp only moves forward, so two messages
// made in the same millisecond are still two messages.
export function makeNote(text: string, bad = false): Note {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return { text, bad, at: lastStamp };
}

export function notice(out: { code: string; message?: string; status?: number }): Note {
  const text = out.message && out.message.trim() ? out.message.trim() : messageFor(out.code);
  const bad = out.status === undefined ? false : out.status === 0 || out.status >= 400;
  return makeNote(text, bad);
}

// A call that worked is shown as the screen's state, not as a message: the list, the count and
// the queue line already say it. Only a call that failed gets a line (rule 8, one job per
// screen). It also keeps the app out of the spec table's generic wording, which says
// "tủ lạnh"; the app's copy is about tủ lành.
export function failure(out: { code: string; message?: string; status?: number }): Note {
  const n = notice(out);
  return n.bad ? n : makeNote('', false);
}
export type RequestOptions = {
  method?: 'get' | 'post' | 'put' | 'delete';
  body?: unknown;
  token?: string | null;
  offline?: boolean;
  requestId?: string | null;
};

// Renewal rule (D117): these are the codes that mean the access token itself is no longer
// valid. The session registers a renewer, and a call that comes back with one of these
// codes is sent once more with the renewed token. The renewal is the session's job, not the
// client's — the client only hands the failed call back. If the renewer answers null, the
// session is over and the caller keeps the server's sentence.
export const EXPIRED = ['00011', '00012', '00055', '00062'];
export type Renewer = () => Promise<string | null>;

let renewer: Renewer | null = null;
export function setRenewer(fn: Renewer | null): void {
  renewer = fn;
}

// The wire call. No renewal here: one fetch, one answer, or the offline/no-route code.
export async function rawRequest(path: string, options: RequestOptions = {}): Promise<Envelope & { status: number; queued?: boolean }> {
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

export async function request(path: string, options: RequestOptions = {}): Promise<Envelope & { status: number; queued?: boolean }> {
  const out = await rawRequest(path, options);
  if (out.code && EXPIRED.includes(out.code) && options.token && renewer) {
    const next = await renewer();
    if (next) return rawRequest(path, { ...options, token: next });
  }
  return out;
}

export { DEFAULT_BASE };
