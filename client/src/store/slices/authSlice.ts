import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  token: string | null;
  user: { id: string; email: string; name: string; role: 'admin' | 'agent' } | null;
  error: string | null;
}

function getStoredToken(): string | null {
  try {
    return localStorage.getItem('crm_token');
  } catch {
    return null;
  }
}

function getStoredUser(): AuthState['user'] {
  try {
    const storedUser = localStorage.getItem('crm_user');
    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    return null;
  }
}

const initialState: AuthState = {
  token: getStoredToken(),
  user: getStoredUser(),
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
