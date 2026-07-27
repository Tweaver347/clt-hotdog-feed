import { createPhoto, getHotdog, getPhotos, getPhotosForHotdog, isDemoMode, likePhoto, unlikePhoto } from "./data.js";
import { getDogChallenge } from "./challenges.js";
const EVENT_ORGANIZER = {
  handle: "@oliveoliveoxenfree",
  profileUrl: "https://www.instagram.com/oliveoliveoxenfree/",
  postUrl: "https://www.instagram.com/p/DbOkU5fkYhB/?img_index=1"
};

const EVENT_NEIGHBORHOODS = [
  {
    name: "Plaza Midwood",
    range: "Stops 1–17",
    suggestedStart: "Plot Twist or Sip City",
    venues: [
      "Plot Twist",
      "Clark's Snack Bar",
      "Resident Culture",
      "Frank's Beer Shop",
      "Bev Prossecheria",
      "Common Market",
      "Burial Beer",
      "Dish",
      "Painted Rooster",
      "Snug Harbor",
      "Diamond Restaurant",
      "Snooze",
      "Moo & Brew",
      "Kilted Buffalo",
      "Two Buck Saloon",
      "Sweet Lew's BBQ",
      "Sip City"
    ]
  },
  {
    name: "Uptown",
    range: "Stops 18–22",
    suggestedStart: "The Local",
    venues: ["The Local", "Retro Bar", "The Daily", "Corner Pub", "Graham Street Pub & Patio"]
  },
  {
    name: "NoDa",
    range: "Stops 23–25",
    suggestedStart: "Crown Station",
    venues: ["Copperhead Social Club", "JackBeagles", "Crown Station Coffee House"]
  },
  {
    name: "South End",
    range: "Stops 26–28",
    suggestedStart: "Monday Night Brewing",
    venues: ["Groovers", "Shake Shack", "Monday Night Brewing"]
  },
  {
    name: "LoSo",
    range: "Stops 29–30",
    suggestedStart: "Goldie's",
    venues: ["Gilde", "Goldie's"]
  }
];
import { reverseGeocode, searchPlaces } from "./geocode.js";
import { preparePhoto } from "./image.js";
import {
  config,
  escapeHtml,
  formatRelativeTime,
  getActiveDog,
  getActiveDogDetails,
  getLikedPhotoIds,
  getRoute,
  navigate,
  setActiveDog,
  setActiveDogDetails,
  showToast
} from "./utils.js";

const app = document.getElementById("app");
let feedSort = "newest";
let mapInstance = null;
let locationMapInstance = null;
let mapDisplayMode = "map";
let mapNeighborhoodFilter = "All";
let mapUserMarker = null;
let mapVisibleBounds = [];
let uploadState = freshUploadState();

const MAP_NEIGHBORHOODS = ["All", "Plaza Midwood", "NoDa", "Uptown", "South End", "LoSo", "Other Charlotte"];

const PREFERENCES_KEY = "clt-hotdog-preferences";
const systemDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");
const systemMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let settingsReturnFocus = null;
let parallaxFrame = null;

function defaultPreferences() {
  return {
    theme: "system",
    textScale: "default",
    highContrast: false,
    reduceMotion: systemMotionQuery.matches,
    showDecorations: true,
    underlineLinks: false
  };
}

function loadPreferences() {
  try {
    return { ...defaultPreferences(), ...JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}") };
  } catch {
    return defaultPreferences();
  }
}

let preferences = loadPreferences();

function resolvedTheme() {
  if (preferences.theme === "light" || preferences.theme === "dark") return preferences.theme;
  return systemDarkQuery.matches ? "dark" : "light";
}

function savePreferences() {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
}

function applyPreferences() {
  const root = document.documentElement;
  const theme = resolvedTheme();
  root.dataset.theme = theme;
  root.dataset.themePreference = preferences.theme;
  root.dataset.textScale = preferences.textScale;
  root.classList.toggle("high-contrast", Boolean(preferences.highContrast));
  root.classList.toggle("reduce-motion", Boolean(preferences.reduceMotion));
  root.classList.toggle("hide-decorations", !preferences.showDecorations);
  root.classList.toggle("underline-links", Boolean(preferences.underlineLinks));

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.content = theme === "dark" ? "#17120f" : "#fffaf2";
  updateThemeButton();
  updateParallax();
}

function updateThemeButton() {
  const button = document.getElementById("theme-toggle");
  if (!button) return;
  const theme = resolvedTheme();
  button.textContent = theme === "dark" ? "☀" : "☾";
  button.setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} mode`);
  button.title = `Switch to ${theme === "dark" ? "light" : "dark"} mode`;
}

function setPreference(name, value) {
  preferences = { ...preferences, [name]: value };
  savePreferences();
  applyPreferences();
}

function accessibilityPanelMarkup() {
  return `
    <div class="settings-backdrop" id="settings-backdrop" hidden></div>
    <aside class="settings-panel" id="accessibility-panel" role="dialog" aria-modal="true" aria-labelledby="accessibility-title" hidden>
      <div class="settings-header">
        <div>
          <p class="settings-eyebrow">Display preferences</p>
          <h2 id="accessibility-title" tabindex="-1">Accessibility & appearance</h2>
        </div>
        <button class="icon-button" id="close-accessibility" aria-label="Close accessibility settings">×</button>
      </div>

      <fieldset class="settings-group">
        <legend>Color theme</legend>
        <div class="choice-grid" role="radiogroup" aria-label="Color theme">
          ${["system", "light", "dark"].map((value) => `
            <label class="choice-chip">
              <input type="radio" name="theme-choice" value="${value}" ${preferences.theme === value ? "checked" : ""} />
              <span>${value === "system" ? "System" : value[0].toUpperCase() + value.slice(1)}</span>
            </label>
          `).join("")}
        </div>
      </fieldset>

      <div class="settings-group">
        <label class="field" for="text-size-choice">
          <span class="field-label">Text size</span>
          <select class="text-input" id="text-size-choice">
            <option value="default" ${preferences.textScale === "default" ? "selected" : ""}>Default</option>
            <option value="large" ${preferences.textScale === "large" ? "selected" : ""}>Large</option>
            <option value="xlarge" ${preferences.textScale === "xlarge" ? "selected" : ""}>Extra large</option>
          </select>
        </label>
      </div>

      <div class="settings-group settings-switches">
        <label class="preference-row">
          <span><strong>High contrast</strong><small>Strengthens borders and text contrast.</small></span>
          <input type="checkbox" id="high-contrast-choice" ${preferences.highContrast ? "checked" : ""} />
        </label>
        <label class="preference-row">
          <span><strong>Reduce motion</strong><small>Stops parallax and most interface animation.</small></span>
          <input type="checkbox" id="reduce-motion-choice" ${preferences.reduceMotion ? "checked" : ""} />
        </label>
        <label class="preference-row">
          <span><strong>Playful background</strong><small>Shows the hot dog, mustard, and ketchup pattern.</small></span>
          <input type="checkbox" id="decorations-choice" ${preferences.showDecorations ? "checked" : ""} />
        </label>
        <label class="preference-row">
          <span><strong>Underline links</strong><small>Makes linked text easier to identify.</small></span>
          <input type="checkbox" id="underline-links-choice" ${preferences.underlineLinks ? "checked" : ""} />
        </label>
      </div>

      <button class="secondary-button" id="reset-preferences">Reset display preferences</button>
    </aside>
  `;
}

function openAccessibilityPanel() {
  const panel = document.getElementById("accessibility-panel");
  const backdrop = document.getElementById("settings-backdrop");
  const trigger = document.getElementById("open-accessibility");
  if (!panel || !backdrop) return;
  settingsReturnFocus = document.activeElement;
  panel.hidden = false;
  backdrop.hidden = false;
  trigger?.setAttribute("aria-expanded", "true");
  document.body.classList.add("settings-open");
  window.setTimeout(() => document.getElementById("accessibility-title")?.focus(), 0);
}

function closeAccessibilityPanel() {
  const panel = document.getElementById("accessibility-panel");
  const backdrop = document.getElementById("settings-backdrop");
  const trigger = document.getElementById("open-accessibility");
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  if (backdrop) backdrop.hidden = true;
  trigger?.setAttribute("aria-expanded", "false");
  document.body.classList.remove("settings-open");
  settingsReturnFocus?.focus?.();
}

function trapSettingsFocus(event) {
  if (event.key !== "Tab") return;
  const panel = document.getElementById("accessibility-panel");
  if (!panel || panel.hidden) return;
  const focusable = [...panel.querySelectorAll('button, input, select, [href], [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.disabled && !element.hidden);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function updateParallax() {
  if (parallaxFrame) return;
  parallaxFrame = window.requestAnimationFrame(() => {
    parallaxFrame = null;
    const root = document.documentElement;
    if (preferences.reduceMotion || !preferences.showDecorations) {
      root.style.setProperty("--parallax-slow", "0px");
      root.style.setProperty("--parallax-fast", "0px");
      return;
    }
    const y = window.scrollY || 0;
    root.style.setProperty("--parallax-slow", `${-((y * 0.055) % 320)}px`);
    root.style.setProperty("--parallax-fast", `${-((y * 0.11) % 320)}px`);
  });
}

function freshUploadState(dogCode = "") {
  return {
    dogCode,
    dog: null,
    location: null,
    searchQuery: "",
    searchResults: [],
    searching: false,
    locating: false,
    preparedPhoto: null,
    submitting: false,
    consent: false
  };
}

function destroyMaps() {
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
  if (locationMapInstance) {
    locationMapInstance.remove();
    locationMapInstance = null;
  }
}

function inferredDogNumber(code = "") {
  const match = String(code).match(/(\d{1,3})/);
  return match ? Number(match[1]) : null;
}

function activeDogHeaderMarkup() {
  const code = getActiveDog();
  if (!code) return "";
  const details = getActiveDogDetails();
  const number = details?.printed_number ?? inferredDogNumber(code);
  const visible = number != null ? `#${number}` : code.slice(0, 8);
  const label = number != null ? `Active Hot Dog number ${number}` : `Active hot dog code ${code}`;
  return `<span class="dog-header-badge" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"><span aria-hidden="true">🌭</span><span>${escapeHtml(visible)}</span></span>`;
}

