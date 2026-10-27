// Cloudflare Worker: puts the Google Ads click id (gclid / gbraid / wbraid) on the
// Square customer, in the customer custom attribute "gclid".
//
// Square drops query parameters on its booking site, so the site asks ad visitors
// for their phone before Book and sends phone + click ids here (POST /click).
// The pair is kept for 90 days. The attribute is written:
//   - right away, if a Square customer with that phone already exists;
//   - otherwise when Square reports the new booking / customer (POST /square).
//
// Bindings (see wrangler.toml): KV namespace CLICKS.
// Secrets: SQUARE_TOKEN (production access token), SQUARE_WEBHOOK_KEY (signature key
// of the webhook subscription). Optional var: SQUARE_WEBHOOK_URL, the notification
// URL exactly as entered in Square, if it differs from the URL the worker sees.

const SQUARE_API = 'https://connect.squareup.com/v2';
const SQUARE_VERSION = '2024-11-20';
const ATTR_NAME = 'gclid';
const TTL = 90 * 24 * 60 * 60;
const ALLOWED_ORIGINS = ['https://auriquebydiana.com', 'https://www.auriquebydiana.com'];
const CLICK_ID = /^[A-Za-z0-9_-]{4,300}$/;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (request.method === 'POST' && url.pathname === '/click') return await handleClick(request, env, ctx);
      if (request.method === 'POST' && url.pathname === '/square') return await handleSquare(request, env, ctx);
      if (request.method === 'GET' && url.pathname === '/') return new Response('ok');
      return new Response('not found', { status: 404 });
    } catch (err) {
      console.error(err && err.stack || err);
      return new Response('error', { status: 500 });
    }
  }
};

/* ---------------- Site → worker ---------------- */

async function handleClick(request, env, ctx) {
  const origin = request.headers.get('Origin') || '';
  const cors = { 'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] };
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return new Response('forbidden', { status: 403, headers: cors });

  const form = new URLSearchParams(await request.text());
  const phone = toE164(form.get('phone') || '');
  const clickId = pickClickId(form);
  // No phone or no ad click id: nothing to store, the attribute is left alone.
  if (!phone || !clickId) return new Response(null, { status: 204, headers: cors });

  const record = { ...clickId, ts: new Date().toISOString() };
  await env.CLICKS.put('p:' + phone, JSON.stringify(record), { expirationTtl: TTL });

  // The visitor may already be a Square customer; tag them now without delaying the reply.
  ctx.waitUntil(tagByPhone(env, phone, record).catch((err) => console.error('tagByPhone', err)));
  return new Response(null, { status: 204, headers: cors });
}

// gclid if present, else gbraid, else wbraid.
function pickClickId(form) {
  for (const type of ['gclid', 'gbraid', 'wbraid']) {
    const v = (form.get(type) || '').trim();
    if (v && CLICK_ID.test(v)) return { type, id: v };
  }
  return null;
}

async function tagByPhone(env, phone, record) {
  const customers = await findCustomersByPhone(env, phone);
  for (const c of customers) await writeAttribute(env, c.id, record);
  return customers.length;
}

/* ---------------- Square → worker (webhooks) ---------------- */

async function handleSquare(request, env, ctx) {
  const body = await request.text();
  const signature = request.headers.get('x-square-hmacsha256-signature') || '';
  const notificationUrl = env.SQUARE_WEBHOOK_URL || request.url;
  if (!(await validSignature(env.SQUARE_WEBHOOK_KEY, notificationUrl + body, signature))) {
    return new Response('bad signature', { status: 401 });
  }

  const event = JSON.parse(body);
  const obj = (event.data && event.data.object) || {};
  ctx.waitUntil((async () => {
    let customer = obj.customer || null;
    const customerId = (obj.booking && obj.booking.customer_id) || (customer && customer.id);
    if (!customerId) return;
    if (!customer || !customer.phone_number) customer = await getCustomer(env, customerId);
    const phone = customer && toE164(customer.phone_number || '');
    if (!phone) return;
    const stored = await env.CLICKS.get('p:' + phone);
    if (stored) await writeAttribute(env, customerId, JSON.parse(stored));
  })().catch((err) => console.error('square event', event.type, err)));

  // Square only needs a quick 2xx.
  return new Response('ok');
}

async function validSignature(key, payload, signature) {
  if (!key || !signature) return false;
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(payload)));
  const expected = btoa(String.fromCharCode(...mac));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

/* ---------------- Square API ---------------- */

async function square(env, path, init = {}) {
  const res = await fetch(SQUARE_API + path, {
    ...init,
    headers: {
      Authorization: 'Bearer ' + env.SQUARE_TOKEN,
      'Square-Version': SQUARE_VERSION,
      'Content-Type': 'application/json'
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Square ${init.method || 'GET'} ${path} → ${res.status} ${JSON.stringify(data.errors || data)}`);
  return data;
}

async function getCustomer(env, id) {
  return (await square(env, '/customers/' + encodeURIComponent(id))).customer || null;
}

// Square keeps phones as typed, so search loosely and compare in E.164.
async function findCustomersByPhone(env, phone) {
  const data = await square(env, '/customers/search', {
    method: 'POST',
    body: JSON.stringify({ query: { filter: { phone_number: { fuzzy: phone.slice(-10) } } }, limit: 20 })
  });
  return (data.customers || []).filter((c) => toE164(c.phone_number || '') === phone);
}

// The definition was created in the Square Dashboard, so its API key is not
// necessarily "gclid": look it up by key or name once and keep it.
async function attributeKey(env) {
  const cached = await env.CLICKS.get('attr-key');
  if (cached) return cached;
  let cursor = '';
  do {
    const data = await square(env, '/customers/custom-attribute-definitions?limit=100' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
    const def = (data.custom_attribute_definitions || []).find((d) =>
      d.key === ATTR_NAME || d.key.endsWith(':' + ATTR_NAME) || (d.name || '').trim().toLowerCase() === ATTR_NAME);
    if (def) {
      await env.CLICKS.put('attr-key', def.key, { expirationTtl: 24 * 60 * 60 });
      return def.key;
    }
    cursor = data.cursor || '';
  } while (cursor);
  throw new Error(`No customer custom attribute named "${ATTR_NAME}" is visible to this Square app`);
}

async function writeAttribute(env, customerId, record) {
  const key = await attributeKey(env);
  await square(env, `/customers/${encodeURIComponent(customerId)}/custom-attributes/${encodeURIComponent(key)}`, {
    method: 'POST',
    body: JSON.stringify({ custom_attribute: { value: record.id } })
  });
  console.log('gclid attribute set', customerId, record.type, record.id);
}

/* ---------------- Helpers ---------------- */

// Same rules as the site: 10 US digits → +1XXXXXXXXXX.
function toE164(raw) {
  const d = String(raw).replace(/\D/g, '');
  if (d.length === 10) return '+1' + d;
  if (d.length === 11 && d[0] === '1') return '+' + d;
  if (String(raw).trim().startsWith('+') && d.length >= 8 && d.length <= 15) return '+' + d;
  return null;
}

export { toE164, pickClickId, validSignature };
