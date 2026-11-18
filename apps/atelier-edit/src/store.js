import { configureStore, createSlice } from "@reduxjs/toolkit";
const basket = createSlice({
  name: "basket",
  initialState: { lines: [], savedIds: [] },
  reducers: {
    replace: (_, action) => ({
      lines: action.payload.lines,
      savedIds: action.payload.savedIds,
    }),
    add(state, { payload: { productId, variant } }) {
      const line = state.lines.find(
        (x) => x.productId === productId && x.variant === variant,
      );
      if (line) line.quantity = Math.min(9, line.quantity + 1);
      else state.lines.push({ productId, variant, quantity: 1 });
    },
    setQuantity(state, { payload: { productId, variant, quantity } }) {
      const index = state.lines.findIndex(
        (x) => x.productId === productId && x.variant === variant,
      );
      if (index < 0) return;
      if (quantity <= 0) state.lines.splice(index, 1);
      else state.lines[index].quantity = Math.min(9, quantity);
    },
    clearBag(state) {
      state.lines = [];
    },
    toggleSaved(state, { payload: id }) {
      const index = state.savedIds.indexOf(id);
      if (index < 0) state.savedIds.push(id);
      else state.savedIds.splice(index, 1);
    },
  },
});
export const basketActions = basket.actions;
export const storefrontStore = () =>
  configureStore({ reducer: { basket: basket.reducer } });
