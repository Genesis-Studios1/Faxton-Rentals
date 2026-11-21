import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const STAGING_PROJECT_ID = "faxton-rentals-staging";
export const STAGING_API_BASE_URL = "https://faxton-backend-staging-ibon.onrender.com";
const DEFAULT_OUTPUT_DIR = ".faxton-staging-build";

const requiredVariables = [
  "STAGING_FIREBASE_PROJECT_ID",
  "STAGING_FIREBASE_API_KEY",
  "STAGING_FIREBASE_AUTH_DOMAIN",
  "STAGING_FIREBASE_STORAGE_BUCKET",
  "STAGING_FIREBASE_MESSAGING_SENDER_ID",
  "STAGING_FIREBASE_APP_ID",
  "STAGING_APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY",
  "STAGING_METERED_TURN_API_KEY",
  "STAGING_FIREBASE_HOSTING_SITE_ID",
  "STAGING_FRONTEND_ORIGIN",
  "STAGING_API_BASE_URL"
];

const excludedNames = [
  /^\.env(?:\..*)?$/i,
  /\.pem$/i,
  /\.key$/i,
  /^serviceaccount.*\.json$/i,
  /-firebase-adminsdk-.*\.json$/i
];

const privateMaterialPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /"private_key"\s*:/i,
  /"client_email"\s*:/i,
  /"type"\s*:\s*"service_account"/i
];

const textExtensions = new Set([
  ".css", ".html", ".js", ".json", ".mjs", ".svg", ".txt", ".webmanifest", ".xml"
]);

function requireValue(env, name) {
  const value = typeof env[name] === "string" ? env[name].trim() : "";
  if (!value) throw new Error(`Missing required staging configuration: ${name}`);
  return value;
}

function requireOrigin(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid staging origin configuration: ${name}`);
  }
  if (url.protocol !== "https:" || url.origin !== value || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error(`Invalid staging origin configuration: ${name}`);
  }
  return url.origin;
}

function requireHost(value, name) {
  if (value.includes("://") || value.includes("/") || !/^[a-z0-9.-]+$/i.test(value)) {
    throw new Error(`Invalid staging host configuration: ${name}`);
  }
  return value;
}

function readConfigString(contents, key) {
  const pattern = new RegExp(`^\\s*${key}:\\s*("(?:\\\\.|[^"\\\\])*")\\s*,?\\s*$`, "m");
  const match = contents.match(pattern);
  if (!match) throw new Error(`Could not verify the existing production ${key} config safely.`);
  return JSON.parse(match[1]);
}

function getStagingConfig(env) {
  const missing = requiredVariables.filter((name) => !String(env[name] ?? "").trim());
  if (missing.length) throw new Error(`Missing required staging configuration: ${missing.join(", ")}`);

  if (env.STAGING_FIREBASE_PROJECT_ID.trim() !== STAGING_PROJECT_ID) {
    throw new Error("Staging Firebase project configuration must target faxton-rentals-staging.");
  }
  if (/^(?:STAGING_|YOUR_|REPLACE_|TODO|CHANGEME)/i.test(env.STAGING_FIREBASE_APP_ID.trim())) {
    throw new Error("STAGING_FIREBASE_APP_ID is still a placeholder; use the real web app ID registered in the staging Firebase project.");
  }
  if (env.STAGING_API_BASE_URL.trim() !== STAGING_API_BASE_URL) {
    throw new Error("Staging API configuration must target the approved staging backend.");
  }

  const siteId = env.STAGING_FIREBASE_HOSTING_SITE_ID.trim();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/.test(siteId) || siteId === "faxton-rentals") {
    throw new Error("Invalid staging Firebase Hosting site ID configuration.");
  }

  const appCheckKey = requireValue(env, "STAGING_APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY");
  const appCheckDisabled = appCheckKey === "disabled";
  const frontendOrigin = requireOrigin(env.STAGING_FRONTEND_ORIGIN.trim(), "STAGING_FRONTEND_ORIGIN");
  if (frontendOrigin !== `https://${siteId}.web.app`) {
    throw new Error("Staging frontend origin must match the configured Firebase Hosting site.");
  }

  return {
    siteId,
    frontendOrigin,
    apiBaseUrl: STAGING_API_BASE_URL,
    appCheckKey: appCheckDisabled ? "" : appCheckKey,
    meteredTurnApiKey: requireValue(env, "STAGING_METERED_TURN_API_KEY") === "disabled"
      ? ""
      : env.STAGING_METERED_TURN_API_KEY.trim(),
    firebase: {
      apiKey: requireValue(env, "STAGING_FIREBASE_API_KEY"),
      authDomain: requireHost(env.STAGING_FIREBASE_AUTH_DOMAIN.trim(), "STAGING_FIREBASE_AUTH_DOMAIN"),
      projectId: STAGING_PROJECT_ID,
      storageBucket: requireHost(env.STAGING_FIREBASE_STORAGE_BUCKET.trim(), "STAGING_FIREBASE_STORAGE_BUCKET"),
      messagingSenderId: requireValue(env, "STAGING_FIREBASE_MESSAGING_SENDER_ID"),
      appId: requireValue(env, "STAGING_FIREBASE_APP_ID"),
      ...(String(env.STAGING_FIREBASE_MEASUREMENT_ID ?? "").trim()
        ? { measurementId: env.STAGING_FIREBASE_MEASUREMENT_ID.trim() }
        : {})
    }
  };
}

