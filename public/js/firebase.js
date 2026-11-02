import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-check.js";
import { APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY } from "./app-check-config.js";

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

// Initialize App Check with the configured public site key. Firebase service enforcement
// must remain off until production traffic has been deployed, monitored and validated.
export const appCheck = APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY
  ? initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    })
  : null;

export const auth = getAuth(app);
export const db = getFirestore(app);
export const google = new GoogleAuthProvider();
google.addScope("email"); google.addScope("profile");

// Re-authentication helpers used by the "Download my data" check (mydata.js). Email-link sign-in must be enabled in the Firebase console
// (Authentication > Sign-in method > Email/Password > Email link); without it the app falls back to the password.
export { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, EmailAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
