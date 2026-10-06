# Faxton Rentals

Rental-home web app for Nigeria: discover and search homes (map + grid), save favourites, book viewings, apply to rent,
message agents, and an admin console. Light and dark mode. Plain HTML/CSS/JS (ES modules), no build step.

- **App:** `public/` (served by Firebase Hosting). Hash routes: `#/`, `#/search`, `#/home/:id`, `#/messages`, `#/admin`, ...
- **Backend:** Firebase project `faxton-rentals` — Authentication (email/password + Google) and Cloud Firestore.
- **Sample listings:** `public/js/data.js` is shown until Firestore has listings; an admin can copy them in with **Add sample listings**.

## One-time Firebase setup
1. Console → Build → **Authentication** → Sign-in method: enable **Email/Password** and **Google**.
2. Console → Build → **Firestore Database** → Create database (production mode).
3. Deploy the rules: `npx firebase-tools deploy --only firestore:rules`.
4. Make yourself admin: after signing up, open Firestore → `users/<your uid>` and set `role` to `admin`.

## Deploy
`npx firebase-tools login && npx firebase-tools deploy` (hosting + rules).
Or push to `main` with a `FIREBASE_SERVICE_ACCOUNT` GitHub secret set and `.github/workflows/deploy.yml` deploys automatically.
