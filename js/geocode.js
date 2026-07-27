import { config } from "./utils.js";

let lastRequestAt = 0;

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function rateLimitedFetch(url) {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < 1050) await wait(1050 - elapsed);
  lastRequestAt = Date.now();
  const response = await fetch(url, {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error("Location search is temporarily unavailable.");
  return response.json();
}

function cacheGet(key) {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || "null");
    return value?.expiresAt > Date.now() ? value.data : null;
  } catch {
    return null;
  }
}

function cacheSet(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ expiresAt: Date.now() + 60 * 60 * 1000, data }));
  } catch {
    // Cache is optional.
  }
}

function normalizeResult(item) {
  const address = item.address || {};
  const primary = item.name || address.amenity || address.shop || address.tourism || address.leisure || address.road || item.display_name?.split(",")[0] || "Selected location";
  const neighborhood = address.neighbourhood || address.suburb || address.quarter || address.city_district || address.city || "Charlotte";
  return {
    lat: Number(item.lat),
    lng: Number(item.lon),
    placeName: primary,
    locationDetail: neighborhood,
    displayName: item.display_name || `${primary}, ${neighborhood}`,
    source: "search"
  };
}

export async function searchPlaces(query) {
  const clean = query.trim();
  if (clean.length < 2) throw new Error("Enter at least two characters.");
  const key = `geo-search:${clean.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const base = config.geocoderBaseUrl || "https://nominatim.openstreetmap.org";
  const params = new URLSearchParams({
    q: clean,
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
    countrycodes: "us",
    viewbox: "-81.06,35.42,-80.53,34.99",
    bounded: "1"
  });
  const data = await rateLimitedFetch(`${base}/search?${params}`);
  const results = data.map(normalizeResult);
  cacheSet(key, results);
  return results;
}

export async function reverseGeocode(lat, lng) {
  const roundedLat = Number(lat).toFixed(4);
  const roundedLng = Number(lng).toFixed(4);
  const key = `geo-reverse:${roundedLat}:${roundedLng}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const base = config.geocoderBaseUrl || "https://nominatim.openstreetmap.org";
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: "jsonv2",
    addressdetails: "1",
    zoom: "18"
  });
  const data = await rateLimitedFetch(`${base}/reverse?${params}`);
  const result = normalizeResult(data);
  result.source = "gps";
  cacheSet(key, result);
  return result;
}
