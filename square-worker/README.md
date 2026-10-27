# aurique-gclid — Cloudflare Worker

Writes the Google Ads click id (gclid, else gbraid, else wbraid) into the Square
customer custom attribute **gclid**, so the Zap "Square → Google Ads Offline
Conversion" can read it.

```
site (ad visitor) ── POST /click {phone, gclid, gbraid, wbraid} ──▶ worker ── KV: phone → click id (90 days)
                                                                       │
                                                customer already in Square? → attribute written now
Square ── webhook booking.created / customer.created ──▶ POST /square ─┘ → attribute written after booking
```

## Setup (one time)

1. **Square app** — https://developer.squareup.com/apps, signed in as the Aurique Square account → *Create app*.
   - *Credentials → Production → Access token*: copy it (keep it secret).
   - *Webhooks → Subscriptions → Add* (Production):
     URL `https://aurique-gclid.<account>.workers.dev/square`,
     events `booking.created`, `customer.created`, `customer.updated`.
     Copy the *Signature key*.
2. **Cloudflare** (free account), from this folder:
   ```
   npx wrangler login
   npx wrangler kv namespace create CLICKS      # paste the id into wrangler.toml
   npx wrangler secret put SQUARE_TOKEN
   npx wrangler secret put SQUARE_WEBHOOK_KEY
   npx wrangler deploy
   ```
3. Put `https://aurique-gclid.<account>.workers.dev/click` into `gclidEndpoint` in `js/config.js` and deploy the site.

## Test

`https://auriquebydiana.com/?gclid=test123` → Book → enter the phone → book on
Square with the same phone → the customer's **gclid** attribute shows `test123`.
Logs: `npx wrangler tail`.
