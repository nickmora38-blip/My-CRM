import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  token: string | null;
  user: { id: string; email: string; name: string; role: 'admin' | 'agent' } | null;
  error: string | null;
}

const storedUser = localStorage.getItem('crm_user');
let parsedUser: AuthState['user'] = null;
try {
  parsedUser = storedUser ? JSON.parse(storedUser) : null;
} catch {
  parsedUser = null;
}

const initialState: AuthState = {
  token: localStorage.getItem('crm_token'),
  user: parsedUser,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth(state, action: PayloadAction<{ token: string; user: { id: string; email: string; name: string; role: 'admin' | 'agent' } }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.error = null;
      localStorage.setItem('crm_token', action.payload.token);
      localStorage.setItem('crm_user', JSON.stringify(action.payload.user));
    },
    setError(state, action: PayloadAction<string>) {
      state.error = action.payload;
    },
    logout(state) {
      state.token = null;
      state.user = null;
      state.error = null;
      localStorage.removeItem('crm_token');
      localStorage.removeItem('crm_user');
    },
  },
});

export const { setAuth, setError, logout } = authSlice.actions;
export default authSlice.reducer;
