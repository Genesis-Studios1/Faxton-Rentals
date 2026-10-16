import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { setDoc, doc, serverTimestamp, updateDoc, getDoc, deleteDoc, Timestamp } from "firebase/firestore";
const env = await initializeTestEnvironment({ projectId: "demo-faxton", firestore: { host: "127.0.0.1", port: 8089, rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8") } });
await env.withSecurityRulesDisabled(async (c) => {
  const d = c.firestore();
  await setDoc(doc(d, "config/owner"), { uid: "own" }); await setDoc(doc(d, "users/own"), { role: "renter" });
  await setDoc(doc(d, "users/adm"), { role: "admin" }); await setDoc(doc(d, "users/sup"), { role: "support" });
  await setDoc(doc(d, "users/r1"), { role: "renter" }); await setDoc(doc(d, "users/r2"), { role: "renter" }); await setDoc(doc(d, "users/st1"), { role: "admin" });
  // r1 has a staff-started chat with st1; r2 has none
  await setDoc(doc(d, "conversations/r1__dm_st1"), { uid: "r1", byStaff: "st1", listingId: "direct", last: "hi", lastBy: "s" });
  await setDoc(doc(d, "presence/st1"), { online: true, show: true, lastSeen: Timestamp.now() });
  await setDoc(doc(d, "presence/r1"), { online: true, show: true, lastSeen: Timestamp.now() });
});
const t = async (n, p, want = true) => { let ok = true; try { await p; } catch { ok = false; } console.log(ok === want ? "PASS" : "FAIL", n); };
const r1 = env.authenticatedContext("r1").firestore(), r2 = env.authenticatedContext("r2").firestore(), adm = env.authenticatedContext("adm").firestore(), sup = env.authenticatedContext("sup").firestore(), anon = env.unauthenticatedContext().firestore();
await t("write own heartbeat", setDoc(doc(r1, "presence/r1"), { online: true, show: true, lastSeen: serverTimestamp() }));
await t("write own heartbeat without show flag", setDoc(doc(r1, "presence/r1"), { online: false, lastSeen: serverTimestamp() }));
await t("hidden document ({show:false})", setDoc(doc(r1, "presence/r1"), { online: false, show: false, lastSeen: serverTimestamp() }));
await t("cannot write someone else's presence", setDoc(doc(r1, "presence/r2"), { online: true, show: true, lastSeen: serverTimestamp() }), false);
await t("lastSeen must be the server clock", setDoc(doc(r1, "presence/r1"), { online: true, show: true, lastSeen: Timestamp.fromMillis(Date.now() + 3600000) }), false);
await t("no extra fields", setDoc(doc(r1, "presence/r1"), { online: true, show: true, lastSeen: serverTimestamp(), note: "x" }), false);
await t("online must be a boolean", setDoc(doc(r1, "presence/r1"), { online: "yes", show: true, lastSeen: serverTimestamp() }), false);
await t("lastSeen is required", setDoc(doc(r1, "presence/r1"), { online: true, show: true }), false);
await t("signed-out cannot write", setDoc(doc(anon, "presence/r1"), { online: true, lastSeen: serverTimestamp() }), false);
await t("delete own presence", deleteDoc(doc(r1, "presence/r1")));
await t("read own presence", getDoc(doc(r1, "presence/r1")));
await t("renter reads the staff member who started a chat with them", getDoc(doc(r1, "presence/st1")));
await t("renter cannot read staff presence without a chat", getDoc(doc(r2, "presence/st1")), false);
await t("renter cannot read another renter", getDoc(doc(r2, "presence/r1")), false);
await t("signed-out cannot read", getDoc(doc(anon, "presence/st1")), false);
await t("admin reads any presence", getDoc(doc(adm, "presence/r1")));
await t("support reads any presence", getDoc(doc(sup, "presence/r1")));
// delivered / read markers live on the conversation document (the existing update rule: owner or staff)
await t("renter stamps dv.u and rd.u on their chat", updateDoc(doc(r1, "conversations/r1__dm_st1"), { "dv.u": serverTimestamp(), "rd.u": serverTimestamp(), unread: false }));
await t("staff stamps dv.s / rd.s", updateDoc(doc(adm, "conversations/r1__dm_st1"), { "dv.s": serverTimestamp(), "rd.s": serverTimestamp(), staffUnread: false }));
await t("another renter cannot stamp markers", updateDoc(doc(r2, "conversations/r1__dm_st1"), { "dv.u": serverTimestamp() }), false);
await env.cleanup();
