import { db } from "./firebase.js";
import { SEED } from "./data.js";
import { collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, query, where, orderBy, onSnapshot, serverTimestamp, arrayUnion, arrayRemove, writeBatch, deleteDoc, deleteField }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let cache = null;
// Fill any missing fields so a partial or older Firestore listing can never break a page.
const norm = (l) => { const seed = SEED.find((x) => x && x.id === l.id) || {}; const o = { ...seed, ...l }; o.agent = { ...(seed.agent || {}), ...(l.agent || {}) }; if (!o.agent.name) o.agent.name = "Faxton agent"; if (!o.agent.avatar) o.agent.avatar = "img/av-daniel.webp"; if (!o.agent.photo) o.agent.photo = o.agent.avatar; o.images = o.images?.length ? o.images : [o.thumb || "img/palm-court.webp"]; o.thumb = o.thumb || o.images[0]; o.amenities = o.amenities || []; o.desc = o.desc || ""; o.area = o.area || ""; o.city = o.city || ""; o.beds = o.beds ?? 1; o.baths = o.baths ?? 1; o.price = o.price || 0; o.videos = (Array.isArray(o.videos) ? o.videos : []).filter((u) => typeof u === "string" && /^https:\/\//.test(u)).slice(0, 6); return o; };
export async function getListings(force = false) {
  if (cache && !force) return cache;
  // Stale-while-revalidate: show the last known listings instantly, then refresh them in the background.
  let stored = null; try { stored = JSON.parse(localStorage.getItem("lst") || "null"); } catch {}
  const fetchFresh = async () => {
    try {
      const snap = await getDocs(query(collection(db, "listings"), where("status", "==", "active")));
      cache = snap.empty ? SEED : snap.docs.map((d) => norm({ ...d.data(), id: d.id }));
    } catch { cache = SEED; }
    try { localStorage.setItem("lst", JSON.stringify(cache)); } catch {}
    return cache;
  };
  if (stored?.length && !force) { cache = stored.filter(Boolean).map(norm); fetchFresh(); return cache; }
  return fetchFresh();
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
export const addViewing = (user, l, when, slot, extra = {}) => addDoc(collection(db, "viewings"), { ...extra, ownerUid: l.ownerUid || null, uid: user.uid, name: user.displayName || user.email, listingId: l.id, title: l.title, area: l.area, image: l.thumb || l.images[0], when, slot, status: "Requested", createdAt: serverTimestamp() });
export const addApplication = (user, l, moveIn, details = {}) => addDoc(collection(db, "applications"), { details, ownerUid: l.ownerUid || null, uid: user.uid, name: user.displayName || user.email, email: user.email, listingId: l.id, title: l.title, area: l.area, image: l.thumb || l.images[0], amount: l.price + l.service + l.deposit, moveIn, status: "Under review", createdAt: serverTimestamp() });
const mine = async (col, user) => { try { return (await getDocs(query(collection(db, col), where("uid", "==", user.uid)))).docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)); } catch { return []; } };
export const myViewings = (u) => mine("viewings", u);
export const myApplications = (u) => mine("applications", u);

// ---- documents (stored per user; files up to ~700 KB are kept in the document itself) ----
export const myDocs = (u) => mine("documents", u);
export const addDocument = (u, d) => addDoc(collection(db, "documents"), { ...d, uid: u.uid, status: "Uploaded", createdAt: serverTimestamp() });
export const removeDocument = (id) => deleteDoc(doc(db, "documents", id));

// ---- support tickets ----
export const myTickets = (u) => mine("tickets", u);
export const addTicket = (u, t) => addDoc(collection(db, "tickets"), { ...t, uid: u.uid, name: u.displayName || u.email, status: "Open", ref: "FR-" + (1000 + Math.floor(Math.random() * 9000)), createdAt: serverTimestamp() });

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
// Every conversation the Faxton team has with users (admins, the owner and support see all of them).
export const watchStaffConversations = (cb) => onSnapshot(query(collection(db, "conversations"), where("listingId", "==", "direct")),
  (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (b.lastAt?.seconds || 0) - (a.lastAt?.seconds || 0))), () => cb([]));
export const setStaffUnread = (cid, v) => updateDoc(doc(db, "conversations", cid), { staffUnread: !!v });
export async function sendMessage(user, cid, text, extra = {}, unread = false, convExtra = {}) {
  const b = writeBatch(db);
  b.set(doc(collection(db, "conversations", cid, "messages")), { from: user.uid, text, at: serverTimestamp(), ...extra });
  b.update(doc(db, "conversations", cid), { last: text, lastAt: serverTimestamp(), unread, ...convExtra });
  await b.commit();
}
export const markRead = (cid) => updateDoc(doc(db, "conversations", cid), { unread: false });

