import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { setDoc, doc, updateDoc, getDoc, getDocs, collection, serverTimestamp } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-faxton",
  firestore: { host: "127.0.0.1", port: 8089, rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8") }
});
await env.withSecurityRulesDisabled(async (c) => {
  const d = c.firestore();
  await setDoc(doc(d, "config/owner"), { uid: "owner" });
  for (const [uid, role, extra] of [
    ["owner", "admin", {}],
    ["admin", "admin", {}],
    ["landlord", "landlord", {}],
    ["otherLandlord", "landlord", {}],
    ["newLandlord", "landlord", {}],
    ["agent", "agent", { verified: true }],
    ["renter", "renter", {}]
  ]) await setDoc(doc(d, "users/" + uid), { role, ...extra });
  await setDoc(doc(d, "identityVerifications/landlord"), { uid: "landlord", role: "landlord", status: "approved" });
  await setDoc(doc(d, "identityVerifications/agent"), { uid: "agent", role: "agent", status: "approved" });
  await setDoc(doc(d, "listings/needsProof"), {
    id: "needsProof", title: "Pending home", ownerUid: "landlord", status: "pending",
    ownershipProofPath: "property-ownership/landlord/needsProof/proof", ownershipVerified: false
  });
  await setDoc(doc(d, "listings/noProof"), { id: "noProof", title: "No proof", ownerUid: "landlord", status: "pending" });
});
const test = async (name, promise, want = true) => {
  let ok = true;
  try { await promise; } catch (error) { ok = false; }
  console.log(ok === want ? "PASS" : "FAIL", name);
};
const landlord = env.authenticatedContext("landlord").firestore();
const other = env.authenticatedContext("otherLandlord").firestore();
const newLandlord = env.authenticatedContext("newLandlord").firestore();
const agent = env.authenticatedContext("agent").firestore();
const renter = env.authenticatedContext("renter").firestore();
const admin = env.authenticatedContext("admin").firestore();
const anon = env.unauthenticatedContext().firestore();
const submission = (uid, role, status = "pending") => ({
  uid, role, identityType: "passport",
  identityPath: "verification-docs/" + uid + "/identity",
  addressPath: "verification-docs/" + uid + "/address",
  country: "Nigeria", professionalBody: "not-applicable",
  professionalNumber: "", professionalPath: "",
  status, submittedAt: serverTimestamp(), updatedAt: serverTimestamp()
});
const listing = (uid, id, proofPath) => ({
  id, title: "Verified property", ownerUid: uid, status: "pending",
  ownershipProofPath: proofPath, ownershipVerified: false
});

await test("applicant can read own verification record", getDoc(doc(landlord, "identityVerifications/landlord")));
await test("another landlord cannot read identity documents metadata", getDoc(doc(other, "identityVerifications/landlord")), false);
await test("public visitor cannot read identity document metadata", getDoc(doc(anon, "identityVerifications/landlord")), false);
await test("admin can list identity submissions", getDocs(collection(admin, "identityVerifications")));
await test("landlord can submit their own identity for review", setDoc(doc(newLandlord, "identityVerifications/newLandlord"), submission("newLandlord", "landlord")));
await test("renter cannot submit a forged landlord identity request", setDoc(doc(renter, "identityVerifications/renter"), submission("renter", "landlord")), false);
await test("applicant cannot self-approve identity", setDoc(doc(newLandlord, "identityVerifications/selfApproved"), submission("newLandlord", "landlord", "approved")), false);
await test("applicant cannot update identity decision", updateDoc(doc(newLandlord, "identityVerifications/newLandlord"), { status: "approved" }), false);
await test("admin can approve after review", updateDoc(doc(admin, "identityVerifications/newLandlord"), {
  status: "approved", reviewNote: "", reviewedAt: serverTimestamp(), reviewedBy: "admin"
}));
await test("landlord with approved identity can submit property with matching ownership evidence", setDoc(doc(landlord, "listings/withProof"), listing("landlord", "withProof", "property-ownership/landlord/withProof/proof")));
await test("landlord cannot submit listing without ownership evidence", setDoc(doc(landlord, "listings/missingProof"), { id: "missingProof", title: "No evidence", ownerUid: "landlord", status: "pending" }), false);
await test("landlord cannot point at another listing's ownership evidence", setDoc(doc(landlord, "listings/wrongProof"), listing("landlord", "wrongProof", "property-ownership/landlord/withProof/proof")), false);
await test("landlord cannot declare ownership already verified", setDoc(doc(landlord, "listings/selfVerified"), { ...listing("landlord", "selfVerified", "property-ownership/landlord/selfVerified/proof"), ownershipVerified: true }), false);
await test("landlord without approved identity cannot post", setDoc(doc(other, "listings/unverifiedOwner"), listing("otherLandlord", "unverifiedOwner", "property-ownership/otherLandlord/unverifiedOwner/proof")), false);
await test("agent with verified role but no identity approval cannot post", setDoc(doc(agent, "listings/unverifiedAgent"), listing("agent", "unverifiedAgent", "property-ownership/agent/unverifiedAgent/proof")), false);
await test("owner cannot make ownership proof verified", updateDoc(doc(landlord, "listings/needsProof"), { ownershipVerified: true }), false);
await test("owner cannot activate their own pending listing", updateDoc(doc(landlord, "listings/needsProof"), { status: "active" }), false);
await test("admin cannot activate listing missing ownership path", updateDoc(doc(admin, "listings/noProof"), { status: "active", ownershipVerified: true }), false);
await test("admin can activate listing only while marking matching proof reviewed", updateDoc(doc(admin, "listings/needsProof"), { status: "active", ownershipVerified: true }));
await env.cleanup();
process.exit(0);
