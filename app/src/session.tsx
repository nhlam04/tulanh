// Session rule (Minh, app shell): one place holds the token, the device database and the
// offline switch. A screen reads from here; no screen owns a token. The server address is not
// held here either — it belongs to the client (D100) — the session only shows what the client
// is using.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Keychain from 'react-native-keychain';
import type { Socket } from 'socket.io-client';
import { tokenStore } from './auth/token';
import { openQueueDb } from './offline/db';
import { init as initQueue, type QueueDb } from './offline/queue';
import { startShell } from './shell';
import { baseUrl, rawRequest, request, setRenewer } from './api/client';

export type Session = {
  token: string | null;
  user: Record<string, unknown> | null;
  db: QueueDb;
  offline: boolean;
  base: string;
  lastEvent: { name: string; payload: unknown } | null;
  setOffline(next: boolean): void;
  signIn(access: string, refresh?: string | null): Promise<void>;
  signOut(): Promise<void>;
  reload(): Promise<void>;
};

const empty = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [offline, setOffline] = useState(false);
  const [lastEvent, setLastEvent] = useState<{ name: string; payload: unknown } | null>(null);
  const base = baseUrl();
  const store = useMemo(() => tokenStore(Keychain), []);
  const db = useMemo(() => {
    const handle = openQueueDb();
    initQueue(handle);
    return handle;
  }, []);
  const connection = useRef<Socket | null>(null);

  const readProfile = useCallback(async (current: string | null) => {
    if (!current) {
      setUser(null);
      return;
    }
    const out = await request('/user/', { token: current });
    setUser(out.code === '00089' ? ((out.data as { user: Record<string, unknown> })?.user ?? null) : null);
  }, []);

  useEffect(() => {
    store.get().then(async (pair) => {
      if (!pair) return;
      setToken(pair.access);
      setRefreshToken(pair.refresh);
      await readProfile(pair.access);
    });
  }, [store, readProfile]);

  // Renewal (D117): when the server says the access token is spent, the session asks the
  // refresh token for a new pair, once. The lock keeps a burst of expired calls behind one
  // refresh; the server rotates the refresh token, so every answer stores the new pair.
  // If the refresh itself is refused, the session is really over: the pair is cleared and
  // the screens see the signed-out state.
  useEffect(() => {
    let inflight: Promise<string | null> | null = null;
    setRenewer(async () => {
      if (!refreshToken) return null;
      if (!inflight) {
        inflight = (async () => {
          const out = await rawRequest('/user/refresh-token/', { method: 'post', body: { refreshToken } });
          if (out.code === '00065') {
            const pair = (out.data as { accessToken: string; refreshToken: string });
            await store.set(pair.accessToken, pair.refreshToken);
            setToken(pair.accessToken);
            setRefreshToken(pair.refreshToken);
            return pair.accessToken;
          }
          await store.clear();
          setToken(null);
          setRefreshToken(null);
          setUser(null);
          return null;
        })().finally(() => {
          inflight = null;
        });
      }
      return inflight;
    });
    return () => setRenewer(null);
  }, [refreshToken, store]);

  useEffect(() => {
    if (!token) {
      connection.current?.close();
      connection.current = null;
      return;
    }
    const shell = startShell({
      db,
      token,
      onEvent: (name, payload) => setLastEvent({ name, payload }),
    });
    shell.then((socket) => {
      connection.current = socket;
    });
    return () => {
      connection.current?.close();
      connection.current = null;
    };
  }, [db, token]);

  const value: Session = {
    token,
    user,
    db,
    offline,
    base,
    lastEvent,
    setOffline,
    async signIn(access, refresh = null) {
      await store.set(access, refresh);
      setToken(access);
      setRefreshToken(refresh);
      await readProfile(access);
    },
    async signOut() {
      await request('/user/logout/', { method: 'post', token });
      await store.clear();
      setToken(null);
      setUser(null);
    },
    async reload() {
      await readProfile(token);
    },
  };

  return React.createElement(empty.Provider, { value }, children);
}

export function useSession(): Session {
  const session = useContext(empty);
  if (!session) throw new Error('a screen needs the session provider');
  return session;
}
