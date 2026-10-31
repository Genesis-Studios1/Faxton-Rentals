import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const ax = read("public/js/ax.js");
const waitlist = read("public/js/waitlist.js");
const map = /const X = \{([\s\S]*?)\n\};/.exec(ax)?.[1];
if (!map) throw new Error("Could not find the shared admin icon map in public/js/ax.js.");

const defined = new Set([...map.matchAll(/^\s*([A-Za-z_$][\w$]*):/gm)].map((match) => match[1]));
const used = [...new Set([...waitlist.matchAll(/\bI\(\s*["']([^"']+)["']/g)].map((match) => match[1]))];
const missing = used.filter((name) => !defined.has(name));

if (missing.length) {
  console.error("Waitlist uses icons missing from public/js/ax.js: " + missing.join(", "));
  process.exit(1);
}
console.log("Waitlist icon check passed (" + used.length + " icon references).");
