# CLT Hot Dog Feed MVP

A mobile-first, anonymous photo feed and Charlotte map designed for QR-coded 3D-printed hot dogs.

## Included in this MVP

- Photo feed sorted by newest or most liked
- Browser GPS permission flow
- Manual Charlotte location search
- Draggable location pin
- Camera or photo-library upload
- Browser-side resizing, JPEG re-encoding, and EXIF removal
- Anonymous one-like-per-browser behavior
- Separate photo map
- QR-compatible hot dog routes
- Supabase shared-data mode
- Automatic local demo mode when Supabase is not configured

## Intentionally not included yet

- Moderation or admin tools
- Reports
- Accounts, usernames, captions, or comments
- Automated inappropriate-image detection
- Exact-address privacy reduction

**Do not broadly publish this test build. Uploaded photos become public immediately.**

## Test URLs

After hosting the site, these routes activate sample hot dogs:

- `https://YOUR-SITE.pages.dev/#/dog/DEMO42`
- `https://YOUR-SITE.pages.dev/#/dog/QUEEN07`
- `https://YOUR-SITE.pages.dev/#/dog/CLTDOG9`

The QR code should use the entire URL, including `#/dog/CODE`.

## Project files

- `index.html` — static app entry point
- `styles.css` — mobile-first styling
- `config.js` — Supabase and app settings
- `js/` — application code
- `assets/` — local demo images
- `supabase.sql` — database, storage, trigger, seed data, and RLS setup
- `DEPLOY.md` — complete setup and hosting instructions

## Important test limitations

The MVP uses the public OpenStreetMap Nominatim endpoint for user-triggered test searches. It does not implement autocomplete and rate-limits requests in the browser. This is appropriate only for a moderate test. Before a larger public event, replace it with a production geocoding provider or a self-hosted Nominatim instance.
