// Same-origin relay to the Hyperliquid info API, so visitors' browsers only
// ever talk to justinalick.com. Only the four read-only queries the page uses
// are forwarded; nothing about the visitor (IP, headers, cookies) is passed on.
// Responses are cached at the edge so repeat loads of a market are cheap.

const BASE = "/projects/hl-funding";
const UPSTREAM = "https://api.hyperliquid.xyz/info";
const MAX_BODY = 512;
const COIN = /^[A-Za-z0-9:._-]{1,40}$/;
const DEX = /^[A-Za-z0-9_-]{0,20}$/;

// Validates a request body and returns the canonical query, or null.
function canonical(q) {
  if (!q || typeof q !== "object" || Array.isArray(q)) return null;
  const keys = Object.keys(q);
  const only = (...allowed) => keys.every(k => allowed.includes(k));
  const optDex = q.dex === undefined || (typeof q.dex === "string" && DEX.test(q.dex));
  switch (q.type) {
    case "perpDexs":
      return only("type") ? { type: q.type } : null;
    case "meta":
    case "metaAndAssetCtxs":
      if (!only("type", "dex") || !optDex) return null;
      return q.dex ? { type: q.type, dex: q.dex } : { type: q.type };
    case "fundingHistory": {
      if (!only("type", "coin", "startTime", "endTime")) return null;
      if (typeof q.coin !== "string" || !COIN.test(q.coin)) return null;
      if (!Number.isSafeInteger(q.startTime) || q.startTime < 0) return null;
      if (q.endTime !== undefined && !Number.isSafeInteger(q.endTime)) return null;
      const out = { type: q.type, coin: q.coin, startTime: q.startTime };
      if (q.endTime !== undefined) out.endTime = q.endTime;
      return out;
    }
    default:
      return null;
  }
}

// Seconds to keep a successful response at the edge.
function ttl(q, data) {
  if (q.type === "perpDexs" || q.type === "meta") return 600;
  if (q.type === "metaAndAssetCtxs") return 10;
  // A full page of funding that ends over two hours ago can never change.
  if (Array.isArray(data) && data.length === 500 && data[499].time < Date.now() - 2 * 3600e3) return 86400;
  return 60;
}

const reply = (body, status = 200) => new Response(body, {
  status,
  headers: {
    "Content-Type": status === 200 ? "application/json" : "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  },
});

async function relay(request, ctx) {
  if (request.method !== "POST") return reply("POST only", 405);
  // Browsers say where a request came from; refuse other sites' pages.
  const site = request.headers.get("Sec-Fetch-Site");
  if (site && site !== "same-origin") return reply("Forbidden", 403);

  const text = await request.text();
  if (text.length > MAX_BODY) return reply("Too large", 413);
  let q;
  try { q = canonical(JSON.parse(text)); } catch { q = null; }
  if (!q) return reply("Unsupported query", 400);

  const body = JSON.stringify(q);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
  const key = new Request(`https://justinalick.com${BASE}/api/cache/${hex}`);
  const cache = caches.default;

  const hit = await cache.match(key);
  if (hit) return reply(await hit.text());

  const up = await fetch(UPSTREAM, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "justinalick.com/projects/hl-funding" },
    body,
  });
  if (up.status === 429) return reply("Rate limited", 429);
  if (!up.ok) return reply("Upstream error", 502);
  const out = await up.text();
  let data;
  try { data = JSON.parse(out); } catch { return reply("Upstream error", 502); }

  ctx.waitUntil(cache.put(key, new Response(out, {
    headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${ttl(q, data)}` },
  })));
  return reply(out);
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === `${BASE}/api/info`) return relay(request, ctx);
    return env.ASSETS.fetch(request);
  },
};
