# Official Instagram Link Update

This patch removes the screenshot carousel from the Event page and replaces it with direct, accessible links to the official organizer and event post.

Official organizer: `@oliveoliveoxenfree`

Official post: `https://www.instagram.com/p/DbOkU5fkYhB/?img_index=1`

## Install

Copy these files into the root of your existing project and replace the matching files:

- `js/app.js`
- `js/event-data.js`
- `styles.css`

The app no longer references `assets/event-guide/`. To remove the old screenshots from the repository and reduce deployment size, run this optional PowerShell command from the project folder:

```powershell
Remove-Item -Recurse -Force .\assets\event-guide
```

Then test locally:

```powershell
python -m http.server 4173
```

Open:

```text
http://localhost:4173/#/event?dog=DEMO42
```

Verify both external buttons:

- Open the official event post
- Visit @oliveoliveoxenfree

## Publish

```powershell
git add -A
git commit -m "Link event page to official Instagram organizer"
git push
```

No Supabase migration or Cloudflare configuration change is required.
