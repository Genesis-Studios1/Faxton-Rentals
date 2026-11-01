# Faxton Rentals: launch checklist

For the owner. No coding needed for most of this; the few steps that touch a file say exactly which file and which line.
Tick the boxes as you go. Anything marked **(blocker)** must be done before real people use the site.

How to read the time and cost notes: prices are typical figures at the time of writing and change, so confirm on the provider's page before paying.

---

## 0. Where things stand

**Already done for you (you do not need to touch these)**
* The site never shows made-up homes to visitors. With no listings it shows a friendly empty state.
* Security headers, a strict Content-Security-Policy, HTTPS-only (HSTS), no framing by other sites, and a locked-down Firestore (156 automated checks pass).
* Works offline for the pages you already opened, shows an "You're offline" bar, a "A new version is ready" prompt, friendly error messages (never raw codes), a proper 404 page.
* Sharing cards for WhatsApp, Facebook, X and LinkedIn (picture, title, description), `robots.txt`, `sitemap.xml`, install-to-home-screen icons and shortcuts.
* A release check (`npm run check`) and a live-site check (`node scripts/smoke-live.mjs <address>`).
* Android app-link file at `/.well-known/assetlinks.json` (see step 6).

**Only you can do (this document)**: accounts, domain, legal text, real contact details, real listings, and the Google/Apple/Play paperwork.

---

## 1. Domain name and DNS (blocker if you want your own address)

The site works today at **https://faxton-rentals.web.app**. A custom address (for example `faxtonrentals.com` or `faxtonrentals.ng`) looks more trustworthy
to renters and agents. Do this *before* you print or share the link, because the Android and desktop apps and every shared link point at the address you launch with.

- [ ] Buy the domain. About US$10 to 15 a year for a `.com`; `.ng` domains are sold by NiRA-accredited registrars (price varies, usually a few thousand naira a year). **You** must be the owner on the registrar account, not a freelancer.
- [ ] Firebase console > **Hosting** > **Add custom domain** > type the domain > Firebase shows 1 or 2 DNS records (a `TXT` to prove ownership and an `A` record or two).
- [ ] At your registrar's DNS page, add exactly those records. Wait. It usually takes minutes, sometimes up to 24 hours. Firebase issues the HTTPS certificate by itself.
- [ ] Also add `www.yourdomain` in Hosting and choose **Redirect** to the main one.
- [ ] Firebase console > **Authentication** > **Settings** > **Authorized domains** > **Add domain**: add `yourdomain.com` and `www.yourdomain.com`. **Without this, sign-in fails on the new address.** (blocker)
- [ ] Replace `faxton-rentals.web.app` with your domain in these four places (ask a developer, or search-and-replace in a text editor): `public/index.html` (the `canonical`, `og:url`, `og:image`, `twitter:image` and JSON-LD lines), `public/sitemap.xml`, `public/robots.txt`, and the picture `public/img/og-image.jpg` (it prints the address in the corner; ask a designer to change the text, or leave it).
- [ ] Android and desktop apps: they open `https://faxton-rentals.web.app` today. Change that address in `apps/mobile/capacitor.config.json` and `apps/desktop/main.js` (and ask the developer to check the Android link host) and rebuild the apps (steps 6 and 7). The app-link file `public/.well-known/assetlinks.json` lists the app's key, not the domain, so it stays.
- [ ] Sign-in pop-up keeps using `faxton-rentals.firebaseapp.com`; that is fine and needs no change. (If you ever set a custom auth domain, the Content-Security-Policy in `firebase.json` must list it.)
- [ ] Run `node scripts/smoke-live.mjs https://yourdomain.com` and check everything says PASS.

## 2. Firebase project settings (blocker)

- [ ] **Authentication > Sign-in method**: *Email/Password* and *Google* enabled. Google needs a **Project support email** (use your support address, not a personal one).
- [ ] **Authentication > Templates**: set the sender name to "Faxton Rentals", edit the verification and password-reset emails into friendly short text, and set the **reply-to** to your support address.
- [ ] **Email deliverability**: Firebase's default sender often lands in spam. In *Templates* choose **Customize domain** and add the DNS records it shows (they prove your domain). New renters must verify their email to use the app, so this matters.
- [ ] **Email limits**: the free plan limits how many verification and password-reset emails Firebase will send per day (a low figure; see **Authentication > Usage** and the Firebase quotas page). If you expect more new sign-ups per day than that, move to the Blaze plan (step 11) before launch.
- [ ] **Firestore**: database created in **production mode**, in a region close to Nigeria if offered (for example `europe-west` is usually the closest; the region cannot be changed later).
- [ ] Deploy the rules and indexes once: GitHub > Actions > **Deploy to Firebase** > Run workflow (or `npm run deploy`).
- [ ] **Project settings > Your apps > Web app**: nothing secret is in it. Leave the public web config as it is.

