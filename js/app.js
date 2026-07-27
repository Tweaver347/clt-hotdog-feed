import { createPhoto, getHotdog, getPhotos, isDemoMode, likePhoto } from "./data.js";
import { reverseGeocode, searchPlaces } from "./geocode.js";
import { preparePhoto } from "./image.js";
import {
  config,
  escapeHtml,
  formatRelativeTime,
  getActiveDog,
  getLikedPhotoIds,
  getRoute,
  navigate,
  setActiveDog,
  showToast
} from "./utils.js";

const app = document.getElementById("app");
let feedSort = "newest";
let mapInstance = null;
let locationMapInstance = null;
let uploadState = freshUploadState();

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

function shell(content, activeTab = "feed", subtitle = "Charlotte community photo feed") {
  const activeDog = getActiveDog();
  const dogQuery = activeDog ? `?dog=${encodeURIComponent(activeDog)}` : "";
  return `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark" aria-hidden="true">🌭</div>
          <div class="brand-copy">
            <h1 class="brand-title">${escapeHtml(config.appName || "CLT Hot Dog Feed")}</h1>
            <p class="brand-subtitle">${escapeHtml(subtitle)}</p>
          </div>
        </div>
        <button class="icon-button" id="refresh-page" aria-label="Refresh page">↻</button>
      </header>
      ${content}
      <nav class="bottom-nav" aria-label="Primary navigation">
        <a class="nav-item ${activeTab === "feed" ? "active" : ""}" href="#/feed${dogQuery}">
          <span class="nav-icon" aria-hidden="true">▦</span><span>Feed</span>
        </a>
        <a class="nav-item add ${activeTab === "upload" ? "active" : ""}" href="#/upload${dogQuery}">
          <span class="nav-icon" aria-hidden="true">＋</span><span>Add Photo</span>
        </a>
        <a class="nav-item ${activeTab === "map" ? "active" : ""}" href="#/map">
          <span class="nav-icon" aria-hidden="true">⌖</span><span>Map</span>
        </a>
      </nav>
    </div>
  `;
}

function attachShellEvents() {
  document.getElementById("refresh-page")?.addEventListener("click", () => route(true));
}

