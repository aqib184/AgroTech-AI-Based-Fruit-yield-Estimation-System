import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { YieldPredictResponse } from '@/api/types';

type PredictionState = {
  lastResult: YieldPredictResponse | null;
};

const initialState: PredictionState = {
  lastResult: null,
};

const predictionSlice = createSlice({
  name: 'prediction',
  initialState,
  reducers: {
    setLastYieldResult(state, action: PayloadAction<YieldPredictResponse | null>) {
      state.lastResult = action.payload;
    },
  },
});

export const { setLastYieldResult } = predictionSlice.actions;
export default predictionSlice.reducer;
