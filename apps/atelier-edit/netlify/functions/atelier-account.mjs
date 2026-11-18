import { randomUUID } from "node:crypto";
import { getDatabase } from "@netlify/database";
import {
  ensureSession,
  readSession,
  issueSession,
  sessionState,
  hashPassword,
  checkPassword,
  json,
  sameOrigin,
  readJson,
} from "../lib/session.mjs";
import { validateCart, mergeCarts } from "../lib/cart.mjs";
const dummyHash = hashPassword("unavailable-account-placeholder");
export function createAccountHandler(provider = getDatabase) {
  let database;
  return async (request) => {
    const db = (database ??= provider()),
      path = new URL(request.url).pathname;
    try {
      if (request.method === "GET" && path === "/api/atelier/session") {
        const session = await ensureSession(db, request);
        return json(await sessionState(db, session), 200, session.cookie);
      }
      if (!["POST", "PUT"].includes(request.method))
        return json({ error: "Method not allowed." }, 405);
      if (!sameOrigin(request))
        return json({ error: "Use the Atelier application." }, 403);
      const session = await readSession(db, request);
      if (!session)
        return json({ error: "Reload Atelier to start a session." }, 401);
      if (path === "/api/atelier/cart" && request.method === "PUT") {
        const input = await readJson(request);
        const catalog = (await db.sql`SELECT data FROM atelier_products`).map(
          (x) => x.data,
        );
        const cart = validateCart(input, catalog);
        if (!cart || !Number.isInteger(input.version))
          return json({ error: "Check your bag and saved pieces." }, 400);
        const updated =
          await db.sql`UPDATE atelier_carts SET state=${JSON.stringify(cart)}::jsonb,version=version+1,updated_at=now()
      WHERE owner_id=${session.owner_id} AND version=${input.version} RETURNING state,version`;
        if (!updated.length)
          return json(
            {
              error:
                "Your bag changed in another tab. The latest saved bag has been restored.",
              ...(await sessionState(db, session)),
            },
            409,
          );
        return json({
          cart: { ...updated[0].state, version: updated[0].version },
        });
      }
      if (request.method !== "POST")
        return json({ error: "Method not allowed." }, 405);
      if (path === "/api/atelier/auth/logout") {
        await db.sql`DELETE FROM atelier_sessions WHERE token_hash=${session.token_hash}`;
        const fresh = await ensureSession(db, new Request(request.url));
        return json(await sessionState(db, fresh), 200, fresh.cookie);
      }
      if (
        !["/api/atelier/auth/register", "/api/atelier/auth/login"].includes(
          path,
        )
      )
        return json({ error: "Not found." }, 404);
      if (session.username)
        return json({ error: "Sign out before switching accounts." }, 409);
      const input = await readJson(request, 1000);
      if (
        typeof input?.username !== "string" ||
        !/^[a-zA-Z0-9_]{3,32}$/.test(input.username) ||
        typeof input.password !== "string" ||
        input.password.length < 12 ||
        input.password.length > 128
      )
        return json(
          {
            error:
              "Use a username of 3–32 letters, numbers or underscores and a password of 12–128 characters.",
          },
          400,
        );
      const username = input.username.toLowerCase();
      const registering = path.endsWith("register");
      const users =
        await db.sql`SELECT id,password_hash FROM atelier_customers WHERE username=${username}`;
      const passwordMatches = registering
        ? false
        : await checkPassword(
            input.password,
            users[0]?.password_hash ?? (await dummyHash),
          );
      if (!registering && (!passwordMatches || !users.length))
        return json({ error: "Username or password is incorrect." }, 401);
      if (registering && users.length)
        return json({ error: "Choose a different username." }, 409);
      const passwordHash = registering
        ? await hashPassword(input.password)
        : null;
      const owner = registering ? session.owner_id : users[0].id;
      const client = await db.pool.connect();
      let cookie;
      try {
        await client.query("BEGIN");
        if (registering) {
          const promoted = await client.query(
            "UPDATE atelier_customers SET username=$1,password_hash=$2 WHERE id=$3 AND username IS NULL RETURNING id",
            [username, passwordHash, owner],
          );
          if (!promoted.rows.length)
            throw Object.assign(
              new Error("The session changed. Reload and retry."),
              { status: 409 },
            );
        } else {
          // Lock in a stable order so simultaneous logins cannot deadlock while merging.
          const carts = await client.query(
            "SELECT owner_id,state FROM atelier_carts WHERE owner_id=ANY($1::uuid[]) ORDER BY owner_id FOR UPDATE",
            [[owner, session.owner_id]],
          );
          const member = carts.rows.find((row) => row.owner_id === owner).state,
            guest = carts.rows.find(
              (row) => row.owner_id === session.owner_id,
            ).state;
          const merged = mergeCarts(member, guest);
          await client.query(
            "UPDATE atelier_carts SET state=$1::jsonb,version=version+1,updated_at=now() WHERE owner_id=$2",
            [JSON.stringify(merged), owner],
          );
          await client.query(
            "UPDATE atelier_orders SET session_id=$1 WHERE session_id=$2",
            [owner, session.owner_id],
          );
          await client.query(
            'UPDATE atelier_carts SET state=\'{"lines":[],"savedIds":[]}\'::jsonb,version=version+1 WHERE owner_id=$1',
            [session.owner_id],
          );
        }
        await client.query("DELETE FROM atelier_sessions WHERE token_hash=$1", [
          session.token_hash,
        ]);
        cookie = await issueSession(client, owner);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        if (error.code === "23505")
          return json({ error: "Choose a different username." }, 409);
        throw error;
      } finally {
        client.release();
      }
      return json(
        await sessionState(db, { owner_id: owner, username }),
        registering ? 201 : 200,
        cookie,
      );
    } catch (error) {
      if (error.status) return json({ error: error.message }, error.status);
      console.error("Atelier account failure", error.code ?? error.name);
      return json(
        {
          error:
            "Your account service is temporarily unavailable. Please retry.",
        },
        503,
      );
    }
  };
}
export default createAccountHandler();
export const config = {
  path: ["/api/atelier/session", "/api/atelier/cart", "/api/atelier/auth/*"],
  rateLimit: {
    action: "rate_limit",
    windowSize: 60,
    windowLimit: 30,
    aggregateBy: ["ip", "domain"],
  },
};