function loadingMarkup(label = "Loading photos…") {
  return `<div class="loading"><div><div class="spinner" aria-hidden="true"></div><div>${escapeHtml(label)}</div></div></div>`;
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
  return `
    <article class="photo-card" id="photo-${escapeHtml(photo.id)}">
      <div class="photo-media">
        <img src="${escapeHtml(photo.image_url)}" alt="Community hot dog crawl photo near ${escapeHtml(photo.place_name)}" loading="lazy" />
      </div>
      <div class="photo-meta">
        <div class="location-line">
          <span class="location-pin" aria-hidden="true">📍</span>
          <div>
            <div class="location-main">${escapeHtml(photo.place_name)}</div>
            <div class="location-sub">${escapeHtml(photo.location_detail || "Charlotte")} · ${escapeHtml(dogLabel(photo))} · ${escapeHtml(formatRelativeTime(photo.created_at))}</div>
          </div>
        </div>
        <button class="like-button ${liked ? "liked" : ""}" data-like-photo="${escapeHtml(photo.id)}" ${liked ? "disabled" : ""} aria-label="${liked ? "Photo liked" : "Like photo"}">
          <span class="heart" aria-hidden="true">${liked ? "♥" : "♡"}</span>
          <span data-like-count>${Number(photo.like_count || 0)}</span>
        </button>
      </div>
    </article>
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
      <main class="page">
        ${demoNotice()}
        ${activeDogMarkup}
        <section class="hero-card">
          <h1>Charlotte, one hot dog at a time.</h1>
          <p>Scan a printed dog, add one photo and a location, then watch the city-wide feed grow.</p>
          <button class="primary-button" data-add-photo>📷 Add your photo</button>
        </section>
        <div class="feed-toolbar">
          <h2>Photo feed</h2>
          <div class="segmented" aria-label="Sort photos">
            <button data-sort="newest" class="${feedSort === "newest" ? "active" : ""}">Newest</button>
            <button data-sort="top" class="${feedSort === "top" ? "active" : ""}">Top</button>
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

    const uploadedId = routeInfo.params.get("uploaded");
    if (uploadedId) {
      window.setTimeout(() => {
        document.getElementById(`photo-${uploadedId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
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

function attachLikeButtons() {
  document.querySelectorAll("[data-like-photo]").forEach((button) => {
    button.addEventListener("click", async () => {
      const photoId = button.dataset.likePhoto;
      button.disabled = true;
      try {
        const result = await likePhoto(photoId);
        button.classList.add("liked");
        button.querySelector(".heart").textContent = "♥";
        if (!result.duplicate) {
          const count = button.querySelector("[data-like-count]");
          count.textContent = String(Number(count.textContent || 0) + 1);
        }
      } catch (error) {
        button.disabled = false;
        showToast(error.message || "Could not like that photo.", "error");
      }
    });
  });
}

async function renderMapPage() {
  destroyMaps();
  app.innerHTML = shell(`<main class="page-wide">${loadingMarkup("Building the map…")}</main>`, "map", "All community photos across Charlotte");
  attachShellEvents();

  try {
    const photos = await getPhotos("newest");
    const content = `
      <main class="page-wide">
        ${demoNotice()}
        <div class="map-shell">
          <div class="map-overlay"><div class="map-pill">📷 ${photos.length} photo${photos.length === 1 ? "" : "s"}</div><div class="map-pill">Charlotte, NC</div></div>
          <div id="photo-map" aria-label="Map showing submitted community photos"></div>
        </div>
      </main>
    `;
    app.innerHTML = shell(content, "map", "All community photos across Charlotte");
    attachShellEvents();
    initializePhotoMap(photos);
  } catch (error) {
    app.innerHTML = shell(`<main class="page"><div class="empty-state"><div class="empty-icon">🗺️</div><h2>Could not load the map</h2><p>${escapeHtml(error.message)}</p></div></main>`, "map");
    attachShellEvents();
  }
}

function initializeBaseMap(elementId, center, zoom) {
  if (!window.L) throw new Error("The map library did not load. Check your internet connection.");
  const map = window.L.map(elementId, { zoomControl: false }).setView(center, zoom);
  window.L.control.zoom({ position: "bottomright" }).addTo(map);
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  return map;
}

function initializePhotoMap(photos) {
  mapInstance = initializeBaseMap("photo-map", config.mapCenter || [35.2271, -80.8431], config.mapZoom || 11);
  const bounds = [];
  photos.forEach((photo) => {
    const latLng = [Number(photo.latitude), Number(photo.longitude)];
    if (!Number.isFinite(latLng[0]) || !Number.isFinite(latLng[1])) return;
    bounds.push(latLng);
    const icon = window.L.divIcon({
      className: "",
      html: `<div class="photo-map-marker"><img src="${escapeHtml(photo.image_url)}" alt="" /></div>`,
      iconSize: [48, 48],
      iconAnchor: [12, 45],
      popupAnchor: [12, -43]
    });
    window.L.marker(latLng, { icon })
      .addTo(mapInstance)
      .bindPopup(`
        <div class="map-popup">
          <img src="${escapeHtml(photo.image_url)}" alt="Community photo near ${escapeHtml(photo.place_name)}" />
          <strong>📍 ${escapeHtml(photo.place_name)}</strong>
          <span>${escapeHtml(dogLabel(photo))} · ♥ ${Number(photo.like_count || 0)}</span>
        </div>
      `);
  });
  if (bounds.length > 1) mapInstance.fitBounds(bounds, { padding: [55, 55], maxZoom: 14 });
  else if (bounds.length === 1) mapInstance.setView(bounds[0], 14);
}

function uploadMarkup() {
  const dog = uploadState.dog;
  const location = uploadState.location;
  const photo = uploadState.preparedPhoto;
  const dogText = dog
    ? dog.printed_number != null ? `Hot Dog #${dog.printed_number}` : dog.public_code
    : uploadState.dogCode ? uploadState.dogCode : "Community upload";

  return `
    <main class="page">
      ${demoNotice()}
      ${testWarning()}
      <div class="active-dog">
        <div><strong>🌭 ${escapeHtml(dogText)}</strong><span>${dog ? `Code ${escapeHtml(dog.public_code)}` : "The photo will not be tied to a known printed dog."}</span></div>
      </div>

      <section class="panel">
        <h2 class="section-heading">1. Choose the location</h2>
        <p class="section-help">Use your current position or search for a Charlotte business, landmark, or address.</p>
        <div class="location-actions">
          <button class="primary-button" id="use-location" ${uploadState.locating ? "disabled" : ""}>${uploadState.locating ? "Finding location…" : "⌖ Use current location"}</button>
          <button class="secondary-button" id="focus-search">⌕ Search for a place</button>
        </div>
        <div class="field" style="margin-top:14px">
          <label for="place-search">Location search</label>
          <div class="search-row">
            <input class="search-input" id="place-search" value="${escapeHtml(uploadState.searchQuery)}" placeholder="Moo & Brew or Plaza Midwood" autocomplete="off" />
            <button class="small-button" id="search-place" ${uploadState.searching ? "disabled" : ""}>${uploadState.searching ? "Searching…" : "Search"}</button>
          </div>
          <span class="section-help" style="margin:0">Search runs only when you press Search. ${escapeHtml(config.geocoderAttribution || "Search data © OpenStreetMap contributors")}.</span>
        </div>
        ${uploadState.searchResults.length ? `<div class="search-results">${uploadState.searchResults.map((result, index) => `
          <button class="search-result" data-search-result="${index}"><strong>${escapeHtml(result.placeName)}</strong><span>${escapeHtml(result.displayName)}</span></button>
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
        <h2 class="section-heading">2. Add one photo</h2>
        <p class="section-help">The browser resizes and re-encodes the image before upload, which removes embedded photo metadata.</p>
        ${photo ? `
          <div class="photo-preview">
            <img src="${escapeHtml(photo.dataUrl)}" alt="Selected photo preview" />
            <button class="small-button" id="remove-photo">Change photo</button>
          </div>
        ` : `
          <div class="upload-drop">
            <label for="photo-input">
              <div class="upload-icon" aria-hidden="true">📸</div>
              <strong>Take or choose a photo</strong>
              <span>JPEG, PNG, WebP, or a phone camera image</span>
            </label>
            <input id="photo-input" type="file" accept="image/*" capture="environment" />
          </div>
        `}
      </section>

      <section class="panel">
        <h2 class="section-heading">3. Publish to the test feed</h2>
        <label class="checkbox-row">
          <input id="photo-consent" type="checkbox" ${uploadState.consent ? "checked" : ""} />
          <span>I have permission to post this photo, including permission from anyone clearly pictured.</span>
        </label>
        <button class="primary-button" id="submit-photo" style="margin-top:16px" ${uploadState.submitting ? "disabled" : ""}>${uploadState.submitting ? "Publishing…" : "Publish photo"}</button>
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
  document.getElementById("photo-input")?.addEventListener("change", handlePhotoInput);
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

async function route(force = false) {
  const routeInfo = getRoute();
  if (routeInfo.segments[0] === "dog" && routeInfo.segments[1]) {
    const code = routeInfo.segments[1].toUpperCase();
    setActiveDog(code);
    navigate(`/feed?dog=${encodeURIComponent(code)}`);
    return;
  }

  if (routeInfo.path === "/map") {
    await renderMapPage();
    return;
  }
  if (routeInfo.path === "/upload") {
    await renderUpload(routeInfo, force);
    return;
  }
  await renderFeed(routeInfo);
}

window.addEventListener("hashchange", () => route());
window.addEventListener("DOMContentLoaded", () => {
  if (!window.location.hash) window.location.hash = "#/feed";
  else route();
});
