# Community Feature Update

This update adds:

- A clickable top-left hot dog icon that returns to the active dog's feed
- A compact active hot dog number in the top-right header
- A live community counter for photos, dogs spotted, and locations
- A new **Journey** tab that shows only photos from the active hot dog
- 100 optional photo challenges, one for each printed hot dog number
- Like/unlike toggling
- Visible icon + text labels for important actions
- A Map/Text view switch on the map page

## 1. Copy the files

Extract the update ZIP into the root of your existing `clt-hotdog-feed` repository and allow it to replace matching files.

The update intentionally does **not** include or replace `config.js`, `build.mjs`, `package.json`, or `wrangler.jsonc`.

## 2. Enable unlike in Supabase

Open Supabase Dashboard > SQL Editor > New query.

Copy and run the entire contents of:

`supabase-unlike-migration.sql`

A successful run normally reports `Success. No rows returned`.

Until this migration is run, adding likes will still work, but removing a like will return an RPC/function error.

## 3. Test locally

From the repository root:

```powershell
python -m http.server 4173
```

Open:

```text
http://localhost:4173/#/feed?dog=DEMO42
```

Test:

1. Click the top-left hot dog icon from the upload page.
2. Confirm `#42` appears in the header.
3. Confirm the community counter appears on the feed.
4. Open **Journey** and confirm only DEMO42 photos appear.
5. Open **Add Photo** and confirm Challenge #42 appears above location selection.
6. Like a photo, then press the same button again to remove the like.
7. Open **Map**, switch to **Text**, and confirm location summaries appear.
8. Test text enlargement, dark mode, reduced motion, and keyboard focus.

## 4. Push to GitHub

```powershell
git status
git add js/app.js js/data.js js/utils.js js/challenges.js styles.css supabase.sql supabase-unlike-migration.sql DOG-CHALLENGES.md COMMUNITY-UPDATE-INSTRUCTIONS.md
git commit -m "Add community counters, dog journeys, challenges, and unlike support"
git push
```

Cloudflare should automatically rebuild and deploy the site.

## Notes

- Challenges use the hot dog's `printed_number`. Numbers above 100 wrap back through the list.
- If a code has no printed number, the app derives a stable challenge from the code.
- Challenges are explicitly optional so users can participate without completing an inaccessible or uncomfortable prompt.
- A browser can remove only the like tied to its own anonymous device hash.
