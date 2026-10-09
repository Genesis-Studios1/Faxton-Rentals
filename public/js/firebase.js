import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// Web app config. These values are public identifiers, not secrets; access is enforced by firestore.rules.
const firebaseConfig = {
  apiKey: "AIzaSyBraCvOGzGiEfmOZPmmi1ceVtkipJeATeE",
  authDomain: "faxton-rentals.firebaseapp.com",
  projectId: "faxton-rentals",
  storageBucket: "faxton-rentals.firebasestorage.app",
  messagingSenderId: "426381186757",
  appId: "1:426381186757:web:d543f2b40df35a9dddc2ac",
  measurementId: "G-05NYRRFD70",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const google = new GoogleAuthProvider();
google.addScope("email"); google.addScope("profile");
