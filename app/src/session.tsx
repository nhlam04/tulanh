// Session rule (Minh, app shell): one place holds the token, the device database, the
// server address and the offline switch. A screen reads from here; no screen owns a token.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Keychain from 'react-native-keychain';
import type { Socket } from 'socket.io-client';
import { tokenStore } from './auth/token';
import { openQueueDb } from './offline/db';
import { init as initQueue, type QueueDb } from './offline/queue';
import { startShell } from './shell';
import { baseUrl, request, setBase } from './api/client';
import { BASE_URL_KEY, initSettings, readSetting, writeSetting } from './settings';

export type Session = {
  token: string | null;
  user: Record<string, unknown> | null;
  db: QueueDb;
  offline: boolean;
  base: string;
  setBase(next: string): void;
  setOffline(next: boolean): void;
  signIn(token: string): Promise<void>;
  signOut(): Promise<void>;
  reload(): Promise<void>;
};

const empty = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [offline, setOffline] = useState(false);
  const [base, setBaseState] = useState(baseUrl());
  const store = useMemo(() => tokenStore(Keychain), []);
  const db = useMemo(() => {
    const handle = openQueueDb();
    initQueue(handle);
    initSettings(handle);
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
    // The address typed last time is read first, so the profile read below goes to the server
    // that address names instead of the built-in default (D100).
    const saved = readSetting(db, BASE_URL_KEY);
    if (saved) {
      setBase(saved);
      setBaseState(saved);
    }
    store.get().then(async (t) => {
      setToken(t);
      await readProfile(t);
    });
  }, [db, store, readProfile]);

  useEffect(() => {
    if (!token) {
      connection.current?.close();
      connection.current = null;
      return;
    }
    const shell = startShell({ db, token });
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
    setBase(next: string) {
      setBase(next);
      const current = baseUrl();
      writeSetting(db, BASE_URL_KEY, current);
      setBaseState(current);
    },
    setOffline,
    async signIn(next: string) {
      await store.set(next);
      setToken(next);
      await readProfile(next);
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
