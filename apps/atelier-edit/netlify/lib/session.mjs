import {
  randomBytes,
  randomUUID,
  createHash,
  scrypt as derive,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(derive);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const cookieName = "atelier_token";
export function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64, options);
  return salt + ":" + key.toString("hex");
}
export async function checkPassword(password, stored) {
  const [salt, hex] = stored.split(":");
  const key = await scrypt(password, salt, 64, options);
  return timingSafeEqual(key, Buffer.from(hex, "hex"));
}
export async function readSession(db, request) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
  if (!token || !/^[a-zA-Z0-9_-]{43}$/.test(token)) return null;
  const rows =
    await db.sql`SELECT s.owner_id,s.token_hash,c.username FROM atelier_sessions s JOIN atelier_customers c ON c.id=s.owner_id
   WHERE s.token_hash=${tokenHash(token)} AND s.expires_at>now()`;
  return rows[0] ?? null;
}
export async function issueSession(client, owner) {
  const token = randomBytes(32).toString("base64url");
  await client.query(
    "INSERT INTO atelier_sessions(token_hash,owner_id,expires_at) VALUES($1,$2,now()+interval '30 days')",
    [tokenHash(token), owner],
  );
  return (
    cookieName +
    "=" +
    token +
    "; HttpOnly; Secure; SameSite=Lax; Path=/api/atelier; Max-Age=2592000"
  );
}
export async function ensureSession(db, request) {
  const existing = await readSession(db, request);
  if (existing) return existing;
  const owner = randomUUID(),
    client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO atelier_customers(id) VALUES($1)", [owner]);
    await client.query("INSERT INTO atelier_carts(owner_id) VALUES($1)", [
      owner,
    ]);
    const cookie = await issueSession(client, owner);
    await client.query("COMMIT");
    return { owner_id: owner, username: null, cookie };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function sessionState(db, session) {
  const [row] =
    await db.sql`SELECT state,version FROM atelier_carts WHERE owner_id=${session.owner_id}`;
  return {
    customer: { username: session.username ?? null },
    cart: { ...row.state, version: row.version },
  };
}
export function json(data, status = 200, cookie) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      ...(cookie ? { "set-cookie": cookie } : {}),
    },
  });
}
export function sameOrigin(request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}
export async function readJson(request, limit = 12000) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw Object.assign(new Error("Use JSON."), { status: 415 });
  const body = await request.text();
  if (body.length > limit)
    throw Object.assign(new Error("Request too large."), { status: 413 });
  try {
    return JSON.parse(body);
  } catch {
    throw Object.assign(new Error("Invalid JSON."), { status: 400 });
  }
}
