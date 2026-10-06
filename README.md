# Faxton Rentals

A static rental-home browsing site with light and dark mode. No build step: open `public/index.html` or run `npx serve public`.

- Search and filter listings, save favorites, request a viewing.
- Sample listings live in `public/data.js`; favorites, theme and viewing requests are stored in the browser (`localStorage`).
- Logo files are in `public/assets/`.

## Deploying (Vercel)

Import the repo in Vercel with the **Other** framework preset. `vercel.json` sets the output directory to `public` and skips the build step, so no further settings are needed. Every push to `main` redeploys.
