import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { setDoc, doc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-faxton",
  firestore: {
    host: "127.0.0.1",
    port: 8089,
    rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8")
  }
});

await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, "config/owner"), { uid: "own" });
  await setDoc(doc(db, "users/own"), { role: "renter" });
  await setDoc(doc(db, "users/adm"), { role: "admin" });
  await setDoc(doc(db, "users/sup"), { role: "support" });
  await setDoc(doc(db, "users/ren"), { role: "renter" });
  await setDoc(doc(db, "tickets/t1"), {
    uid: "ren", name: "Renter", subject: "Need help", message: "Original message",
    status: "Open", priority: "Medium", assignee: "", replies: [], ref: "FR-1234"
  });
  await setDoc(doc(db, "suggestions/s1"), {
    uid: "ren", name: "Renter", email: "ren@example.com", text: "Add a feature",
    status: "New"
  });
  await setDoc(doc(db, "reports/r1"), {
    reporterUid: "ren", reporterName: "Renter", targetUid: "other",
    reason: "Spam", details: "Original report", status: "New"
  });
});

const t = async (name, promise, expected = true) => {
  let ok = true;
  try { await promise; } catch { ok = false; }
  console.log(ok === expected ? "PASS" : "FAIL", name);
};
const db = (uid) => env.authenticatedContext(uid).firestore();
const admin = db("adm"), support = db("sup"), renter = db("ren");

await t("support can change ticket status", updateDoc(doc(support, "tickets/t1"), { status: "In progress" }));
await t("support can set ticket priority", updateDoc(doc(support, "tickets/t1"), { priority: "High" }));
await t("support can assign a ticket", updateDoc(doc(support, "tickets/t1"), { assignee: "Support Agent" }));
await t("support can append ticket replies", updateDoc(doc(support, "tickets/t1"), { replies: [{ by: "Support", text: "We are checking", internal: false, at: Date.now() }] }));
await t("admin can resolve a ticket", updateDoc(doc(admin, "tickets/t1"), { status: "Resolved" }));
await t("staff cannot rewrite ticket message", updateDoc(doc(support, "tickets/t1"), { message: "Changed" }), false);
await t("staff cannot change ticket owner", updateDoc(doc(admin, "tickets/t1"), { uid: "adm" }), false);
await t("staff cannot add arbitrary ticket fields", updateDoc(doc(support, "tickets/t1"), { isAdmin: true }), false);
await t("staff cannot set an unknown ticket status", updateDoc(doc(support, "tickets/t1"), { status: "Deleted" }), false);
await t("ordinary user cannot update tickets", updateDoc(doc(renter, "tickets/t1"), { status: "Resolved" }), false);

await t("support can change suggestion status", updateDoc(doc(support, "suggestions/s1"), { status: "Reviewed" }));
await t("admin can mark suggestion planned", updateDoc(doc(admin, "suggestions/s1"), { status: "Planned" }));
await t("staff cannot rewrite suggestion text", updateDoc(doc(support, "suggestions/s1"), { text: "Changed" }), false);
await t("staff cannot change suggestion author", updateDoc(doc(admin, "suggestions/s1"), { uid: "adm" }), false);
await t("staff cannot set an unknown suggestion status", updateDoc(doc(support, "suggestions/s1"), { status: "Archived" }), false);
await t("ordinary user cannot update suggestions", updateDoc(doc(renter, "suggestions/s1"), { status: "Done" }), false);

await t("support can update report status", updateDoc(doc(support, "reports/r1"), { status: "Reviewing" }));
await t("support can add an internal report note", updateDoc(doc(support, "reports/r1"), { note: "Reviewed by support" }));
await t("admin can dismiss a report", updateDoc(doc(admin, "reports/r1"), { status: "Dismissed" }));
await t("staff cannot rewrite report details", updateDoc(doc(support, "reports/r1"), { details: "Changed" }), false);
await t("staff cannot change report target", updateDoc(doc(admin, "reports/r1"), { targetUid: "adm" }), false);
await t("staff cannot set an unknown report status", updateDoc(doc(support, "reports/r1"), { status: "Deleted" }), false);
await t("ordinary user cannot update reports", updateDoc(doc(renter, "reports/r1"), { status: "Dismissed" }), false);

const report = {
  reporterUid: "ren", reporterName: "Renter", targetUid: "other", targetName: "Other user",
  convId: "conversation-1", reason: "Spam or scam", details: "Please review this account",
  status: "New", createdAt: serverTimestamp()
};
await t("user can submit a valid report", addDoc(collection(renter, "reports"), report));
await t("user cannot submit a report for another reporter", addDoc(collection(renter, "reports"), { ...report, reporterUid: "adm" }), false);
await t("user cannot submit a report with forged staff status", addDoc(collection(renter, "reports"), { ...report, status: "Action taken" }), false);
await t("user cannot add arbitrary report fields", addDoc(collection(renter, "reports"), { ...report, reviewedBy: "adm" }), false);
await t("user cannot submit an unsupported report reason", addDoc(collection(renter, "reports"), { ...report, reason: "Other invalid reason" }), false);
await t("user cannot submit an oversized report description", addDoc(collection(renter, "reports"), { ...report, details: "x".repeat(1501) }), false);

await env.cleanup();
