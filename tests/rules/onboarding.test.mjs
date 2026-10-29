import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { setDoc, updateDoc, getDoc, doc, serverTimestamp } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-faxton",
  firestore: { host: "127.0.0.1", port: 8089, rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8") }
});
await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), "config/owner"), { uid: "owner" });
});
const test = async (name, op, expected = true) => {
  let ok = true; try { await op; } catch { ok = false; }
  console.log(ok === expected ? "PASS" : "FAIL", name);
};
const person = (uid, email, role, extra = {}) => ({
  name: uid, email, role, saved: [], createdAt: serverTimestamp(),
  onboarding: { completed: false }, ...extra
});
const done = (source = "Instagram") => ({
  country: "Nigeria", state: "Lagos", lga: "Ikeja", city: "Ikeja",
  location: "Ikeja, Lagos, Nigeria", discoverySource: source, discoveryOther: "",
  onboarding: { completed: true, completedAt: Date.now(), documentTypes: ["kyc-id", "kyc-address"] }
});

const renter = env.authenticatedContext("renter", { email: "renter@example.com" }).firestore();
const agent = env.authenticatedContext("agent", { email: "agent@example.com" }).firestore();
const business = env.authenticatedContext("business", { email: "business@example.com" }).firestore();
const landlord = env.authenticatedContext("landlord", { email: "landlord@example.com" }).firestore();
const other = env.authenticatedContext("other", { email: "other@example.com" }).firestore();
const admin = env.authenticatedContext("admin", { email: "admin@example.com" }).firestore();

await test("renter creates a new profile with onboarding incomplete",
  setDoc(doc(renter, "users/renter"), person("renter", "renter@example.com", "renter")));
await test("renter completes the one-time discovery and location form",
  updateDoc(doc(renter, "users/renter"), done("TikTok")));
await test("renter cannot change role after onboarding",
  updateDoc(doc(renter, "users/renter"), { role: "admin" }), false);
await test("renter cannot set their own verified status",
  updateDoc(doc(renter, "users/renter"), { verified: true }), false);
await test("renter cannot rewrite their discovery source after onboarding",
  updateDoc(doc(renter, "users/renter"), { discoverySource: "X" }), false);

await test("agent profile can start pending verification",
  setDoc(doc(agent, "users/agent"), person("agent", "agent@example.com", "agent", {
    verification: { kind: "agent", status: "pending", requestedAt: Date.now() }
  })));
const agentDone = {
  ...done("Friend or family"), phone: "+2348012345678",
  agentInfo: {
    phone: "+2348012345678", experience: 4, company: "", areas: "Ikeja, Lekki",
    dob: "1998-05-11", licenceType: "Not registered / not applicable", licence: "",
    country: "Nigeria", state: "Lagos", lga: "Ikeja", city: "Ikeja"
  }
};
await test("agent saves role-specific fields during one-time onboarding",
  updateDoc(doc(agent, "users/agent"), agentDone));
await test("agent cannot mark their account verified",
  updateDoc(doc(agent, "users/agent"), { verified: true }), false);
await test("agent cannot alter the admin-controlled verification record",
  updateDoc(doc(agent, "users/agent"), { verification: { kind: "agent", status: "verified" } }), false);

await test("business profile can start pending verification",
  setDoc(doc(business, "users/business"), person("business", "business@example.com", "agency", {
    verification: { kind: "agency", status: "pending", requestedAt: Date.now() }
  })));
const businessDone = {
  ...done("Google search"), name: "Greenline Home Services",
  agency: {
    business: "Greenline Home Services", businessType: "Plumbing", businessTypeOther: "",
    cac: "RC1234567", registrar: "Alex Example", position: "Director",
    supportEmail: "support@greenline.example", phone: "+2348012345678",
    address: "12 Example Road, Ikeja", website: "",
    country: "Nigeria", state: "Lagos", lga: "Ikeja", city: "Ikeja"
  },
  phone: "+2348012345678",
  onboarding: { completed: true, completedAt: Date.now(), documentTypes: ["kyc-id", "kyc-address", "kyc-cac"] }
};
await test("business saves CAC, representative, service type and office details",
  updateDoc(doc(business, "users/business"), businessDone));
await test("business cannot self-verify",
  updateDoc(doc(business, "users/business"), { verified: true }), false);

await test("home owner profile may register a pending verification request",
  setDoc(doc(landlord, "users/landlord"), person("landlord", "landlord@example.com", "landlord", {
    verification: { kind: "landlord", status: "pending", requestedAt: Date.now() }
  })));
await test("home owner saves residence and contact details",
  updateDoc(doc(landlord, "users/landlord"), { ...done("Referral"), phone: "+2348012345678" }));
await test("home owner cannot skip admin verification",
  updateDoc(doc(landlord, "users/landlord"), { verified: true }), false);

await test("agent can upload a private identity file",
  setDoc(doc(agent, "documents/agent-id"), {
    uid: "agent", category: "kyc-id", name: "id.png", originalName: "id.png",
    size: 1, data: "data:image/png;base64,AA==", status: "Uploaded", createdAt: serverTimestamp()
  }));
await test("another user cannot read a private identity file",
  getDoc(doc(other, "documents/agent-id")), false);
await test("admin can review a private identity file",
  getDoc(doc(admin, "documents/agent-id")));
await test("user cannot create a document in another user's name",
  setDoc(doc(agent, "documents/forged"), {
    uid: "other", category: "kyc-id", name: "id.png", size: 1,
    data: "data:image/png;base64,AA==", status: "Uploaded"
  }), false);

await env.cleanup();