function shell(content, activeTab = "feed", subtitle = "Charlotte community photo feed") {
  const activeDog = getActiveDog();
  const dogQuery = activeDog ? `?dog=${encodeURIComponent(activeDog)}` : "";
  const theme = resolvedTheme();
  return `
    <div class="app-shell">
      <a class="skip-link" href="#main-content">Skip to main content</a>
      <div class="food-pattern food-pattern-slow" aria-hidden="true"></div>
      <div class="food-pattern food-pattern-fast" aria-hidden="true"></div>
      <header class="topbar">
        <div class="brand">
          <a class="brand-mark brand-home" href="#/feed${dogQuery}" aria-label="Return to the photo feed" title="Return to the photo feed">🌭</a>
          <div class="brand-copy">
            <h1 class="brand-title">${escapeHtml(config.appName || "CLT Hot Dog Feed")}</h1>
            <p class="brand-subtitle">${escapeHtml(subtitle)}</p>
          </div>
        </div>
        <div class="topbar-actions">
          ${activeDogHeaderMarkup()}
          <button class="icon-button" id="theme-toggle" aria-label="Switch to ${theme === "dark" ? "light" : "dark"} mode" title="Switch to ${theme === "dark" ? "light" : "dark"} mode">${theme === "dark" ? "☀" : "☾"}<span class="sr-only">Theme</span></button>
          <button class="icon-button text-icon-button" id="open-accessibility" aria-label="Open accessibility and appearance settings" aria-controls="accessibility-panel" aria-expanded="false">Aa<span class="sr-only">Accessibility</span></button>
        </div>
      </header>
      ${accessibilityPanelMarkup()}
      <div id="main-content" class="route-content" tabindex="-1">${content}</div>
      <nav class="bottom-nav" aria-label="Primary navigation">
        <a class="nav-item ${activeTab === "event" ? "active" : ""}" href="#/event${dogQuery}" ${activeTab === "event" ? 'aria-current="page"' : ""}>
          <span class="nav-icon" aria-hidden="true">ⓘ</span><span>Event</span>
        </a>
        <a class="nav-item ${activeTab === "feed" ? "active" : ""}" href="#/feed${dogQuery}" ${activeTab === "feed" ? 'aria-current="page"' : ""}>
          <span class="nav-icon" aria-hidden="true">▦</span><span>Feed</span>
        </a>
        <a class="nav-item add ${activeTab === "upload" ? "active" : ""}" href="#/upload${dogQuery}" ${activeTab === "upload" ? 'aria-current="page"' : ""}>
          <span class="nav-icon" aria-hidden="true">＋</span><span>Add</span>
        </a>
        <a class="nav-item ${activeTab === "journey" ? "active" : ""}" href="#/journey${dogQuery}" ${activeTab === "journey" ? 'aria-current="page"' : ""}>
          <span class="nav-icon" aria-hidden="true">↝</span><span>Journey</span>
        </a>
        <a class="nav-item ${activeTab === "map" ? "active" : ""}" href="#/map${dogQuery}" ${activeTab === "map" ? 'aria-current="page"' : ""}>
          <span class="nav-icon" aria-hidden="true">⌖</span><span>Map</span>
        </a>
      </nav>
    </div>
  `;
}

function attachShellEvents() {
  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    setPreference("theme", resolvedTheme() === "dark" ? "light" : "dark");
  });
  document.getElementById("open-accessibility")?.addEventListener("click", openAccessibilityPanel);
  document.getElementById("close-accessibility")?.addEventListener("click", closeAccessibilityPanel);
  document.getElementById("settings-backdrop")?.addEventListener("click", closeAccessibilityPanel);
  document.getElementById("accessibility-panel")?.addEventListener("keydown", trapSettingsFocus);

  document.querySelectorAll('input[name="theme-choice"]').forEach((input) => {
    input.addEventListener("change", (event) => setPreference("theme", event.target.value));
  });
  document.getElementById("text-size-choice")?.addEventListener("change", (event) => setPreference("textScale", event.target.value));
  document.getElementById("high-contrast-choice")?.addEventListener("change", (event) => setPreference("highContrast", event.target.checked));
  document.getElementById("reduce-motion-choice")?.addEventListener("change", (event) => setPreference("reduceMotion", event.target.checked));
  document.getElementById("decorations-choice")?.addEventListener("change", (event) => setPreference("showDecorations", event.target.checked));
  document.getElementById("underline-links-choice")?.addEventListener("change", (event) => setPreference("underlineLinks", event.target.checked));
  document.getElementById("reset-preferences")?.addEventListener("click", () => {
    preferences = defaultPreferences();
    savePreferences();
    applyPreferences();
    route(true);
    showToast("Display preferences reset.");
  });
  applyPreferences();
}

function loadingMarkup(label = "Loading photos…") {
  return `<div class="loading" role="status" aria-live="polite"><div><div class="spinner" aria-hidden="true"></div><div>${escapeHtml(label)}</div></div></div>`;
}

function demoNotice() {
  if (!isDemoMode()) return "";
  return `
    <div class="notice demo">
      <strong>Demo mode:</strong> photos and likes are saved only in this browser. Add Supabase details in <code>config.js</code> to share the feed across devices.
    </div>
  `;
}

function testWarning() {
  return `
    <div class="notice warning">
      <strong>Testing build:</strong> there is no moderation yet. A submitted photo becomes public immediately, so only share this test link with people you trust.
    </div>
  `;
}

