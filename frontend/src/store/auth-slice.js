import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api, { setAuthToken } from '@/services/api';

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  initialized: false,
  status: 'idle',
  error: null,
};

export const restoreAuth = createAsyncThunk('auth/restore', async (_, { rejectWithValue }) => {
  const token = window.sessionStorage.getItem('purebazar.authToken');
  if (!token) {
    setAuthToken(null);
    return null;
  }

  setAuthToken(token);
  try {
    const { data } = await api.get('/auth/me');
    return { token, user: data.user };
  } catch (error) {
    setAuthToken(null);
    window.sessionStorage.removeItem('purebazar.authToken');
    if (error.response?.status === 401) return null;
    return rejectWithValue(error.response?.data?.message || 'Unable to verify your session. Check your connection and try again.');
  }
});

export const loginUser = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/auth/login', credentials);
    setAuthToken(data.token);
    window.sessionStorage.setItem('purebazar.authToken', data.token);
    return data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Unable to sign in. Check your connection and try again.');
  }
});

export const logoutUser = createAsyncThunk('auth/logout', async (_, { getState, rejectWithValue }) => {
  try {
    const token = getState().auth.token;
    await api.post('/auth/logout', null, { headers: { Authorization: `Bearer ${token}` } });
    setAuthToken(null);
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Unable to sign out. Please try again.');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuthError(state) {
      state.error = null;
      if (state.status === 'failed') state.status = 'idle';
    },
  },
  extraReducers(builder) {
    builder
      .addCase(restoreAuth.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(restoreAuth.fulfilled, (state, action) => {
        state.initialized = true;
        state.status = action.payload ? 'succeeded' : 'idle';
        state.user = action.payload?.user || null;
        state.token = action.payload?.token || null;
        state.isAuthenticated = Boolean(action.payload);
      })
      .addCase(restoreAuth.rejected, (state, action) => {
        state.initialized = true;
        state.status = 'failed';
        state.error = action.payload || action.error.message;
      })
      .addCase(loginUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.initialized = true;
        state.status = 'succeeded';
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message;
      })
      .addCase(logoutUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(logoutUser.fulfilled, () => ({ ...initialState, initialized: true }))
      .addCase(logoutUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error.message;
      });
  },
});

export const { clearAuthError } = authSlice.actions;
export default authSlice.reducer;