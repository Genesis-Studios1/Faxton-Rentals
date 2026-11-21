import { pathToFileURL } from "node:url";

const expectedProjectId = "faxton-rentals-staging";
const expectedApiOrigin = "https://faxton-backend-staging-ibon.onrender.com";
function requireValue(env, key) {
  const value = typeof env[key] === "string" ? env[key].trim() : "";
  if (!value) throw new Error(`Missing staging smoke-test configuration: ${key}`);
  return value;
}

function validateSmokeConfig(env) {
  const projectId = requireValue(env, "STAGING_FIREBASE_PROJECT_ID");
  const siteId = requireValue(env, "STAGING_FIREBASE_HOSTING_SITE_ID");
  const rawOrigin = requireValue(env, "STAGING_FRONTEND_ORIGIN");
  const apiOrigin = requireValue(env, "STAGING_API_BASE_URL");
  let originUrl;
  try {
    originUrl = new URL(rawOrigin);
  } catch {
    throw new Error("Staging smoke-test origin is invalid or points to production.");
  }

  if (projectId !== expectedProjectId || apiOrigin !== expectedApiOrigin) {
    throw new Error("Staging smoke-test configuration does not target the approved staging project and API.");
  }
  if (
    originUrl.protocol !== "https:" ||
    originUrl.origin !== rawOrigin ||
    originUrl.origin !== `https://${siteId}.web.app`
  ) {
    throw new Error("Staging smoke-test origin is invalid or points to production.");
  }
  if (!/^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/.test(siteId) || siteId === "faxton-rentals") {
    throw new Error("Staging smoke-test Hosting site ID is invalid.");
  }
  const appCheckKey = requireValue(env, "STAGING_APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY");
  const meteredKey = requireValue(env, "STAGING_METERED_TURN_API_KEY");
  return {
    origin: originUrl.origin,
    siteId,
    firebase: {
      apiKey: requireValue(env, "STAGING_FIREBASE_API_KEY"),
      authDomain: requireValue(env, "STAGING_FIREBASE_AUTH_DOMAIN"),
      projectId: expectedProjectId,
      storageBucket: requireValue(env, "STAGING_FIREBASE_STORAGE_BUCKET"),
      messagingSenderId: requireValue(env, "STAGING_FIREBASE_MESSAGING_SENDER_ID"),
      appId: requireValue(env, "STAGING_FIREBASE_APP_ID"),
      ...(String(env.STAGING_FIREBASE_MEASUREMENT_ID ?? "").trim()
        ? { measurementId: env.STAGING_FIREBASE_MEASUREMENT_ID.trim() }
        : {})
    },
    appCheckKey: appCheckKey === "disabled" ? "" : appCheckKey,
    meteredKey: meteredKey === "disabled" ? "" : meteredKey
  };
}

function getFirebaseConfig(source) {
  const match = source.match(/const firebaseConfig = (\{[\s\S]*?\n\});/);
  if (!match) throw new Error("Staging smoke test could not find the served Firebase configuration.");
  try {
    return JSON.parse(match[1]);
  } catch {
    throw new Error("Staging smoke test could not parse the served Firebase configuration.");
  }
}

async function getResponse(fetchImpl, url, label) {
  let response;
  try {
    response = await fetchImpl(url, { cache: "no-store", redirect: "manual" });
  } catch {
    throw new Error(`Staging smoke test could not reach ${label}.`);
  }
  if (!response.ok) throw new Error(`Staging smoke test ${label} returned HTTP ${response.status}.`);
  return { text: await response.text(), headers: response.headers };
}

function getExportedString(source, name, label) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`^\\s*export const ${escaped} = ("(?:\\\\.|[^"\\\\])*");?\\s*$`, "m"));
  if (!match) throw new Error(`Staging smoke test could not verify served ${label}.`);
  try {
    return JSON.parse(match[1]);
  } catch {
    throw new Error(`Staging smoke test could not verify served ${label}.`);
  }
}

export async function smokeTestStagingSite({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const config = validateSmokeConfig(env);
  const root = `${config.origin}/`;
  const [rootResponse, firebaseResponse, apiResponse, appCheckResponse, turnResponse] = await Promise.all([
    getResponse(fetchImpl, root, "the site root"),
    getResponse(fetchImpl, new URL("/js/firebase.js", config.origin), "Firebase configuration"),
    getResponse(fetchImpl, new URL("/js/api-config.js", config.origin), "API configuration"),
    getResponse(fetchImpl, new URL("/js/app-check-config.js", config.origin), "App Check configuration"),
    getResponse(fetchImpl, new URL("/js/turn-config.js", config.origin), "TURN configuration")
  ]);

  if (!/<html[\s>]/i.test(rootResponse.text)) throw new Error("Staging smoke test received an unexpected site-root document.");

  const contentSecurityPolicy = rootResponse.headers.get("content-security-policy") ?? "";
  const connectSource = contentSecurityPolicy.match(/(?:^|;)\s*connect-src\s+([^;]*)/i)?.[1] ?? "";
  if (
    !connectSource.split(/\s+/).includes(expectedApiOrigin) ||
    !connectSource.split(/\s+/).includes(`https://${config.firebase.authDomain}`) ||
    contentSecurityPolicy.includes("https://faxton-rentals.firebaseapp.com")
  ) {
    throw new Error("Staging smoke test found a Content-Security-Policy mismatch.");
  }

  const firebase = getFirebaseConfig(firebaseResponse.text);
  for (const key of ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId", "measurementId"]) {
    if (firebase[key] !== config.firebase[key]) {
      throw new Error("Staging smoke test found a Firebase configuration mismatch.");
    }
  }
  if (getExportedString(apiResponse.text, "API_BASE_URL", "API origin") !== expectedApiOrigin) {
    throw new Error("Staging smoke test found an API origin mismatch.");
  }
  if (getExportedString(appCheckResponse.text, "APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY", "App Check configuration") !== config.appCheckKey) {
    throw new Error("Staging smoke test found an App Check configuration mismatch.");
  }
  if (getExportedString(turnResponse.text, "METERED_TURN_API_KEY", "TURN configuration") !== config.meteredKey) {
    throw new Error("Staging smoke test found a TURN configuration mismatch.");
  }

  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await smokeTestStagingSite();
    console.log("Staging Hosting smoke test passed.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Staging Hosting smoke test failed.");
    process.exitCode = 1;
  }
}
