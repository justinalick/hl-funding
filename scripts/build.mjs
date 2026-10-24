// Copies the page and its vendored libraries into dist/ under the path it is
// served from on justinalick.com, and writes the security headers. The
// inline scripts are allowed by hash, so the CSP is recomputed on every build.
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const BASE = "/projects/hl-funding";
const out = `dist${BASE}`;

rmSync("dist", { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of ["index.html", "LICENSE", "NOTICE"]) cpSync(f, `${out}/${f}`);
cpSync("vendor", `${out}/vendor`, { recursive: true });

const html = readFileSync("index.html", "utf8");
const hashes = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  .map(m => `'sha256-${createHash("sha256").update(m[1]).digest("base64")}'`);
if (hashes.length === 0) throw new Error("no inline scripts found");
if (/https?:\/\/(?!api\.hyperliquid\.xyz|x\.com|justinalick\.com)[a-z]/i.test(html.replace(/<!--[\s\S]*?-->/g, "")))
  console.warn("warning: page mentions an external URL");

const csp = [
  "default-src 'self'",
  `script-src 'self' ${hashes.join(" ")}`,
  // Chart.js and the legend swatches set inline style attributes.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  // Data comes through the same-origin relay only.
  "connect-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

// no-transform on the page stops Cloudflare injecting its Web Analytics
// beacon into the HTML, whatever the dashboard setting is.
writeFileSync("dist/_headers", `${BASE}/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  X-Frame-Options: DENY
  X-Robots-Tag: noindex
  Strict-Transport-Security: max-age=31536000

${BASE}/
  Cache-Control: public, max-age=0, must-revalidate, no-transform

${BASE}/vendor/*
  Cache-Control: public, max-age=86400
`);
console.log(`built ${out} with ${hashes.length} inline script hashes`);
