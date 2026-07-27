# Deploy and Test the CLT Hot Dog Feed

## Part 1 — Preview the interface locally

The application automatically enters demo mode while the Supabase fields in `config.js` are blank.

1. Install Python if it is not already available.
2. Open a terminal inside the `clt-hotdog-feed` folder.
3. Run:

   ```bash
   python -m http.server 4173
   ```

   On some systems the command is:

   ```bash
   python3 -m http.server 4173
   ```

4. Open `http://localhost:4173`.
5. Test the sample QR route at `http://localhost:4173/#/dog/DEMO42`.

Demo-mode uploads are stored in that browser only. They do not appear on another phone or computer.

## Part 2 — Create the shared Supabase backend

1. Create a free Supabase project.
2. Open **SQL Editor** in the Supabase dashboard.
3. Create a new query.
4. Copy all contents of `supabase.sql` into the editor.
5. Select **Run**.
6. Open **Project Settings → API**.
7. Copy:
   - Project URL
   - Publishable key or legacy `anon` public key
8. Open `config.js` and fill in:

   ```js
   supabaseUrl: "https://YOUR-PROJECT.supabase.co",
   supabaseAnonKey: "YOUR-PUBLISHABLE-OR-ANON-KEY",
   ```

9. Keep `forceDemoMode: false`.

The publishable/anon key is intended for browser use and is restricted by the SQL Row Level Security policies. Never place a Supabase `service_role` key in this project.

## Part 3 — Test shared mode locally

1. Restart the local HTTP server if needed.
2. Refresh `http://localhost:4173`.
3. The yellow demo-mode notice should disappear.
4. Open `http://localhost:4173/#/dog/DEMO42`.
5. Add a location and photo.
6. Open the same local URL in a private/incognito window to confirm the photo comes from Supabase rather than local demo storage.

Location permission works on `localhost`. On a real phone it requires an HTTPS-hosted site.

## Part 4 — Host on Cloudflare Pages with drag and drop

This application is already a static, prebuilt site. There is no build command.

1. Make sure the Supabase values have been saved in `config.js`.
2. Zip the **contents** of the `clt-hotdog-feed` folder, or keep the folder available for drag and drop.
3. Log in to Cloudflare.
4. Open **Workers & Pages**.
5. Select **Create application → Get started → Drag and drop your files**.
6. Enter a project name such as `clt-hotdog-feed`.
7. Drag in the folder or ZIP.
8. Select **Deploy site**.
9. Cloudflare provides an HTTPS URL such as:

   ```text
   https://clt-hotdog-feed.pages.dev
   ```

10. Test:

    ```text
    https://clt-hotdog-feed.pages.dev/#/dog/DEMO42
    ```

Cloudflare Pages serves HTTPS automatically, which allows the browser to request location permission.

## Part 5 — Test on two phones

1. Open the `DEMO42` route on Phone A.
2. Allow location or search for a place.
3. Upload a harmless test image.
4. Open the root site on Phone B.
5. Confirm that the photo appears in the feed and on the map.
6. Like the photo on Phone B.
7. Refresh Phone A and confirm the count increased.

Likes are limited to one per browser installation using a random local browser ID whose SHA-256 hash is sent to Supabase. There are no user accounts.

## Part 6 — Create more hot dog codes

In Supabase **SQL Editor**, run a statement like:

```sql
insert into public.hotdogs (public_code, printed_number)
values
  ('DOG001', 1),
  ('DOG002', 2),
  ('DOG003', 3);
```

QR URLs would be:

```text
https://YOUR-SITE.pages.dev/#/dog/DOG001
https://YOUR-SITE.pages.dev/#/dog/DOG002
https://YOUR-SITE.pages.dev/#/dog/DOG003
```

Codes must contain 4–24 uppercase letters, numbers, underscores, or hyphens.

## Resetting test content

To delete all test likes and photos from the database:

```sql
truncate table public.likes, public.photos restart identity cascade;
```

This does not remove uploaded files from Storage. Delete test objects from **Storage → photos → uploads** in the Supabase dashboard.

To reset browser demo data, clear site data/local storage for the local site.

## Before sharing publicly

Do not use this no-moderation build for a wide public launch. Add at minimum:

- Pending/private photo storage
- Human approval before publication
- Report and takedown tools
- Upload rate limiting and bot checks
- Terms/privacy notice
- Public-location rounding or venue snapping
- A production geocoding provider
