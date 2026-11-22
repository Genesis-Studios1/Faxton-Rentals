import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { setDoc, doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-faxton",
  firestore: {
    host: "127.0.0.1",
    port: 8089,
    rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8")
  }
});
await env.withSecurityRulesDisabled(async (context) => {
  const db = context.firestore();
  await setDoc(doc(db, "config/owner"), { uid: "own" });
  for (const [uid, role] of [["own", "renter"], ["adm", "admin"], ["ren", "renter"], ["other", "renter"]]) {
    await setDoc(doc(db, "users", uid), { role });
  }
  await setDoc(doc(db, "documents/d1"), {
    uid: "ren",
    name: "Identity document",
    size: 120,
    data: "data:application/pdf;base64,JVBERi0xLjQ="
  });
});
const t = async (name, promise, expected = true) => {
  let succeeded = true;
  try { await promise; } catch { succeeded = false; }
  console.log(succeeded === expected ? "PASS" : "FAIL", name);
};
const renter = env.authenticatedContext("ren").firestore();
const other = env.authenticatedContext("other").firestore();
const admin = env.authenticatedContext("adm").firestore();
await t("owner can read their uploaded document", getDoc(doc(renter, "documents/d1")));
await t("unrelated renter cannot read another user's document", getDoc(doc(other, "documents/d1")), false);
await t("admin can read uploaded evidence", getDoc(doc(admin, "documents/d1")));
await t("admin cannot replace uploaded evidence", updateDoc(doc(admin, "documents/d1"), {
  data: "data:application/pdf;base64,QUJD",
  name: "Changed evidence"
}), false);
await t("document owner cannot replace uploaded evidence", updateDoc(doc(renter, "documents/d1"), {
  data: "data:application/pdf;base64,QUJD"
}), false);
await t("document owner can delete their own upload", deleteDoc(doc(renter, "documents/d1")));
await env.cleanup();
