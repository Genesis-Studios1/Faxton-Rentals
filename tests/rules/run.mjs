// Runs every *.test.mjs in this folder against the running Firestore emulator and fails if any line says FAIL.
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const dir = fileURLToPath(new URL(".", import.meta.url));
let pass = 0, fail = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".test.mjs")).sort()) {
  const r = spawnSync("node", [f], { cwd: dir, encoding: "utf8" });
  const lines = (r.stdout || "").split("\n").filter((l) => /^(PASS|FAIL) /.test(l));
  const p = lines.filter((l) => l.startsWith("PASS")).length, bad = lines.filter((l) => l.startsWith("FAIL"));
  pass += p; fail += bad.length || (r.status ? 1 : 0);
  console.log(`${bad.length || r.status ? "FAIL" : "ok  "}  ${f}: ${p} passed${bad.length ? ", " + bad.length + " failed" : ""}`);
  bad.forEach((l) => console.log("      " + l));
  if (!lines.length) {
    const detail = (r.stderr || r.stdout || "").trim().split("\n").slice(-12);
    console.log("      No test results. Process exit: " + r.status);
    detail.forEach((line) => console.log("      " + line));
  }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
