# CLT Hot Dog Feed — Mobile + Map Refresh

This patch is designed to replace the current frontend files without changing Supabase, Cloudflare, the database schema, the 100-dog ID set, or `config.js`.

## What changed

### Mobile feed
- Tighter mobile header and active-dog banner
- More compact counters and hero area so photos appear sooner
- True one-column phone feed with larger square photos
- Larger touch targets and clearer metadata
- Improved safe-area spacing for iPhone and Android bottom navigation
- Accessibility panel becomes a mobile bottom sheet
- Focused photos receive a temporary visible highlight when opened from the map

### Map
- Branded thumbnail markers instead of default pins
- Photos at the same stop are grouped into one marker with a count badge
- Neighborhood filters for Plaza Midwood, NoDa, Uptown, South End, LoSo, and other Charlotte locations
- Taller mobile map with modern floating controls
- `Near me` control that centers the map without saving the user's location
- `Show all` control
- Mobile location detail sheet with a direct `View in feed` action
- More modern warm map treatment in light mode and a coordinated dark treatment
- Redesigned accessible list view grouped by neighborhood

## Install

Extract this package into the root of the existing project:

```text
C:\Users\Thoma\Desktop\HotDogApp\clt-hotdog-feed
```

Allow it to replace:

```text
styles.css
js/app.js
js/challenges.js
js/data.js
js/geocode.js
js/image.js
js/utils.js
```

The supporting JavaScript files are included to prevent another deployment where `app.js` is present but one of its imported modules is missing.

This package intentionally does not include:

```text
config.js
build.mjs
package.json
wrangler.jsonc
supabase.sql
```

## Local test

```powershell
cd "$HOME\Desktop\HotDogApp\clt-hotdog-feed"
python -m http.server 4173
```

Test these URLs:

```text
http://localhost:4173/#/feed?dog=QUEEN07
http://localhost:4173/#/map?dog=QUEEN07
```

Use a narrow browser window or Firefox responsive design mode at approximately `390 × 844`.

## Mobile test checklist

- Feed displays one photo per row
- Header, active dog, counters, and hero do not crowd the screen
- Bottom navigation does not cover the last photo
- Accessibility panel opens as a bottom sheet
- Map and List switch works
- Neighborhood chips scroll horizontally and filter correctly
- Markers group multiple photos from the same stop
- Tapping a marker opens the location sheet
- `View in feed` opens and highlights the selected photo
- `Near me` asks for permission and states that the location is not saved
- Denying location does not break the map
- Light mode, dark mode, large text, high contrast, and reduced motion remain usable

## Publish

```powershell
git status
git add styles.css js
 git commit -m "Improve mobile feed and community map"
git push
```

Cloudflare should rebuild automatically.

## Rollback

Cloudflare keeps previous deployments. If this release causes a serious event-day issue, use the Cloudflare deployment history to roll back to the last working deployment. You can also use Git:

```powershell
git log --oneline -5
git revert <commit-id>
git push
```

## Notes

- No database migration is needed.
- The map continues using OpenStreetMap tiles and Leaflet, so the change avoids adding a new paid map provider or API key.
- Neighborhood detection uses the submitted place and location text. Locations with no recognizable neighborhood appear under `Other Charlotte`.