function dogLabel(photo) {
  if (photo.hotdog_number !== null && photo.hotdog_number !== undefined) return `Hot Dog #${photo.hotdog_number}`;
  if (photo.hotdog_code) return `Dog ${photo.hotdog_code}`;
  return "Community upload";
}

function photoCard(photo, likedIds) {
  const liked = likedIds.has(photo.id);
  const count = Number(photo.like_count || 0);
  return `
    <article class="photo-card" id="photo-${escapeHtml(photo.id)}">
      <div class="photo-media">
        <img src="${escapeHtml(photo.image_url)}" alt="Community hot dog crawl photo near ${escapeHtml(photo.place_name)}" loading="lazy" decoding="async" />
      </div>
      <div class="photo-meta">
        <div class="location-line">
          <span class="location-pin" aria-hidden="true">📍</span>
          <div>
            <div class="location-main">${escapeHtml(photo.place_name)}</div>
            <div class="location-sub">${escapeHtml(photo.location_detail || "Charlotte")} · ${escapeHtml(dogLabel(photo))} · ${escapeHtml(formatRelativeTime(photo.created_at))}</div>
          </div>
        </div>
        <button class="like-button ${liked ? "liked" : ""}" data-like-photo="${escapeHtml(photo.id)}" data-liked="${liked ? "true" : "false"}" aria-label="${liked ? `Remove your like. ${count} likes` : `Like this photo. ${count} likes`}" aria-pressed="${liked ? "true" : "false"}">
          <span class="heart" aria-hidden="true">${liked ? "♥" : "♡"}</span>
          <span class="like-action" data-like-action>${liked ? "Liked" : "Like"}</span>
          <span class="like-count" data-like-count>${count}</span>
        </button>
      </div>
    </article>
  `;
}

function communityCounterMarkup(photos) {
  const dogCount = new Set(photos.map((photo) => photo.hotdog_code).filter(Boolean)).size;
  const placeCount = new Set(photos.map((photo) => `${photo.place_name}|${photo.location_detail || ""}`)).size;
  return `
    <section class="community-counter" aria-label="Community activity">
      <div class="community-stat"><span class="community-stat-icon" aria-hidden="true">📷</span><strong>${photos.length}</strong><span>Photos</span></div>
      <div class="community-stat"><span class="community-stat-icon" aria-hidden="true">🌭</span><strong>${dogCount}</strong><span>Dogs spotted</span></div>
      <div class="community-stat"><span class="community-stat-icon" aria-hidden="true">📍</span><strong>${placeCount}</strong><span>Places</span></div>
    </section>
  `;
}

