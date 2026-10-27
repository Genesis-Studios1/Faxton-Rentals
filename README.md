# Faxton Rentals

A rental marketplace for Nigeria: find and compare homes, book viewings, apply to rent, negotiate offers, message and call agents, and run it all from
an admin console. Light and dark mode. Plain HTML, CSS and JavaScript (ES modules, hash routes), **no build step**.

> **Launching?** Read [LAUNCH.md](LAUNCH.md). It lists exactly what you must do or supply before real people use the site.

## What is in here

| Path | What it is |
|---|---|
| `public/` | The website (served by Firebase Hosting). `index.html` is the only page; the app draws everything with JavaScript. |
| `public/js/` | App code. `main.js` starts everything, `store.js` talks to Firestore, `views.js` and friends draw pages, `robust.js` handles errors, offline and updates. |
| `public/css/` | Styles, loaded in this order: `fonts`, `app`, `theme` (design tokens), `shell`, `home`, `flow`, `admin`, `chat`, `auth`, `robust`. |
| `public/sw.js` | Service worker: makes the app installable, fast and usable offline. See "Offline, caching and updates". |
| `public/404.html`, `public/offline.html` | Friendly "not found" and "you are offline" pages. |
| `public/.well-known/assetlinks.json` | Lets the Android app open `faxton-rentals.web.app` links. |
| `public/vendor/leaflet/` | The map library, hosted by us (no third party). Loaded only when a map opens. |
| `firebase.json` | Hosting settings: security headers, the Content-Security-Policy, caching rules. |
| `firestore.rules` | Who may read or write what. Deny by default. |
| `firestore.indexes.json` | Search indexes. Faxton needs no custom ones; the file also switches off indexing for big picture fields. |
| `storage.rules` | Only for the optional app-installer upload. The app does not use Firebase Storage for pictures. |
| `scripts/check-release.mjs` | `npm run check`: stops a broken release before it goes out. |
| `scripts/smoke-live.mjs` | `node scripts/smoke-live.mjs https://your-site`: checks the live site from outside. |
| `tests/rules/` | Security-rule tests (`npm run test:rules`). |
| `apps/mobile`, `apps/desktop` | Android/iPhone (Capacitor) and Windows/Mac/Linux (Electron) wrappers. They load the live website. |
| `.github/workflows/` | `deploy.yml` (publish the site) and `release-apps.yml` (build the apps). |

## How the data is stored

* **Firebase Authentication**: email and password, and Google sign-in.
* **Cloud Firestore** on the free Spark plan. There are **no Cloud Functions and no Storage**: photos, voice notes and documents are saved as text
  ("data URLs") inside Firestore documents, so each document must stay under 1 MiB. The rules cap picture fields well below that.
* **No sample homes are ever shown to visitors.** If there are no live listings the app shows an honest empty state. The sample homes in
  `public/js/data.js` (`DEMO_SEED`) exist only for tests and for the owner's optional demo mode (below).

### Demo mode (owner only, for look-and-feel checks)

Sign in as the owner and open `#/admin?demo=on` (add it to the end of the web address). On an empty site the Overview page then shows
**Add demo listings (sample data)**. Those homes are real documents marked `demo: true`, so visitors can see them too: delete them before launch.
`#/admin?demo=off` hides the button again. Demo mode is remembered only in that one browser.

## Roles

| Role | Can do |
|---|---|
| **owner** (one person) | Everything an admin can, plus promote or demote people and hand over ownership |
| **admin** | Approve listings, agents and verifications; manage applications, viewings, payments, support |
| **support** | Tickets and suggestions |
| **agency, agent, landlord ("Home owner")** | Their own listings, leads, viewings, offers and tenants (agents and agencies must be verified first) |
| **renter** | Search, save, book, apply, pay by bank transfer, message |

The owner's email is **not stored in this repository**. It lives in a private Firestore document (`config/bootstrap`, unreadable from the app)
that you create once in the Firebase console. The first *verified* sign-in with that email becomes the owner. This is enforced in
`firestore.rules`, not only in the browser. See LAUNCH.md for the exact clicks.

## Run it on your computer

Windows: double-click **run-locally.bat**. Mac/Linux: `./run-locally.sh`. Or `npx serve public` and open http://localhost:3000.
(Do not open `index.html` straight from the folder: browsers block ES modules on `file://`.) Local servers do not apply the headers from
`firebase.json`, so the Content-Security-Policy is only exercised on the real site; the live check below covers that.

## Releasing a new version

1. Pick a version string, for example `2026-10-20.1`, and put the same value in **three places**:
   * `public/js/ui.js` (`BUILD`)
   * `public/sw.js` (`BUILD`)
   * every `?v=` in `public/index.html` (css and js links, 13 of them)
2. `npm run check` (it fails with a plain-English reason if the three disagree, a file is missing, or the code talks to a website the security policy would block).
3. `npm run deploy` (checks again, then publishes the site and the Firestore rules). Or push to `main` and GitHub does it (`deploy.yml`).
4. Run `node scripts/smoke-live.mjs https://faxton-rentals.web.app` and the by-hand test in LAUNCH.md.

People who already have the app open see **"A new version is ready. Reload"**; everyone else gets it on their next visit.

If you replace a picture in `public/img/` **keep the file name** and it updates on the next visit (pictures are refreshed in the background);
a different name updates at once.

