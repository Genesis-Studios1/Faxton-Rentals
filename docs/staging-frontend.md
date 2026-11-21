# Staging frontend

The production frontend stays in `public/` with its existing Firebase configuration. The staging builder copies `public/` into `.faxton-staging-build/public` and changes only that generated copy. It replaces the Firebase web-app, App Check, Metered TURN and API settings, updates CSP for the staging auth domain and backend, and writes a Firebase config containing Hosting only. The generated directory is ignored by Git.

The Firebase **project ID** is fixed as `faxton-rentals-staging`. The Firebase Hosting **site ID** is a separate value; it identifies the Hosting site within that project and determines the Firebase-provided site hostname. The site ID is not assumed to equal the project ID and must be supplied as `STAGING_FIREBASE_HOSTING_SITE_ID`. Firebase Hosting site IDs must be valid hostname labels, use lowercase letters/digits/hyphens, be no more than 30 characters, and be globally unique.

The API origin is fixed as `https://faxton-backend-staging-ibon.onrender.com`. The build has no production fallback and fails if required configuration is missing, the project/API is wrong, or Firebase/App Check/TURN settings reuse the production values. App Check and Metered TURN must each be set to a staging public key or explicitly set to `disabled`.

## Values needed before building

Register a web app in `faxton-rentals-staging`, create its Hosting site, and supply these values from that staging setup. Browser configuration values are public and are not Firebase Admin credentials:

- `STAGING_FIREBASE_API_KEY`
- `STAGING_FIREBASE_AUTH_DOMAIN`
- `STAGING_FIREBASE_STORAGE_BUCKET`
- `STAGING_FIREBASE_MESSAGING_SENDER_ID`
- `STAGING_FIREBASE_APP_ID`
- Optional: `STAGING_FIREBASE_MEASUREMENT_ID`
- `STAGING_FIREBASE_HOSTING_SITE_ID` (Hosting site ID, not project ID)
- `STAGING_FRONTEND_ORIGIN` (must be exactly `https://<site-id>.web.app`; custom domains are not accepted by the builder or smoke test)
- `STAGING_APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY` (staging key or `disabled`)
- `STAGING_METERED_TURN_API_KEY` (staging credential-scoped key or `disabled`)

`STAGING_FIREBASE_PROJECT_ID` must equal `faxton-rentals-staging`; `STAGING_API_BASE_URL` must equal the staging backend origin. The workflow supplies both fixed values. Never put Firebase Admin JSON or private keys in frontend variables or the browser artifact.

Run `npm run test:staging-build` for offline checks. With the staging values set, `npm run build:staging` creates `.faxton-staging-build/`. The builder does not overwrite an existing output directory; inspect and remove that generated directory before rebuilding.

## Manual Firebase setup

1. In the Firebase Console, select **`faxton-rentals-staging`**, register a web app, and configure the staging Authentication providers and authorized domain.
2. In that same project, explicitly create or confirm the Hosting site. New Firebase projects do not necessarily have a default Hosting site. Record the exact site ID and attached HTTPS origin; do not guess either value.
3. Set the GitHub repository variables listed above. They are public browser configuration, not service-account secrets.
4. Set the staging Render service's `CORS_ORIGINS` to exactly the staging frontend origin.
5. If testing Firestore-backed screens, provision staging Firestore and deploy the complete canonical rules and indexes through a separately reviewed staging-only process. This frontend workflow deploys Hosting only.

## GitHub deployment protection

The workflow requires the GitHub Environment named `staging`. Configure it manually under **Repository Settings → Environments**:

- Add required reviewers and enable prevent-self-review where available.
- Restrict deployment branches to the `staging` branch.
- Add `FIREBASE_STAGING_SERVICE_ACCOUNT` as an **environment secret** for `staging` only. Do not also create it as a repository secret.
- Protect the `staging` branch in **Branches / Rulesets** and require the staging build tests before merging or allowing deployment.

These reviewer, branch-protection, and IAM settings are not created or verified by this YAML. The service account must be dedicated to the staging project and have only Firebase Hosting deployment permissions on `faxton-rentals-staging`; it must have no production-project access and must not be Owner or Editor. The workflow checks the service-account project field and parses its key, but cannot prove its IAM grants.

The `staging` branch must exist and contain this workflow before a push can trigger deployment. Manual dispatch from any other branch is skipped. The job runs the staging and frontend tests, builds the isolated artifact, deploys with explicit project ID and `--only hosting`, then smoke-tests only the configured staging origin. The smoke test refuses known production hostnames and redirects, checks the site and served Firebase/API/App Check/TURN settings, and fails the job on any mismatch. It does not automatically roll back.

## Rollback

If the smoke test or manual verification finds a bad staging release, open **Firebase Console → Hosting → Release history** for the staging site, select the previous known-good release, and choose **Roll back**. This creates a new release serving the earlier version. The workflow reports a failed smoke test and leaves rollback to an operator; it never rolls back production or staging automatically.
