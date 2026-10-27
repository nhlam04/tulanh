// Token storage (D30): AsyncStorage is unencrypted, so the token goes to the system
// key store. This file is the only place that touches it.
export type TokenStore = {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
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
      return row ? row.password : null;
    },
    async set(token: string) {
      await keychain.setGenericPassword('token', token, { service });
    },
    async clear() {
      await keychain.resetGenericPassword({ service });
    },
  };
}
