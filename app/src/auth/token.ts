// Token storage (D30): AsyncStorage is unencrypted, so the token goes to the system
// key store. This file is the only place that touches it.
//
// The store keeps the pair (D117): the access token for calls and the refresh token that
// renews it. A session left overnight keeps its access token expired but its refresh
// token valid, so the session can come back without a second login. An entry written
// before the pair existed is a bare access token; it is read back as { access, refresh: null }.
export type TokenPair = { access: string; refresh: string | null };

export type TokenStore = {
  get(): Promise<TokenPair | null>;
  set(access: string, refresh: string | null): Promise<void>;
  clear(): Promise<void>;
};

// In the app, `keychain` is react-native-keychain. A test passes a plain object. The write
// calls answer with whatever the key store reports; the rule only needs the call to happen.
export function tokenStore(keychain: {
  getGenericPassword: (options: { service: string }) => Promise<{ password: string } | false>;
  setGenericPassword: (user: string, password: string, options: { service: string }) => Promise<unknown>;
  resetGenericPassword: (options: { service: string }) => Promise<unknown>;
}): TokenStore {
  const service = 'tulanh-token';
  return {
    async get() {
      const row = await keychain.getGenericPassword({ service });
      if (!row) return null;
      try {
        const pair = JSON.parse(row.password) as { access?: string; refresh?: string | null };
        if (pair && typeof pair.access === 'string' && pair.access) {
          return { access: pair.access, refresh: typeof pair.refresh === 'string' ? pair.refresh : null };
        }
      } catch {
        // Not the pair shape: the legacy entry is a bare access token.
      }
      return { access: row.password, refresh: null };
    },
    async set(access, refresh) {
      await keychain.setGenericPassword('token', JSON.stringify({ access, refresh: refresh || null }), { service });
    },
    async clear() {
      await keychain.resetGenericPassword({ service });
    },
  };
}