function updateFirebaseModule(contents, firebaseConfig) {
  const pattern = /const firebaseConfig = \{[\s\S]*?\n\};/g;
  const matches = contents.match(pattern) ?? [];
  if (matches.length !== 1) {
    throw new Error("Could not safely locate the frontend Firebase config for the staging build.");
  }
  return contents.replace(pattern, `const firebaseConfig = ${JSON.stringify(firebaseConfig, null, 2)};`);
}

function updateApiConfig(contents, apiBaseUrl) {
  const pattern = /^export const API_BASE_URL = .*;$/gm;
  const matches = contents.match(pattern) ?? [];
  if (matches.length !== 1) throw new Error("Could not safely locate the frontend API config for the staging build.");
  return contents.replace(pattern, `export const API_BASE_URL = ${JSON.stringify(apiBaseUrl)};`);
}

function updateAppCheckConfig(appCheckKey) {
  return `// Staging-only public App Check site key. Set the build value to "disabled" to omit App Check explicitly.\nexport const APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY = ${JSON.stringify(appCheckKey)};\n`;
}

function updateTurnConfig(turnApiKey) {
  return `// Staging-only public Metered credential-scoped key. Set to "disabled" to omit Metered in staging.\nexport const METERED_TURN_API_KEY = ${JSON.stringify(turnApiKey)};\n`;
}

function stageHeaders(sourceHeaders, authDomain, apiBaseUrl) {
  if (!Array.isArray(sourceHeaders)) throw new Error("Production Hosting headers are missing; staging build stopped.");

  const result = structuredClone(sourceHeaders);
  let cspCount = 0;
  for (const rule of result) {
    for (const header of rule.headers ?? []) {
      if (header.key?.toLowerCase() !== "content-security-policy") continue;
      cspCount += 1;
      let policy = header.value.replaceAll("https://faxton-rentals.firebaseapp.com", `https://${authDomain}`);
      const connect = policy.match(/(?:^|;)\s*connect-src\s+([^;]*)/i);
      if (!connect) throw new Error("A staging Content-Security-Policy is missing connect-src.");
      if (!connect[1].split(/\s+/).includes(apiBaseUrl)) {
        const replacement = `connect-src ${connect[1].trim()} ${apiBaseUrl}`;
        policy = policy.replace(connect[0], `${connect[0].startsWith(";") ? "; " : ""}${replacement}`);
      }
      header.value = policy;
    }
    rule.headers ??= [];
    if (!rule.headers.some((header) => header.key?.toLowerCase() === "x-robots-tag")) {
      rule.headers.push({ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" });
    }
  }
  if (!cspCount) throw new Error("Production Hosting Content-Security-Policy was not found; staging build stopped.");
  return result;
}

async function assertNoPrivateMaterial(root) {
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (textExtensions.has(path.extname(entry.name).toLowerCase())) {
        const contents = await readFile(fullPath, "utf8");
        if (privateMaterialPatterns.some((pattern) => pattern.test(contents))) {
          throw new Error(`Staging browser artifact contains credential material: ${path.relative(root, fullPath)}`);
        }
      }
    }
  }
  await visit(root);
}

