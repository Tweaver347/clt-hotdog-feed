import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "dist");

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY;

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

// Copy the public application files.
for (const item of [
  "index.html",
  "styles.css",
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