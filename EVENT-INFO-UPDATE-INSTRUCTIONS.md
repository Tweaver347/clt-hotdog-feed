# Event Information Page Update

This update adds a new **Event** tab to the left of **Feed** while keeping the photo feed as the landing page.

## What it adds

- Event tab in the bottom navigation
- Accessible text summary of the Hot Dog Bar Crawl
- Passport instructions
- Participating venues grouped by neighborhood
- Responsible travel information
- Activities, hashtags, and merchandise details
- One-page-at-a-time viewer for the 17 supplied event-guide images
- Descriptive alternative text for every guide page
- Dark mode, high contrast, text sizing, and reduced-motion compatibility

## Install

Extract the ZIP and copy its contents into the root of the existing `clt-hotdog-feed` project. Allow the following existing files to be replaced:

- `js/app.js`
- `styles.css`

The following files and folder are new:

- `js/event-data.js`
- `assets/event-guide/`

This package does **not** contain `config.js`, Supabase credentials, SQL changes, or Cloudflare configuration.

## Test locally

```powershell
cd "$HOME\Desktop\HotDogApp\clt-hotdog-feed"
python -m http.server 4173
```

Open:

```text
http://localhost:4173/#/event?dog=DEMO42
```

Check:

1. The normal root route still opens the photo feed.
2. **Event** appears immediately left of **Feed** in the bottom navigation.
3. The top-left hot-dog icon still returns to the feed.
4. Passport, neighborhood, travel, and extras buttons scroll within the Event page without changing routes.
5. Neighborhood accordions expand with keyboard and touch.
6. The guide page selector and Previous/Next buttons change only one image at a time.
7. Dark mode, large text, high contrast, and reduced motion remain usable.
8. Feed, upload, journey, map, likes, and unlikes still work.

## Publish

```powershell
git add js/app.js js/event-data.js styles.css assets/event-guide EVENT-INFO-UPDATE-INSTRUCTIONS.md
git commit -m "Add accessible event information page"
git push
```

Cloudflare should rebuild automatically.
