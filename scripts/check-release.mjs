// Release check. Run before every deploy:   npm run check      (or: node scripts/check-release.mjs)
// It reads the project files only (no network) and tells you, in plain words, if something would break the release.
// Exit code 1 = a real problem. "Launch to-do" lines are things only the owner can fill in (see LAUNCH.md); they never fail the check.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");
const read = (p) => readFileSync(join(root, p), "utf8");
const problems = [], todo = [];
const bad = (m) => problems.push(m);

// 1. One version number everywhere ------------------------------------------------------------
const uiBuild = /export const BUILD = "([^"]+)"/.exec(read("public/js/ui.js"))?.[1];
const swBuild = /const BUILD = "([^"]+)"/.exec(read("public/sw.js"))?.[1];
const html = read("public/index.html");
const vs = [...html.matchAll(/(?:src|href)="(?:css|js)\/[^"?]+\?v=([^"]+)"/g)].map((m) => m[1]);
if (!uiBuild) bad("js/ui.js has no BUILD constant.");
if (!swBuild) bad("sw.js has no BUILD constant.");
if (uiBuild && swBuild && uiBuild !== swBuild) bad(`Version mismatch: js/ui.js says ${uiBuild} but sw.js says ${swBuild}. Make them equal.`);
const odd = [...new Set(vs)].filter((v) => v !== uiBuild);
if (odd.length) bad(`index.html has ?v= values (${odd.join(", ")}) that differ from BUILD ${uiBuild}. Every css and js link in index.html must end with ?v=${uiBuild}.`);
const unversioned = [...html.matchAll(/(?:src|href)="((?:css|js)\/[^"]+)"/g)].map((m) => m[1]).filter((u) => !u.includes("?v=") && !/^js\/[a-z0-9-]+\.js$/.test(u));
if (unversioned.length) bad(`index.html loads files without ?v=${uiBuild}: ${unversioned.join(", ")}`);

// 2. Everything the service worker saves must exist ------------------------------------------------
const sw = read("public/sw.js");
const listed = [...sw.matchAll(/"((?:css|js|img|assets|icons|fonts)\/[^"?]+)(?:"| ?\+ ?V)/g)].map((m) => m[1]);
const modNames = /\[("applock"[^\]]+)\]\.map/.exec(sw)?.[1].match(/"([a-z0-9-]+)"/g)?.map((s) => "js/" + s.replaceAll('"', "") + ".js") || [];
for (const f of new Set([...listed, ...modNames, "offline.html", "manifest.webmanifest"])) if (!existsSync(join(pub, f))) bad(`sw.js saves "${f}" but that file does not exist.`);

for (const m of html.matchAll(/(?:src|href)="((?:css|js)\/[^"?]+)\?v=/g)) if (!sw.includes(`"${m[1]}"`)) problems.push(`Offline: sw.js does not save ${m[1]} (add "${m[1]}" + V to CORE in sw.js).`);

// 3. Modules the app needs at start-up should be pre-loaded in index.html and saved by the service worker
const graph = new Set(), stack = ["main.js"];
while (stack.length) {
  const f = stack.pop(); if (graph.has(f) || !existsSync(join(pub, "js", f))) continue; graph.add(f);
  for (const m of read("public/js/" + f).matchAll(/(?:^|\n)\s*(?:import|export)[^;\n]*?from\s*"\.\/([a-z0-9-]+\.js)"/g)) stack.push(m[1]);
}
for (const f of graph) {
  if (f === "main.js") continue;
  if (!html.includes(`href="js/${f}"`)) problems.push(`Slower start: index.html does not preload js/${f} (add <link rel="modulepreload" href="js/${f}">).`);
  if (!modNames.includes("js/" + f)) problems.push(`Offline: sw.js does not save js/${f} (add "${f.replace(".js", "")}" to the module list in sw.js).`);
}

