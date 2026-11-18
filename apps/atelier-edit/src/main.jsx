import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Provider, useDispatch, useSelector, useStore } from "react-redux";
import "@fontsource-variable/dm-sans";
import "./styles.css";
import "./atelier.css";
import { basketActions, storefrontStore } from "./store.js";
import { deliveryOptions } from "./atelier-delivery.js";
import { api, createBasketSync } from "./api.js";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const categories = ["All", "Rings", "Earrings", "Necklaces"];
const catalogueUrl = "/api/atelier/catalogue";
const ordersUrl = "/api/atelier/orders";
const checkoutKey = "atelier-edit:checkout";

function Modal({ title, children, onClose, busy = false }) {
  const dialog = useRef(null);

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="dialog-title"
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <div className="dialog-top">
        <h2 id="dialog-title">{title}</h2>
        <button
          type="button"
          className="shop-secondary"
          aria-label={"Close " + title}
          disabled={busy}
          onClick={() => dialog.current.close()}
        >
          Close
        </button>
      </div>
      {children}
    </dialog>
  );
}

function ProductDetails({ product, onClose, onAdd, embedded = false }) {
  const [variant, setVariant] = useState("");
  const content = (
    <div className="detail-grid">
      <img src={"/" + product.image} alt={product.name} />
      <div>
        <p className="shop-muted">{product.material}</p>
        <p>{product.description}</p>
        <p className="item-price">{money.format(product.price)}</p>
        <dl className="piece-details">
          <div>
            <dt>Finish</dt>
            <dd>{product.finish}</dd>
          </div>
          <div>
            <dt>Collection</dt>
            <dd>{product.category}</dd>
          </div>
        </dl>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (product.variants.includes(variant)) onAdd(product, variant);
          }}
        >
          <label htmlFor="variant">Choose a variant</label>
          <select
            id="variant"
            required
            value={variant}
            onChange={(event) => setVariant(event.target.value)}
          >
            <option value="">Select an option</option>
            {product.variants.map((item) => (
              <option
                key={item}
                value={item}
                disabled={product.inventory?.[item] === 0}
              >
                {item}
                {product.inventory?.[item] === 0 ? " · Sold out" : ""}
              </option>
            ))}
          </select>
          {variant && product.inventory && (
            <p className="shop-muted stock-note">
              {product.inventory[variant]} available
            </p>
          )}
          <button className="button" type="submit">
            Add to bag
          </button>
        </form>
      </div>
    </div>
  );
  return embedded ? (
    <section className="product-page">
      <a className="back-link" href="/#collection">
        ← Back to the collection
      </a>
      <p className="label">{product.category} · The first edit</p>
      <h1>{product.name}</h1>
      {content}
      <div className="piece-care">
        <h2>Made for everyday rituals.</h2>
        <p>
          Store separately in a soft pouch. Keep away from perfume, water, and
          cleaning products. Wipe gently with a dry cloth.
        </p>
        <p className="shop-muted">
          Fictional collection · Sample products and prices. Product imagery was
          generated for this project.
        </p>
      </div>
    </section>
  ) : (
    <Modal title={product.name} onClose={onClose}>
      {content}
    </Modal>
  );
}

function idForCheckout(lines, delivery, lastRequest) {
  const signature = JSON.stringify({ lines, delivery });
  if (lastRequest.current?.signature === signature)
    return lastRequest.current.id;
  try {
    const stored = JSON.parse(sessionStorage.getItem(checkoutKey));
    if (stored?.signature === signature) {
      lastRequest.current = stored;
      return stored.id;
    }
  } catch {
    // The in-memory reference still supports retries in this tab.
  }
  const pending = { signature, id: crypto.randomUUID() };
  lastRequest.current = pending;
  try {
    sessionStorage.setItem(checkoutKey, JSON.stringify(pending));
  } catch {
    /* optional */
  }
  return pending.id;
}

function Receipt({ order }) {
  const option = deliveryOptions[order.delivery];
  return (
    <div className="order-receipt">
      <p className="label">
        {order.status === "cancelled" ? "Order cancelled" : "Order confirmed"}
      </p>
      <p className="order-reference">
        Order {order.id.slice(0, 8).toUpperCase()}
      </p>
      <ul>
        {order.lines.map((line) => (
          <li key={line.productId + ":" + line.variant}>
            <span>
              {line.name} · {line.variant} × {line.quantity}
            </span>
            <strong>{money.format(line.price * line.quantity)}</strong>
          </li>
        ))}
      </ul>
      <div className="bag-total">
        <span>{option.label} delivery</span>
        <span>{money.format(order.shipping)}</span>
      </div>
      <div className="bag-total">
        <strong>Demo total</strong>
        <strong>{money.format(order.total)}</strong>
      </div>
    </div>
  );
}