async function renderFeed(routeInfo) {
  destroyMaps();
  const dogCode = (routeInfo.params.get("dog") || "").toUpperCase();
  if (dogCode) setActiveDog(dogCode);

  app.innerHTML = shell(`<main class="page">${loadingMarkup()}</main>`, "feed");
  attachShellEvents();

  try {
    const [photos, dog] = await Promise.all([
      getPhotos(feedSort),
      dogCode ? getHotdog(dogCode) : Promise.resolve(null)
    ]);
    if (dog) setActiveDogDetails(dog);
    const likedIds = getLikedPhotoIds();
    const activeDogMarkup = dog
      ? `<div class="active-dog">
          <div><strong>🌭 ${dog.printed_number != null ? `Hot Dog #${dog.printed_number}` : dog.public_code} is active</strong><span>Photos you add from this link will be connected to ${escapeHtml(dog.public_code)}.</span></div>
          <button class="small-button" data-add-photo>Add photo</button>
        </div>`
      : "";

    const feedMarkup = photos.length
      ? `<div class="feed-grid">${photos.map((photo) => photoCard(photo, likedIds)).join("")}</div>`
      : `<div class="empty-state"><div class="empty-icon">📷</div><h2>No photos yet</h2><p>Be the first person to add a Charlotte hot dog crawl photo.</p><button class="primary-button" data-add-photo>Add the first photo</button></div>`;

    const content = `
      <main class="page feed-page">
        ${demoNotice()}
        ${activeDogMarkup}
        ${communityCounterMarkup(photos)}
        <section class="hero-card feed-hero">
          <h1>Charlotte, one hot dog at a time.</h1>
          <p>Scan a printed dog, add one photo and a location, then watch the city-wide feed grow.</p>
          <button class="primary-button" data-add-photo>📷 Add your photo</button>
        </section>
        <div class="feed-toolbar">
          <h2>Photo feed</h2>
          <div class="segmented" aria-label="Sort photos">
            <button data-sort="newest" class="${feedSort === "newest" ? "active" : ""}" aria-pressed="${feedSort === "newest" ? "true" : "false"}"><span aria-hidden="true">🕒</span> Newest</button>
            <button data-sort="top" class="${feedSort === "top" ? "active" : ""}" aria-pressed="${feedSort === "top" ? "true" : "false"}"><span aria-hidden="true">♥</span> Top</button>
          </div>
        </div>
        ${feedMarkup}
      </main>
    `;
    app.innerHTML = shell(content, "feed");
    attachShellEvents();

    document.querySelectorAll("[data-add-photo]").forEach((button) => {
      button.addEventListener("click", () => {
        const code = dog?.public_code || getActiveDog();
        navigate(`/upload${code ? `?dog=${encodeURIComponent(code)}` : ""}`);
      });
    });

    document.querySelectorAll("[data-sort]").forEach((button) => {
      button.addEventListener("click", () => {
        feedSort = button.dataset.sort;
        renderFeed(getRoute());
      });
    });

    attachLikeButtons();

    const focusedPhotoId = routeInfo.params.get("uploaded") || routeInfo.params.get("focus");
    if (focusedPhotoId) {
      window.setTimeout(() => {
        const focusedCard = document.getElementById(`photo-${focusedPhotoId}`);
        focusedCard?.classList.add("photo-card-focused");
        focusedCard?.scrollIntoView({ behavior: preferences.reduceMotion ? "auto" : "smooth", block: "center" });
      }, 100);
    }
  } catch (error) {
    app.innerHTML = shell(`
      <main class="page">
        <div class="empty-state"><div class="empty-icon">⚠️</div><h2>Could not load the feed</h2><p>${escapeHtml(error.message)}</p><button class="primary-button" id="try-again">Try again</button></div>
      </main>
    `, "feed");
    attachShellEvents();
    document.getElementById("try-again")?.addEventListener("click", () => renderFeed(routeInfo));
  }
}

function updateLikeButton(button, liked, count) {
  button.dataset.liked = liked ? "true" : "false";
  button.classList.toggle("liked", liked);
  button.setAttribute("aria-pressed", liked ? "true" : "false");
  button.setAttribute("aria-label", `${liked ? "Remove your like" : "Like this photo"}. ${count} likes`);
  const heart = button.querySelector(".heart");
  const action = button.querySelector("[data-like-action]");
  const countElement = button.querySelector("[data-like-count]");
  if (heart) heart.textContent = liked ? "♥" : "♡";
  if (action) action.textContent = liked ? "Liked" : "Like";
  if (countElement) countElement.textContent = String(Math.max(0, count));
}

function attachLikeButtons() {
  document.querySelectorAll("[data-like-photo]").forEach((button) => {
    button.addEventListener("click", async () => {
      const photoId = button.dataset.likePhoto;
      const wasLiked = button.dataset.liked === "true";
      const countElement = button.querySelector("[data-like-count]");
      const currentCount = Number(countElement?.textContent || 0);
      button.disabled = true;
      try {
        if (wasLiked) {
          const result = await unlikePhoto(photoId);
          updateLikeButton(button, false, result.removed ? currentCount - 1 : currentCount);
          showToast("Like removed.");
        } else {
          const result = await likePhoto(photoId);
          updateLikeButton(button, true, result.duplicate ? currentCount : currentCount + 1);
        }
      } catch (error) {
        showToast(error.message || `Could not ${wasLiked ? "remove" : "add"} that like.`, "error");
      } finally {
        button.disabled = false;
      }
    });
  });
}

function neighborhoodForPhoto(photo) {
  const haystack = `${photo.location_detail || ""} ${photo.place_name || ""}`.toLowerCase();
  if (haystack.includes("plaza midwood") || haystack.includes("the plaza")) return "Plaza Midwood";
  if (haystack.includes("noda") || haystack.includes("north davidson")) return "NoDa";
  if (haystack.includes("uptown") || haystack.includes("center city")) return "Uptown";
  if (haystack.includes("south end") || haystack.includes("southend")) return "South End";
  if (haystack.includes("loso") || haystack.includes("lower south end")) return "LoSo";
  return "Other Charlotte";
}

function filteredMapPhotos(photos) {
  if (mapNeighborhoodFilter === "All") return photos;
  return photos.filter((photo) => neighborhoodForPhoto(photo) === mapNeighborhoodFilter);
}

function mapNeighborhoodFiltersMarkup(photos) {
  const counts = new Map(MAP_NEIGHBORHOODS.map((name) => [name, 0]));
  counts.set("All", photos.length);
  photos.forEach((photo) => {
    const neighborhood = neighborhoodForPhoto(photo);
    counts.set(neighborhood, (counts.get(neighborhood) || 0) + 1);
  });
  const visible = MAP_NEIGHBORHOODS.filter((name) => name === "All" || (counts.get(name) || 0) > 0);
  return `
    <div class="neighborhood-filter-wrap" aria-label="Filter map by neighborhood">
      <div class="neighborhood-filters">
        ${visible.map((name) => `
          <button class="neighborhood-chip ${mapNeighborhoodFilter === name ? "active" : ""}" data-map-neighborhood="${escapeHtml(name)}" aria-pressed="${mapNeighborhoodFilter === name ? "true" : "false"}">
            <span>${escapeHtml(name)}</span><span class="chip-count">${counts.get(name) || 0}</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function groupPhotosByLocation(photos) {
  const groups = new Map();
  photos.forEach((photo) => {
    const latitude = Number(photo.latitude);
    const longitude = Number(photo.longitude);
    const coordinateKey = Number.isFinite(latitude) && Number.isFinite(longitude)
      ? `${latitude.toFixed(4)}|${longitude.toFixed(4)}`
      : "no-coordinate";
    const key = `${photo.place_name}|${photo.location_detail || "Charlotte"}|${coordinateKey}`;
    if (!groups.has(key)) {
      groups.set(key, {
        placeName: photo.place_name,
        locationDetail: photo.location_detail || "Charlotte",
        neighborhood: neighborhoodForPhoto(photo),
        latitude,
        longitude,
        photos: [],
        dogs: new Set(),
        likes: 0
      });
    }
    const group = groups.get(key);
    group.photos.push(photo);
    if (photo.hotdog_code) group.dogs.add(photo.hotdog_code);
    group.likes += Number(photo.like_count || 0);
  });
  return [...groups.values()].sort((a, b) => b.photos.length - a.photos.length || a.placeName.localeCompare(b.placeName));
}

function feedLinkForPhoto(photoId) {
  const activeDog = getActiveDog();
  const params = new URLSearchParams();
  if (activeDog) params.set("dog", activeDog);
  params.set("focus", photoId);
  return `/feed?${params.toString()}`;
}

function mapTextListMarkup(photos) {
  const groups = groupPhotosByLocation(photos);
  if (!groups.length) {
    return `<div class="empty-state"><div class="empty-icon">📍</div><h2>No locations here yet</h2><p>Try another neighborhood or add the first photo from this area.</p></div>`;
  }
  const neighborhoods = [...new Set(groups.map((group) => group.neighborhood))]
    .sort((a, b) => MAP_NEIGHBORHOODS.indexOf(a) - MAP_NEIGHBORHOODS.indexOf(b));
  return `
    <section class="map-text-view" aria-labelledby="map-list-title">
      <div class="map-list-heading">
        <div><h2 id="map-list-title">Locations in ${escapeHtml(mapNeighborhoodFilter)}</h2><p class="section-help">The same community locations as the map, organized for easy reading and keyboard access.</p></div>
        <span class="map-result-count">${groups.length} stop${groups.length === 1 ? "" : "s"}</span>
      </div>
      <div class="neighborhood-location-groups">
        ${neighborhoods.map((neighborhood) => {
          const neighborhoodGroups = groups.filter((group) => group.neighborhood === neighborhood);
          const photoCount = neighborhoodGroups.reduce((sum, group) => sum + group.photos.length, 0);
          return `
            <section class="neighborhood-location-section" aria-labelledby="neighborhood-${escapeHtml(neighborhood).replace(/\s+/g, "-")}">
              <div class="neighborhood-location-heading">
                <h3 id="neighborhood-${escapeHtml(neighborhood).replace(/\s+/g, "-")}">${escapeHtml(neighborhood)}</h3>
                <span>${photoCount} photo${photoCount === 1 ? "" : "s"}</span>
              </div>
              <ul class="location-list">
                ${neighborhoodGroups.map((group) => {
                  const latest = group.photos[0];
                  return `
                    <li class="location-list-item">
                      <img class="location-list-thumb" src="${escapeHtml(latest.image_url)}" alt="" loading="lazy" decoding="async" />
                      <div class="location-list-copy">
                        <strong>${escapeHtml(group.placeName)}</strong>
                        <span>${escapeHtml(group.locationDetail)}</span>
                        <span>${group.photos.length} photo${group.photos.length === 1 ? "" : "s"} · ${group.dogs.size} dog${group.dogs.size === 1 ? "" : "s"} · ${group.likes} like${group.likes === 1 ? "" : "s"}</span>
                      </div>
                      <button class="small-button location-list-action" data-map-feed-photo="${escapeHtml(latest.id)}"><span aria-hidden="true">↗</span> View</button>
                    </li>
                  `;
                }).join("")}
              </ul>
            </section>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function mapCanvasMarkup(photos) {
  return `
    <div class="map-stage">
      <div class="map-shell modern-map-shell">
        <div id="photo-map" aria-label="Interactive map showing submitted community photos"></div>
        <div class="map-status-pill"><span aria-hidden="true">📷</span><strong>${photos.length}</strong><span>photo${photos.length === 1 ? "" : "s"}</span></div>
        <div class="map-floating-actions" aria-label="Map controls">
          <button class="map-control-button" id="map-near-me"><span aria-hidden="true">⌖</span><span>Near me</span></button>
          <button class="map-control-button" id="map-show-all"><span aria-hidden="true">⊙</span><span>Show all</span></button>
        </div>
        <aside class="map-photo-sheet" id="map-photo-sheet" aria-live="polite" hidden></aside>
      </div>
    </div>
  `;
}

async function renderMapPage() {
  destroyMaps();
  mapUserMarker = null;
  mapVisibleBounds = [];
  app.innerHTML = shell(`<main class="page-wide">${loadingMarkup("Building the map…")}</main>`, "map", "All community photos across Charlotte");
  attachShellEvents();

  try {
    const photos = await getPhotos("newest");
    const visiblePhotos = filteredMapPhotos(photos);
    const viewMarkup = mapDisplayMode === "map" ? mapCanvasMarkup(visiblePhotos) : mapTextListMarkup(visiblePhotos);
    const content = `
      <main class="page-wide map-page">
        ${demoNotice()}
        <div class="view-toolbar modern-map-toolbar">
          <div><p class="map-eyebrow">Explore Charlotte</p><h1>Community map</h1><p>See where the hot dogs have traveled, or use the text view for a simpler list.</p></div>
          <div class="segmented" aria-label="Map display">
            <button data-map-view="map" class="${mapDisplayMode === "map" ? "active" : ""}" aria-pressed="${mapDisplayMode === "map" ? "true" : "false"}"><span aria-hidden="true">🗺️</span> Map</button>
            <button data-map-view="text" class="${mapDisplayMode === "text" ? "active" : ""}" aria-pressed="${mapDisplayMode === "text" ? "true" : "false"}"><span aria-hidden="true">☷</span> List</button>
          </div>
        </div>
        ${mapNeighborhoodFiltersMarkup(photos)}
        ${viewMarkup}
      </main>
    `;
    app.innerHTML = shell(content, "map", "All community photos across Charlotte");
    attachShellEvents();

    document.querySelectorAll("[data-map-view]").forEach((button) => {
      button.addEventListener("click", () => {
        mapDisplayMode = button.dataset.mapView;
        renderMapPage();
      });
    });
    document.querySelectorAll("[data-map-neighborhood]").forEach((button) => {
      button.addEventListener("click", () => {
        mapNeighborhoodFilter = button.dataset.mapNeighborhood;
        renderMapPage();
      });
    });
    document.querySelectorAll("[data-map-feed-photo]").forEach((button) => {
      button.addEventListener("click", () => navigate(feedLinkForPhoto(button.dataset.mapFeedPhoto)));
    });

    if (mapDisplayMode === "map") {
      initializePhotoMap(visiblePhotos);
      document.getElementById("map-show-all")?.addEventListener("click", fitVisibleMapMarkers);
      document.getElementById("map-near-me")?.addEventListener("click", centerMapNearUser);
    }
  } catch (error) {
    app.innerHTML = shell(`<main class="page"><div class="empty-state"><div class="empty-icon">🗺️</div><h2>Could not load the map</h2><p>${escapeHtml(error.message)}</p></div></main>`, "map");
    attachShellEvents();
  }
}

function initializeBaseMap(elementId, center, zoom) {
  if (!window.L) throw new Error("The map library did not load. Check your internet connection.");
  const map = window.L.map(elementId, { zoomControl: false, attributionControl: true }).setView(center, zoom);
  window.L.control.zoom({ position: "topright" }).addTo(map);
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  return map;
}

function initializePhotoMap(photos) {
  mapInstance = initializeBaseMap("photo-map", config.mapCenter || [35.2271, -80.8431], config.mapZoom || 11);
  const groups = groupPhotosByLocation(photos).filter((group) => Number.isFinite(group.latitude) && Number.isFinite(group.longitude));
  mapVisibleBounds = groups.map((group) => [group.latitude, group.longitude]);

  groups.forEach((group) => {
    const latest = group.photos[0];
    const icon = window.L.divIcon({
      className: "modern-map-icon-wrap",
      html: `<div class="modern-map-marker"><img src="${escapeHtml(latest.image_url)}" alt="" /><span class="modern-map-marker-count" aria-hidden="true">${group.photos.length}</span></div>`,
      iconSize: [58, 66],
      iconAnchor: [29, 63]
    });
    window.L.marker([group.latitude, group.longitude], {
      icon,
      title: `${group.placeName}, ${group.photos.length} photo${group.photos.length === 1 ? "" : "s"}`,
      keyboard: true,
      riseOnHover: true
    })
      .addTo(mapInstance)
      .on("click", () => openMapPhotoSheet(group));
  });

  fitVisibleMapMarkers();
}

function fitVisibleMapMarkers() {
  if (!mapInstance) return;
  if (mapVisibleBounds.length > 1) mapInstance.fitBounds(mapVisibleBounds, { padding: [62, 62], maxZoom: 15 });
  else if (mapVisibleBounds.length === 1) mapInstance.setView(mapVisibleBounds[0], 15);
  else mapInstance.setView(config.mapCenter || [35.2271, -80.8431], config.mapZoom || 11);
}

function centerMapNearUser() {
  if (!navigator.geolocation) {
    showToast("Location is not supported by this browser.", "error");
    return;
  }
  const button = document.getElementById("map-near-me");
  if (button) button.disabled = true;
  navigator.geolocation.getCurrentPosition((position) => {
    if (!mapInstance) return;
    const latLng = [position.coords.latitude, position.coords.longitude];
    if (mapUserMarker) mapUserMarker.remove();
    mapUserMarker = window.L.circleMarker(latLng, {
      radius: 9,
      color: "#ffffff",
      weight: 4,
      fillColor: "#b7332c",
      fillOpacity: 1
    }).addTo(mapInstance).bindTooltip("You are here", { permanent: false, direction: "top" });
    mapInstance.setView(latLng, 14);
    showToast("Map centered near you. Your location was not saved.");
    if (button) button.disabled = false;
  }, (error) => {
    showToast(error.code === 1 ? "Location permission was declined." : "Could not find your location.", "error");
    if (button) button.disabled = false;
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
}

function openMapPhotoSheet(group) {
  const sheet = document.getElementById("map-photo-sheet");
  if (!sheet) return;
  const latest = group.photos[0];
  const previewPhotos = group.photos.slice(0, 3);
  sheet.hidden = false;
  sheet.innerHTML = `
    <button class="map-sheet-close" id="close-map-sheet" aria-label="Close selected location">×</button>
    <div class="map-sheet-handle" aria-hidden="true"></div>
    <div class="map-sheet-content">
      <img class="map-sheet-main-image" src="${escapeHtml(latest.image_url)}" alt="Community photo near ${escapeHtml(group.placeName)}" />
      <div class="map-sheet-copy">
        <p class="map-sheet-neighborhood">${escapeHtml(group.neighborhood)}</p>
        <h2>${escapeHtml(group.placeName)}</h2>
        <p>${escapeHtml(group.locationDetail)} · ${group.photos.length} photo${group.photos.length === 1 ? "" : "s"} · ${group.dogs.size} dog${group.dogs.size === 1 ? "" : "s"} · ${group.likes} like${group.likes === 1 ? "" : "s"}</p>
        ${previewPhotos.length > 1 ? `<div class="map-sheet-thumbnails">${previewPhotos.map((photo) => `<img src="${escapeHtml(photo.image_url)}" alt="" loading="lazy" />`).join("")}</div>` : ""}
        <button class="primary-button map-sheet-feed-button" data-map-feed-photo="${escapeHtml(latest.id)}"><span aria-hidden="true">▦</span> View in feed</button>
      </div>
    </div>
  `;
  sheet.querySelector("#close-map-sheet")?.addEventListener("click", () => { sheet.hidden = true; });
  sheet.querySelector("[data-map-feed-photo]")?.addEventListener("click", (event) => navigate(feedLinkForPhoto(event.currentTarget.dataset.mapFeedPhoto)));
}

function uploadMarkup() {
  const dog = uploadState.dog;
  const location = uploadState.location;
  const photo = uploadState.preparedPhoto;
  const dogText = dog
    ? dog.printed_number != null ? `Hot Dog #${dog.printed_number}` : dog.public_code
    : uploadState.dogCode ? uploadState.dogCode : "Community upload";
  const challenge = getDogChallenge(dog, uploadState.dogCode);

  return `
    <main class="page">
      ${demoNotice()}
      <div class="active-dog">
        <div><strong><span aria-hidden="true">🌭</span> ${escapeHtml(dogText)}</strong><span>${dog ? `Code ${escapeHtml(dog.public_code)}` : "The photo will not be tied to a known printed dog."}</span></div>
        <a class="small-button inline-link-button" href="#/feed${uploadState.dogCode ? `?dog=${encodeURIComponent(uploadState.dogCode)}` : ""}"><span aria-hidden="true">←</span> Feed</a>
      </div>

      <section class="challenge-card" aria-labelledby="photo-challenge-title">
        <div class="challenge-kicker"><span aria-hidden="true">🎯</span> Hot Dog #${challenge.challengeNumber} photo challenge</div>
        <h1 id="photo-challenge-title">${escapeHtml(challenge.prompt)}</h1>
        <p>This is optional. Any respectful photo is welcome, and you never need to photograph a person to participate.</p>
      </section>

      ${testWarning()}

      <section class="panel">
        <h2 class="section-heading"><span aria-hidden="true">1️⃣</span> Choose the location</h2>
        <p class="section-help">Use your current position or search for a Charlotte business, landmark, or address.</p>
        <div class="location-actions">
          <button class="primary-button" id="use-location" ${uploadState.locating ? "disabled" : ""}><span aria-hidden="true">⌖</span> ${uploadState.locating ? "Finding location…" : "Use current location"}</button>
          <button class="secondary-button" id="focus-search"><span aria-hidden="true">⌕</span> Search for a place</button>
        </div>
        <div class="field" style="margin-top:14px">
          <label for="place-search">Location search</label>
          <div class="search-row">
            <input class="search-input" id="place-search" value="${escapeHtml(uploadState.searchQuery)}" placeholder="Moo & Brew or Plaza Midwood" autocomplete="off" />
            <button class="small-button" id="search-place" ${uploadState.searching ? "disabled" : ""}><span aria-hidden="true">⌕</span> ${uploadState.searching ? "Searching…" : "Search"}</button>
          </div>
          <span class="section-help" style="margin:0">Search runs only when you press Search. ${escapeHtml(config.geocoderAttribution || "Search data © OpenStreetMap contributors")}.</span>
        </div>
        ${uploadState.searchResults.length ? `<div class="search-results">${uploadState.searchResults.map((result, index) => `
          <button class="search-result" data-search-result="${index}"><strong><span aria-hidden="true">📍</span> ${escapeHtml(result.placeName)}</strong><span>${escapeHtml(result.displayName)}</span></button>
        `).join("")}</div>` : ""}
        ${location ? `
          <div class="location-summary" style="margin-top:14px">
            <span aria-hidden="true">✓</span>
            <div><strong id="selected-location-name">${escapeHtml(location.placeName)}</strong><span id="selected-location-coords">${escapeHtml(location.locationDetail || "Charlotte")} · Pin can be adjusted on the map</span></div>
          </div>
          <div class="location-map-wrap" style="margin-top:12px"><div id="location-map"></div></div>
        ` : ""}
      </section>

      <section class="panel">
        <h2 class="section-heading"><span aria-hidden="true">2️⃣</span> Add one photo</h2>
        <p class="section-help">The browser resizes and re-encodes the image before upload, which removes embedded photo metadata.</p>
        ${photo ? `
          <div class="photo-preview">
            <img src="${escapeHtml(photo.dataUrl)}" alt="Selected photo preview" />
            <button class="small-button" id="remove-photo"><span aria-hidden="true">↻</span> Change photo</button>
          </div>
        ` : `
          <div class="photo-source-grid">
            <label class="photo-source-button camera-source" for="camera-photo-input">
              <span class="photo-source-icon" aria-hidden="true">📸</span>
              <strong>Take a photo</strong>
              <small>Open the rear camera for an in-the-moment picture.</small>
            </label>
            <label class="photo-source-button library-source" for="library-photo-input">
              <span class="photo-source-icon" aria-hidden="true">🖼️</span>
              <strong>Choose from library</strong>
              <small>Select an existing photo from your phone or computer.</small>
            </label>
            <input class="sr-only-file" id="camera-photo-input" type="file" accept="image/*" capture="environment" />
            <input class="sr-only-file" id="library-photo-input" type="file" accept="image/*" />
          </div>
          <p class="photo-source-help">Your browser may combine these choices into one photo picker depending on the device.</p>
        `}
      </section>

      <section class="panel">
        <h2 class="section-heading"><span aria-hidden="true">3️⃣</span> Publish to the test feed</h2>
        <label class="checkbox-row">
          <input id="photo-consent" type="checkbox" ${uploadState.consent ? "checked" : ""} />
          <span>I have permission to post this photo, including permission from anyone clearly pictured.</span>
        </label>
        <button class="primary-button" id="submit-photo" style="margin-top:16px" ${uploadState.submitting ? "disabled" : ""}><span aria-hidden="true">⬆</span> ${uploadState.submitting ? "Publishing…" : "Publish photo"}</button>
      </section>
    </main>
  `;
}

async function renderUpload(routeInfo, reset = false) {
  destroyMaps();
  const dogCode = (routeInfo.params.get("dog") || getActiveDog() || "").toUpperCase();
  if (reset || uploadState.dogCode !== dogCode) uploadState = freshUploadState(dogCode);
  if (dogCode) setActiveDog(dogCode);

  if (!uploadState.dog && dogCode) {
    try {
      uploadState.dog = await getHotdog(dogCode);
      if (uploadState.dog) setActiveDogDetails(uploadState.dog);
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  app.innerHTML = shell(uploadMarkup(), "upload", "Add one photo and one location");
  attachShellEvents();
  attachUploadEvents();
  if (uploadState.location) initializeLocationMap();
}

function attachUploadEvents() {
  document.getElementById("use-location")?.addEventListener("click", useCurrentLocation);
  document.getElementById("focus-search")?.addEventListener("click", () => document.getElementById("place-search")?.focus());
  document.getElementById("search-place")?.addEventListener("click", runPlaceSearch);
  document.getElementById("place-search")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runPlaceSearch();
    }
  });
  document.querySelectorAll("[data-search-result]").forEach((button) => {
    button.addEventListener("click", () => {
      uploadState.location = uploadState.searchResults[Number(button.dataset.searchResult)];
      uploadState.searchResults = [];
      renderUpload(getRoute());
    });
  });
  document.getElementById("camera-photo-input")?.addEventListener("change", handlePhotoInput);
  document.getElementById("library-photo-input")?.addEventListener("change", handlePhotoInput);
  document.getElementById("remove-photo")?.addEventListener("click", () => {
    uploadState.preparedPhoto = null;
    renderUpload(getRoute());
  });
  document.getElementById("photo-consent")?.addEventListener("change", (event) => {
    uploadState.consent = event.target.checked;
  });
  document.getElementById("submit-photo")?.addEventListener("click", submitPhoto);
}

async function useCurrentLocation() {
  if (!navigator.geolocation) {
    showToast("This browser does not support location access. Use search instead.", "error");
    return;
  }
  uploadState.locating = true;
  renderUpload(getRoute());
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      try {
        const result = await reverseGeocode(latitude, longitude);
        uploadState.location = { ...result, lat: latitude, lng: longitude, accuracy, source: "gps" };
      } catch {
        uploadState.location = {
          lat: latitude,
          lng: longitude,
          accuracy,
          placeName: "Current location",
          locationDetail: "Charlotte",
          displayName: "Current location",
          source: "gps"
        };
      }
      uploadState.locating = false;
      renderUpload(getRoute());
    },
    (error) => {
      uploadState.locating = false;
      renderUpload(getRoute());
      const message = error.code === 1
        ? "Location permission was declined. Search for a place instead."
        : "Your location could not be found. Search for a place instead.";
      showToast(message, "error");
      window.setTimeout(() => document.getElementById("place-search")?.focus(), 50);
    },
    { enableHighAccuracy: false, timeout: 9000, maximumAge: 60_000 }
  );
}

async function runPlaceSearch() {
  const input = document.getElementById("place-search");
  uploadState.searchQuery = input?.value || "";
  uploadState.searching = true;
  renderUpload(getRoute());
  try {
    uploadState.searchResults = await searchPlaces(uploadState.searchQuery);
    if (!uploadState.searchResults.length) showToast("No Charlotte locations matched that search.");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    uploadState.searching = false;
    renderUpload(getRoute());
  }
}

async function handlePhotoInput(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  showToast("Preparing photo…");
  try {
    uploadState.preparedPhoto = await preparePhoto(file);
    renderUpload(getRoute());
  } catch (error) {
    showToast(error.message, "error");
  }
}

function initializeLocationMap() {
  const location = uploadState.location;
  locationMapInstance = initializeBaseMap("location-map", [location.lat, location.lng], 15);
  const marker = window.L.marker([location.lat, location.lng], { draggable: true }).addTo(locationMapInstance);
  const update = (latLng) => {
    uploadState.location.lat = latLng.lat;
    uploadState.location.lng = latLng.lng;
    const label = document.getElementById("selected-location-coords");
    if (label) label.textContent = `${uploadState.location.locationDetail || "Charlotte"} · Pin adjusted`;
  };
  marker.on("dragend", () => update(marker.getLatLng()));
  locationMapInstance.on("click", (event) => {
    marker.setLatLng(event.latlng);
    update(event.latlng);
  });
}

async function submitPhoto() {
  if (!uploadState.location) {
    showToast("Choose a location first.", "error");
    return;
  }
  if (!uploadState.preparedPhoto) {
    showToast("Choose a photo first.", "error");
    return;
  }
  if (!uploadState.consent) {
    showToast("Confirm that you have permission to post the photo.", "error");
    return;
  }

  uploadState.submitting = true;
  renderUpload(getRoute());
  try {
    const photo = await createPhoto({
      blob: uploadState.preparedPhoto.blob,
      dataUrl: uploadState.preparedPhoto.dataUrl,
      latitude: uploadState.location.lat,
      longitude: uploadState.location.lng,
      placeName: uploadState.location.placeName,
      locationDetail: uploadState.location.locationDetail,
      locationSource: uploadState.location.source,
      hotdogCode: uploadState.dog?.public_code || uploadState.dogCode || null
    });
    showToast("Photo published to the feed.");
    const dogCode = uploadState.dog?.public_code || uploadState.dogCode;
    uploadState = freshUploadState(dogCode);
    navigate(`/feed?uploaded=${encodeURIComponent(photo.id)}${dogCode ? `&dog=${encodeURIComponent(dogCode)}` : ""}`);
  } catch (error) {
    uploadState.submitting = false;
    renderUpload(getRoute());
    showToast(error.message || "The photo could not be published.", "error");
  }
}

async function renderJourneyPage(routeInfo) {
  destroyMaps();
  const dogCode = (routeInfo.params.get("dog") || getActiveDog() || "").toUpperCase();
  if (dogCode) setActiveDog(dogCode);
  app.innerHTML = shell(`<main class="page">${loadingMarkup("Loading this dog's journey…")}</main>`, "journey", "Photos from one traveling hot dog");
  attachShellEvents();

  if (!dogCode) {
    app.innerHTML = shell(`<main class="page"><div class="empty-state"><div class="empty-icon">🌭</div><h2>No hot dog selected</h2><p>Scan a numbered hot dog QR code to see its journey.</p><a class="primary-button" href="#/feed"><span aria-hidden="true">▦</span> Return to feed</a></div></main>`, "journey");
    attachShellEvents();
    return;
  }

  try {
    const { dog, photos } = await getPhotosForHotdog(dogCode, "oldest");
    if (dog) setActiveDogDetails(dog);
    const likedIds = getLikedPhotoIds();
    const challenge = getDogChallenge(dog, dogCode);
    const placeCount = new Set(photos.map((photo) => `${photo.place_name}|${photo.location_detail || ""}`)).size;
    const totalLikes = photos.reduce((total, photo) => total + Number(photo.like_count || 0), 0);
    const dogName = dog?.printed_number != null ? `Hot Dog #${dog.printed_number}` : dog?.public_code || dogCode;
    const journeyPhotos = photos.length
      ? `<div class="journey-timeline">${photos.map((photo, index) => `<div class="journey-stop"><div class="journey-marker" aria-hidden="true">${index + 1}</div>${photoCard(photo, likedIds)}</div>`).join("")}</div>`
      : `<div class="empty-state"><div class="empty-icon">🧭</div><h2>No journey photos yet</h2><p>Be the first person to add a stop for ${escapeHtml(dogName)}.</p><a class="primary-button" href="#/upload?dog=${encodeURIComponent(dogCode)}"><span aria-hidden="true">📷</span> Add the first photo</a></div>`;

    const content = `
      <main class="page">
        ${demoNotice()}
        <section class="journey-hero">
          <div><p class="journey-eyebrow"><span aria-hidden="true">↝</span> This Dog's Journey</p><h1>${escapeHtml(dogName)}</h1><p>Every stop connected to code ${escapeHtml(dog?.public_code || dogCode)} appears here.</p></div>
          <a class="small-button inline-link-button" href="#/upload?dog=${encodeURIComponent(dogCode)}"><span aria-hidden="true">📷</span> Add stop</a>
        </section>
        <section class="journey-stats" aria-label="Journey summary">
          <div><strong>${photos.length}</strong><span>Photos</span></div>
          <div><strong>${placeCount}</strong><span>Places</span></div>
          <div><strong>${totalLikes}</strong><span>Likes</span></div>
        </section>
        <section class="challenge-mini"><span aria-hidden="true">🎯</span><div><strong>Photo challenge #${challenge.challengeNumber}</strong><p>${escapeHtml(challenge.prompt)}</p></div></section>
        ${journeyPhotos}
      </main>
    `;
    app.innerHTML = shell(content, "journey", `${dogName}'s community journey`);
    attachShellEvents();
    attachLikeButtons();
  } catch (error) {
    app.innerHTML = shell(`<main class="page"><div class="empty-state"><div class="empty-icon">⚠️</div><h2>Could not load this journey</h2><p>${escapeHtml(error.message)}</p><button class="primary-button" id="retry-journey"><span aria-hidden="true">↻</span> Try again</button></div></main>`, "journey");
    attachShellEvents();
    document.getElementById("retry-journey")?.addEventListener("click", () => renderJourneyPage(routeInfo));
  }
}


function neighborhoodMarkup() {
  return EVENT_NEIGHBORHOODS.map((area) => `
    <details class="event-neighborhood">
      <summary>
        <span><strong>${escapeHtml(area.name)}</strong><small>${escapeHtml(area.range)} · Suggested start: ${escapeHtml(area.suggestedStart)}</small></span>
        <span class="details-chevron" aria-hidden="true">⌄</span>
      </summary>
      <ul class="event-venue-list">
        ${area.venues.map((venue) => `<li><span aria-hidden="true">🌭</span><span>${escapeHtml(venue)}</span></li>`).join("")}
      </ul>
    </details>
  `).join("");
}

function organizerCardMarkup() {
  return `
    <section class="event-organizer-card" aria-labelledby="event-organizer-title">
      <div class="event-organizer-icon" aria-hidden="true">◎</div>
      <div class="event-organizer-copy">
        <p class="event-eyebrow"><span aria-hidden="true">📣</span> Official event source</p>
        <h2 id="event-organizer-title">Follow the organizer on Instagram</h2>
        <p>For the latest crawl updates, participating locations, specials, maps, and any day-of changes, view the official post from <strong>${escapeHtml(EVENT_ORGANIZER.handle)}</strong>.</p>
        <div class="event-organizer-actions">
          <a class="primary-button" href="${escapeHtml(EVENT_ORGANIZER.postUrl)}" target="_blank" rel="noopener noreferrer">
            <span aria-hidden="true">↗</span> Open the official event post
          </a>
          <a class="secondary-button" href="${escapeHtml(EVENT_ORGANIZER.profileUrl)}" target="_blank" rel="noopener noreferrer">
            <span aria-hidden="true">◎</span> Visit ${escapeHtml(EVENT_ORGANIZER.handle)}
          </a>
        </div>
        <p class="event-external-note"><span aria-hidden="true">ℹ️</span> Instagram links open in a new tab or in the Instagram app when supported.</p>
      </div>
    </section>
  `;
}

function attachEventEvents() {
  document.querySelectorAll("[data-event-section]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById(button.dataset.eventSection)?.scrollIntoView({ behavior: preferences.reduceMotion ? "auto" : "smooth", block: "start" });
    });
  });
}

