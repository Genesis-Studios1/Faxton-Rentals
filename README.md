# Faxton Rentals

Rental-home web app for Nigeria: discover and search homes (map + grid), save favourites, book viewings, apply to rent,
message agents, and an admin console. Light and dark mode. Plain HTML/CSS/JS (ES modules), no build step.

- **App:** `public/` (Firebase Hosting). Hash routes: `#/`, `#/search`, `#/home/:id`, `#/messages`, `#/admin`, …
- **Backend:** Firebase project `faxton-rentals` — Authentication (email/password + Google) and Cloud Firestore.
- **Sample listings:** `public/js/data.js` shows until Firestore has listings; an admin can copy them in with **Add sample listings**.

## Roles
| Role | Can do |
|---|---|
| **owner** (one person) | Everything an admin can, plus promote/demote users and transfer ownership |
| **admin** | Approve listings, manage applications and viewings |
| **agent / renter** | Normal use |

The owner's email is **not stored in this repository**. It lives in a private Firestore document (`config/bootstrap`,
unreadable from the app) that you create once in the Firebase console (see *Set the owner* below). The first *verified*
sign-in with that email claims ownership (email + password users must click the verification link first; Google sign-in is
already verified). This is enforced in `firestore.rules`, not just in the browser. The owner can later transfer ownership from
**Admin → Users → Make owner** (the previous owner becomes an admin).

## Set the owner (once, in the Firebase console)
Firestore Database → Start collection → ID `config` → Document ID `bootstrap` → field `ownerEmail` (string) = the owner's email.
Then sign in with that email (verified) and the app makes that account the owner.

## Security
- Strict security headers and a Content-Security-Policy are set in `firebase.json`.
- Firestore rules are deny-by-default; users only read their own data; roles can only be changed by the owner.
- The Firebase *web config* in `public/js/firebase.js` is public by design (every web app ships it). It is not a secret —
  access is controlled by the rules above, not by hiding it. Never commit service-account keys or `.env` files.

## Run locally
Windows: double-click **run-locally.bat**. Mac/Linux: `./run-locally.sh`. Or: `npx serve public` and open http://localhost:3000
(Needs Node.js. Don't open `index.html` directly from the folder — browsers block ES modules on `file://`.)

## Install it as an app
Once it is running on a web address (https://faxton-rentals.web.app or localhost) it is an installable app (PWA):
- **Chrome / Edge:** click the install icon in the address bar, or *Settings → Install the app* inside Faxton Rentals.
- **iPhone / iPad (Safari):** Share → *Add to Home Screen*. **Android:** menu → *Install app*.
It opens in its own window, shows the animated splash, and reopens fast.

## One-time Firebase setup
```bash
npm install -g firebase-tools     # or prefix every command below with: npx
firebase login
firebase use faxton-rentals
```
In the Firebase console (project **faxton-rentals**):
1. Build → Authentication → Get started → Sign-in method → enable **Email/Password** and **Google**.
2. Authentication → Settings → Authorized domains → make sure `faxton-rentals.web.app` and `faxton-rentals.firebaseapp.com` are listed (add your custom domain later).
3. Build → Firestore Database → Create database (production mode).

## Deploy (Windows cmd or PowerShell)
```bash
npm install -g firebase-tools
firebase login
firebase use faxton-rentals
firebase deploy
```
Run `firebase deploy` again every time you change the app. Live at https://faxton-rentals.web.app.
