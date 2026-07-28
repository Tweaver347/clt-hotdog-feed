# Blank Page Hotfix

This replaces `js/app.js` with a version that contains the event organizer and neighborhood data directly. It no longer imports `js/event-data.js`, so a missing or misplaced event-data file cannot prevent the app from starting.

## Install

Copy `js/app.js` over the existing file in the project.

Do not replace `config.js`, `js/data.js`, or any Supabase files.

## Publish

```powershell
git add js/app.js
git commit -m "Fix blank page after Instagram update"
git push
```

After Cloudflare finishes deploying, hard refresh with `Ctrl+Shift+R` or open the site in a private window.