## Offline, caching and updates

* `index.html`, `sw.js` and everything in `js/` and `css/` are revalidated on every visit (`no-cache`), so a release shows up immediately.
* Fonts and the map library are cached for a year; pictures for a day and are also refreshed in the background by the service worker. Files with a `?v=` build number are served straight from the service worker's saved copy (a new build number is a new file).
* The service worker saves the app shell and the Firebase SDK scripts so the app can open with no signal. It **never** saves Firestore or
  sign-in traffic, maps tiles or any other website. If it ever misbehaves, see "Emergency: switch the service worker off" in LAUNCH.md.
* If `localStorage` is blocked (private mode, some in-app browsers) the app keeps working with a temporary in-memory copy.

## Security

* Headers and the Content-Security-Policy are in `firebase.json`. Only these outside hosts are allowed: Google/Firebase (`gstatic`, `googleapis`,
  `apis.google.com`, the project's `firebaseapp.com` sign-in domain), OpenStreetMap tiles (as images), `overpass-api.de` (nearby places), GitHub's API
  (app update check), and the TURN call-relay hosts (`metered`, Cloudflare). Pictures and videos from any `https://` address are allowed because
  agents paste photo links.
* Firestore rules are deny-by-default, with size limits and "who owns this" checks (for example a booking can only point at the real owner of the
  home). `npm run test:rules` runs 156 checks against the emulator.
* The Firebase *web config* in `public/js/firebase.js` is public by design. Access is controlled by the rules, not by hiding it.
  Never commit service-account keys or `.env` files. The Android sideload key in `apps/mobile/signing/` is committed on purpose: **keep this repository private**.

## One-time Firebase setup

```bash
npm install -g firebase-tools     # or prefix the commands below with: npx
firebase login
firebase use faxton-rentals
```
In the Firebase console (project **faxton-rentals**):
1. Build > Authentication > Get started > Sign-in method: enable **Email/Password** and **Google**.
2. Authentication > Settings > Authorized domains: `faxton-rentals.web.app` and `faxton-rentals.firebaseapp.com` must be listed (add your custom domain later).
3. Build > Firestore Database > Create database (production mode).
4. Build > Hosting > Get started.

## Identity and ownership verification

Landlords, agents and agencies must submit a government-issued ID and proof of address before they can post a property. Professional registrations are checked by a reviewer when applicable; the admin review screen links to the official ESVARBON practitioner register and NIESV membership checker. These are manual, reviewer-assisted checks, not a claim of a private registry API integration.

Every user-submitted listing also needs ownership evidence or written authority to list it. The file is stored privately in Firebase Storage; the listing stores only the private object path and review status. Firestore and Storage rules limit access to the applicant and authorised admins, and block an owner from setting their own verification status. Never replace these paths with public download URLs or store ID scans in public profile fields.

One-time setup:
1. Ensure Firebase Storage is enabled for the `faxton-rentals` project and that your project plan supports the bucket. The existing `storage.rules` file must be deployed with the other rules.
2. Configure bucket CORS once so the web app can preview private documents using authenticated byte reads (not public download tokens). With the Google Cloud CLI and Storage Admin permission, from this repository run:
   `gcloud storage buckets update gs://faxton-rentals.firebasestorage.app --cors-file=storage.cors.json`
   The CORS file allows only the app's two Firebase Hosting origins. Add a custom domain explicitly if one is introduced.
3. In Firebase Console → Authentication → Sign-in method, enable **Email/Password** and **Email link (passwordless sign-in)**. Confirm `faxton-rentals.web.app` is an authorised domain. The app-lock recovery fallback is a one-time email link, not a 6-digit numeric code. SMS MFA codes require Firebase Authentication with Identity Platform, SMS MFA enabled and a phone factor enrolled; the client does not fake this flow.

Test with a non-admin landlord account first, then verify in an admin account that the files open privately, a rejection allows resubmission, and a listing cannot be activated without its ownership proof being reviewed.

## Deploy from GitHub (no local tools)

1. Firebase console > Project settings > Service accounts > **Generate new private key** (a `.json` file; treat it like a password).
2. GitHub repository > Settings > Secrets and variables > Actions > New repository secret: `FIREBASE_SERVICE_ACCOUNT` = the whole file. Delete the download.
3. Actions > **Deploy to Firebase** > Run workflow. After that every push to `main` deploys: it runs the release check, publishes the site, rules and
   indexes, and then smoke-tests the live site (headers, 404 page, app-link file).

Troubleshooting deploys:
* *"resolving hosting target of a site with no site name"*: run `npm run setup:site` (or Console > Hosting > Get started). If the name is taken, put another in `firebase.json` as `"site"`.
* *Firestore error on deploy*: create the database first, or run `npm run deploy:hosting`.
* *Storage step fails*: expected on the free plan; that step is allowed to fail.

## Apps (Android, iPhone, Windows, Mac, Linux)

The apps are thin wrappers that open the live website, so a website release updates them too. Build them from GitHub > Actions > **Build and release
apps**. Android sign-in details: `apps/mobile/ANDROID-GOOGLE-SIGNIN.md`. The apps are hard-wired to `https://faxton-rentals.web.app`
(`apps/mobile/capacitor.config.json`, `apps/desktop/main.js`); if you move to a custom domain, change those and rebuild.
