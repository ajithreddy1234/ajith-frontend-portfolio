import { basketActions } from "./store.js";
export async function api(path, body, method = "POST") {
  const response = await fetch("/api/atelier/" + path, {
    method: body === undefined ? "GET" : method,
    signal: AbortSignal.timeout(20000),
    headers: body === undefined ? {} : { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(data.error || "Please try again."), {
      status: response.status,
      data,
    });
  return data;
}
export function createBasketSync(store, onChange) {
  let version = 0,
    saved = "",
    enabled = false,
    applying = false,
    timer,
    inflight = null,
    stopped = false;
  const fingerprint = () => JSON.stringify(store.getState().basket);
  function apply(data) {
    applying = true;
    version = data.cart.version;
    store.dispatch(basketActions.replace(data.cart));
    saved = fingerprint();
    applying = false;
    enabled = true;
    onChange({ status: "saved", customer: data.customer, error: "" });
  }
  async function reload() {
    enabled = false;
    onChange({ status: "loading" });
    try {
      apply(await api("session"));
      return true;
    } catch (error) {
      onChange({ status: "error", error: error.message });
      return false;
    }
  }
  async function flush() {
    clearTimeout(timer);
    if (inflight) return inflight;
    if (!enabled) return false;
    if (saved === fingerprint()) return true;
    inflight = (async () => {
      try {
        while (saved !== fingerprint() && !stopped) {
          const snapshot = store.getState().basket,
            key = JSON.stringify(snapshot);
          onChange({ status: "saving" });
          const data = await api("cart", { ...snapshot, version }, "PUT");
          version = data.cart.version;
          saved = key;
        }
        onChange({ status: "saved", error: "" });
        return true;
      } catch (error) {
        if (error.status === 409 && error.data.cart) {
          apply(error.data);
          onChange({ status: "conflict", error: error.message });
        } else onChange({ status: "error", error: error.message });
        return false;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }
  const unsubscribe = store.subscribe(() => {
    if (enabled && !applying && !stopped) {
      onChange({ status: "saving" });
      clearTimeout(timer);
      timer = setTimeout(flush, 300);
    }
  });
  function stop() {
    stopped = true;
    clearTimeout(timer);
    unsubscribe();
  }
  return {
    reload,
    flush,
    apply,
    stop,
    retry: () => (enabled ? flush() : reload()),
  };
}
