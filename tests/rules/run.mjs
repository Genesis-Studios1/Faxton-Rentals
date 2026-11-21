// Runs every *.test.mjs in this folder against the running Firestore emulator.
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));
let pass = 0;
let fail = 0;

for (const file of readdirSync(dir).filter((name) => name.endsWith(".test.mjs")).sort()) {
  const result = spawnSync("node", [file], { cwd: dir, encoding: "utf8" });
  const lines = (result.stdout || "").split("\n").filter((line) => /^(PASS|FAIL) /.test(line));
  const passed = lines.filter((line) => line.startsWith("PASS")).length;
  const failures = lines.filter((line) => line.startsWith("FAIL"));
  const failed = failures.length > 0 || result.status !== 0 || lines.length === 0;

  pass += passed;
  fail += failed ? Math.max(failures.length, 1) : 0;

  console.log(`${failed ? "FAIL" : "ok  "}  ${file}: ${passed} passed${failures.length ? ", " + failures.length + " failed" : ""}${!lines.length ? " (no test results emitted)" : ""}`);
  failures.forEach((line) => console.log("      " + line));

  if (result.error) console.error(result.error.message);
  if (result.stderr) console.error(result.stderr.trim());
  if (!lines.length && result.stdout) console.log(result.stdout.trim());
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
