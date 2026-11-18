import { randomUUID } from 'node:crypto';
import { getDatabase } from '@netlify/database';
import { catalogueWithStock, matchesOrder, priceOrder, uuidPattern } from '../lib/atelier-orders.mjs';

const cataloguePath = '/api/atelier/catalogue';
const ordersPath = '/api/atelier/orders';
const sessionCookie = 'atelier_session';

function json(data, status = 200, cookie) {
  const headers = { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' };
  if (cookie) headers['set-cookie'] = cookie;
  return Response.json(data, { status, headers });
}

function getSession(request) {
  const token = request.headers.get('cookie')?.split(';')
    .map((entry) => entry.trim()).find((entry) => entry.startsWith(sessionCookie + '='))?.slice(sessionCookie.length + 1);
  return uuidPattern.test(token ?? '') ? token : null;
}

async function placeOrder(db, session, order) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO atelier_orders (id, session_id, request_id, delivery, shipping, total, lines)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      ON CONFLICT (session_id, request_id) DO NOTHING
      RETURNING id, delivery, shipping, total, lines, created_at`,
      [randomUUID(), session, order.requestId, order.delivery, order.shipping, order.total, JSON.stringify(order.lines)],
    );
    const receipt = inserted.rows[0];
    if (!receipt) {
      const existing = await client.query(
        'SELECT id, delivery, shipping, total, lines, created_at FROM atelier_orders WHERE session_id = $1 AND request_id = $2',
        [session, order.requestId],
      );
      await client.query('COMMIT');
      return matchesOrder(existing.rows[0], order)
        ? json({ order: existing.rows[0] })
        : json({ error: 'This checkout reference is already in use. Reopen your bag and try again.' }, 409);
    }
    for (const line of order.lines) {
      const adjustment = await client.query(
        'UPDATE atelier_inventory SET stock = stock - $3 WHERE product_id = $1 AND variant = $2 AND stock >= $3',
        [line.productId, line.variant, line.quantity],
      );
      if (!adjustment.rowCount) {
        await client.query('ROLLBACK');
        return json({ error: line.name + ' (' + line.variant + ') has less stock than requested. Update your bag to continue.' }, 409);
      }
    }
    await client.query('COMMIT');
    return json({ order: receipt }, 201);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function createCommerceHandler(provider = getDatabase) {
  let database;
  const databaseClient = () => database ??= provider();
  return async function handler(request) {
  const url = new URL(request.url);
  const session = getSession(request);
  try {
    if (request.method === 'GET' && url.pathname === cataloguePath) {
      const db = databaseClient();
      const inventory = await db.sql`SELECT product_id, variant, stock FROM atelier_inventory`;
      const cookie = session ? null
        : sessionCookie + '=' + randomUUID() + '; HttpOnly; Secure; SameSite=Lax; Path=/api/atelier; Max-Age=2592000';
      return json(catalogueWithStock(inventory), 200, cookie);
    }
    if (request.method === 'GET' && url.pathname === ordersPath) {
      if (!session) return json({ orders: [] });
      const db = databaseClient();
      const orders = await db.sql`SELECT id, delivery, shipping, total, lines, created_at FROM atelier_orders
        WHERE session_id = ${session} ORDER BY created_at DESC LIMIT 20`;
      return json({ orders });
    }
    if (request.method !== 'POST' || url.pathname !== ordersPath) return json({ error: 'Method not allowed.' }, 405);
    if (request.headers.get('origin') !== url.origin) return json({ error: 'Open checkout from Atelier Edit.' }, 403);
    if (!session) return json({ error: 'Reload the catalogue to start a checkout session.' }, 409);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Use JSON.' }, 415);
    const content = await request.text();
    const order = content.length < 6000 ? priceOrder(JSON.parse(content || 'null')) : null;
    if (!order) return json({ error: 'Check the selected items, quantities, and delivery option.' }, 400);
    return await placeOrder(databaseClient(), session, order);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: 'Invalid checkout request.' }, 400);
    console.error('Atelier storage request failed', error.code ?? error.name);
    return json({ error: 'The shop service is temporarily unavailable. Please try again.' }, 503);
  }
  };
}

export default createCommerceHandler();

export const config = {
  path: ['/api/atelier/catalogue', '/api/atelier/orders'],
  rateLimit: { action: 'rate_limit', windowSize: 60, windowLimit: 35, aggregateBy: ['ip', 'domain'] },
};
