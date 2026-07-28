# Mobile bottom navigation centering hotfix

## Problem

The desktop navigation uses:

```css
left: 50%;
transform: translateX(-50%);
```

The mobile rule changed `left` and `right`, but did not clear the inherited transform. Safari therefore shifted the whole bar half of its own width to the left.

## Fix

The mobile rule now:

- clears the inherited transform with `transform: none`
- anchors to both viewport edges
- respects left, right, and bottom iPhone safe-area insets
- keeps the bar width inside the visible viewport

## Install

Replace the existing project-root `styles.css` with the included `styles.css`.

Then publish:

```powershell
cd "$HOME\Desktop\HotDogApp\clt-hotdog-feed"
git add styles.css
git commit -m "Center mobile bottom navigation"
git push
```

After Cloudflare finishes, reload the site in a private Safari tab or fully close and reopen the tab.
