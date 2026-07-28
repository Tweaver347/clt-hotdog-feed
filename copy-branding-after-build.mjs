import { cp, copyFile, mkdir } from "node:fs/promises";

await mkdir("dist/assets", { recursive: true });
await copyFile("manifest.webmanifest", "dist/manifest.webmanifest");
await cp("assets", "dist/assets", { recursive: true });
console.log("Copied manifest and branding assets into dist/.");
