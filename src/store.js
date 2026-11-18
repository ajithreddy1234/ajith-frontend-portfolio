import { configureStore, createSlice } from '@reduxjs/toolkit';
const chat = createSlice({
  name: 'chat',
  initialState: { turns: [] },
  reducers: {
    record(state, { payload }) {
      state.turns = [...state.turns.slice(-19), payload];
    },
    reset() {
      return { turns: [] };
    },
  },
});

const storageKey = 'atelier-edit:v1';

function restoreBasket() {
  try {
    const saved = JSON.parse(globalThis.localStorage.getItem(storageKey));
    const savedLines = Array.isArray(saved?.lines) ? saved.lines : [];
    const lines = savedLines.filter((line) =>
      typeof line?.productId === 'string' && typeof line.variant === 'string'
      && Number.isInteger(line.quantity) && line.quantity >= 1 && line.quantity <= 9
    );
    const savedIds = Array.isArray(saved?.savedIds) ? saved.savedIds.filter((id) => typeof id === 'string') : [];
    return { lines, savedIds: [...new Set(savedIds)] };
  } catch {
    return { lines: [], savedIds: [] };
  }
}

const basket = createSlice({
  name: 'basket',
  initialState: restoreBasket,
  reducers: {
    add(state, { payload: { productId, variant } }) {
      const line = state.lines.find((item) => item.productId === productId && item.variant === variant);
      if (line) {
        line.quantity = Math.min(9, line.quantity + 1);
      } else {
        state.lines.push({ productId, variant, quantity: 1 });
      }
    },
    setQuantity(state, { payload: { productId, variant, quantity } }) {
      const index = state.lines.findIndex((item) => item.productId === productId && item.variant === variant);
      if (index < 0) return;
      if (quantity <= 0) {
        state.lines.splice(index, 1);
      } else {
        state.lines[index].quantity = Math.min(9, quantity);
      }
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

export const chatActions = chat.actions;
export const basketActions = basket.actions;
export const portfolioStore = () => configureStore({ reducer: { chat: chat.reducer } });
export function storefrontStore() {
  const store = configureStore({ reducer: { basket: basket.reducer } });
  store.subscribe(() => {
    try {
      globalThis.localStorage.setItem(storageKey, JSON.stringify(store.getState().basket));
    } catch {
      // Keep the current session usable if browser storage is unavailable.
    }
  });
  return store;
}
