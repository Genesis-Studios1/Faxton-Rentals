// Checks a LIVE site from the outside:   node scripts/smoke-live.mjs https://faxton-rentals.web.app
// Prints one line per check and exits with 1 if anything important is wrong. Needs Node 18 or newer. No installs.
const base = (process.argv[2] || "https://faxton-rentals.web.app").replace(/\/+$/, "");
const local = /^http:\/\/(127\.0\.0\.1|localhost)/.test(base);
let failed = 0;
const line = (ok, msg, extra = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${msg}${extra ? "  (" + extra + ")" : ""}`); };
const get = async (path, opt = {}) => { try { return await fetch(base + path, { redirect: "manual", ...opt }); } catch (e) { return { status: 0, headers: new Headers(), text: async () => "", error: e }; } };

const home = await get("/");
const h = home.headers;
const html = await home.text();
line(home.status === 200, "Home page answers 200", "got " + home.status);
line(/<title>[^<]+<\/title>/.test(html), "Home page has a title");
line(/og:image/.test(html) && /rel="canonical"/.test(html), "Sharing tags and canonical link are present");
if (!local) line(/max-age=\d{6,}/.test(h.get("strict-transport-security") || ""), "HSTS header", h.get("strict-transport-security") || "missing");
line(/default-src 'self'/.test(h.get("content-security-policy") || ""), "Content-Security-Policy header");
line(/frame-ancestors 'none'/.test(h.get("content-security-policy") || ""), "Page cannot be put inside another site (frame-ancestors)");
line((h.get("x-content-type-options") || "") === "nosniff", "X-Content-Type-Options: nosniff");
line(/same-origin-allow-popups/.test(h.get("cross-origin-opener-policy") || ""), "Cross-Origin-Opener-Policy lets the Google sign-in pop-up work");
line(/no-cache|max-age=0/.test(h.get("cache-control") || ""), "Home page is not cached for long", h.get("cache-control") || "missing");

const sw = await get("/sw.js"); line(sw.status === 200 && /no-cache|max-age=0/.test(sw.headers.get("cache-control") || ""), "Service worker is served fresh (no-cache)", "status " + sw.status);
const mf = await get("/manifest.webmanifest"); let mj = {}; try { mj = JSON.parse(await mf.text()); } catch {}
line(mf.status === 200 && mj.name === "Faxton Rentals" && (mj.icons || []).some((i) => i.purpose === "maskable"), "Manifest is valid and has a maskable icon");
const al = await get("/.well-known/assetlinks.json"); let aj = []; try { aj = JSON.parse(await al.text()); } catch {}
line(al.status === 200 && Array.isArray(aj) && aj[0]?.target?.package_name === "com.faxton.rentals", "Android app-link file is published (.well-known/assetlinks.json)");
const og = await get("/img/og-image.jpg"); line(og.status === 200 && /image\//.test(og.headers.get("content-type") || ""), "Sharing picture (og-image.jpg) loads");
const rb = await get("/robots.txt"); line(rb.status === 200 && /Sitemap:/i.test(await rb.text()), "robots.txt lists the sitemap");
const sm = await get("/sitemap.xml"); line(sm.status === 200 && /<urlset/.test(await sm.text()), "sitemap.xml loads");
const nf = await get("/this-page-does-not-exist"); line(nf.status === 404, "Unknown addresses answer 404", "got " + nf.status);
const nfh = await nf.text(); line(/We couldn.t find that page/.test(nfh), "...and show the friendly 404 page");
const off = await get("/offline"); line(off.status === 200, "Offline page is published", "status " + off.status);
const font = await get("/fonts/inter-latin-400-normal.woff2"); line(font.status === 200 && /immutable/.test(font.headers.get("cache-control") || ""), "Fonts are cached for a year (immutable)");
const lf = await get("/vendor/leaflet/leaflet.js"); line(lf.status === 200, "Map library is hosted on your own site (no third party)");
const priv = await get("/firebase.json"); line(priv.status === 404, "firebase.json is NOT downloadable", "status " + priv.status);
const dot = await get("/.git/config"); line(dot.status === 404, ".git is NOT downloadable", "status " + dot.status);

console.log(failed ? `\n${failed} check(s) failed. See LAUNCH.md > "Launch day".` : "\nAll checks passed. Now do the by-hand test in LAUNCH.md (sign up, search, message, call).");
process.exit(failed ? 1 : 0);