// ---- ownership & roles ----
export async function getOwnerUid() { try { const s = await getDoc(doc(db, "config", "owner")); return s.exists() ? s.data().uid : null; } catch { return null; } }
// While no owner exists, a verified sign-in may try to claim ownership. Firestore rules decide who is allowed.
export async function claimOwnership(user) {
  await setDoc(doc(db, "config", "owner"), { uid: user.uid, since: serverTimestamp() });
  await setDoc(doc(db, "users", user.uid), { role: "owner" }, { merge: true });
}
export const setRole = (uid, role) => updateDoc(doc(db, "users", uid), { role });
export const setBanned = (uid, on) => updateDoc(doc(db, "users", uid), on ? { banned: true, bannedAt: serverTimestamp() } : { banned: false });
export const watchProfile = (uid, cb) => onSnapshot(doc(db, "users", uid), (s) => cb(s.exists() ? s.data() : null), () => {});
// Sign-in can tell "no account" from "wrong password" through a public marker keyed by a hash of the email (the email itself is never stored there).
export async function emailHash(email) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(email).trim().toLowerCase())); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
export async function hasAccountMarker(email) { try { return (await getDoc(doc(db, "accountEmails", await emailHash(email)))).exists(); } catch { return null; } }
export async function writeAccountMarker(email) { try { await setDoc(doc(db, "accountEmails", await emailHash(email)), { t: 1 }); } catch { /* already there, or offline */ } }
export async function transferOwnership(fromUid, toUid) {
  const b = writeBatch(db);
  b.update(doc(db, "config", "owner"), { uid: toUid });
  b.update(doc(db, "users", fromUid), { role: "admin" });
  b.update(doc(db, "users", toUid), { role: "owner" });
  await b.commit();
}

// ---- admin ----
export async function adminAll(col) { try { return (await getDocs(collection(db, col))).docs.map((d) => ({ ...d.data(), id: d.id })); } catch { return []; } }
export const patch = (col, id, data) => { cache = null; return updateDoc(doc(db, col, id), data); };
export const createListing = (l) => { cache = null; return setDoc(doc(db, "listings", l.id), { ...l, createdAt: serverTimestamp() }); };
export const watchReleases = (cb) => onSnapshot(query(collection(db, "appReleases"), where("published", "==", true)), (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id }))), () => cb([]));
export const saveRelease = (id, data) => (id ? updateDoc(doc(db, "appReleases", id), { ...data, updatedAt: serverTimestamp() }) : addDoc(collection(db, "appReleases"), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
export const removeRelease = (id) => deleteDoc(doc(db, "appReleases", id));
export const setStatus = (col, id, status) => updateDoc(doc(db, col, id), { status });
export async function seedListings() {
  const b = writeBatch(db);
  SEED.forEach((l) => b.set(doc(db, "listings", l.id), l));
  b.set(doc(db, "listings", "cedar-house"), { ...SEED[1], id: "cedar-house", title: "Cedar House", area: "Wuse 2", city: "Abuja", status: "pending", price: 2800000, lat: 9.0765, lng: 7.4719 });
  await b.commit(); cache = null;
}

// Documents (listings, viewings, applications) that belong to a landlord or agency account.
export async function ownedDocs(col, uid) { try { return (await getDocs(query(collection(db, col), where("ownerUid", "==", uid)))).docs.map((d) => ({ ...d.data(), id: d.id })); } catch { return []; } }

// ---- verification of agencies and agents, notifications, suggestions ----
export const verifyUser = (uid, verification) => updateDoc(doc(db, "users", uid), { verified: verification.status === "verified", verification });
export const notify = (uid, n) => addDoc(collection(db, "notifications"), { uid, read: false, createdAt: serverTimestamp(), ...n });
export const watchNotifications = (uid, cb) => onSnapshot(query(collection(db, "notifications"), where("uid", "==", uid), where("read", "==", false)), (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id }))), () => {});
export const markNotificationRead = (id) => updateDoc(doc(db, "notifications", id), { read: true }).catch(() => {});
export const watchPendingVerifications = (cb) => onSnapshot(query(collection(db, "users"), where("verification.status", "==", "pending")), (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id }))), () => {});
export const addSuggestion = (u, s) => addDoc(collection(db, "suggestions"), { ...s, uid: u.uid, name: u.displayName || u.email, email: u.email, status: "New", createdAt: serverTimestamp() });
export const setDeletion = (uid, d) => updateDoc(doc(db, "users", uid), { deletion: d ? d : deleteField() });
export const decideDeletion = (uid, d) => updateDoc(doc(db, "users", uid), { deletion: d });
export async function deleteProfile(uid) { await deleteDoc(doc(db, "users", uid)); }

// A direct conversation started by the Faxton team (admin or support) with any user.
export async function ensureDirectConversation(staff, u) {
  const id = `${u.id}__direct`, ref = doc(db, "conversations", id);
  if (!(await getDoc(ref)).exists()) await setDoc(ref, { uid: u.id, userName: u.name || u.email, listingId: "direct", listingTitle: "Faxton team", area: "", price: 0, beds: 0, baths: 0, image: "assets/mark.svg", userPhoto: u.photo || "", agent: { id: "faxton", name: "Faxton team", avatar: "assets/mark.svg", photo: "assets/mark.svg" }, last: "", lastAt: serverTimestamp(), createdAt: serverTimestamp() });
  return id;
}