export async function buildStagingSite({
  repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  outputDir = path.join(repoRoot, DEFAULT_OUTPUT_DIR),
  env = process.env
} = {}) {
  const config = getStagingConfig(env);
  const sourcePublic = path.join(repoRoot, "public");
  const sourceFirebaseConfig = path.join(repoRoot, "firebase.json");
  const stagingTemplatePath = path.join(repoRoot, "firebase.staging.json");
  const resolvedOutput = path.resolve(outputDir);
  const resolvedRepoRoot = path.resolve(repoRoot);
  const defaultOutput = path.resolve(repoRoot, DEFAULT_OUTPUT_DIR);

  const relativeOutput = path.relative(resolvedRepoRoot, resolvedOutput);
  const isInsideRepo = relativeOutput && !relativeOutput.startsWith(`..${path.sep}`) && relativeOutput !== ".." && !path.isAbsolute(relativeOutput);
  if (resolvedOutput === resolvedRepoRoot || (isInsideRepo && resolvedOutput !== defaultOutput)) {
    throw new Error("Staging output must use the dedicated generated directory or a separate temporary directory.");
  }

  try {
    await stat(resolvedOutput);
    throw new Error("A staging output directory already exists; inspect and remove it before rebuilding.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const productionConfig = JSON.parse(await readFile(sourceFirebaseConfig, "utf8"));
  const stagingTemplate = JSON.parse(await readFile(stagingTemplatePath, "utf8"));
  if (Object.keys(stagingTemplate).length !== 1 || !stagingTemplate.hosting) {
    throw new Error("Staging Firebase config must contain only Hosting configuration.");
  }

  const productionFirebaseModule = await readFile(path.join(sourcePublic, "js", "firebase.js"), "utf8");
  const firebaseFields = ["apiKey", "authDomain", "storageBucket", "messagingSenderId", "appId"];
  if (config.firebase.measurementId) firebaseFields.push("measurementId");
  for (const key of firebaseFields) {
    if (config.firebase[key] === readConfigString(productionFirebaseModule, key)) {
      throw new Error(`Staging Firebase ${key} must be different from production configuration.`);
    }
  }
  if (config.appCheckKey) {
    const productionAppCheck = await readFile(path.join(sourcePublic, "js", "app-check-config.js"), "utf8");
    const match = productionAppCheck.match(/APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY\s*=\s*("(?:\\.|[^"\\])*")/);
    if (!match) throw new Error("Could not safely verify production App Check configuration.");
    if (JSON.parse(match[1]) === config.appCheckKey) {
      throw new Error("Staging App Check configuration must not reuse production configuration.");
    }
  }
  if (config.meteredTurnApiKey) {
    const productionTurnConfig = await readFile(path.join(sourcePublic, "js", "turn-config.js"), "utf8");
    const match = productionTurnConfig.match(/METERED_TURN_API_KEY\s*=\s*("(?:\\.|[^"\\])*")/);
    if (!match) throw new Error("Could not safely verify production TURN configuration.");
    if (JSON.parse(match[1]) === config.meteredTurnApiKey) {
      throw new Error("Staging TURN configuration must not reuse production configuration.");
    }
  }

  await mkdir(resolvedOutput);
  try {
    const publicOutput = path.join(resolvedOutput, "public");
    await mkdir(publicOutput, { recursive: true });
    await cp(sourcePublic, publicOutput, {
      recursive: true,
      filter: async (source) => {
        const name = path.basename(source);
        if (excludedNames.some((pattern) => pattern.test(name))) return false;
        try {
          const { lstat } = await import("node:fs/promises");
          return !(await lstat(source)).isSymbolicLink();
        } catch {
          return false;
        }
      }
    });

    const firebaseModulePath = path.join(publicOutput, "js", "firebase.js");
    const apiConfigPath = path.join(publicOutput, "js", "api-config.js");
    const appCheckConfigPath = path.join(publicOutput, "js", "app-check-config.js");
    const turnConfigPath = path.join(publicOutput, "js", "turn-config.js");
    await writeFile(firebaseModulePath, updateFirebaseModule(await readFile(firebaseModulePath, "utf8"), config.firebase));
    await writeFile(apiConfigPath, updateApiConfig(await readFile(apiConfigPath, "utf8"), config.apiBaseUrl));
    await writeFile(appCheckConfigPath, updateAppCheckConfig(config.appCheckKey));
    await writeFile(turnConfigPath, updateTurnConfig(config.meteredTurnApiKey));

    for (const relativePath of ["js/profile.js", "js/safety.js"]) {
      const filePath = path.join(publicOutput, relativePath);
      const contents = await readFile(filePath, "utf8");
      await writeFile(filePath, contents.replaceAll("https://faxton-rentals.web.app", config.frontendOrigin));
    }

    const hostingConfig = {
      ...structuredClone(productionConfig.hosting),
      ...structuredClone(stagingTemplate.hosting),
      site: config.siteId,
      public: "public",
      headers: stageHeaders(productionConfig.hosting?.headers, config.firebase.authDomain, config.apiBaseUrl)
    };
    delete hostingConfig.target;

    const firebaseConfig = { hosting: hostingConfig };
    if (Object.keys(firebaseConfig).some((key) => ["firestore", "storage", "functions"].includes(key))) {
      throw new Error("Staging deploy config must remain Hosting-only.");
    }

    await writeFile(path.join(resolvedOutput, "firebase.json"), `${JSON.stringify(firebaseConfig, null, 2)}\n`);
    await writeFile(path.join(resolvedOutput, ".faxton-staging-artifact"), "Generated by scripts/build-staging-site.mjs\n");
    await assertNoPrivateMaterial(resolvedOutput);
    return resolvedOutput;
  } catch (error) {
    await rm(resolvedOutput, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const outputDir = await buildStagingSite();
    console.log(`Staging artifact built at ${path.basename(outputDir)}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Staging artifact build failed.");
    process.exitCode = 1;
  }
}
