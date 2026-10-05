# Faxton Rentals

A static rental-home browsing site with light and dark mode. No build step: open `public/index.html` or run `npx serve public`.

- Search and filter listings, save favorites, request a viewing.
- Sample listings live in `public/data.js`; favorites, theme and viewing requests are stored in the browser (`localStorage`).
- Logo files are in `public/assets/`.

## Deploying (Firebase Hosting)

The site is served from `public/` on Firebase project `faxton-ai`. Pushes to `main` deploy automatically via
`.github/workflows/deploy.yml`, which needs a `FIREBASE_SERVICE_ACCOUNT` repository secret
(Firebase console → Project settings → Service accounts → Generate new private key; paste the JSON as the secret).

Manual deploy: `npx firebase-tools login && npx firebase-tools deploy --only hosting`.
