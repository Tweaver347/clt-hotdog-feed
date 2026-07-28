# CLT Hot Dog Feed — Final Playful Branding Patch

This is a focused patch for the working app. It does **not** replace `js/`, `styles.css`, Supabase configuration, QR routing, moderation, Feed, Map, Journey, or upload behavior.

## Included changes

- Event-facing page title and description
- Open Graph and social-sharing metadata
- Playful 1200×630 link preview
- Waving hot-dog keychain app icon
- Favicons, Apple touch icon, Android icons, and maskable icon
- Web-app manifest
- Root-relative paths that preserve direct `/h/CODE` QR loading
- Cache-busted branding references (`playful-branding-2`)

## Files to copy into the repository root

```text
index.html
manifest.webmanifest
assets/branding/
verify-branding.mjs
copy-branding-after-build.mjs
BUILD-MJS-ADDITION.txt
```

Allow `index.html` and `manifest.webmanifest` to replace the existing versions. Merge `assets/branding/` into the existing `assets/` directory.

## Make the production build include the assets

Preferred permanent method: merge the two copy operations from `BUILD-MJS-ADDITION.txt` into the existing `build.mjs`.

Temporary verification method:

```powershell
npm run build
node .\copy-branding-after-build.mjs
node .\verify-branding.mjs
```

After the permanent `build.mjs` change is made, the normal process becomes:

```powershell
npm run build
node .\verify-branding.mjs
```

## Commit and push

```powershell
git add index.html manifest.webmanifest assets/branding build.mjs verify-branding.mjs copy-branding-after-build.mjs BUILD-MJS-ADDITION.txt
git commit -m "Add final playful event branding"
git push
```

## Post-deployment checks

Open a private browser window and verify:

1. The base website loads normally.
2. A direct QR route such as `/h/B6RS6DLZ56` is styled on first load.
3. `/assets/branding/social-preview-playful-v2.png` loads directly.
4. `/manifest.webmanifest` loads directly.
5. The favicon is the hot-dog mascot, not the earlier cat concept.

Social platforms may cache older preview cards. The new filename `social-preview-playful-v2.png` is intentionally different to reduce stale-preview issues.
