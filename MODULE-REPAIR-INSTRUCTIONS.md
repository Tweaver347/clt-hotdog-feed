# Full JavaScript Module Repair

The browser console showed that `js/app.js` loaded, but its imported modules returned the website HTML fallback with MIME type `text/html`. This means the deployed `js/` folder is missing the files below.

Copy the entire `js` folder from this repair package into the project root and allow Windows to merge/replace files:

```text
clt-hotdog-feed/
└── js/
    ├── app.js
    ├── challenges.js
    ├── data.js
    ├── geocode.js
    ├── image.js
    └── utils.js
```

Do not delete or replace `config.js`, `build.mjs`, `package.json`, `styles.css`, or Supabase files.

Then run:

```powershell
git add js
git commit -m "Restore required JavaScript modules"
git push
```

After Cloudflare finishes, open a private window or hard refresh with `Ctrl+Shift+R`.

Optional verification before committing:

```powershell
Get-ChildItem .\js\*.js
```

All six files above must be listed.
