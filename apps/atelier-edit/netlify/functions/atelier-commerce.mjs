import { randomUUID } from "node:crypto";
import { getDatabase } from "@netlify/database";
import {
  catalogueWithStock,
  matchesOrder,
  priceOrder,
  uuidPattern,
} from "../lib/atelier-orders.mjs";
import {
  ensureSession,
  readSession,
  json,
  sameOrigin,
  readJson,
} from "../lib/session.mjs";
const receiptFields =
  "id,delivery,shipping,total,lines,status,created_at,cancelled_at";
async function placeOrder(db, owner, order) {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO atelier_orders(id,session_id,request_id,delivery,shipping,total,lines)
   VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT(session_id,request_id) DO NOTHING RETURNING ${receiptFields}`,
      [
        randomUUID(),
        owner,
        order.requestId,
        order.delivery,
        order.shipping,
        order.total,
        JSON.stringify(order.lines),
      ],
    );
    const receipt = inserted.rows[0];
    if (!receipt) {
      const existing = await client.query(
        `SELECT ${receiptFields} FROM atelier_orders WHERE session_id=$1 AND request_id=$2`,
        [owner, order.requestId],
      );
      await client.query("COMMIT");
      return matchesOrder(existing.rows[0], order)
        ? json({ order: existing.rows[0] })
        : json(
            {
              error:
                "This checkout reference is already in use. Reopen your bag and try again.",
            },
            409,
          );
    }
    for (const line of order.lines) {
      const result = await client.query(
        "UPDATE atelier_inventory SET stock=stock-$3 WHERE product_id=$1 AND variant=$2 AND stock>=$3",
        [line.productId, line.variant, line.quantity],
      );
      if (!result.rowCount) {
        await client.query("ROLLBACK");
        return json(
          {
            error:
              line.name +
              " (" +
              line.variant +
              ") has less stock than requested. Update your bag to continue.",
          },
          409,
        );
      }
    }
    await client.query(
      "INSERT INTO atelier_order_events(id,order_id,event) VALUES($1,$2,$3)",
      [randomUUID(), receipt.id, "Demo order confirmed"],
    );
    await client.query(
      "UPDATE atelier_carts SET state=jsonb_set(state,'{lines}','[]'::jsonb),version=version+1,updated_at=now() WHERE owner_id=$1",
      [owner],
    );
    await client.query("COMMIT");
    return json({ order: receipt }, 201);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
async function cancelOrder(db, owner, id) {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      `SELECT ${receiptFields} FROM atelier_orders WHERE id=$1 AND session_id=$2 FOR UPDATE`,
      [id, owner],
    );
    const order = found.rows[0];
    if (!order) {
      await client.query("ROLLBACK");
      return json({ error: "Order not found." }, 404);
    }
    if (order.status === "cancelled") {
      await client.query("COMMIT");
      return json({ order });
    }
    const updated = await client.query(
      `UPDATE atelier_orders SET status='cancelled',cancelled_at=now() WHERE id=$1 RETURNING ${receiptFields}`,
      [id],
    );
    for (const line of order.lines)
      await client.query(
        "UPDATE atelier_inventory SET stock=stock+$3 WHERE product_id=$1 AND variant=$2",
        [line.productId, line.variant, line.quantity],
      );
    await client.query(
      "INSERT INTO atelier_order_events(id,order_id,event) VALUES($1,$2,$3)",
      [randomUUID(), id, "Cancelled · inventory restored"],
    );
    await client.query("COMMIT");
    return json({ order: updated.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export function createCommerceHandler(provider = getDatabase) {
  let database;
  return async (request) => {
    const db = (database ??= provider()),
      url = new URL(request.url),
      path = url.pathname;
    try {
      const productRoute = path.match(
        /^\/api\/atelier\/catalogue(?:\/([a-z]+))?$/,
      );
      if (request.method === "GET" && productRoute) {
        const session = await ensureSession(db, request);
        const [rows, inventory] = await Promise.all([
          db.sql`SELECT data FROM atelier_products ORDER BY id`,
          db.sql`SELECT product_id,variant,stock FROM atelier_inventory`,
        ]);
        let catalog = catalogueWithStock(
          inventory,
          rows.map((row) => row.data),
        );
        if (productRoute[1]) {
          const product = catalog.find((p) => p.id === productRoute[1]);
          return product
            ? json(product, 200, session.cookie)
            : json({ error: "Piece not found." }, 404, session.cookie);
        }
        const q = (url.searchParams.get("q") ?? "").toLowerCase().slice(0, 100),
          category = url.searchParams.get("category");
        catalog = catalog.filter(
          (p) =>
            [p.name, p.material, p.category]
              .join(" ")
              .toLowerCase()
              .includes(q) &&
            (!category || p.category === category),
        );
        const sort = url.searchParams.get("sort");
        if (sort === "low") catalog.sort((a, b) => a.price - b.price);
        if (sort === "high") catalog.sort((a, b) => b.price - a.price);
        return json(catalog, 200, session.cookie);
      }
      const detail = path.match(/^\/api\/atelier\/orders\/([^/]+)(\/cancel)?$/);
      const session = await readSession(db, request);
      if (request.method === "GET" && path === "/api/atelier/orders") {
        if (!session) return json({ orders: [] });
        const orders =
          await db.sql`SELECT id,delivery,shipping,total,lines,status,created_at,cancelled_at FROM atelier_orders WHERE session_id=${session.owner_id} ORDER BY created_at DESC LIMIT 50`;
        return json({ orders });
      }
      if (detail && !uuidPattern.test(detail[1]))
        return json({ error: "Order not found." }, 404);
      if (request.method === "GET" && detail && !detail[2]) {
        if (!session) return json({ error: "Order not found." }, 404);
        const [order] =
          await db.sql`SELECT id,delivery,shipping,total,lines,status,created_at,cancelled_at FROM atelier_orders WHERE id=${detail[1]} AND session_id=${session.owner_id}`;
        if (!order) return json({ error: "Order not found." }, 404);
        const events =
          await db.sql`SELECT event,created_at FROM atelier_order_events WHERE order_id=${order.id} ORDER BY created_at`;
        return json({ order, events });
      }
      if (
        request.method !== "POST" ||
        !(path === "/api/atelier/orders" || detail?.[2])
      )
        return json({ error: "Method not allowed." }, 405);
      if (!sameOrigin(request))
        return json({ error: "Open checkout from Atelier Edit." }, 403);
      if (!session)
        return json(
          { error: "Reload the collection to start a checkout session." },
          401,
        );
      if (detail?.[2])
        return await cancelOrder(db, session.owner_id, detail[1]);
      const input = await readJson(request, 6000),
        catalog = (await db.sql`SELECT data FROM atelier_products`).map(
          (row) => row.data,
        );
      const order = priceOrder(input, catalog);
      if (!order)
        return json(
          { error: "Check your items, quantities, and delivery option." },
          400,
        );
      return await placeOrder(db, session.owner_id, order);
    } catch (error) {
      if (error.status) return json({ error: error.message }, error.status);
      console.error("Atelier storage request failed", error.code ?? error.name);
      return json(
        {
          error:
            "The shop service is temporarily unavailable. Please try again.",
        },
        503,
      );
    }
  };
}
export default createCommerceHandler();
export const config = {
  path: [
    "/api/atelier/catalogue",
    "/api/atelier/catalogue/*",
    "/api/atelier/orders",
    "/api/atelier/orders/*",
  ],
  rateLimit: {
    action: "rate_limit",
    windowSize: 60,
    windowLimit: 60,
    aggregateBy: ["ip", "domain"],
  },
};
