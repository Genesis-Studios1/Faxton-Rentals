# Faxton email functions

The website already shows verification requests inside the admin console, with a live badge and a pop-up.
These functions add **emails** (to the owner when an agency or agent signs up, and to the person when they are verified).
Cloud Functions need the Firebase **Blaze** plan.

1. Get an API key from https://resend.com (free tier) and verify a sender domain.
2. `firebase functions:secrets:set RESEND_API_KEY --project faxton-rentals`
3. Optionally set the sender: `MAIL_FROM="Faxton Rentals <hello@yourdomain.com>"`
4. `firebase deploy --only functions --project faxton-rentals`
