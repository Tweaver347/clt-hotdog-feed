# Playful background hotfix

The app expected `assets/food-pattern.svg`, but later update packages did not always include that asset. This replacement stylesheet embeds the pattern directly, so Cloudflare cannot omit it.

## Install

Replace the project's root `styles.css` with the supplied `styles.css`.

Do not replace `config.js`, JavaScript files, SQL, or Cloudflare configuration.

## Publish

```powershell
git add styles.css
git commit -m "Fix playful parallax background"
git push
```

After Cloudflare deploys, hard-refresh with `Ctrl + Shift + R` or test in a private window.

## Expected behavior

- The pattern is visible in light and dark modes.
- Turning off **Playful background** hides it.
- **Reduce motion** leaves the pattern visible but stops its parallax movement.