## 3. Google sign-in in production (blocker)

- [ ] Google Cloud console (console.cloud.google.com, same project) > **APIs & Services** > **OAuth consent screen** (newer name: **Google Auth Platform**).
- [ ] User type **External**. Fill in: app name *Faxton Rentals*, **support email**, **developer contact email**, app logo (use `public/icons/icon-512.png`), home page (your domain), privacy policy link (`https://yourdomain/#/privacy`), terms link (`https://yourdomain/#/terms`).
- [ ] Add your domain under **Authorised domains**.
- [ ] Click **Publish app** so **Publishing status** says **In production**. If it says *Testing*, only the few test users you list can sign in and everyone else sees an error. Google, email and profile scopes need no review.

## 4. Real contact details and social pages (blocker for legal pages)

- [ ] **Support email**: open `public/js/fx.js`, line 6: replace `"{SUPPORT_EMAIL}"` with your real address, for example `"support@yourdomain.com"`. Until then the Terms and Privacy pages say "use the Help centre in the app".
- [ ] Set up that mailbox (Google Workspace from about US$7 per user per month, or your registrar's email, or a forwarding address). Someone must read it every day. Put a phone or WhatsApp line in the Help page text if you want one.
- [ ] **Social pages**: open `public/js/footer.js`, the list called `SOCIALS` at the top. Between the quotes after each name, paste the full page address (for example `"https://instagram.com/faxtonrentals"`). Networks you leave empty say "coming soon" when tapped.
- [ ] Create the actual accounts first (Instagram, X, LinkedIn, YouTube, TikTok, Pinterest) and use the same handle everywhere.

## 5. Legal and data protection (blocker)

The Terms of Use, Privacy Policy and License pages are drafts written for a Nigerian marketplace. **They are not legal advice.**

- [ ] A Nigerian lawyer reads and approves `public/js/legal.js` (the three pages) and edits the wording. Make sure the company name in the footer ("Faxton Rentals Inc.") is your registered name.
- [ ] **Register the business**: CAC registration (Corporate Affairs Commission), and a business bank account. Renters pay by bank transfer, so the account name must match.
- [ ] **Data protection**: Faxton handles names, phone numbers, addresses, IDs and documents, so the **Nigeria Data Protection Act 2023** applies. Ask your lawyer whether you must register with the **Nigeria Data Protection Commission (NDPC)** as a "data controller of major importance" (this depends on how many people's data you handle; thresholds and fees are set by the NDPC and change, so confirm the current ones), whether you need a Data Protection Officer, and whether the Privacy Policy needs more (retention periods, who your processors are: Google/Firebase, and the call-relay provider).
- [ ] **Public-form abuse protection**: the public waitlist currently writes directly to Firestore. Rules validate the shape and timestamp, but Firestore rules do not rate-limit anonymous requests. Before a broad public launch, route submissions through a server-side endpoint with Firebase App Check verification, CAPTCHA/risk checks and server-enforced rate limits. The current honeypot or browser cooldown is not an abuse-control boundary. This requires a server-side hosting plan; the project README currently documents the Firebase Spark plan and no Cloud Functions.
- [ ] **Cookies and storage**: Faxton uses no advertising or tracking cookies and **runs no analytics today**. It stores only what is needed to keep people signed in and to remember theme and a few settings on their device. The footer's **Your Privacy Choices** says exactly that. If you add Google Analytics or similar later, add a consent choice first and update the Privacy Policy.
- [ ] Decide who answers **account-deletion requests** (they appear in the admin console and need an admin to approve).

## 6. Android app (Google Play)

- [ ] **Google Play Console** developer account: one-time fee, about US$25. Allow a few days for identity verification. New personal accounts must run a closed test with testers for a period before production; business accounts have fewer steps.
- [ ] Follow `apps/mobile/ANDROID-GOOGLE-SIGNIN.md` (about 15 minutes): register the app's **SHA-1 and SHA-256** in Firebase, replace `apps/mobile/google-services.json` with the new download, rebuild. Without this, **Google sign-in fails in the Android app** (email sign-in still works).
- [ ] Make your own **upload key** and add the four secrets in GitHub > Settings > Secrets and variables > Actions: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` (commands in `apps/mobile/signing/README.md`). **Back the key up somewhere safe: if you lose it you cannot update the app.**
- [ ] Turn on **Play App Signing** in the Play Console. Copy the **App signing key** SHA-1 and SHA-256 from *Setup > App signing* into Firebase (same screen as above), download `google-services.json` again, rebuild.
- [ ] Put the same **Play App signing SHA-256** into `public/.well-known/assetlinks.json` (inside the brackets, next to the existing one, comma-separated) so links to your site open in the app. Redeploy the site.
- [ ] Build: GitHub > Actions > **Build and release apps** > Run workflow > version (for example `1.0.0`). Upload the `.aab` file from the release to Play Console. Fill in the store listing (screenshots, short and long description, privacy policy link, data-safety form, content rating).
- [ ] The repository holds a sideload signing key on purpose. **Keep the repository private.**

## 7. iPhone, Mac and Windows apps (optional for launch day)

- [ ] **Apple Developer Program**: US$99 a year, needed to put an app on the App Store and to remove the "unidentified developer" warning on Mac. Approval takes a few days (a business needs a D-U-N-S number).
- [ ] The workflow currently builds an **unsigned** iPhone file (`.ipa`) that only works for sideloading (AltStore or Sideloadly). Publishing on the App Store needs a signed build; plan a day or two with a developer and a Mac or CI signing setup. The Apple rules also expect a working account-deletion option (the app has one) and a privacy policy link.
- [ ] iPhone Google sign-in: register an iOS app in Firebase and commit `GoogleService-Info.plist` (see `ANDROID-GOOGLE-SIGNIN.md`, "iPhone"). Until then the iPhone app offers email sign-in.
- [ ] **Windows**: the installer is unsigned, so Windows SmartScreen warns people. A code-signing certificate costs roughly US$100 to 400 a year, or look at Microsoft's Trusted Signing (about US$10 a month). Optional.
- [ ] You can launch with the website and the "Add to Home Screen" install while these are pending.

## 8. Bank-transfer details (blocker: renters cannot pay without them)

- [ ] Sign in as owner (or admin) > Admin console > **Payments** > scroll to **Bank transfer details** > enter bank name, account number, account name and the instructions renters should follow (for example "Use your name and the home's name as the reference").
- [ ] Do a test transfer of a small amount and a test "I've paid" with a receipt photo, then confirm it as admin (Admin > **Payments**).
- [ ] Make a rule for yourself: money is confirmed only when it is **in the bank account**, never because a receipt screenshot looks fine.

## 9. First owner and admin accounts (blocker)

The owner's email is deliberately not stored in the code. You tell Firestore once:

- [ ] Firebase console > **Firestore Database** > **Start collection** > Collection ID `config` > Document ID `bootstrap` > Field `ownerEmail` (string) = your email address. Save.
- [ ] Open the site, **Sign up** with that exact email (or use Google with that account), and verify the email if asked. The first verified sign-in becomes the **owner** and the Admin console appears.
- [ ] Admin > **Team access**: add your admins and support staff by email after they have signed up once. Give admin only to people you trust with everyone's data.
- [ ] Use a strong, unique password on the owner account and keep the Google account behind it protected with 2-step verification. (If someone takes over this account they own the platform.)
- [ ] **Calls** (optional but recommended): voice and video calls work between most phones, but some networks need a relay server. Owner/admin **Settings** > the **Call relay** card: paste the relay details from a TURN provider (for example Metered has a free tier, and Cloudflare offers one too; check the current limits). Test a call between a phone on mobile data and one on Wi-Fi.
  - **How it works.** The card takes either a **credentials URL** (recommended) or relay address(es) (comma separated, each starting `turn:` or `turns:`) with a user name and password. **Save** stores it in Firestore `config/ice`; **Save and test** also opens a test connection that may only use the relay and reports **Relay works** (it got a relay address, with the time taken) or **Test failed** with the reason (wrong password, wrong address, no answer). Every call reads `config/ice` once per page load.
  - **Security trade-off (Spark has no server).** A phone placing a call needs the relay details, so they cannot be hidden from the app. The rules (`config/ice`) let only the owner and admins write, and only **signed-in users with a verified email** read; signed-out visitors and unverified sign-ups cannot. A verified user who inspects network traffic can still see the relay password. To limit the damage: use a relay account made only for Faxton, set a low monthly usage cap with the provider, and change the password or API key if usage looks odd. A credentials URL is better than typing a password because the provider can issue short-lived credentials and you can rotate or restrict the API key to your domain without touching Faxton. If you move to Blaze later, a Cloud Function can mint short-lived credentials per call and the secret never reaches the browser.
  - A credentials URL must be on `*.metered.live`, `*.metered.ca` or `rtc.live.cloudflare.com` (the site's security policy in `firebase.json` blocks other hosts; add yours to `connect-src` first).
- [ ] **Home services** (Home page > Home services, `#/services`): people send requests (tiling, electrical, plumbing and so on) that land in Firestore `serviceRequests`. Staff see them under Admin > **Service requests** (support: Support console > Service requests) and set the status (New, Contacted, Scheduled, Done, Cancelled) and a note the requester sees on their Home services page. Decide who phones people back, and how quickly. Nothing is paid through the site. Deploy the rules (`npm run deploy:rules`) before launch.

## 10. Real agents, real homes (blocker: the site is empty until you do this)

- [ ] **Remove demo data.** If you ever used demo mode, delete every home that has the sample agents (Daniel Okafor, Ngozi Adeyemi, Tunde Salami, Amara Bello, Ibrahim Musa) from Admin > **Listings**. Visitors must only ever see real homes.
- [ ] **Approve the first agents and agencies**: they sign up with the *Agent* or *Agency* tab, upload their documents, then appear in Admin > **Verifications**. Check the documents (CAC number for agencies, valid ID and a phone call for agents) and **Verify**. Verified people get the green tick and can list homes.
- [ ] **Home owners** (landlords) can list straight away; every new listing waits in Admin > **Listings** (or the **Review queue**) until you approve it.
- [ ] **Seed 10 to 20 real homes before announcing.** Visit each one or get the agent's proof. Each home: a clear title, the real price per year, 4 to 6 good photos (or paste photo links), the real area, and a working phone/WhatsApp contact via the app. Keep photos small: pictures live inside the database and one home can hold roughly 8 to 10 photos before it hits the 1 MB document limit.
- [ ] Videos: only YouTube, Vimeo or `https://` video links; the app does not host video.
- [ ] Decide your **cities**: the search and the "Lagos" wording assume Lagos first. Add areas of other cities only when you have homes there.
- [ ] Have a plan for the day-to-day: who approves listings (target: within 24 hours), who answers the support inbox and Help tickets, who handles reports of scams (Admin > **User reports**).

## 11. The free Firebase plan (Spark): limits and what breaks first

The site runs on the free **Spark** plan with no servers of your own. Typical free limits (confirm on firebase.google.com/pricing; Google changes them):

| Resource | Free limit | What happens when you hit it |
|---|---|---|
| Hosting downloads | **360 MB per day** | The site stops loading for the rest of that day |
| Firestore reads | **50,000 per day** | Pages show empty or "couldn't load" until midnight (Pacific time) |
| Firestore writes | 20,000 per day | Messages, bookings and sign-ups fail until the reset |
| Firestore deletes | 20,000 per day | Deletions fail |
| Firestore stored data | 1 GiB | Writes fail |
| Firestore document size | **1 MiB each** | That one save fails (very big photo sets, long chats with media) |
| Firestore data sent out | 10 GiB per month | Reads fail |
| Email sign-in/Google | No practical limit; phone/SMS is paid and not used | n/a |

**What breaks first, in order, with rough numbers measured on this build:**
1. **Hosting downloads (360 MB a day).** A first visit downloads about **0.85 MB of our own files plus the Firebase scripts (roughly 0.3 to 0.4 MB)**, so about **1.2 MB**. That is roughly **300 brand-new visitors a day** before the site goes down for the day. Repeat visitors cost very little (the app is cached on the phone). Installing the app or sharing a link on a big WhatsApp group can burn the whole day in an hour.
2. **Firestore reads (50,000 a day).** Opening the app reads every live listing once (one read per home) plus the person's profile, chats and notifications. With 60 listings that is about 100 to 150 reads per visit, so roughly **350 to 500 visits a day**. The admin console reads whole collections (every user, every application) and can use thousands of reads per page load: do not keep the admin dashboard open on many devices.
3. **Document size (1 MiB).** Each home, chat message and document keeps its pictures inside the document. Keep photos few and small.
4. **Writes (20,000 a day)**: chat typing indicators, read receipts and call signalling all write. A busy chat day with a few hundred active users can reach it.

**When to move to the paid Blaze plan.** Blaze is pay-as-you-go with the **same free amounts**; you only pay for what goes over. It also unlocks things that need a server: scheduled backups, Cloud Functions (for emailed 2-step codes, push notifications and automatic clean-ups), and Firebase Storage. Cards issued in Nigeria usually work if enabled for international payments.
- [ ] Upgrade to Blaze **before** your first big announcement or ad. In the same screen set a **budget alert** (for example the equivalent of US$10 to 20) so a surprise never becomes a big bill. A budget alert only emails you; it does not stop the spending, so also check the **Usage** tab weekly.
- [ ] Until you upgrade, announce quietly and grow in steps. If many people arrive at once, the site simply stops for the day instead of costing you money.

## 12. Backups (the free plan has none)

Spark has **no automatic backups and no undelete**. A bad click or a bug can lose data for good.
- [ ] After upgrading to Blaze: Firebase console > **Firestore Database** > **Disaster recovery** > turn on **scheduled backups** (daily, kept for a few weeks) and **point-in-time recovery**. Test one restore into a new database at least once.
- [ ] Meanwhile: every week, use the **Export** (CSV) buttons in the admin console (Overview report, Payments, Suggestions, User reports) and keep them in a private folder you also back up. They are not a full backup but they save the important records.
- [ ] Never share the Firebase console password; turn on 2-step verification on the Google account that owns the project.

## 13. Monitoring (so you hear about problems before users do)

- [ ] Free uptime check: create a monitor at UptimeRobot or Better Stack on `https://yourdomain.com/` (alert by email or WhatsApp/Telegram). It tells you if the site is down.
- [ ] Firebase console **Usage and billing** (weekly): Firestore reads/writes and Hosting transfer against the limits above.
- [ ] Firebase **Authentication > Users**: sudden spikes of new accounts can be spam.
- [ ] **Google Search Console**: add your domain (a free `TXT` DNS record) and submit `https://yourdomain.com/sitemap.xml`.
- [ ] There is no error-tracking service installed (it would need a paid or third-party account and a privacy-policy change). A developer can add one later. Meanwhile, if a customer reports a problem, ask them to open **Settings** and send you the **version number** shown there and the page they were on; the footer also shows the version.

## 14. Search engines (important to understand)

This is a "single page app": every page address looks like `https://yourdomain.com/#/search`. Google and other crawlers **ignore everything after the `#`**, so they only see the front page. That means individual homes will **not** appear in Google search results yet. What is in place: a good title, description, sharing cards and the sitemap for the front page. Sharing a home link in WhatsApp shows the general Faxton card (not that home's photo).

Post-launch option (a developer, about 2 to 4 days): publish one real, crawlable page per home (for example `https://yourdomain.com/h/<home-id>`) that is created when a listing is approved, with that home's photo, price and area, and a button that opens the app. This needs Cloud Functions or a build step, so it comes after you move to the Blaze plan. Until then, run paid ads and WhatsApp/Instagram marketing to the front page.

## 15. Launch day: the by-hand test (about 30 minutes)

Do this on your own phone and a computer, using the live address, with the owner account and a second test email.

**Automatic check first**
- [ ] `node scripts/smoke-live.mjs https://yourdomain.com` prints PASS on every line. (Needs Node 18+. If you do not have it, skip, GitHub's deploy already runs the same checks.)

**On a phone (use mobile data, not Wi-Fi)**
- [ ] Open the address. The splash plays once, then the home page loads in a few seconds. No blank screen.
- [ ] **Sign up** as a *Renter* with the second email. The verification email arrives (check spam). Tap the link, come back, you are in.
- [ ] **Sign out, then Sign in with Google.** (Then the same on the Android app if you built it.)
- [ ] Search: filter by area and price. Open a real home. Photos open full screen. Tap **Save** (heart), then find it in **Saved**.
- [ ] **Book a viewing** (3 steps). The agent/owner gets it (check their side). Open **Viewings**.
- [ ] **Message the agent**: send text, a photo and a voice note. Check the agent sees them and can reply.
- [ ] **Call** the agent (voice, then video). The other phone rings, call connects with sound both ways.
- [ ] **Apply to rent** with a small document. It appears in Applications and in the owner's/admin's list.
- [ ] **Make an offer** on a home; the owner counter-offers; accept.
- [ ] **Payments**: the bank details are right and the "I've paid" with a receipt works.
- [ ] **Settings**: change name and photo; switch to dark mode; the version number shows.
- [ ] Turn on airplane mode and reload: you see the saved page and an **"You're offline"** bar, not a broken page. Turn it back on: **"You're back online"**.
- [ ] Type a nonsense address after the site name (`/hello`): you see the friendly "We couldn't find that page" screen.

**As owner/admin (on a computer)**
- [ ] Admin console opens. Approve a pending listing; it appears in the public search.
- [ ] Verify a pending agent; they get a notification and the green tick.
- [ ] Reply to a Help ticket and a chat as "Faxton support".
- [ ] Delete the test accounts and any test listings afterwards.

**Share test**
- [ ] Send the link to yourself on WhatsApp: the Faxton card (green picture, title, description) appears. (WhatsApp caches cards for a while; add `?x=1` to the link to test a changed card.)

If any step fails, **do not announce**. Note the step and what you saw, and send it to your developer.

## 16. Rolling back a bad release

You can always go back; nothing is lost because the data lives in Firestore, not in the site files.

- **Website (fastest, 1 minute, no tools)**: Firebase console > **Hosting** > the **Release history** table > on the last good version choose **⋮ > Rollback**. The old site is live within a minute. People with the app open will see "A new version is ready" and reload.
- **Website (from GitHub)**: GitHub > the repository > **Commits** > open the last good commit > **Revert** the bad one > the **Deploy to Firebase** workflow publishes the reverted code.
- **Security rules**: Firebase console > **Firestore** > **Rules** > **Rules history** > pick the previous one > **Publish**. (Or revert `firestore.rules` and run the deploy.)
- **Apps (Android/iPhone/desktop)** only wrap the website, so rolling the website back fixes them. A bad *app* build: unpublish it in Play Console > **Production** > **Halt rollout**, and re-release the previous version.
- **Data**: with Blaze and backups on (step 12) restore into a new database from **Disaster recovery**. On the free plan there is no restore, which is why step 12 matters.

### Emergency: switch the service worker off

If a release ever gets people stuck on an old or broken screen that a normal reload does not fix, replace the entire contents of `public/sw.js` with the lines below and deploy. Every phone will delete its saved copies and unregister the worker the next time it opens the site, then behave like a normal website. After the problem is fixed, restore `sw.js` from git and bump the version.

```js
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((k) => Promise.all(k.map((n) => caches.delete(n)))).then(() => self.registration.unregister()).then(() => self.clients.matchAll()).then((cl) => cl.forEach((c) => c.navigate(c.url)))));
```

## 17. Summary: costs and time

| Item | Cost (typical) | Time |
|---|---|---|
| Domain | US$10 to 15 a year (`.com`) or a few thousand naira (`.ng`) | 1 hour + DNS wait |
| Firebase Spark | Free | n/a |
| Firebase Blaze (recommended before ads) | Free up to the same limits, then pay-as-you-go; set a budget alert | 10 minutes |
| Business email | About US$7 per user per month (Workspace) or cheaper | 1 hour |
| Google Play developer account | About US$25, once | 1 to 3 days |
| Apple Developer Program | US$99 a year | 2 to 5 days |
| Windows code-signing (optional) | About US$100 to 400 a year, or about US$10 a month | 1 to 3 days |
| Lawyer review of Terms, Privacy, NDPC | Quote from your lawyer | 1 to 2 weeks |
| TURN relay for calls (optional) | Free tiers exist; paid plans start low | 30 minutes |

## 18. Known gaps (honest list)

- **No analytics and no error tracking** are installed (see steps 5 and 13).
- **Homes are not individually searchable on Google** (step 14).
- **Application list**: a renter's application disappears from their list if the home is taken off the market (rented or unpublished), because the list is built from live listings. A developer should keep a copy of the title and photo on the application (a small change in `public/js/pages.js` and in the application save).
- **Admin console reads whole collections**, which will not scale past a few thousand records on the free plan (needs paging, a developer task).
- **Listings are fetched in full** on every visit; past a few hundred homes add paging ("load more"). Until then it is fine.
- **Voice notes, photos and files are stored inside the database** (no Storage): fine for launch, expensive at scale. Moving them to Firebase Storage or an image service is the first scaling task, and needs Blaze.
- The latin-extended font files are loaded just for the **₦** symbol (about 35 KB per font weight). A developer can cut about 100 KB from the first visit by subsetting the fonts to the ₦ sign.
- The Android sideload key is committed to the repository so Google sign-in keeps working across builds. Keep the repository private, and move to your own Play key as in step 6.
- Unused files sit in `public/img` (`splash.mp4`, `splash.webm`, `splash-lines.webp`, `splash-base.webp`; about 360 KB in total). They are never downloaded by visitors and can be deleted when convenient.
