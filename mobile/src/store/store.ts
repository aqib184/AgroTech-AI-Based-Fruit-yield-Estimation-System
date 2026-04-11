import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { agroApi } from '@/api/agroApi';
import authReducer from './authSlice';
import predictionReducer from './predictionSlice';

const reducer = combineReducers({
  [agroApi.reducerPath]: agroApi.reducer,
  auth: authReducer,
  prediction: predictionReducer,
});

export const store = configureStore({
  reducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }).concat(agroApi.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof reducer>;
export type AppDispatch = typeof store.dispatch;
