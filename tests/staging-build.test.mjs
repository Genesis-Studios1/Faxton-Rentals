import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildStagingSite, STAGING_API_BASE_URL, STAGING_PROJECT_ID } from "../scripts/build-staging-site.mjs";
import { smokeTestStagingSite } from "../scripts/smoke-staging-site.mjs";
import { validateStagingServiceAccountJson } from "../scripts/validate-staging-service-account.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

function stagingEnv(overrides = {}) {
  return {
    STAGING_FIREBASE_PROJECT_ID: STAGING_PROJECT_ID,
    STAGING_FIREBASE_API_KEY: "fixture-staging-web-api-key",
    STAGING_FIREBASE_AUTH_DOMAIN: "fixture-staging.firebaseapp.com",
    STAGING_FIREBASE_STORAGE_BUCKET: "fixture-staging.firebasestorage.app",
    STAGING_FIREBASE_MESSAGING_SENDER_ID: "fixture-staging-sender",
    STAGING_FIREBASE_APP_ID: "1:fixture-staging:web:app",
    STAGING_FIREBASE_MEASUREMENT_ID: "G-STAGING-FIXTURE",
    STAGING_APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY: "fixture-staging-app-check-key",
    STAGING_METERED_TURN_API_KEY: "fixture-staging-metered-key",
    STAGING_FIREBASE_HOSTING_SITE_ID: "fixture-staging",
    STAGING_FRONTEND_ORIGIN: "https://fixture-staging.web.app",
    STAGING_API_BASE_URL,
    ...overrides
  };
}

function expectedFirebaseConfig(env = stagingEnv()) {
  return {
    apiKey: env.STAGING_FIREBASE_API_KEY,
    authDomain: env.STAGING_FIREBASE_AUTH_DOMAIN,
    projectId: STAGING_PROJECT_ID,
    storageBucket: env.STAGING_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.STAGING_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.STAGING_FIREBASE_APP_ID,
    ...(env.STAGING_FIREBASE_MEASUREMENT_ID
      ? { measurementId: env.STAGING_FIREBASE_MEASUREMENT_ID }
      : {})
  };
}

function getFirebaseConfig(source) {
  const match = source.match(/const firebaseConfig = (\{[\s\S]*?\n\});/);
  assert.ok(match, "Firebase config block exists");
  return JSON.parse(match[1]);
}

function getFirebaseField(source, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`^\\s*${escaped}:\\s*("(?:\\\\.|[^"\\\\])*")`, "m"));
  assert.ok(match, `Firebase ${name} config exists`);
  return JSON.parse(match[1]);
}

