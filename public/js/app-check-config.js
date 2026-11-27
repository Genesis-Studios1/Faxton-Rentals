// App Check is intentionally not initialized on the isolated staging build.
// The configured Enterprise site key is restricted to production hostnames and
// cannot issue tokens for faxton-rentals-staging.web.app. Staging Firebase App
// Check enforcement remains disabled; production retains its own key/config.
export const APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY = "";
