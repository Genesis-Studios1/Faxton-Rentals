// Parse-check every first-party browser JavaScript module before a release.
// Vendor libraries are intentionally excluded: they are third-party files, not application source.
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const sourceRoot = join(root, "public", "js");
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(path);
  }
}
walk(sourceRoot);
files.sort();

let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--experimental-default-type=module", "--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    failed++;
    process.stderr.write("FAIL " + relative(root, file) + "\n");
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.stdout) process.stderr.write(result.stdout);
  }
}
if (failed) {
  process.stderr.write("\n" + failed + " of " + files.length + " browser modules failed syntax validation.\n");
  process.exit(1);
}
console.log("PASS: syntax checked all " + files.length + " first-party browser JavaScript modules.");