function Bag({ products, lines, onClose, onOrdered, onBeforeCheckout }) {
  const dispatch = useDispatch();
  const [delivery, setDelivery] = useState("standard");
  const [checkout, setCheckout] = useState(false);
  const [pending, setPending] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState("");
  const lastRequest = useRef(null);
  const items = lines.flatMap((line) => {
    const product = products.find(
      (item) =>
        item.id === line.productId && item.variants.includes(line.variant),
    );
    return product ? [{ ...line, product }] : [];
  });
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.product.price,
    0,
  );
  const soldOut = items.some(
    ({ product, variant, quantity }) =>
      typeof product.inventory?.[variant] === "number" &&
      quantity > product.inventory[variant],
  );

  async function placeOrder(event) {
    event.preventDefault();
    if (pending || soldOut) return;
    setPending(true);
    setError("");
    const requestLines = items.map(({ productId, variant, quantity }) => ({
      productId,
      variant,
      quantity,
    }));
    const requestId = idForCheckout(requestLines, delivery, lastRequest);
    try {
      if (!(await onBeforeCheckout()))
        throw new Error(
          "Your bag has not synced. Close checkout and retry saving your bag.",
        );
      const response = await fetch(ordersUrl, {
        method: "POST",
        signal: AbortSignal.timeout(20_000),
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId, delivery, lines: requestLines }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Checkout is unavailable. Try again.");
      setReceipt(result.order);
      try {
        sessionStorage.removeItem(checkoutKey);
      } catch {
        /* optional */
      }
      await onOrdered();
    } catch (failure) {
      setError(
        failure instanceof SyntaxError
          ? "Checkout is unavailable. Try again."
          : failure.message,
      );
    } finally {
      setPending(false);
    }
  }

  const title = receipt
    ? "Order confirmation"
    : checkout
      ? "Demo checkout"
      : "Your bag";
  return (
    <Modal title={title} onClose={onClose} busy={pending}>
      {receipt ? (
        <Receipt order={receipt} />
      ) : items.length === 0 ? (
        <p className="shop-muted">
          Your bag is empty. Choose a piece from the collection to get started.
        </p>
      ) : (
        <>
          <ul className="bag-list">
            {items.map(({ productId, variant, quantity, product }) => {
              const stock = product.inventory?.[variant] ?? 9;
              return (
                <li key={productId + "|" + variant}>
                  <img
                    src={"/" + product.image}
                    alt=""
                    width="58"
                    height="58"
                  />
                  <div>
                    <strong>{product.name}</strong>
                    <span>
                      {variant} · {money.format(product.price * quantity)}
                    </span>
                    {quantity > stock && (
                      <span className="order-error">
                        Only {stock} available
                      </span>
                    )}
                  </div>
                  {checkout ? (
                    <span>Qty {quantity}</span>
                  ) : (
                    <div className="quantity">
                      <button
                        type="button"
                        aria-label={"Decrease " + product.name + " " + variant}
                        onClick={() =>
                          dispatch(
                            basketActions.setQuantity({
                              productId,
                              variant,
                              quantity: quantity - 1,
                            }),
                          )
                        }
                      >
                        −
                      </button>
                      <span aria-label="Quantity">{quantity}</span>
                      <button
                        type="button"
                        aria-label={"Increase " + product.name + " " + variant}
                        disabled={quantity >= Math.min(9, stock)}
                        onClick={() =>
                          dispatch(
                            basketActions.setQuantity({
                              productId,
                              variant,
                              quantity: quantity + 1,
                            }),
                          )
                        }
                      >
                        +
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="bag-total">
            <strong>Subtotal</strong>
            <strong>{money.format(subtotal)}</strong>
          </div>
          {checkout ? (
            <form onSubmit={placeOrder} className="order-form">
              <fieldset disabled={pending}>
                <legend>Delivery option</legend>
                {Object.entries(deliveryOptions).map(([code, option]) => (
                  <label key={code} className="delivery-option">
                    <input
                      type="radio"
                      name="delivery"
                      value={code}
                      checked={delivery === code}
                      onChange={() => setDelivery(code)}
                    />
                    <span>
                      {option.label} · {option.days}
                    </span>
                    <strong>{money.format(option.fee)}</strong>
                  </label>
                ))}
              </fieldset>
              <div className="bag-total">
                <strong>Demo total</strong>
                <strong>
                  {money.format(subtotal + deliveryOptions[delivery].fee)}
                </strong>
              </div>
              <p className="shop-muted">
                This checkout records a demo order. No payment or shipping
                details are collected.
              </p>
              {error && (
                <p className="order-error" role="alert">
                  {error}
                </p>
              )}
              <div className="order-actions">
                <button
                  type="button"
                  className="shop-secondary"
                  disabled={pending}
                  onClick={() => setCheckout(false)}
                >
                  Back to bag
                </button>
                <button
                  type="submit"
                  className="button"
                  disabled={pending || soldOut}
                >
                  {pending ? "Placing order…" : "Place demo order"}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="button"
              disabled={soldOut}
              onClick={() => {
                setError("");
                setCheckout(true);
              }}
            >
              Demo checkout
            </button>
          )}
        </>
      )}
    </Modal>
  );
}

function OrderHistory({ onClose, onChanged }) {
  const [cancelling, setCancelling] = useState(null);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState("");
  const [events, setEvents] = useState({});
  async function cancel(id) {
    setPending(true);
    setActionError("");
    try {
      const data = await api("orders/" + id + "/cancel", {});
      setOrders((current) =>
        current.map((order) => (order.id === id ? data.order : order)),
      );
      setCancelling(null);
      setEvents((current) => ({ ...current, [id]: null }));
      await onChanged();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setPending(false);
    }
  }
  async function loadEvents(id) {
    if (events[id]) return;
    try {
      const data = await api("orders/" + id);
      setEvents((current) => ({ ...current, [id]: data.events }));
    } catch {
      setEvents((current) => ({
        ...current,
        [id]: [
          {
            event:
              "Order timeline could not load. Reopen your orders to retry.",
          },
        ],
      }));
    }
  }
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(ordersUrl, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Orders unavailable");
        const data = await response.json();
        setOrders(data.orders);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, []);

  return (
    <Modal title="Your orders" onClose={onClose} busy={pending}>
      {actionError && (
        <p className="order-error" role="alert">
          {actionError}
        </p>
      )}
      {error ? (
        <p role="alert">
          Order history is temporarily unavailable. Reopen it to try again.
        </p>
      ) : !orders ? (
        <p role="status">Loading orders…</p>
      ) : orders.length ? (
        <div className="order-history">
          {orders.map((order) => (
            <details
              key={order.id}
              onToggle={(event) => {
                if (event.currentTarget.open) loadEvents(order.id);
              }}
            >
              <summary>
                {order.id.slice(0, 8).toUpperCase()} ·{" "}
                {money.format(order.total)} ·{" "}
                {new Date(order.created_at).toLocaleDateString()}
              </summary>
              <Receipt order={order} />
              <ol className="order-timeline">
                {(events[order.id] || []).map((event, index) => (
                  <li key={index}>
                    {event.event}
                    {event.created_at && (
                      <time>{new Date(event.created_at).toLocaleString()}</time>
                    )}
                  </li>
                ))}
              </ol>
              {order.status !== "cancelled" &&
                (cancelling === order.id ? (
                  <div className="cancel-confirm">
                    <p>Cancel this demo order and return its items to stock?</p>
                    <button
                      className="shop-secondary"
                      disabled={pending}
                      onClick={() => setCancelling(null)}
                    >
                      Keep order
                    </button>
                    <button
                      className="button"
                      disabled={pending}
                      onClick={() => cancel(order.id)}
                    >
                      {pending ? "Cancelling…" : "Confirm cancellation"}
                    </button>
                  </div>
                ) : (
                  <button
                    className="shop-secondary"
                    onClick={() => setCancelling(order.id)}
                  >
                    Cancel order
                  </button>
                ))}
            </details>
          ))}
        </div>
      ) : (
        <p className="shop-muted">
          Your confirmed and cancelled demo orders will appear here. Sign in to
          keep your order history across devices.
        </p>
      )}
    </Modal>
  );
}

function Account({ customer, sync, onClose }) {
  const [mode, setMode] = useState("login"),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      if (!(await sync.flush()))
        throw new Error("Save your bag before switching accounts.");
      const data = await api("auth/" + mode, {
        username: form.get("username"),
        password: form.get("password"),
      });
      sync.apply(data);
      onClose();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setPending(false);
    }
  }
  async function logout() {
    setPending(true);
    setError("");
    try {
      if (!(await sync.flush()))
        throw new Error("Save your bag before signing out.");
      sync.apply(await api("auth/logout", {}));
      onClose();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal
      title={
        customer?.username
          ? "Your account"
          : mode === "login"
            ? "Welcome back"
            : "Make it your edit"
      }
      onClose={onClose}
      busy={pending}
    >
      {customer?.username ? (
        <div className="account-summary">
          <p className="label">Signed in as</p>
          <h3>{customer.username}</h3>
          <p>
            Your bag, saved pieces, and order history are stored with your
            account.
          </p>
          <button className="button" disabled={pending} onClick={logout}>
            {pending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : (
        <>
          <p className="shop-muted">
            Save your edit and return to it from another device. No email
            required. Demo accounts have no password recovery; use a unique
            password.
          </p>
          <form className="account-form" onSubmit={submit}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              pattern="[A-Za-z0-9_]{3,32}"
              minLength="3"
              maxLength="32"
              autoComplete="username"
              required
              disabled={pending}
            />
            <label htmlFor="password">Password · at least 12 characters</label>
            <input
              id="password"
              name="password"
              type="password"
              minLength="12"
              maxLength="128"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
              disabled={pending}
            />
            <button className="button" disabled={pending}>
              {pending
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>
          <button
            className="account-switch"
            disabled={pending}
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login"
              ? "New here? Create an account"
              : "Already have an account? Sign in"}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="order-error">
          {error}
        </p>
      )}
    </Modal>
  );
}

function ComparePieces({ products, onClose }) {
  return (
    <Modal title="Compare pieces" onClose={onClose}>
      <div className="compare-grid">
        {products.map((product) => (
          <article key={product.id}>
            <img src={"/" + product.image} alt="" />
            <h3>{product.name}</h3>
            <p>{money.format(product.price)}</p>
            <dl className="piece-details">
              <div>
                <dt>Material</dt>
                <dd>{product.material}</dd>
              </div>
              <div>
                <dt>Finish</dt>
                <dd>{product.finish}</dd>
              </div>
              <div>
                <dt>Variants</dt>
                <dd>{product.variants.join(", ")}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </Modal>
  );
}

export function Storefront() {
  const store = useStore();
  const [accountOpen, setAccountOpen] = useState(false);
  const [remote, setRemote] = useState({
    status: "loading",
    customer: null,
    error: "",
  });
  const sync = useRef(null);
  useEffect(() => {
    const service = createBasketSync(store, (patch) =>
      setRemote((current) => ({ ...current, ...patch })),
    );
    sync.current = service;
    service.reload();
    return () => service.stop();
  }, [store]);
  const ready = !!remote.customer;
  const pieceId = window.location.pathname.match(/^\/pieces\/([^/]+)\/?$/)?.[1];
  const dispatch = useDispatch();
  const { lines, savedIds } = useSelector((state) => state.basket);
  const [products, setProducts] = useState([]);
  const [request, setRequest] = useState({ status: "loading", attempt: 0 });
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("featured");
  const [budget, setBudget] = useState("");
  const [material, setMaterial] = useState("");
  const [compareIds, setCompareIds] = useState([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [savedOnly, setSavedOnly] = useState(
    new URLSearchParams(window.location.search).get("saved") === "1",
  );
  const [activeProduct, setActiveProduct] = useState(null);
  const [bagOpen, setBagOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const quantity = lines.reduce((sum, line) => sum + line.quantity, 0);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(catalogueUrl, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Catalogue unavailable");
        const catalog = await response.json();
        if (!Array.isArray(catalog)) throw new Error("Invalid catalogue");
        if (controller.signal.aborted) return;
        setProducts(catalog);
        setRequest((state) => ({ ...state, status: "ready" }));
      } catch {
        if (!controller.signal.aborted)
          setRequest((state) => ({ ...state, status: "error" }));
      }
    }
    load();
    return () => controller.abort();
  }, [request.attempt, ready]);

  const pageProduct = products.find((product) => product.id === pieceId);
  const needle = query.toLowerCase().trim();
  const visible = products.filter((product) => {
    const matchesText = [product.name, product.category, product.material].some(
      (value) => value.toLowerCase().includes(needle),
    );
    return (
      matchesText &&
      (!budget || product.price <= Number(budget)) &&
      (!material || product.material.toLowerCase().includes(material)) &&
      (category === "All" || category === product.category) &&
      (!savedOnly || savedIds.includes(product.id))
    );
  });
  if (sort === "low") visible.sort((a, b) => a.price - b.price);
  if (sort === "high") visible.sort((a, b) => b.price - a.price);

  function clearFilters() {
    setQuery("");
    setCategory("All");
    setBudget("");
    setMaterial("");
    setSavedOnly(false);
  }

  function openSaved() {
    if (pieceId) {
      window.location.href = "/?saved=1#collection";
      return;
    }
    clearFilters();
    setSavedOnly(!savedOnly);
    document.getElementById("collection")?.scrollIntoView({ block: "start" });
  }

  function toggleCompare(id) {
    setCompareIds((ids) =>
      ids.includes(id)
        ? ids.filter((item) => item !== id)
        : [...ids.slice(0, 2), id],
    );
  }

  function addToBag(product, variant) {
    const current = lines.find(
      (line) => line.productId === product.id && line.variant === variant,
    );
    if (
      (current?.quantity ?? 0) >= Math.min(9, product.inventory?.[variant] ?? 9)
    ) {
      setNotice(
        "Your bag already has the maximum quantity for " +
          product.name +
          " in " +
          variant +
          ".",
      );
    } else {
      dispatch(basketActions.add({ productId: product.id, variant }));
      setNotice(product.name + " · " + variant + " added to your bag.");
    }
    setActiveProduct(null);
  }

  return (
    <>
      <a className="skip" href="#collection">
        Skip to collection
      </a>
      <header className="shop-header">
        <div className="wrap shop-nav">
          <a href="/" className="atelier-brand">
            <img src="/atelier-mark.svg" alt="" width="35" height="35" />
            <span>Atelier Edit</span>
          </a>
          <div className="shop-nav-actions">
            <a className="collection-link" href="/#collection">
              Collection
            </a>
            <button
              className="shop-secondary"
              disabled={!ready}
              onClick={() => setAccountOpen(true)}
            >
              {remote.customer?.username || "Account"}
            </button>
            <button
              className="shop-secondary"
              type="button"
              aria-pressed={savedOnly}
              disabled={!ready}
              onClick={openSaved}
            >
              Saved ({savedIds.length})
            </button>
            <button
              className="shop-secondary bag-button"
              type="button"
              disabled={!ready}
              onClick={() => {
                setNotice("");
                setBagOpen(true);
              }}
            >
              Bag ({quantity})
            </button>
          </div>
        </div>
      </header>
      <main className="wrap shop-main" id="top">
        <div className="shop-service-bar">
          <span>Small forms. Everyday rituals.</span>
          <span>Demo store · No payments collected</span>
        </div>
        <div className="sync-status" role="status">
          <span>
            {remote.status === "loading"
              ? "Opening your saved bag…"
              : remote.status === "saving"
                ? "Saving your bag…"
                : remote.status === "saved"
                  ? remote.customer?.username
                    ? "Bag & saved pieces synced to your account"
                    : "Bag & saved pieces saved for this browser"
                  : remote.error}
          </span>
          {["error", "conflict"].includes(remote.status) && (
            <button
              className="shop-secondary"
              onClick={() => sync.current.retry()}
            >
              Retry
            </button>
          )}
        </div>
        {pieceId ? (
          request.status === "ready" ? (
            pageProduct ? (
              <>
                <ProductDetails
                  product={pageProduct}
                  embedded
                  onAdd={addToBag}
                />
                <p role="status" className={notice ? "shop-notice" : "sr-only"}>
                  {notice}{" "}
                  {notice && (
                    <button
                      className="shop-secondary"
                      onClick={() => setBagOpen(true)}
                    >
                      View bag
                    </button>
                  )}
                </p>
              </>
            ) : (
              <div className="shop-state">
                <h1>Piece not found</h1>
                <a href="/#collection">Browse the collection</a>
              </div>
            )
          ) : (
            <div className="shop-state" role="status">
              <p>
                {request.status === "error"
                  ? "The piece could not load."
                  : "Loading your piece…"}
              </p>
              {request.status === "error" && (
                <button
                  onClick={() =>
                    setRequest((state) => ({
                      ...state,
                      attempt: state.attempt + 1,
                    }))
                  }
                >
                  Retry
                </button>
              )}
            </div>
          )
        ) : (
          <>
            <div className="shop-hero">
              <div className="shop-hero-copy">
                <p className="label">The first edit</p>
                <h1>
                  Atelier Edit<span>.</span>
                </h1>
                <p>Gold forms, freshwater pearls, and pieces made to layer.</p>
                <a href="#collection" className="button shop-hero-cta">
                  Explore the collection <span aria-hidden="true">↓</span>
                </a>
              </div>
              <img
                src="/atelier-hero.webp"
                alt="Gold jewellery and freshwater pearl on textured limestone"
                fetchPriority="high"
              />
            </div>
            <section
              id="collection"
              className="collection"
              aria-labelledby="collection-title"
            >
              <div className="collection-heading">
                <div>
                  <p className="label">The collection</p>
                  <h2 id="collection-title">
                    {savedOnly ? "Saved pieces" : "Jewellery catalogue"}
                  </h2>
                </div>
                <p>Storefront demo · Sample products and prices</p>
              </div>
              <div className="category-tabs" aria-label="Categories">
                {categories.map((item) => (
                  <button
                    type="button"
                    key={item}
                    aria-pressed={category === item}
                    onClick={() => setCategory(item)}
                  >
                    {item === "All" ? "All pieces" : item}
                  </button>
                ))}
              </div>
              <div className="shop-tools">
                <div className="shop-search">
                  <label htmlFor="catalogue-search">
                    Search the collection
                  </label>
                  <input
                    type="search"
                    id="catalogue-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Try pearl, gold, or signet"
                  />
                </div>
                <div className="shop-facet">
                  <label htmlFor="material">Material</label>
                  <select
                    id="material"
                    value={material}
                    onChange={(event) => setMaterial(event.target.value)}
                  >
                    <option value="">All materials</option>
                    <option value="pearl">Freshwater pearl</option>
                    <option value="gold">Gold vermeil</option>
                  </select>
                </div>
                <div className="shop-facet">
                  <label htmlFor="budget">Price ceiling</label>
                  <select
                    id="budget"
                    value={budget}
                    onChange={(event) => setBudget(event.target.value)}
                  >
                    <option value="">Any price</option>
                    <option value="4000">Up to ₹4,000</option>
                    <option value="5000">Up to ₹5,000</option>
                    <option value="6000">Up to ₹6,000</option>
                  </select>
                </div>
                <div className="shop-sort">
                  <label htmlFor="sort">Sort by</label>
                  <select
                    id="sort"
                    value={sort}
                    onChange={(event) => setSort(event.target.value)}
                  >
                    <option value="featured">Featured</option>
                    <option value="low">Price, low to high</option>
                    <option value="high">Price, high to low</option>
                  </select>
                </div>
              </div>
              <p role="status" className={notice ? "shop-notice" : "sr-only"}>
                {notice}
              </p>
              {request.status === "loading" && (
                <p role="status" className="shop-state">
                  Loading the collection…
                </p>
              )}
              {request.status === "error" && (
                <div className="shop-state" role="alert">
                  <p>The collection couldn’t load.</p>
                  <button
                    className="shop-secondary"
                    type="button"
                    onClick={() =>
                      setRequest((state) => ({
                        status: "loading",
                        attempt: state.attempt + 1,
                      }))
                    }
                  >
                    Retry
                  </button>
                </div>
              )}
              {request.status === "ready" && (
                <>
                  <p role="status" className="result-count">
                    {visible.length} {visible.length === 1 ? "piece" : "pieces"}
                  </p>
                  {visible.length === 0 ? (
                    <div className="shop-state">
                      <p>
                        {savedOnly
                          ? "No saved pieces match these filters."
                          : "No pieces match your search."}
                      </p>
                      <button
                        className="shop-secondary"
                        type="button"
                        onClick={clearFilters}
                      >
                        Clear filters
                      </button>
                    </div>
                  ) : (
                    <div className="shop-products">
                      {visible.map((product) => (
                        <article className="shop-product" key={product.id}>
                          <div className="product-media">
                            <a
                              className="piece-image"
                              href={"/pieces/" + product.id}
                              aria-label={"View " + product.name}
                            >
                              <img
                                src={"/" + product.image}
                                alt=""
                                loading="lazy"
                              />
                            </a>
                            <button
                              className="save-tile"
                              aria-pressed={savedIds.includes(product.id)}
                              type="button"
                              aria-label={"Save " + product.name}
                              onClick={() =>
                                dispatch(basketActions.toggleSaved(product.id))
                              }
                            >
                              <svg
                                width="21"
                                height="21"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                                fill={
                                  savedIds.includes(product.id)
                                    ? "currentColor"
                                    : "none"
                                }
                                stroke="currentColor"
                                strokeWidth="1.5"
                              >
                                <path d="M20.6 8.5c0 4.1-8.6 9.2-8.6 9.2S3.4 12.6 3.4 8.5a4.4 4.4 0 0 1 8.6-1.2 4.4 4.4 0 0 1 8.6 1.2Z" />
                              </svg>
                            </button>
                          </div>
                          <div className="shop-product-body">
                            <div>
                              <h2>{product.name}</h2>
                              <p>{product.material}</p>
                            </div>
                            <b>{money.format(product.price)}</b>
                            <div className="product-controls">
                              <a
                                className="shop-secondary details-link"
                                href={"/pieces/" + product.id}
                              >
                                View piece <span aria-hidden="true">↗</span>
                              </a>
                              <button
                                className="compare-button"
                                type="button"
                                aria-pressed={compareIds.includes(product.id)}
                                disabled={
                                  compareIds.length >= 3 &&
                                  !compareIds.includes(product.id)
                                }
                                aria-label={"Compare " + product.name}
                                onClick={() => toggleCompare(product.id)}
                              >
                                {compareIds.includes(product.id)
                                  ? "Selected ✓"
                                  : "Compare"}
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
            <section className="shop-editorial">
              <div>
                <p className="label">Considered essentials</p>
                <h2>
                  A little less.
                  <br />A little better.
                </h2>
              </div>
              <p>
                Sculptural silhouettes, warm gold tones, and quiet details.
                Discover pieces by material, compare the finishes, and find your
                own combination.
              </p>
              <a href="/pieces/tide">Meet the Tide Pendant ↗</a>
            </section>
          </>
        )}
      </main>
      {compareIds.length > 0 && (
        <aside className="compare-tray" aria-label="Selected pieces to compare">
          <div>
            <strong>
              {compareIds.length} {compareIds.length === 1 ? "piece" : "pieces"}{" "}
              selected
            </strong>
            <span>Select up to 3 pieces</span>
          </div>
          <button
            className="shop-secondary"
            type="button"
            onClick={() => setCompareIds([])}
          >
            Clear
          </button>
          <button
            className="button"
            type="button"
            disabled={compareIds.length < 2}
            onClick={() => setCompareOpen(true)}
          >
            Compare
          </button>
        </aside>
      )}
      <footer className="wrap shop-footer">
        <div>
          <strong>Atelier Edit</strong>
          <p>A fictional jewellery store · Built by Ajith Reddy</p>
          <small>
            Sample products, generated photography, and demo checkout.
          </small>
        </div>
        <button
          type="button"
          className="shop-secondary"
          onClick={() => setOrdersOpen(true)}
        >
          Your orders
        </button>
      </footer>
      {accountOpen && (
        <Account
          customer={remote.customer}
          sync={sync.current}
          onClose={() => setAccountOpen(false)}
        />
      )}
      {activeProduct && (
        <ProductDetails
          product={activeProduct}
          onClose={() => setActiveProduct(null)}
          onAdd={addToBag}
        />
      )}
      {bagOpen && (
        <Bag
          products={products}
          lines={lines}
          onClose={() => setBagOpen(false)}
          onBeforeCheckout={() => sync.current.flush()}
          onOrdered={async () => {
            await sync.current.reload();
            setRequest((state) => ({ ...state, attempt: state.attempt + 1 }));
          }}
        />
      )}
      {ordersOpen && (
        <OrderHistory
          onClose={() => setOrdersOpen(false)}
          onChanged={() =>
            setRequest((state) => ({ ...state, attempt: state.attempt + 1 }))
          }
        />
      )}
      {compareOpen && (
        <ComparePieces
          products={products.filter(({ id }) => compareIds.includes(id))}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </>
  );
}

if (typeof document !== "undefined")
  createRoot(document.getElementById("root")).render(
    <Provider store={storefrontStore()}>
      <Storefront />
    </Provider>,
  );
