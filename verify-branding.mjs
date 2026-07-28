import { access, readFile } from "node:fs/promises";

const required = [
  "dist/index.html",
  "dist/manifest.webmanifest",
  "dist/assets/branding/favicon.ico",
  "dist/assets/branding/apple-touch-icon.png",
  "dist/assets/branding/icon-192.png",
  "dist/assets/branding/icon-512.png",
  "dist/assets/branding/social-preview-playful-v2.png"
];

for (const file of required) {
  await access(file);
  console.log(`OK ${file}`);
}

const html = await readFile("dist/index.html", "utf8");
for (const expected of [
  "Charlotte Hot Dog Bar Crawl Photo Feed",
  "/manifest.webmanifest",
  "social-preview-playful-v2.png",
  "apple-touch-icon.png",
  '<base href="/" />',
  '/styles.css?v=playful-branding-2',
  '/js/app.js'
]) {
  if (!html.includes(expected)) {
    throw new Error(`dist/index.html is missing: ${expected}`);
  }
}

console.log("Playful release branding verification passed.");
