import { createPrivateKey } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

const expectedProjectId = "faxton-rentals-staging";
const safeError = "Staging Firebase deploy credential is invalid.";

export function validateStagingServiceAccountJson(rawValue) {
  let serviceAccount;
  try {
    if (typeof rawValue !== "string" || !rawValue.trim()) throw new Error();
    serviceAccount = JSON.parse(rawValue);
  } catch {
    throw new Error(safeError);
  }

  if (
    !serviceAccount ||
    serviceAccount.type !== "service_account" ||
    serviceAccount.project_id !== expectedProjectId ||
    typeof serviceAccount.client_email !== "string" ||
    !serviceAccount.client_email.endsWith(`@${expectedProjectId}.iam.gserviceaccount.com`) ||
    typeof serviceAccount.private_key !== "string"
  ) {
    throw new Error(safeError);
  }

  try {
    createPrivateKey(serviceAccount.private_key);
  } catch {
    throw new Error(safeError);
  }

  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    validateStagingServiceAccountJson(process.env.FIREBASE_STAGING_SERVICE_ACCOUNT);
    console.log("Staging Firebase deploy credential structure validated.");
  } catch {
    console.error("Staging Firebase deploy credential validation failed.");
    process.exitCode = 1;
  }
}
