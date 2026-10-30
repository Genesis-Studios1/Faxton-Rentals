import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ui = readFileSync("public/js/ui.js", "utf8");
const sw = readFileSync("public/sw.js", "utf8");
const html = readFileSync("public/app/index.html", "utf8");
const uiBuild = /export const BUILD = "([^"]+)"/.exec(ui)?.[1];
const swBuild = /const BUILD = "([^"]+)"/.exec(sw)?.[1];
const versions = [...html.matchAll(/(?:src|href)="(?:css|js)\/[^"?]+\?v=([^"]+)"/g)].map((m) => m[1]);

assert.ok(uiBuild, "public/js/ui.js must define BUILD");
assert.equal(swBuild, uiBuild, "service worker and app BUILD values must match");
assert.ok(versions.length, "app entry point must include versioned CSS/JS assets");
assert.ok(versions.every((v) => v === uiBuild), "every versioned CSS/JS asset must match BUILD");
console.log("PASS: app cache version is consistent (" + uiBuild + ")");
