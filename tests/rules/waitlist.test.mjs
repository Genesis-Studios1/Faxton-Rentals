
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-faxton",
  firestore: {
    host: "127.0.0.1",
    port: 8089,
    rules: readFileSync(
      new URL("../../firestore.rules", import.meta.url),
      "utf8"
    ),
  },
});

await env.withSecurityRulesDisabled(async (context) => {
  const db = context.firestore();

  await setDoc(doc(db, "config/owner"), { uid: "owner-user" });

  await setDoc(doc(db, "users/admin-user"), { role: "admin" });
  await setDoc(doc(db, "users/regular-user"), { role: "renter" });

  await setDoc(doc(db, "waitlist/seed-entry"), {
    name: "Existing Visitor",
    email: "existing@example.com",
    role: "renter",
    city: "Lagos",
    source: "website",
    createdAt: new Date(),
  });
});

const check = async (name, operation, expected = true) => {
  let succeeded = true;

  try {
    await operation;
  } catch (error) {
    succeeded = false;
    console.log("DETAIL:", name, error.code, error.message);
  }

  console.log(
    succeeded === expected ? "PASS" : "FAIL",
    name
  );
};

const visitor = env.unauthenticatedContext().firestore();
const regular = env.authenticatedContext("regular-user").firestore();
const admin = env.authenticatedContext("admin-user").firestore();
const owner = env.authenticatedContext("owner-user").firestore();

const validEntry = () => ({
  name: "Test Visitor",
  email: "visitor@example.com",
  role: "renter",
  city: "Lagos",
  source: "website",
  createdAt: serverTimestamp(),
});

await check(
  "public visitor can submit a valid signup",
  addDoc(collection(visitor, "waitlist"), validEntry())
);

await check(
  "signup with missing name is rejected",
  addDoc(collection(visitor, "waitlist"), {
    email: "missing@example.com",
    role: "renter",
    city: "Lagos",
    source: "website",
    createdAt: serverTimestamp(),
  }),
  false
);

await check(
  "signup with invalid email is rejected",
  addDoc(collection(visitor, "waitlist"), {
    ...validEntry(),
    email: "not-an-email",
  }),
  false
);

await check(
  "signup with invalid role is rejected",
  addDoc(collection(visitor, "waitlist"), {
    ...validEntry(),
    role: "administrator",
  }),
  false
);

await check(
  "signup with wrong source is rejected",
  addDoc(collection(visitor, "waitlist"), {
    ...validEntry(),
    source: "admin",
  }),
  false
);

await check(
  "signup with unexpected field is rejected",
  addDoc(collection(visitor, "waitlist"), {
    ...validEntry(),
    isAdmin: true,
  }),
  false
);

await check(
  "anonymous visitor cannot probe email-hash account markers",
  getDoc(doc(visitor, "accountEmails/" + "a".repeat(64))),
  false
);

await check(
  "visitor cannot read waitlist entries",
  getDoc(doc(visitor, "waitlist/seed-entry")),
  false
);

await check(
  "ordinary user cannot read waitlist entries",
  getDoc(doc(regular, "waitlist/seed-entry")),
  false
);

await check(
  "admin can read a waitlist entry",
  getDoc(doc(admin, "waitlist/seed-entry"))
);

await check(
  "owner can read a waitlist entry",
  getDoc(doc(owner, "waitlist/seed-entry"))
);

await check(
  "admin cannot update a waitlist entry",
  updateDoc(doc(admin, "waitlist/seed-entry"), {
    city: "Abuja",
  }),
  false
);

await check(
  "admin cannot delete a waitlist entry",
  deleteDoc(doc(admin, "waitlist/seed-entry")),
  false
);

await check(
  "owner cannot update a waitlist entry",
  updateDoc(doc(owner, "waitlist/seed-entry"), {
    city: "Abuja",
  }),
  false
);

await check(
  "admin can list waitlist entries",
  getDocs(collection(admin, "waitlist"))
);

await check(
  "ordinary user cannot list waitlist entries",
  getDocs(collection(regular, "waitlist")),
  false
);

await env.cleanup();
