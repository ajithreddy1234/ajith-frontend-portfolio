import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { NetlifyDB } from "@netlify/database-dev";
import { getDatabase } from "@netlify/database";
import { createAccountHandler } from "../netlify/functions/atelier-account.mjs";
import { deliveryOptions } from "../src/atelier-delivery.js";
import { createCommerceHandler } from "../netlify/functions/atelier-commerce.mjs";
test("accounts persist a bag across sessions, merge guests, reject stale writes, isolate orders and restore stock once", async () => {
  const local = new NetlifyDB(),
    db = getDatabase({ connectionString: await local.start() });
  const accounts = createAccountHandler(() => db),
    commerce = createCommerceHandler(() => db);
  const origin = "https://atelier.example";
  const password = "A unique test password 123";
  let cookie = "";
  async function call(
    path,
    body,
    method = "POST",
    session = cookie,
    source = origin,
  ) {
    const request = new Request(origin + "/api/atelier/" + path, {
      method: body === undefined ? "GET" : method,
      headers: {
        origin: source,
        cookie: session,
        "content-type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const response = await (
      path.startsWith("orders") || path.startsWith("catalogue")
        ? commerce
        : accounts
    )(request);
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  }
  try {
    await local.applyMigrations("netlify/database/migrations");
    let result = await call("session");
    cookie = result.cookie;
    const guestCookie = cookie;
    assert.equal(result.data.cart.version, 0);
    const bag = {
      lines: [{ productId: "arc", variant: "Size 6", quantity: 2 }],
      savedIds: ["tide"],
      version: 0,
    };
    result = await call("cart", bag, "PUT");
    assert.equal(result.status, 200);
    assert.equal(result.data.cart.version, 1);
    result = await call("cart", bag, "PUT");
    assert.equal(result.status, 409);
    assert.equal(result.data.cart.lines[0].quantity, 2);
    assert.equal(
      (
        await call(
          "cart",
          { ...bag, version: 1 },
          "PUT",
          cookie,
          "https://evil.example",
        )
      ).status,
      403,
    );
    result = await call("auth/register", { username: "test_member", password });
    assert.equal(result.status, 201);
    cookie = result.cookie;
    assert.notEqual(cookie, guestCookie);
    assert.equal(result.data.cart.lines[0].quantity, 2);
    assert.equal(
      (await call("cart", { ...bag, version: 1 }, "PUT", guestCookie)).status,
      401,
      "Old session is revoked",
    );
    const catalog = (await call("catalogue")).data;
    const before = catalog.find((p) => p.id === "arc").inventory["Size 6"];
    const input = {
      requestId: randomUUID(),
      delivery: "express",
      lines: bag.lines,
      total: 1,
    };
    const placed = await call("orders", input);
    assert.equal(placed.status, 201);
    const order = placed.data.order;
    assert.equal(order.total, 2 * 4200 + deliveryOptions.express.fee);
    assert.equal(
      (await call("session")).data.cart.lines.length,
      0,
      "Checkout clears persisted cart",
    );
    assert.equal(
      (await call("orders", input)).data.order.id,
      order.id,
      "Checkout is idempotent",
    );
    assert.equal(
      (await call("catalogue")).data.find((p) => p.id === "arc").inventory[
        "Size 6"
      ],
      before - 2,
    );
    result = await call("auth/logout", {});
    cookie = result.cookie;
    assert.equal(result.data.customer.username, null);
    assert.equal((await call("orders")).data.orders.length, 0);
    assert.equal(
      (await call("orders/" + order.id + "/cancel", {})).status,
      404,
      "Stranger cannot cancel",
    );
    assert.equal(
      (
        await call("auth/login", {
          username: "test_member",
          password: "incorrect password",
        })
      ).status,
      401,
    );
    result = await call(
      "cart",
      {
        lines: [{ productId: "form", variant: "One size", quantity: 1 }],
        savedIds: ["sol"],
        version: 0,
      },
      "PUT",
    );
    assert.equal(result.status, 200);
    result = await call("auth/login", { username: "test_member", password });
    assert.equal(result.status, 200);
    cookie = result.cookie;
    assert.deepEqual(result.data.cart.savedIds.sort(), ["sol", "tide"]);
    assert.equal(result.data.cart.lines[0].productId, "form");
    assert.equal((await call("orders")).data.orders.length, 1);
    const cancelled = await call("orders/" + order.id + "/cancel", {});
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.data.order.status, "cancelled");
    assert.equal(
      (await call("orders/" + order.id + "/cancel", {})).status,
      200,
    );
    assert.equal(
      (await call("catalogue")).data.find((p) => p.id === "arc").inventory[
        "Size 6"
      ],
      before,
      "Cancellation restores exactly once",
    );
    const detail = await call("orders/" + order.id);
    assert.equal(detail.data.events.length, 2);
    result = await call("auth/logout", {});
    cookie = result.cookie;
    result = await call("auth/login", { username: "test_member", password });
    assert.equal(result.status, 200);
    cookie = result.cookie;
    assert.equal(result.data.cart.lines[0].productId, "form");
  } finally {
    await db.pool.end();
    await local.stop();
  }
});
