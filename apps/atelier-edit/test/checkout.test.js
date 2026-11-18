import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { NetlifyDB } from "@netlify/database-dev";
import pg from "pg";
import { createCommerceHandler } from "../netlify/functions/atelier-commerce.mjs";
import { getDatabase } from "@netlify/database";

test("checkout uses trusted prices, isolates receipts, replays safely, and rejects unavailable stock", async () => {
  const local = new NetlifyDB();
  const connectionString = await local.start();
  const database = getDatabase({ connectionString });
  const handler = createCommerceHandler(() => database);
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await local.applyMigrations("./netlify/database/migrations");
    const origin = "https://atelier.example";
    const catalogue = await handler(
      new Request(origin + "/api/atelier/catalogue"),
    );
    assert.equal(catalogue.status, 200);
    const cookie = catalogue.headers.get("set-cookie").split(";")[0];
    function order(input, session = cookie) {
      return handler(
        new Request(origin + "/api/atelier/orders", {
          method: "POST",
          headers: {
            origin,
            cookie: session,
            "content-type": "application/json",
          },
          body: JSON.stringify(input),
        }),
      );
    }
    const payload = {
      requestId: randomUUID(),
      delivery: "standard",
      lines: [{ productId: "arc", variant: "Size 5", quantity: 1, price: 1 }],
      total: 1,
    };
    const first = await order(payload);
    assert.equal(first.status, 201);
    const receipt = (await first.json()).order;
    assert.equal(receipt.total, receipt.lines[0].price + 120);
    assert.notEqual(receipt.total, 1);
    const replay = await order(payload);
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).order.id, receipt.id);
    assert.equal(
      (await order({ ...payload, delivery: "express" })).status,
      409,
    );
    const history = await (
      await handler(
        new Request(origin + "/api/atelier/orders", { headers: { cookie } }),
      )
    ).json();
    assert.equal(history.orders.length, 1);
    const stranger = await (
      await handler(
        new Request(origin + "/api/atelier/orders", {
          headers: { cookie: "atelier_session=" + randomUUID() },
        }),
      )
    ).json();
    assert.equal(stranger.orders.length, 0);
    await client.query(
      "UPDATE atelier_inventory SET stock = 1 WHERE product_id = 'arc' AND variant = 'Size 5'",
    );
    // Netlify's single-process dev database does not emulate concurrent transactions.
    const results = [
      await order({ ...payload, requestId: randomUUID() }),
      await order({ ...payload, requestId: randomUUID() }),
    ];
    assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
    const remaining = await client.query(
      "SELECT stock FROM atelier_inventory WHERE product_id = 'arc' AND variant = 'Size 5'",
    );
    assert.equal(remaining.rows[0].stock, 0);
    const count = await client.query(
      "SELECT count(*)::int AS count FROM atelier_orders",
    );
    assert.equal(count.rows[0].count, 2);
    const invalid = {
      ...payload,
      requestId: randomUUID(),
      lines: [{ productId: "arc", variant: "Invalid", quantity: -1 }],
    };
    assert.equal((await order(invalid)).status, 400);
  } finally {
    await client.end();
    await database.pool.end();
    await local.stop();
  }
});
