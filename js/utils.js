export const config = window.APP_CONFIG || {};

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatRelativeTime(dateValue) {
  const date = new Date(dateValue);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function showToast(message, type = "info") {
  const region = document.getElementById("toast-region");
  if (!region) return;
  const toast = document.createElement("div");
  toast.className = `toast${type === "error" ? " error" : ""}`;
  toast.textContent = message;
  region.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3500);
}

export function getRoute() {
  const raw = window.location.hash.replace(/^#/, "") || "/feed";
  const [pathPart, queryPart = ""] = raw.split("?");
  const segments = pathPart.split("/").filter(Boolean);
  return {
    path: `/${segments.join("/")}`,
    segments,
    params: new URLSearchParams(queryPart)
  };
}

export function navigate(path) {
  window.location.hash = path.startsWith("#") ? path.slice(1) : path;
}

export function randomId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getOrCreateDeviceId() {
  const key = "clt-hotdog-device-id";
  let value = localStorage.getItem(key);
  if (!value) {
    value = randomId();
    localStorage.setItem(key, value);
  }
  return value;
}

export function getLikedPhotoIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem("clt-hotdog-liked") || "[]"));
  } catch {
    return new Set();
  }
}

export function markPhotoLiked(photoId) {
  const ids = getLikedPhotoIds();
  ids.add(photoId);
  localStorage.setItem("clt-hotdog-liked", JSON.stringify([...ids]));
}

export function unmarkPhotoLiked(photoId) {
  const ids = getLikedPhotoIds();
  ids.delete(photoId);
  localStorage.setItem("clt-hotdog-liked", JSON.stringify([...ids]));
}

export function setActiveDog(code) {
  if (!code) return;
  const normalized = code.toUpperCase();
  const existing = getActiveDogDetails();
  if (existing?.public_code !== normalized) {
    localStorage.removeItem("clt-hotdog-active-dog-details");
  }
  localStorage.setItem("clt-hotdog-active-dog", normalized);
}

export function setActiveDogDetails(dog) {
  if (!dog?.public_code) return;
  setActiveDog(dog.public_code);
  localStorage.setItem("clt-hotdog-active-dog-details", JSON.stringify({
    public_code: dog.public_code,
    printed_number: dog.printed_number ?? null
  }));
}

export function getActiveDogDetails() {
  try {
    const details = JSON.parse(localStorage.getItem("clt-hotdog-active-dog-details") || "null");
    const activeCode = localStorage.getItem("clt-hotdog-active-dog");
    return details?.public_code === activeCode ? details : null;
  } catch {
    return null;
  }
}

export function getActiveDog() {
  return localStorage.getItem("clt-hotdog-active-dog") || config.defaultHotdogCode || "";
}