async function withTempOutput(callback) {
  const root = await mkdtemp(path.join(os.tmpdir(), "faxton-staging-build-"));
  const outputDir = path.join(root, "artifact");
  try {
    return await callback(outputDir);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("staging artifact replaces Firebase, App Check, TURN, API and CSP config", async () => {
  await withTempOutput(async (outputDir) => {
    const env = stagingEnv();
    const result = await buildStagingSite({ repoRoot, outputDir, env });
    const firebaseJs = await readFile(path.join(result, "public", "js", "firebase.js"), "utf8");
    const apiConfig = await readFile(path.join(result, "public", "js", "api-config.js"), "utf8");
    const appCheck = await readFile(path.join(result, "public", "js", "app-check-config.js"), "utf8");
    const turnConfig = await readFile(path.join(result, "public", "js", "turn-config.js"), "utf8");
    const stagingProfile = await readFile(path.join(result, "public", "js", "profile.js"), "utf8");
    const stagingSafety = await readFile(path.join(result, "public", "js", "safety.js"), "utf8");
    const hosting = JSON.parse(await readFile(path.join(result, "firebase.json"), "utf8"));

    assert.deepEqual(getFirebaseConfig(firebaseJs), expectedFirebaseConfig(env));
    assert.match(apiConfig, new RegExp(JSON.stringify(STAGING_API_BASE_URL).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(appCheck, new RegExp(JSON.stringify(env.STAGING_APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY)));
    assert.match(turnConfig, new RegExp(JSON.stringify(env.STAGING_METERED_TURN_API_KEY)));
    assert.doesNotMatch(stagingProfile, /https:\/\/faxton-rentals\.web\.app/);
    assert.doesNotMatch(stagingSafety, /https:\/\/faxton-rentals\.web\.app/);
    assert.equal(hosting.hosting.site, env.STAGING_FIREBASE_HOSTING_SITE_ID);
    assert.deepEqual(Object.keys(hosting), ["hosting"]);

    const policies = hosting.hosting.headers.flatMap((rule) => rule.headers ?? [])
      .filter((header) => header.key.toLowerCase() === "content-security-policy")
      .map((header) => header.value);
    assert.ok(policies.length > 0);
    for (const policy of policies) {
      assert.match(policy, /https:\/\/fixture-staging\.firebaseapp\.com/);
      assert.doesNotMatch(policy, /https:\/\/faxton-rentals\.firebaseapp\.com/);
      assert.match(policy, /connect-src[^;]*https:\/\/faxton-backend-staging-ibon\.onrender\.com/);
    }
    assert.match(JSON.stringify(hosting.hosting.headers), /X-Robots-Tag/);
  });
});

test("production Firebase, App Check and TURN settings are rejected or replaced", async () => {
  const productionFirebase = await readFile(path.join(repoRoot, "public", "js", "firebase.js"), "utf8");
  const productionConfig = Object.fromEntries(
    ["apiKey", "authDomain", "storageBucket", "messagingSenderId", "appId", "measurementId"]
      .map((name) => [name, getFirebaseField(productionFirebase, name)])
  );
  const productionAppCheck = await readFile(path.join(repoRoot, "public", "js", "app-check-config.js"), "utf8");
  const productionTurn = await readFile(path.join(repoRoot, "public", "js", "turn-config.js"), "utf8");
  const appCheckKey = productionAppCheck.match(/APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY\s*=\s*("(?:\\.|[^"\\])*")/)?.[1];
  const turnKey = productionTurn.match(/METERED_TURN_API_KEY\s*=\s*("(?:\\.|[^"\\])*")/)?.[1];
  assert.ok(appCheckKey);
  assert.ok(turnKey);

  for (const [name, value] of Object.entries(productionConfig)) {
    if (name === "projectId") continue;
    await withTempOutput(async (outputDir) => {
      await assert.rejects(
        buildStagingSite({ repoRoot, outputDir, env: stagingEnv({ [`STAGING_FIREBASE_${name.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`]: value }) }),
        /different from production configuration/);
    });
  }
  await withTempOutput(async (outputDir) => {
    await assert.rejects(
      buildStagingSite({ repoRoot, outputDir, env: stagingEnv({ STAGING_APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY: JSON.parse(appCheckKey) }) }),
      /must not reuse production configuration/);
  });
  await withTempOutput(async (outputDir) => {
    await assert.rejects(
      buildStagingSite({ repoRoot, outputDir, env: stagingEnv({ STAGING_METERED_TURN_API_KEY: JSON.parse(turnKey) }) }),
      /must not reuse production configuration/);
  });
});

test("missing or wrong staging project/API values fail before creating output", async () => {
  await withTempOutput(async (outputDir) => {
    await assert.rejects(buildStagingSite({ repoRoot, outputDir, env: {} }), /Missing required staging configuration/);
  });
  await withTempOutput(async (outputDir) => {
    await assert.rejects(
      buildStagingSite({ repoRoot, outputDir, env: stagingEnv({ STAGING_FIREBASE_APP_ID: "STAGING_FIREBASE_APP_ID" }) }),
      /is still a placeholder/
    );
  });
  await withTempOutput(async (outputDir) => {
    await assert.rejects(
      buildStagingSite({ repoRoot, outputDir, env: stagingEnv({
        STAGING_FIREBASE_APP_ID: "STAGING_FIREBASE_APP_ID",
        STAGING_METERED_TURN_API_KEY: ""
      }) }),
      (error) => {
        assert.match(error.message, /Missing required staging configuration: STAGING_METERED_TURN_API_KEY/);
        assert.match(error.message, /STAGING_FIREBASE_APP_ID is still a placeholder/);
        return true;
      }
    );
  });
  await withTempOutput(async (outputDir) => {
    await assert.rejects(
      buildStagingSite({ repoRoot, outputDir, env: stagingEnv({ STAGING_FIREBASE_PROJECT_ID: "faxton-rentals" }) }),
      /must target faxton-rentals-staging/);
  });
  await withTempOutput(async (outputDir) => {
    await assert.rejects(
      buildStagingSite({ repoRoot, outputDir, env: stagingEnv({ STAGING_API_BASE_URL: "https://faxton-backend.onrender.com" }) }),
      /must target the approved staging backend/);
  });
  await withTempOutput(async (outputDir) => {
    await assert.rejects(
      buildStagingSite({ repoRoot, outputDir, env: stagingEnv({ STAGING_FRONTEND_ORIGIN: "https://faxton-rentals.web.app" }) }),
      /must match the configured Firebase Hosting site/);
  });
});

test("Hosting site IDs enforce the hostname format and 30-character maximum", async () => {
  for (const siteId of ["a".repeat(31), "bad_site", "bad.site", "-leading", "trailing-", "UpperCase"]) {
    await withTempOutput(async (outputDir) => {
      await assert.rejects(
        buildStagingSite({ repoRoot, outputDir, env: stagingEnv({ STAGING_FIREBASE_HOSTING_SITE_ID: siteId }) }),
        /Invalid staging Firebase Hosting site ID/);
    });
  }
  await withTempOutput(async (outputDir) => {
    const siteId = "a".repeat(30);
    const result = await buildStagingSite({
      repoRoot,
      outputDir,
      env: stagingEnv({
        STAGING_FIREBASE_HOSTING_SITE_ID: siteId,
        STAGING_FRONTEND_ORIGIN: `https://${siteId}.web.app`
      })
    });
    const hosting = JSON.parse(await readFile(path.join(result, "firebase.json"), "utf8"));
    assert.equal(hosting.hosting.site, siteId);
  });
});

test("disabled optional public integrations are explicit and do not use production values", async () => {
  await withTempOutput(async (outputDir) => {
    const result = await buildStagingSite({
      repoRoot,
      outputDir,
      env: stagingEnv({
        STAGING_APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY: "disabled",
        STAGING_METERED_TURN_API_KEY: "disabled"
      })
    });
    const appCheck = await readFile(path.join(result, "public", "js", "app-check-config.js"), "utf8");
    const turn = await readFile(path.join(result, "public", "js", "turn-config.js"), "utf8");
    assert.match(appCheck, /=\s*"";/);
    assert.match(turn, /=\s*"";/);
  });
});

test("credential validation accepts a valid staging key and safely rejects invalid inputs", () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const validCredential = JSON.stringify({
    type: "service_account",
    project_id: STAGING_PROJECT_ID,
    client_email: `staging-test@${STAGING_PROJECT_ID}.iam.gserviceaccount.com`,
    private_key: privateKey.export({ type: "pkcs8", format: "pem" })
  });
  assert.equal(validateStagingServiceAccountJson(validCredential), true);

  for (const invalid of [
    "not-json-private-key-sentinel",
    JSON.stringify({ type: "service_account", project_id: "faxton-rentals", client_email: "production@example.invalid", private_key: "private-key-sentinel" }),
    JSON.stringify({ type: "service_account", project_id: STAGING_PROJECT_ID, client_email: `staging-test@${STAGING_PROJECT_ID}.iam.gserviceaccount.com`, private_key: "private-key-sentinel" })
  ]) {
    assert.throws(() => validateStagingServiceAccountJson(invalid), (error) => {
      assert.equal(error.message, "Staging Firebase deploy credential is invalid.");
      assert.equal(error.message.includes("private-key-sentinel"), false);
      return true;
    });
  }

  const validRun = spawnSync(process.execPath, ["scripts/validate-staging-service-account.mjs"], {
    cwd: repoRoot,
    env: { ...process.env, FIREBASE_STAGING_SERVICE_ACCOUNT: validCredential },
    encoding: "utf8"
  });
  assert.equal(validRun.status, 0);
  assert.match(validRun.stdout, /credential structure validated/);
  assert.equal(validRun.stdout.includes(privateKey.export({ type: "pkcs8", format: "pem" })), false);

  const invalidRun = spawnSync(process.execPath, ["scripts/validate-staging-service-account.mjs"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FIREBASE_STAGING_SERVICE_ACCOUNT: JSON.stringify({ type: "service_account", private_key: "PRIVATE-KEY-SENTINEL" })
    },
    encoding: "utf8"
  });
  assert.equal(invalidRun.status, 1);
  assert.match(invalidRun.stderr, /validation failed/);
  assert.equal(`${invalidRun.stdout}${invalidRun.stderr}`.includes("PRIVATE-KEY-SENTINEL"), false);
});

function smokeEnv(overrides = {}) {
  return stagingEnv(overrides);
}

test("post-deploy smoke test validates served staging settings without following redirects", async () => {
  const env = smokeEnv();
  const firebaseJs = `const firebaseConfig = ${JSON.stringify(expectedFirebaseConfig(env), null, 2)};`;
  const responses = new Map([
    ["/", "<!doctype html><html><body>Faxton staging</body></html>"],
    ["/js/firebase.js", firebaseJs],
    ["/js/api-config.js", `export const API_BASE_URL = ${JSON.stringify(STAGING_API_BASE_URL)};`],
    ["/js/app-check-config.js", `export const APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY = ${JSON.stringify(env.STAGING_APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY)};`],
    ["/js/turn-config.js", `export const METERED_TURN_API_KEY = ${JSON.stringify(env.STAGING_METERED_TURN_API_KEY)};`]
  ]);
  const requests = [];
  const fetchImpl = async (url, options) => {
    const parsed = new URL(url);
    requests.push(parsed.origin);
    assert.equal(options.redirect, "manual");
    return new Response(responses.get(parsed.pathname) ?? "not found", {
      status: responses.has(parsed.pathname) ? 200 : 404,
      headers: parsed.pathname === "/"
        ? { "content-security-policy": `default-src 'self'; connect-src 'self' https://${env.STAGING_FIREBASE_AUTH_DOMAIN} ${STAGING_API_BASE_URL}` }
        : {}
    });
  };

  assert.equal(await smokeTestStagingSite({ env, fetchImpl }), true);
  assert.equal(requests.length, 5);
  assert.ok(requests.every((origin) => origin === env.STAGING_FRONTEND_ORIGIN));
});

test("smoke test rejects mixed production API configuration and a stale CSP", async () => {
  const env = smokeEnv();
  const firebaseJs = `const firebaseConfig = ${JSON.stringify(expectedFirebaseConfig(env), null, 2)};`;
  const responses = new Map([
    ["/", "<!doctype html><html><body>Faxton staging</body></html>"],
    ["/js/firebase.js", firebaseJs],
    ["/js/api-config.js", `export const API_BASE_URL = ${JSON.stringify("https://faxton-backend.onrender.com")};\n// ${JSON.stringify(STAGING_API_BASE_URL)}`],
    ["/js/app-check-config.js", `export const APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY = ${JSON.stringify(env.STAGING_APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY)};`],
    ["/js/turn-config.js", `export const METERED_TURN_API_KEY = ${JSON.stringify(env.STAGING_METERED_TURN_API_KEY)};`]
  ]);
  const fetchImpl = async (url) => new Response(responses.get(new URL(url).pathname), {
    status: 200,
    headers: new URL(url).pathname === "/"
      ? { "content-security-policy": `default-src 'self'; connect-src 'self' https://${env.STAGING_FIREBASE_AUTH_DOMAIN} ${STAGING_API_BASE_URL}` }
      : {}
  });

  const staleCspFetch = async (url) => {
    const parsed = new URL(url);
    const headers = parsed.pathname === "/"
      ? { "content-security-policy": `default-src 'self'; connect-src 'self' https://${env.STAGING_FIREBASE_AUTH_DOMAIN}` }
      : {};
    return new Response(responses.get(parsed.pathname), { status: 200, headers });
  };
  await assert.rejects(smokeTestStagingSite({ env, fetchImpl: staleCspFetch }), /Content-Security-Policy mismatch/);
  await assert.rejects(smokeTestStagingSite({ env, fetchImpl }), /API origin mismatch/);
});

test("smoke test refuses production origins and fails clearly on unsuccessful responses", async () => {
  let calls = 0;
  await assert.rejects(
    smokeTestStagingSite({
      env: smokeEnv({ STAGING_FRONTEND_ORIGIN: "https://faxton-rentals.web.app" }),
      fetchImpl: async () => { calls += 1; return new Response("", { status: 200 }); }
    }),
    /invalid or points to production/);
  assert.equal(calls, 0);

  await assert.rejects(
    smokeTestStagingSite({
      env: smokeEnv(),
      fetchImpl: async (url) => new Response("", { status: new URL(url).pathname === "/" ? 302 : 200 })
    }),
    /site root returned HTTP 302/);
});

test("staging deploy is environment-protected, branch-restricted and Hosting-only", async () => {
  const workflow = await readFile(path.join(repoRoot, ".github", "workflows", "deploy-staging.yml"), "utf8");
  assert.match(workflow, /branches:\s*\[staging\]/);
  assert.match(workflow, /if:\s*github\.ref == 'refs\/heads\/staging'/);
  assert.match(workflow, /environment:\s*staging/);
  assert.match(workflow, /run: node scripts\/validate-staging-service-account\.mjs/);
  assert.match(await readFile(path.join(repoRoot, "scripts", "validate-staging-service-account.mjs"), "utf8"), /import \{ createPrivateKey \} from "node:crypto"/);
  assert.doesNotMatch(workflow, /require\("node:crypto"\)/);
  assert.match(workflow, /--project faxton-rentals-staging --only hosting/);
  assert.doesNotMatch(workflow, /--only[^\n]*(?:firestore|storage|functions)/i);
  assert.ok(workflow.indexOf("deploy --config") < workflow.indexOf("Smoke test the deployed staging frontend"));
  assert.match(workflow, /node scripts\/smoke-staging-site\.mjs/);
});
