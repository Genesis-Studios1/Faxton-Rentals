import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { setDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-faxton",
  firestore: {
    host: "127.0.0.1",
    port: 8089,
    rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8"),
  },
});

await env.withSecurityRulesDisabled(async (c) => {
  const d = c.firestore();
  await setDoc(doc(d, "config/owner"), { uid: "owner" });
  const users = [
    ["owner", "renter"],
    ["admin", "admin"],
    ["renter", "renter"],
    ["renter2", "renter"],
    ["agent", "agent"],
    ["landlord", "landlord"],
    ["other", "renter"],
  ];
  for (const [uid, role] of users) {
    await setDoc(doc(d, "users", uid), {
      name: uid,
      email: uid + "@x.com",
      role,
      saved: [],
      createdAt: new Date(),
      onboarding: { completed: false },
      ...(role === "agent" ? { verification: { status: "pending", kind: "agent", requestedAt: Date.now() } } : {}),
    });
  }
});

const t = async (name, operation, want = true) => {
  let ok = true;
  try { await operation; } catch { ok = false; }
  console.log(ok === want ? "PASS" : "FAIL", name);
};

const ctx = (uid, verified = true) => env.authenticatedContext(uid, {
  email_verified: verified,
  email: uid + "@x.com",
}).firestore();

const owner = ctx("owner");
const admin = ctx("admin");
const renter = ctx("renter", false);
const renter2 = ctx("renter2");
const agent = ctx("agent");
const landlord = ctx("landlord");
const other = ctx("other");

// Self branch: ordinary profile edits and bounded onboarding drafts.
await t("user can update their own profile", updateDoc(doc(renter, "users/renter"), { phone: "08012345678" }));
await t("user can save an onboarding draft", updateDoc(doc(renter, "users/renter"), {
  onboarding: { completed: false, step: 2, draft: { city: "Lagos", budget: 2500000 } },
}));
await t("onboarding draft cannot move past the final step", updateDoc(doc(renter, "users/renter"), {
  onboarding: { completed: false, step: 9, draft: {} },
}), false);
await t("onboarding draft rejects unexpected fields", updateDoc(doc(renter, "users/renter"), {
  onboarding: { completed: false, step: 2, draft: {}, isAdmin: true },
}), false);
await t("user cannot change their role", updateDoc(doc(renter, "users/renter"), { role: "admin" }), false);
await t("user cannot self-verify", updateDoc(doc(renter, "users/renter"), { verified: true }), false);
await t("user cannot change their own ban timestamp", updateDoc(doc(renter, "users/renter"), { bannedAt: serverTimestamp() }), false);

// Role-specific completion must be allowed only through the expected profile fields.
await t("renter can complete their profile onboarding", updateDoc(doc(renter2, "users/renter2"), {
  onboarding: { completed: true, step: 8, draft: {} },
  tenantInfo: {
    phone: "08012345678", dob: "2000-01-01", address: "12 Example Street",
    city: "Lagos", state: "Lagos", propertyType: "Apartment", bedrooms: "2",
    budget: 2500000, preferredAreas: "Lekki", amenities: ["Parking"],
    employment: "Employed", moveIn: "2026-11-01", notes: "",
  },
}));
await t("agent can complete agent onboarding", updateDoc(doc(agent, "users/agent"), {
  onboarding: { completed: true, step: 8, draft: {} },
  agentInfo: {
    phone: "08012345678", experience: 3, company: "Faxton Partner",
    licence: "", areas: "Lekki", dob: "2000-01-01", address: "12 Example Street",
    country: "Nigeria", state: "Lagos", city: "Lagos", lga: "Eti-Osa",
  },
}));
await t("landlord can complete homeowner onboarding", updateDoc(doc(landlord, "users/landlord"), {
  onboarding: { completed: true, step: 8, draft: {} },
  homeownerInfo: {
    phone: "08012345678", dob: "2000-01-01", propertyType: "Apartment",
    address: "12 Example Street", city: "Lagos", state: "Lagos",
    bedrooms: "2", bathrooms: "2", size: "120 sqm", features: ["Parking"],
    rent: 2500000, leaseDuration: "One year", tenantPreference: "Any", notes: "",
  },
}));

// Admin branch is deliberately limited to moderation fields on non-owner accounts.
await t("admin can ban another account", updateDoc(doc(admin, "users/other"), {
  banned: true, bannedAt: serverTimestamp(),
}));
await t("admin can verify an agent", updateDoc(doc(admin, "users/agent"), {
  verified: true,
  verification: { status: "verified", kind: "agent", requestedAt: Date.now() },
}));
await t("admin cannot change another account's role", updateDoc(doc(admin, "users/other"), { role: "admin" }), false);
await t("admin cannot write to the owner's account", updateDoc(doc(admin, "users/owner"), {
  banned: true, bannedAt: serverTimestamp(),
}), false);
await t("normal user cannot ban someone else", updateDoc(doc(other, "users/renter2"), {
  banned: true, bannedAt: serverTimestamp(),
}), false);
await t("owner can perform an owner-only role update", updateDoc(doc(owner, "users/other"), { role: "landlord" }));

await env.cleanup();
