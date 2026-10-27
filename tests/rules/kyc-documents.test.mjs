import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
const env = await initializeTestEnvironment({
  projectId: "demo-faxton",
  firestore: { host: "127.0.0.1", port: 8089, rules }
});
const seedDoc = (db, path, data) => setDoc(doc(db, path), data);
await env.withSecurityRulesDisabled(async (context) => {
  const db = context.firestore();
  await seedDoc(db, "config/owner", { uid: "owner" });
  await seedDoc(db, "users/owner", { name: "Platform owner", email: "owner@example.test", role: "admin", saved: [], verified: false });
  await seedDoc(db, "users/admin", { name: "Reviewer", email: "reviewer@example.test", role: "admin", saved: [], verified: false });
  await seedDoc(db, "users/landlord", { name: "Property owner", email: "landlord@example.test", role: "landlord", saved: [], verified: false });
  await seedDoc(db, "users/agent", { name: "Agent", email: "agent@example.test", role: "agent", saved: [], verified: false });
  await seedDoc(db, "users/renter", { name: "Renter", email: "renter@example.test", role: "renter", saved: [], verified: false });
  await seedDoc(db, "users/verified", {
    name: "Verified owner", email: "verified@example.test", role: "landlord", saved: [], verified: true,
    verification: { status: "verified", kind: "landlord", documents: { identity: true, address: true, professional: false } }
  });
  await seedDoc(db, "users/verified/verificationDocuments/identity", { type: "identity", label: "ID", dataUrl: "data:image/jpeg;base64,AAAA", mime: "image/jpeg", fileName: "id.jpg", submittedAt: serverTimestamp() });
  await seedDoc(db, "users/verified/verificationDocuments/address", { type: "address", label: "Address", dataUrl: "data:image/jpeg;base64,AAAA", mime: "image/jpeg", fileName: "address.jpg", submittedAt: serverTimestamp() });
});
const tests = async (name, promise, expected = true) => {
  let ok = true;
  try { await promise; } catch { ok = false; }
  console.log(ok === expected ? "PASS" : "FAIL", name);
};

const owner = env.authenticatedContext("owner", { email: "owner@example.test" }).firestore();
const reviewer = env.authenticatedContext("admin", { email: "reviewer@example.test" }).firestore();
const landlord = env.authenticatedContext("landlord", { email: "landlord@example.test" }).firestore();
const verified = env.authenticatedContext("verified", { email: "verified@example.test" }).firestore();
const agent = env.authenticatedContext("agent", { email: "agent@example.test" }).firestore();
const renter = env.authenticatedContext("renter", { email: "renter@example.test" }).firestore();

const kycDoc = (type) => ({
  type, label: type === "identity" ? "National ID" : "Proof of address",
  dataUrl: "data:image/jpeg;base64,AAAA", mime: "image/jpeg",
  fileName: type + ".jpg", submittedAt: serverTimestamp()
});
await tests("landlord can upload private identity evidence", setDoc(doc(landlord, "users/landlord/verificationDocuments/identity"), kycDoc("identity")));
await tests("landlord can upload private address evidence", setDoc(doc(landlord, "users/landlord/verificationDocuments/address"), kycDoc("address")));
await tests("landlord can submit KYC for review", updateDoc(doc(landlord, "users/landlord"), {
  verification: { status: "pending", kind: "landlord", requestedAt: Date.now(), documents: { identity: true, address: true, professional: false }, idKind: "National ID", professionalNumber: "", regulatoryBody: "" }
}));
await tests("renter cannot read landlord identity evidence", getDoc(doc(renter, "users/landlord/verificationDocuments/identity")), false);
await tests("reviewer can read landlord identity evidence", getDoc(doc(reviewer, "users/landlord/verificationDocuments/identity")));
await tests("landlord cannot mark themselves verified", updateDoc(doc(landlord, "users/landlord"), { verified: true }), false);
await tests("landlord cannot edit own verification decision", updateDoc(doc(landlord, "users/landlord"), {
  verification: { status: "verified", kind: "landlord", requestedAt: Date.now(), documents: { identity: true, address: true, professional: false }, idKind: "National ID", professionalNumber: "", regulatoryBody: "" }
}), false);
await tests("landlord cannot delete submitted ID evidence", deleteDoc(doc(landlord, "users/landlord/verificationDocuments/identity")), false);

await tests("verified owner can upload private listing ownership proof", setDoc(doc(verified, "listingVerificationDocuments/new-home"), {
  listingId: "new-home", ownerUid: "verified", docType: "land-title", dataUrl: "data:image/jpeg;base64,AAAA", mime: "image/jpeg",
  fileName: "title.jpg", submittedAt: serverTimestamp()
}));
await tests("verified owner can create listing held for review", setDoc(doc(verified, "listings/new-home"), {
  ownerUid: "verified", title: "Verified draft", status: "pending",
  ownershipVerification: { status: "pending", docType: "land-title", requestedAt: Date.now() }
}));
await tests("verified owner cannot create listing without ownership proof", setDoc(doc(verified, "listings/missing-proof"), {
  ownerUid: "verified", title: "No evidence", status: "pending",
  ownershipVerification: { status: "pending", docType: "land-title", requestedAt: Date.now() }
}), false);
await tests("unverified agent cannot create listing", setDoc(doc(agent, "listings/unverified-agent"), {
  ownerUid: "agent", title: "Unverified", status: "pending",
  ownershipVerification: { status: "pending", docType: "land-title", requestedAt: Date.now() }
}), false);
await tests("renter cannot read ownership proof", getDoc(doc(renter, "listingVerificationDocuments/new-home")), false);
await tests("owner can read own ownership proof", getDoc(doc(verified, "listingVerificationDocuments/new-home")));
await tests("owner cannot self-approve ownership evidence", updateDoc(doc(verified, "listings/new-home"), {
  ownershipVerification: { status: "verified", docType: "land-title", requestedAt: Date.now() }
}), false);
await tests("client cannot read server-only unlock code", getDoc(doc(landlord, "unlockCodes/landlord")), false);
await tests("client cannot write server-only unlock code state", setDoc(doc(landlord, "unlockCodeState/landlord"), { windowCount: 0 }), false);

await env.cleanup();
process.exit(0);
