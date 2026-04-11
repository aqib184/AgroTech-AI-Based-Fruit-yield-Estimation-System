import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  bootstrapped: boolean;
};

const initialState: AuthState = {
  accessToken: null,
  refreshToken: null,
  bootstrapped: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{ access: string; refresh: string } | null>
    ) {
      if (!action.payload) {
        state.accessToken = null;
        state.refreshToken = null;
      } else {
        state.accessToken = action.payload.access;
        state.refreshToken = action.payload.refresh;
      }
    },
    setAccessToken(state, action: PayloadAction<string | null>) {
      state.accessToken = action.payload;
    },
    setBootstrapped(state, action: PayloadAction<boolean>) {
      state.bootstrapped = action.payload;
    },
  },
});

export const { setCredentials, setAccessToken, setBootstrapped } = authSlice.actions;
export default authSlice.reducer;
