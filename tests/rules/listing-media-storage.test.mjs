import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { ref, uploadBytes, deleteObject } from "firebase/storage";

const env = await initializeTestEnvironment({
  projectId: "demo-faxton",
  firestore: {
    host: "127.0.0.1",
    port: 8089,
    rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8")
  },
  storage: {
    host: "127.0.0.1",
    port: 9199,
    rules: readFileSync(new URL("../../storage.rules", import.meta.url), "utf8")
  }
});

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  const { setDoc, doc } = await import("firebase/firestore");
  await setDoc(doc(db, "config/owner"), { uid: "owner" });
  const users = [
    ["owner", "renter", true],
    ["admin", "admin", false],
    ["landlord", "landlord", false],
    ["agent", "agent", true],
    ["agency", "agency", true],
    ["unverified-agent", "agent", false],
    ["unverified-agency", "agency", false],
    ["renter", "renter", false]
  ];
  for (const [uid, role, verified] of users) {
    await setDoc(doc(db, "users", uid), { role, verified });
  }
});

const storageFor = (uid) => env.authenticatedContext(uid).storage();
const bytes = new Uint8Array([0x46, 0x61, 0x78, 0x74, 0x6f, 0x6e]);
const imagePath = (uid, name) => \`listing-media/\${uid}/listing-1/images/\${name}.jpg\`;
const videoPath = (uid, name) => \`listing-media/\${uid}/listing-1/videos/\${name}.mp4\`;
const t = async (name, action, expected = true) => {
  let allowed = true;
  try { await action(); } catch { allowed = false; }
  console.log(allowed === expected ? "PASS" : "FAIL", name);
};

await t("owner can upload a listing image", () => uploadBytes(ref(storageFor("owner"), imagePath("owner", "owner")), bytes, { contentType: "image/jpeg" }));
await t("admin can upload a listing image", () => uploadBytes(ref(storageFor("admin"), imagePath("admin", "admin")), bytes, { contentType: "image/jpeg" }));
await t("landlord can upload a listing image", () => uploadBytes(ref(storageFor("landlord"), imagePath("landlord", "landlord")), bytes, { contentType: "image/jpeg" }));
await t("verified agent can upload a listing image", () => uploadBytes(ref(storageFor("agent"), imagePath("agent", "agent")), bytes, { contentType: "image/jpeg" }));
await t("verified agency can upload a listing image", () => uploadBytes(ref(storageFor("agency"), imagePath("agency", "agency")), bytes, { contentType: "image/jpeg" }));
await t("verified agent can upload a listing video", () => uploadBytes(ref(storageFor("agent"), videoPath("agent", "clip")), bytes, { contentType: "video/mp4" }));
await t("unverified agent cannot upload listing media", () => uploadBytes(ref(storageFor("unverified-agent"), imagePath("unverified-agent", "bad")), bytes, { contentType: "image/jpeg" }), false);
await t("unverified agency cannot upload listing media", () => uploadBytes(ref(storageFor("unverified-agency"), imagePath("unverified-agency", "bad")), bytes, { contentType: "image/jpeg" }), false);
await t("renter cannot upload listing media", () => uploadBytes(ref(storageFor("renter"), imagePath("renter", "bad")), bytes, { contentType: "image/jpeg" }), false);
await t("user cannot write into another UID folder", () => uploadBytes(ref(storageFor("landlord"), imagePath("agent", "spoof")), bytes, { contentType: "image/jpeg" }), false);
await t("invalid image MIME type is rejected", () => uploadBytes(ref(storageFor("landlord"), imagePath("landlord", "wrong-mime")), bytes, { contentType: "text/plain" }), false);
await t("video MIME type is required in the videos folder", () => uploadBytes(ref(storageFor("landlord"), videoPath("landlord", "wrong-mime")), bytes, { contentType: "image/jpeg" }), false);
await t("admin can remove media uploaded by another user", () => deleteObject(ref(storageFor("admin"), imagePath("landlord", "landlord"))));
await t("unrelated renter cannot remove another user's media", () => deleteObject(ref(storageFor("renter"), imagePath("agent", "agent")), false);

await env.cleanup();
