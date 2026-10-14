import { configureStore } from '@reduxjs/toolkit';
import authReducer from './auth-slice';

export function makeStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
    },
  });
}