// 4. Head essentials ------------------------------------------------------------------------
for (const [re, what] of [[/<title>[^<]{10,}<\/title>/, "a <title>"], [/name="description"/, "a meta description"], [/rel="canonical"/, "a canonical link"], [/property="og:image"/, "an og:image"], [/name="twitter:card"/, "a twitter:card"], [/application\/ld\+json/, "JSON-LD"], [/rel="manifest"/, "the manifest link"], [/<html lang=/, "a lang attribute"]]) if (!re.test(html)) bad(`index.html is missing ${what}.`);
for (const f of ["img/og-image.jpg", "robots.txt", "sitemap.xml", "404.html", "offline.html", ".well-known/assetlinks.json", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png"]) if (!existsSync(join(pub, f))) bad(`public/${f} is missing.`);
try { const m = JSON.parse(read("public/manifest.webmanifest")); for (const i of m.icons) if (!existsSync(join(pub, i.src))) bad(`manifest icon ${i.src} is missing.`); } catch (e) { bad("manifest.webmanifest is not valid JSON."); }
try { JSON.parse(read("public/.well-known/assetlinks.json")); } catch { bad(".well-known/assetlinks.json is not valid JSON."); }
let cfg; try { cfg = JSON.parse(read("firebase.json")); } catch { bad("firebase.json is not valid JSON."); }
const csp = JSON.stringify(cfg?.hosting?.headers || []);
if (cfg && !/Content-Security-Policy/.test(csp)) bad("firebase.json has no Content-Security-Policy.");

// 5. Every outside website the code talks to must be allowed by the security policy --------------------
const cspText = (cfg?.hosting?.headers || []).flatMap((h) => h.headers).find((h) => h.key === "Content-Security-Policy")?.value || "";
const allowed = new Set([...cspText.matchAll(/https:\/\/([a-z0-9*.-]+)/g)].map((m) => m[1]));
const ok = (h) => allowed.has(h) || [...allowed].some((a) => a.startsWith("*.") && h.endsWith(a.slice(1)));
const skip = /^(www\.w3\.org|faxton-rentals\.web\.app|yourbusiness\.com|wa\.me|www\.google\.com|outlook\.live\.com|mail\.yahoo\.com|mail\.google\.com|yourapp\.metered\.live|www\.youtube\.com|i\.ytimg\.com|schema\.org|github\.com|apps\.apple\.com|play\.google\.com|[a-z.]*tile\.openstreetmap\.org|\{s\}\.tile\.openstreetmap\.org)$/;
for (const f of readdirSync(join(pub, "js")).filter((x) => x.endsWith(".js"))) {
  for (const m of read("public/js/" + f).matchAll(/["'`]https:\/\/([a-z0-9{}.-]+)/g)) {
    const h = m[1]; if (skip.test(h) || ok(h)) continue;
    if (/^(www\.google\.com|accounts\.google\.com)$/.test(h)) continue;
    problems.push(`js/${f} talks to ${h}, which the security policy in firebase.json does not allow (it will be blocked in production, check it is only a link and not a request).`);
  }
}

// 6. Owner to-do list (never fails the check) ----------------------------------------------------
if (/SUPPORT_EMAIL = "\{/.test(read("public/js/fx.js"))) todo.push("Set SUPPORT_EMAIL in public/js/fx.js (support address shown in Terms, Privacy and Help).");
const socials = read("public/js/footer.js");
const emptySocials = [...socials.matchAll(/\["(Instagram|LinkedIn|X|YouTube|TikTok|Pinterest)", ""/g)].map((m) => m[1]);
if (emptySocials.length) todo.push(`Add real page addresses for: ${emptySocials.join(", ")} (SOCIALS in public/js/footer.js), or leave them as "coming soon".`);
if (/0C:72:5F:9B/.test(read("public/.well-known/assetlinks.json"))) todo.push("Android app links still use the sideload key. After Play App Signing is on, add the Play signing SHA-256 to public/.well-known/assetlinks.json.");
if (/faxton-rentals\.web\.app/.test(html) && !process.argv.includes("--no-domain-note")) todo.push("Using the free web.app address. When you add a custom domain, replace faxton-rentals.web.app in index.html, sitemap.xml, robots.txt and rebuild img/og-image.jpg (LAUNCH.md, step 1).");

// ---------------------------------------------------------------------------------------------
const real = problems.filter((p) => !p.startsWith("Slower start") && !p.startsWith("Offline:"));
const soft = problems.filter((p) => p.startsWith("Slower start") || p.startsWith("Offline:"));
console.log(`Faxton release check. Version ${uiBuild || "?"}\n`);
if (real.length) { console.log("PROBLEMS (fix these before deploying):"); real.forEach((p) => console.log("  x " + p)); } else console.log("OK  versions, files, head tags and security policy all line up.");
if (soft.length) { console.log("\nSuggestions:"); soft.forEach((p) => console.log("  - " + p)); }
if (todo.length) { console.log("\nLaunch to-do (only you can do these):"); todo.forEach((p) => console.log("  [ ] " + p)); }
process.exit(real.length ? 1 : 0);
