import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "dist");

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY;
const configuredModeratorPath = String(
  process.env.MODERATOR_PATH || "/moderator-8f3c2a"
).trim();
const moderatorPath = configuredModeratorPath.startsWith("/")
  ? configuredModeratorPath
  : `/${configuredModeratorPath}`;

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL environment variable.");
}

if (!supabasePublishableKey) {
  throw new Error(
    "Missing SUPABASE_PUBLISHABLE_KEY environment variable."
  );
}

await rm(output, {
  recursive: true,
  force: true
});

await mkdir(output, {
  recursive: true
});

// Copy every public application file referenced by index.html. Files omitted
// from this list are not deployed because Wrangler serves only ./dist.
for (const item of [
  "index.html",
  "styles.css",
  "moderator.css",
  "manifest.webmanifest",
  "js",
  "assets"
]) {
  await cp(
    path.join(root, item),
    path.join(output, item),
    { recursive: true }
  );
}

const config = {
  appName: "CLT Hot Dog Feed",
  supabaseUrl,
  supabaseAnonKey: supabasePublishableKey,
  forceDemoMode: false,
  defaultHotdogCode: "DEMO42",
  moderatorPath,
  mapCenter: [35.2271, -80.8431],
  mapZoom: 11,
  geocoderBaseUrl:
    "https://nominatim.openstreetmap.org",
  geocoderAttribution:
    "Search data © OpenStreetMap contributors",
  maxUploadBytes: 2_000_000,
  maxSourceBytes: 12_000_000
};

await writeFile(
  path.join(output, "config.js"),
  `window.APP_CONFIG = ${JSON.stringify(config, null, 2)};\n`,
  "utf8"
);

console.log("Created deployable site in dist/");