function renderEventPage() {
  destroyMaps();
  const activeDog = getActiveDog();
  const dogQuery = activeDog ? `?dog=${encodeURIComponent(activeDog)}` : "";
  const content = `
    <main class="page event-page">
      <section class="event-hero" aria-labelledby="event-page-title">
        <p class="event-eyebrow"><span aria-hidden="true">🌭</span> Your guide to the crawl</p>
        <h1 id="event-page-title">The Hot Dog Bar Crawl</h1>
        <p class="event-date"><span aria-hidden="true">📅</span> Saturday, August 1, 2026</p>
        <p>Plaza Midwood and beyond, with participating stops in Uptown, NoDa, South End, and LoSo. This page is a quick, accessible summary of the event guide.</p>
        <div class="event-hero-actions">
          <a class="primary-button" href="#/feed${dogQuery}"><span aria-hidden="true">▦</span> Open the photo feed</a>
          <a class="secondary-button" href="${escapeHtml(EVENT_ORGANIZER.postUrl)}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">↗</span> Official Instagram post</a>
        </div>
      </section>

      ${organizerCardMarkup()}

      <section class="event-at-a-glance" aria-label="Event at a glance">
        <div><span aria-hidden="true">📍</span><strong>5</strong><span>Neighborhoods</span></div>
        <div><span aria-hidden="true">🌭</span><strong>30</strong><span>Mapped stops</span></div>
        <div><span aria-hidden="true">✅</span><strong>6</strong><span>Stamps for rewards</span></div>
      </section>

      <nav class="event-jump-links" aria-label="Event page sections">
        <button type="button" data-event-section="passport"><span aria-hidden="true">🛂</span> Passport</button>
        <button type="button" data-event-section="neighborhoods"><span aria-hidden="true">🗺️</span> Neighborhoods</button>
        <button type="button" data-event-section="travel"><span aria-hidden="true">🚌</span> Travel safely</button>
        <button type="button" data-event-section="extras"><span aria-hidden="true">🎉</span> Extras</button>
      </nav>

      <section class="event-section" id="passport" aria-labelledby="passport-title">
        <p class="event-eyebrow"><span aria-hidden="true">🛂</span> The passport</p>
        <h2 id="passport-title">Collect stamps and unlock rewards</h2>
        <ol class="event-step-list">
          <li><span aria-hidden="true">1</span><div><strong>Pick up a passport</strong><p>Most passports will be available on event day at the recommended starting locations, with some available at other participating businesses.</p></div></li>
          <li><span aria-hidden="true">2</span><div><strong>Buy an eligible item</strong><p>Ask the participating business for a stamp or sticker after an eligible purchase.</p></div></li>
          <li><span aria-hidden="true">3</span><div><strong>Reach six stamps</strong><p>Six stamps unlock the ability to redeem any and all listed rewards, not just one.</p></div></li>
          <li><span aria-hidden="true">4</span><div><strong>Keep the passport</strong><p>Rewards have their own redemption windows. You do not need a stamp from the business whose reward you redeem.</p></div></li>
        </ol>
      </section>

      <section class="event-section" id="neighborhoods" aria-labelledby="neighborhoods-title">
        <p class="event-eyebrow"><span aria-hidden="true">🗺️</span> Where to go</p>
        <h2 id="neighborhoods-title">Choose your own route</h2>
        <p>The map numbers identify stops; they are not a required crawl order. Expand a neighborhood to see its venue list.</p>
        <div class="event-neighborhood-list">${neighborhoodMarkup()}</div>
      </section>

      <section class="event-section event-safety" id="travel" aria-labelledby="travel-title">
        <p class="event-eyebrow"><span aria-hidden="true">🚌</span> Crawl responsibly</p>
        <h2 id="travel-title">Plan transportation before the first stop</h2>
        <div class="event-info-grid">
          <div><span aria-hidden="true">🚐</span><strong>JUMP Transit</strong><p>$3 one way per person or a $7 day pass per person for select neighborhoods.</p></div>
          <div><span aria-hidden="true">🚈</span><strong>Rail and rideshare</strong><p>Use the Blue Line, Gold Line, or a rideshare service to move between other neighborhoods.</p></div>
          <div><span aria-hidden="true">🚫</span><strong>Do not drink and drive</strong><p>No amount of hot dogs makes driving after drinking safe. Arrange a sober ride.</p></div>
        </div>
      </section>

      <section class="event-section" id="extras" aria-labelledby="extras-title">
        <p class="event-eyebrow"><span aria-hidden="true">🎉</span> More event fun</p>
        <h2 id="extras-title">Activities, challenges, and merch</h2>
        <ul class="event-feature-list">
          <li><span aria-hidden="true">🏆</span><div><strong>Hot dog eating contest</strong><p>Scheduled for 7 PM at Common Market, with an “eat a hot dog in style” competition around 7:30 PM.</p></div></li>
          <li><span aria-hidden="true">🎨</span><div><strong>Hot dog tattoos</strong><p>Charlotte Tattoo Company is offering several hot dog flash designs.</p></div></li>
          <li><span aria-hidden="true">🏛️</span><div><strong>Mint Museum admission</strong><p>Hot dog-themed outfits receive free general admission at the Mint Museum in Uptown.</p></div></li>
          <li><span aria-hidden="true">📣</span><div><strong>Share the day</strong><p>The official guide suggests using <strong>#HDBC2026</strong> and <strong>#GLEEZYGOODTIME</strong>.</p></div></li>
          <li><span aria-hidden="true">🎁</span><div><strong>Merch</strong><p>Free magnets, stickers, and koozies are available at select locations; limited shirts are available for purchase at Common Market.</p></div></li>
        </ul>
      </section>

      <aside class="event-note" aria-label="Event information note">
        <span aria-hidden="true">ℹ️</span>
        <p>This community photo website is an independent companion to the crawl and is not the official event page. Specials, hours, availability, and entry rules may change. Check the official Instagram post from ${escapeHtml(EVENT_ORGANIZER.handle)} and participating venues on the day of the crawl.</p>
      </aside>

    </main>
  `;
  app.innerHTML = shell(content, "event", "Hot Dog Bar Crawl event details");
  attachShellEvents();
  attachEventEvents();
}

