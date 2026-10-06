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

The owner is **isaacij6yes@gmail.com**. The first *verified* sign-in with that email claims ownership
(email + password users must click the verification link first; Google sign-in is already verified).
This is enforced in `firestore.rules`, not just in the browser. The owner can later transfer ownership from
**Admin → Users → Make owner** (the previous owner becomes an admin).

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

## Deploy
```bash
firebase deploy                                   # hosting + firestore rules
# or individually
firebase deploy --only firestore:rules
firebase deploy --only hosting
```
Live at https://faxton-rentals.web.app. Pushes to `main` also deploy automatically if the GitHub repo has a
`FIREBASE_SERVICE_ACCOUNT` secret (generate it with `firebase init hosting:github`).
