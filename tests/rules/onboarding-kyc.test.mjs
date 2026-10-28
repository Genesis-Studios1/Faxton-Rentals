import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { doc, setDoc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-faxton",
  firestore: { host: "127.0.0.1", port: 8089, rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8") }
});
const pending = (role) => ({ status: "pending", kind: role, requestedAt: Date.now() });
const kyc = (uid, role = "agent") => ({
  status: "submitted", idType: "national-id", identityPath: "verification/" + uid + "/identity",
  addressProofType: "utility-bill", addressPath: "verification/" + uid + "/address-proof",
  ...(role === "landlord" ? { ownershipProofType: "title", ownershipPath: "verification/" + uid + "/ownership-proof" } : {}),
  submittedAt: Date.now()
});
const incomplete = (uid, role, email) => ({
  name: uid, email, role, saved: [], createdAt: serverTimestamp(),
  onboarding: { completed: false }, verification: pending(role)
});
const location = { country: "Nigeria", state: "Lagos", city: "Ikeja", lga: "Ikeja", location: "Ikeja, Lagos, Nigeria" };
const referral = { completed: true, referralSource: "instagram", referralOther: "", completedAt: Date.now() };
const business = {
  business: "Example Homes Ltd", businessTypes: ["real-estate", "plumbing"], cac: "RC1234567",
  registrar: "Alex Example", address: "12 Test Street, Ikeja", supportEmail: "support@example.com",
  position: "Director", website: "", otherService: ""
};
const agentInfo = { phone: "+2348012345678", experience: 3, company: "", licence: "", areas: "Lekki, Ikeja", dob: "1990-01-01" };
await env.withSecurityRulesDisabled(async (context) => {
  const db = context.firestore();
  await setDoc(doc(db, "config/owner"), { uid: "own" });
  await setDoc(doc(db, "users/own"), { role: "owner", name: "Owner", email: "own@example.com", saved: [] });
  await setDoc(doc(db, "users/admin"), { role: "admin", name: "Admin", email: "admin@example.com", saved: [] });
  await setDoc(doc(db, "users/renter"), incomplete("renter", "renter", "renter@example.com"));
  await setDoc(doc(db, "users/business"), incomplete("business", "agency", "business@example.com"));
  await setDoc(doc(db, "users/agent"), incomplete("agent", "agent", "agent@example.com"));
  await setDoc(doc(db, "users/no-kyc-agent"), incomplete("no-kyc-agent", "agent", "no-kyc-agent@example.com"));
  await setDoc(doc(db, "users/landlord"), incomplete("landlord", "landlord", "landlord@example.com"));
  await setDoc(doc(db, "users/bad-landlord"), incomplete("bad-landlord", "landlord", "bad-landlord@example.com"));
  await setDoc(doc(db, "users/unverified-landlord"), { role: "landlord", onboarding: { completed: true, referralSource: "friend", completedAt: Date.now() }, name: "No KYC", email: "no-kyc@example.com", saved: [] });
  await setDoc(doc(db, "users/lord"), {
    role: "landlord", onboarding: referral, kyc: kyc("lord", "landlord"),
    name: "Verified owner", email: "lord@example.com", saved: [], country: "Nigeria", state: "Lagos", city: "Ikeja", lga: "Ikeja"
  });
  await setDoc(doc(db, "listings/l-unverified"), { status: "active", ownerUid: "unverified-landlord", title: "No KYC home", verified: false });
  await setDoc(doc(db, "listings/l-landlord"), { status: "active", ownerUid: "lord", title: "KYC home", verified: false });
});

const t = async (name, promise, expected = true) => {
  let passed = true, failure = "";
  try { await promise; } catch (error) { passed = false; failure = (error?.code || "error") + ": " + (error?.message || "request failed"); }
  const ok = passed === expected;
  console.log(ok ? "PASS" : "FAIL", name, ok ? "" : failure);
};
const ctx = (uid, email) => env.authenticatedContext(uid, { email, email_verified: true }).firestore();
const landlord = ctx("landlord", "landlord@example.com");
const agent = ctx("agent", "agent@example.com");
const businessDb = ctx("business", "business@example.com");
const renter = ctx("renter", "renter@example.com");
const admin = ctx("admin", "admin@example.com");

const landlordPayload = {
  ...location, onboarding: referral, kyc: kyc("landlord", "landlord")
};
await t("landlord completes onboarding with ID, address, and ownership evidence", updateDoc(doc(landlord, "users/landlord"), landlordPayload));
await t("landlord cannot complete onboarding without ownership evidence", updateDoc(doc(ctx("bad-landlord", "bad-landlord@example.com"), "users/bad-landlord"), {
  ...location, onboarding: referral, kyc: { ...kyc("bad-landlord", "landlord"), ownershipPath: "", ownershipProofType: "" }
}), false);

await t("agent completes onboarding with ID and address proof", updateDoc(doc(agent, "users/agent"), {
  ...location, ...referral, onboarding: referral, phone: agentInfo.phone, agentInfo, kyc: kyc("agent", "agent")
}));
await t("business completes setup without government KYC uploads", updateDoc(doc(businessDb, "users/business"), {
  ...location, onboarding: referral, agency: business
}));
await t("renter completes referral and location setup", updateDoc(doc(renter, "users/renter"), {
  ...location, onboarding: referral
}));

await t("renter cannot mark onboarding complete twice to add business details", updateDoc(doc(renter, "users/renter"), {
  onboarding: referral, agency: business
}), false);
await t("another user cannot edit the landlord onboarding profile", updateDoc(doc(renter, "users/landlord"), landlordPayload), false);
await t("agent without submitted KYC cannot be approved", updateDoc(doc(admin, "users/no-kyc-agent"), {
  verified: true, verification: { status: "verified", kind: "agent", requestedAt: Date.now(), decidedAt: Date.now() }
}), false);
await t("landlord with KYC can be approved by an admin", updateDoc(doc(admin, "users/landlord"), {
  verified: true, verification: { status: "verified", kind: "landlord", requestedAt: Date.now(), decidedAt: Date.now() }
}));
await t("admin cannot mark a home verified without owner evidence", updateDoc(doc(admin, "listings/l-unverified"), { verified: true }), false);
await t("admin can mark a home verified after landlord ownership evidence is submitted", updateDoc(doc(admin, "listings/l-landlord"), { verified: true }));
await t("landlord cannot mark their listing verified", updateDoc(doc(landlord, "listings/l-landlord"), { verified: true }), false);

await env.cleanup();
