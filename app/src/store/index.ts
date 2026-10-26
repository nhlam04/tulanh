// State layer (D45): Redux Toolkit, one store, one slice per feature.
import { configureStore, createSlice } from '@reduxjs/toolkit';

const emptyList = { items: [] as Record<string, unknown>[], source: 'network' as 'network' | 'cache' };

const authSlice = createSlice({
  name: 'auth',
  initialState: { token: null as string | null, user: null as Record<string, unknown> | null },
  reducers: { setToken: (state, action) => { state.token = action.payload; }, setUser: (state, action) => { state.user = action.payload; } },
});

const featureSlice = (name: string) => createSlice({
  name,
  initialState: emptyList,
  reducers: {
    replace: (state, action) => { state.items = action.payload; state.source = action.payload ? 'network' : 'cache'; },
    useCache: (state, action) => { state.items = action.payload; state.source = 'cache'; },
  },
});

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    group: featureSlice('group').reducer,
    food: featureSlice('food').reducer,
    fridge: featureSlice('fridge').reducer,
    shopping: featureSlice('shopping').reducer,
  },
});

export { authSlice };
