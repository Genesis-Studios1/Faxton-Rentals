import { db } from "./firebase.js";
import { SEED } from "./data.js";
import { collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, query, where, orderBy, onSnapshot, serverTimestamp, arrayUnion, arrayRemove, writeBatch }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let cache = null;
export async function getListings(force = false) {
  if (cache && !force) return cache;
  try {
    const snap = await getDocs(query(collection(db, "listings"), where("status", "==", "active")));
    cache = snap.empty ? SEED : snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  } catch { cache = SEED; }
  return cache;
}
export const getListing = async (id) => (await getListings()).find((l) => l.id === id) || null;

// ---- profile + saved homes ----
export async function getProfile(uid) { try { const s = await getDoc(doc(db, "users", uid)); return s.exists() ? s.data() : null; } catch { return null; } }
export const saveProfile = (uid, data) => setDoc(doc(db, "users", uid), data, { merge: true });
const localSaved = () => { try { return JSON.parse(localStorage.getItem("saved") || "[]"); } catch { return []; } };
export async function getSaved(user) { return user ? ((await getProfile(user.uid))?.saved || []) : localSaved(); }
export async function toggleSaved(user, id, on) {
  if (!user) { const s = new Set(localSaved()); on ? s.add(id) : s.delete(id); try { localStorage.setItem("saved", JSON.stringify([...s])); } catch {} return; }
  await setDoc(doc(db, "users", user.uid), { saved: on ? arrayUnion(id) : arrayRemove(id) }, { merge: true });
}

// ---- viewings, applications ----
export const addViewing = (user, l, when, slot) => addDoc(collection(db, "viewings"), { uid: user.uid, name: user.displayName || user.email, listingId: l.id, title: l.title, area: l.area, image: l.thumb || l.images[0], when, slot, status: "Requested", createdAt: serverTimestamp() });
export const addApplication = (user, l, moveIn) => addDoc(collection(db, "applications"), { uid: user.uid, name: user.displayName || user.email, email: user.email, listingId: l.id, title: l.title, area: l.area, image: l.thumb || l.images[0], amount: l.price + l.service + l.deposit, moveIn, status: "Under review", createdAt: serverTimestamp() });
const mine = async (col, user) => { try { return (await getDocs(query(collection(db, col), where("uid", "==", user.uid)))).docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)); } catch { return []; } };
export const myViewings = (u) => mine("viewings", u);
export const myApplications = (u) => mine("applications", u);

// ---- messaging ----
export const convId = (user, l) => `${user.uid}__${l.id}`;
export async function ensureConversation(user, l) {
  const ref = doc(db, "conversations", convId(user, l));
  if (!(await getDoc(ref)).exists()) await setDoc(ref, { uid: user.uid, userName: user.displayName || user.email, listingId: l.id, listingTitle: l.title, area: l.area, price: l.price, beds: l.beds, baths: l.baths, image: l.thumb || l.images[0], agent: l.agent, last: "", lastAt: serverTimestamp(), createdAt: serverTimestamp() });
  return ref.id;
}
export const watchConversations = (user, cb) => onSnapshot(query(collection(db, "conversations"), where("uid", "==", user.uid)),
  (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (b.lastAt?.seconds || 0) - (a.lastAt?.seconds || 0))), () => cb([]));
export const watchMessages = (cid, cb) => onSnapshot(query(collection(db, "conversations", cid, "messages"), orderBy("at")), (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id }))), () => cb([]));
export async function sendMessage(user, cid, text, extra = {}) {
  const b = writeBatch(db);
  b.set(doc(collection(db, "conversations", cid, "messages")), { from: user.uid, text, at: serverTimestamp(), ...extra });
  b.update(doc(db, "conversations", cid), { last: text, lastAt: serverTimestamp() });
  await b.commit();
}

// ---- admin ----
export async function adminAll(col) { try { return (await getDocs(collection(db, col))).docs.map((d) => ({ ...d.data(), id: d.id })); } catch { return []; } }
export const setStatus = (col, id, status) => updateDoc(doc(db, col, id), { status });
export async function seedListings() {
  const b = writeBatch(db);
  SEED.forEach((l) => b.set(doc(db, "listings", l.id), l));
  b.set(doc(db, "listings", "cedar-house"), { ...SEED[1], id: "cedar-house", title: "Cedar House", area: "Wuse 2", city: "Abuja", status: "pending", price: 2800000, lat: 9.0765, lng: 7.4719 });
  await b.commit(); cache = null;
}