async function route(force = false) {
  const routeInfo = getRoute();
  const routeDogCode = (routeInfo.params.get("dog") || "").toUpperCase();
  if (routeDogCode) setActiveDog(routeDogCode);
  if (routeInfo.segments[0] === "dog" && routeInfo.segments[1]) {
    const code = routeInfo.segments[1].toUpperCase();
    setActiveDog(code);
    navigate(`/feed?dog=${encodeURIComponent(code)}`);
    return;
  }

  if (routeInfo.path === "/event") {
    renderEventPage();
    return;
  }
  if (routeInfo.path === "/map") {
    await renderMapPage();
    return;
  }
  if (routeInfo.path === "/journey") {
    await renderJourneyPage(routeInfo);
    return;
  }
  if (routeInfo.path === "/upload") {
    await renderUpload(routeInfo, force);
    return;
  }
  await renderFeed(routeInfo);
}

window.addEventListener("hashchange", () => route());
window.addEventListener("scroll", updateParallax, { passive: true });
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAccessibilityPanel();
});
systemDarkQuery.addEventListener?.("change", () => {
  if (preferences.theme === "system") applyPreferences();
});
window.addEventListener("DOMContentLoaded", () => {
  applyPreferences();
  updateParallax();
  if (!window.location.hash) window.location.hash = "#/feed";
  else route();
});
