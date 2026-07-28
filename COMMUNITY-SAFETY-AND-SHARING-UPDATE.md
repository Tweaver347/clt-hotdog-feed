# CLT Hot Dog Feed — Community Safety & Sharing Update

This update is based on the mobile-map refresh and includes the corrected centered mobile navigation.

## Included

- Compact mobile photo metadata and like button
- Three-dot post menu
- Native photo sharing with copy-link fallback
- Anonymous report flow with five report reasons
- One report per photo per browser/device ID
- Post-upload success screen
- Dog journey milestones
- Non-disruptive “new photos available” indicator
- Full JavaScript module set to prevent missing-module deployments

## Install

Copy these into the existing `clt-hotdog-feed` project and replace matching files:

- `styles.css`
- the complete `js/` directory
- `supabase-reports-migration.sql`

The update does not contain `config.js`, Supabase keys, `build.mjs`, `package.json`, or `wrangler.jsonc`.

## Required Supabase step

Open **Supabase → SQL Editor → New query**, paste all of `supabase-reports-migration.sql`, and run it.

Reports can then be reviewed in **Supabase → Table Editor → reports**. The table stores only:

- photo UUID
- hashed anonymous device identifier
- selected reason
- submission time

Reports do not automatically hide a photo.

## Local test

```powershell
cd "$HOME\Desktop\HotDogApp\clt-hotdog-feed"
python -m http.server 4173
```

Open:

```text
http://localhost:4173/#/feed?dog=QUEEN07
```

Test:

1. Like and unlike a photo.
2. Open the three-dot menu.
3. Share a photo.
4. Submit a report and confirm a row appears in Supabase.
5. Try reporting the same photo again from the same browser.
6. Upload a photo and confirm the success screen appears.
7. Use the success-screen share button.
8. Open the selected dog’s Journey and inspect milestones.
9. Leave the feed open while another tester uploads; within about 25 seconds, a new-photo button should appear without moving the feed.
10. Verify the bottom navigation remains centered on iPhone Safari.

## Publish

```powershell
git add styles.css js supabase-reports-migration.sql COMMUNITY-SAFETY-AND-SHARING-UPDATE.md
git commit -m "Add reports, sharing, milestones, and upload success"
git push
```

## Rollback

The update changes only frontend files plus the new `reports` table. Rolling back the Cloudflare deployment restores the prior frontend. The unused reports table may safely remain in Supabase.
