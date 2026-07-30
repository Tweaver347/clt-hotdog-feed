import { preparePhoto } from "./image.js";
import { config, escapeHtml } from "./utils.js";

const app = document.getElementById("app");
let photos = [];
let reports = [];
let announcement = null;
let activeTab = "visible";
let sortMode = "reports";
let announcementEditorOpen = false;
let preparedAnnouncementPhoto = null;
let removeAnnouncementPhoto = false;

document.documentElement.classList.add("moderator-mode");
document.body.classList.add("moderator-mode");

function headers(extra = {}) {
  return {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`,
    ...extra
  };
}

async function api(path, options = {}) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: headers(options.headers || {})
  });
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try { message = (await response.json()).message || message; } catch {}
    throw new Error(message);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function reportCount(photoId) {
  return reports.filter((report) => report.photo_id === photoId).length;
}

function reportReasons(photoId) {
  const counts = new Map();
  reports.filter((report) => report.photo_id === photoId).forEach((report) => {
    counts.set(report.reason, (counts.get(report.reason) || 0) + 1);
  });
  return [...counts.entries()].map(([reason, count]) => `${reason.replaceAll("_", " ")} (${count})`).join(" · ") || "No reports";
}

function imageUrl(photo) {
  return `${config.supabaseUrl}/storage/v1/object/public/photos/${photo.image_path}`;
}

function sortedPhotos() {
  const filtered = photos.filter((photo) => photo.status === activeTab);
  return filtered.sort((a, b) => {
    if (sortMode === "reports") return reportCount(b.id) - reportCount(a.id) || new Date(b.created_at) - new Date(a.created_at);
    if (sortMode === "likes") return Number(b.like_count || 0) - Number(a.like_count || 0);
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

function photoCard(photo) {
  const count = reportCount(photo.id);
  const dogNumber = photo.hotdogs?.printed_number;
  return `
    <article class="moderator-photo-card">
      <img src="${escapeHtml(imageUrl(photo))}" alt="Photo submitted near ${escapeHtml(photo.place_name)}" loading="lazy" />
      <div class="moderator-photo-copy">
        <div class="moderator-card-heading">
          <div><strong>${escapeHtml(photo.place_name)}</strong><span>${dogNumber != null ? `Hot Dog #${dogNumber}` : "Community upload"}</span></div>
          <span class="report-count ${count ? "has-reports" : ""}">${count} report${count === 1 ? "" : "s"}</span>
        </div>
        <p>${escapeHtml(reportReasons(photo.id))}</p>
        <small>${new Date(photo.created_at).toLocaleString()} · ${Number(photo.like_count || 0)} likes</small>
        <button class="${photo.status === "visible" ? "danger-button" : "secondary-button"}" type="button" data-photo-status="${photo.status === "visible" ? "hidden" : "visible"}" data-photo-id="${escapeHtml(photo.id)}">
          ${photo.status === "visible" ? "Hide from public feed" : "Restore to public feed"}
        </button>
      </div>
    </article>
  `;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function dateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function newAnnouncementSchedule() {
  const startsAt = new Date();
  startsAt.setSeconds(0, 0);
  startsAt.setMinutes(Math.ceil(startsAt.getMinutes() / 15) * 15);
  const expiresAt = new Date(startsAt.getTime() + 6 * 60 * 60 * 1000);
  return { startsAt, expiresAt };
}

function announcementStatus(item) {
  if (!item) return { label: "None published", className: "neutral" };
  const now = Date.now();
  const starts = new Date(item.starts_at).getTime();
  const expires = new Date(item.expires_at).getTime();
  if (now < starts) return { label: "Scheduled", className: "scheduled" };
  if (now >= expires) return { label: "Expired", className: "expired" };
  return { label: "Live now", className: "live" };
}

function announcementSummaryMarkup(item) {
  if (!item) {
    return `
      <section class="moderator-panel announcement-summary-panel">
        <div class="announcement-empty-copy">
          <div><p class="moderator-eyebrow">Site-wide popup</p><h2>No announcement is published</h2><p>Create a timed message that visitors will see once per device.</p></div>
          <button class="primary-button" type="button" data-open-announcement>Create announcement</button>
        </div>
      </section>
    `;
  }

  const status = announcementStatus(item);
  return `
    <section class="moderator-panel announcement-summary-panel">
      <div class="moderator-section-heading">
        <div><p class="moderator-eyebrow">Site-wide popup</p><h2>Current announcement</h2></div>
        <span class="announcement-status ${status.className}">${status.label}</span>
      </div>
      <div class="announcement-summary">
        ${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="" />` : ""}
        <div class="announcement-summary-copy">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.body)}</p>
          <small>${new Date(item.starts_at).toLocaleString()} – ${new Date(item.expires_at).toLocaleString()}</small>
        </div>
      </div>
      <div class="announcement-summary-actions">
        <button class="primary-button" type="button" data-open-announcement>Edit announcement</button>
        <button class="secondary-button" type="button" data-clear-announcement>Clear announcement</button>
      </div>
    </section>
  `;
}

function announcementEditorMarkup(item) {
  if (!announcementEditorOpen) return "";
  const schedule = item
    ? { startsAt: new Date(item.starts_at), expiresAt: new Date(item.expires_at) }
    : newAnnouncementSchedule();
  const previewUrl = preparedAnnouncementPhoto?.dataUrl || (!removeAnnouncementPhoto ? item?.image_url : "");

  return `
    <div class="moderator-modal-layer" role="presentation">
      <div class="moderator-modal-backdrop" data-close-announcement></div>
      <section class="moderator-modal" role="dialog" aria-modal="true" aria-labelledby="announcement-editor-title">
        <div class="moderator-modal-header">
          <div><p class="moderator-eyebrow">Site-wide popup</p><h2 id="announcement-editor-title">${item ? "Edit announcement" : "Create announcement"}</h2></div>
          <button class="moderator-close-button" type="button" data-close-announcement aria-label="Close announcement editor">×</button>
        </div>
        <form id="announcement-form" class="moderator-form">
          <label>Title<input id="announcement-title" name="title" maxlength="100" required value="${escapeHtml(item?.title || "")}" /></label>
          <label>Body<textarea name="body" maxlength="600" required>${escapeHtml(item?.body || "")}</textarea></label>

          <fieldset class="announcement-photo-fieldset">
            <legend>Optional photo</legend>
            <div class="announcement-photo-actions">
              <button class="secondary-button" type="button" data-pick-announcement-photo="upload">Upload photo</button>
              <button class="secondary-button" type="button" data-pick-announcement-photo="camera">Take photo</button>
              <button class="text-button" type="button" data-remove-announcement-photo ${previewUrl ? "" : "hidden"}>Remove photo</button>
            </div>
            <input id="announcement-upload-input" class="visually-hidden-file" type="file" accept="image/jpeg,image/png,image/webp" />
            <input id="announcement-camera-input" class="visually-hidden-file" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" />
            <p class="moderator-help">Images are resized and compressed before upload. Maximum stored size is 2 MB.</p>
            <div class="announcement-photo-preview ${previewUrl ? "has-image" : ""}" id="announcement-photo-preview">
              ${previewUrl ? `<img src="${escapeHtml(previewUrl)}" alt="Selected announcement preview" />` : `<span>No photo selected</span>`}
            </div>
          </fieldset>

          <fieldset class="announcement-schedule-fieldset">
            <legend>Display window</legend>
            <div class="moderator-schedule-grid">
              <label>Start date<input name="starts_on" type="date" required value="${dateInputValue(schedule.startsAt)}" /></label>
              <label>Start time<input name="starts_time" type="time" step="60" required value="${timeInputValue(schedule.startsAt)}" /></label>
              <label>Expiration date<input name="expires_on" type="date" required value="${dateInputValue(schedule.expiresAt)}" /></label>
              <label>Expiration time<input name="expires_time" type="time" step="60" required value="${timeInputValue(schedule.expiresAt)}" /></label>
            </div>
            <p class="moderator-help">Times use the timezone of this device.</p>
          </fieldset>

          <div class="moderator-modal-actions">
            <button class="secondary-button" type="button" data-close-announcement>Cancel</button>
            <button class="primary-button" type="submit" data-publish-announcement>${item ? "Publish updated announcement" : "Publish announcement"}</button>
          </div>
          <p class="moderator-help">A newly published version receives a new ID, so people who dismissed the previous version can see the update.</p>
        </form>
      </section>
    </div>
  `;
}

function render() {
  const list = sortedPhotos();
  document.body.classList.toggle("moderator-modal-open", announcementEditorOpen);
  app.innerHTML = `
    <main class="moderator-page">
      <header class="moderator-header">
        <div><p class="moderator-eyebrow">Unlisted event tools</p><h1>CLT Hot Dog Feed Moderator</h1><p>Review reports, hide or restore photos, and publish one timed site announcement.</p></div>
        <a class="secondary-button" href="/">Open public site</a>
      </header>
      ${announcementSummaryMarkup(announcement)}
      <section class="moderator-panel">
        <div class="moderator-toolbar">
          <div class="moderator-tabs" role="tablist">
            <button class="${activeTab === "visible" ? "active" : ""}" data-tab="visible">Visible (${photos.filter((p) => p.status === "visible").length})</button>
            <button class="${activeTab === "hidden" ? "active" : ""}" data-tab="hidden">Hidden / resolved (${photos.filter((p) => p.status === "hidden").length})</button>
          </div>
          <label>Sort<select id="moderator-sort"><option value="reports" ${sortMode === "reports" ? "selected" : ""}>Most reported</option><option value="newest" ${sortMode === "newest" ? "selected" : ""}>Newest</option><option value="likes" ${sortMode === "likes" ? "selected" : ""}>Most liked</option></select></label>
        </div>
        <div class="moderator-grid">${list.length ? list.map(photoCard).join("") : `<div class="moderator-empty">No ${activeTab} photos.</div>`}</div>
      </section>
    </main>
    ${announcementEditorMarkup(announcement)}
  `;
  attachEvents();
  if (announcementEditorOpen) window.setTimeout(() => document.getElementById("announcement-title")?.focus(), 0);
}

async function refresh() {
  if (!config.supabaseUrl || !config.supabaseAnonKey) throw new Error("Supabase is not configured.");
  [photos, reports, announcement] = await Promise.all([
    api("photos?select=id,image_path,place_name,like_count,created_at,status,hotdogs(printed_number)&order=created_at.desc&limit=500"),
    api("reports?select=id,photo_id,reason,created_at&order=created_at.desc&limit=2000"),
    api("announcements?select=*&order=updated_at.desc&limit=1").then((rows) => rows?.[0] || null)
  ]);
  render();
}

function openAnnouncementEditor() {
  preparedAnnouncementPhoto = null;
  removeAnnouncementPhoto = false;
  announcementEditorOpen = true;
  render();
}

function closeAnnouncementEditor() {
  announcementEditorOpen = false;
  preparedAnnouncementPhoto = null;
  removeAnnouncementPhoto = false;
  render();
}

function updatePhotoPreview() {
  const preview = document.getElementById("announcement-photo-preview");
  if (!preview) return;
  const previewUrl = preparedAnnouncementPhoto?.dataUrl || (!removeAnnouncementPhoto ? announcement?.image_url : "");
  preview.classList.toggle("has-image", Boolean(previewUrl));
  preview.innerHTML = previewUrl
    ? `<img src="${escapeHtml(previewUrl)}" alt="Selected announcement preview" />`
    : `<span>No photo selected</span>`;
  const removeButton = document.querySelector("[data-remove-announcement-photo]");
  if (removeButton) removeButton.hidden = !previewUrl;
}

async function selectAnnouncementPhoto(file, input) {
  if (!file) return;
  const triggerButtons = [...document.querySelectorAll("[data-pick-announcement-photo]")];
  triggerButtons.forEach((button) => { button.disabled = true; });
  try {
    preparedAnnouncementPhoto = await preparePhoto(file);
    removeAnnouncementPhoto = false;
    updatePhotoPreview();
  } catch (error) {
    alert(error.message);
  } finally {
    if (input) input.value = "";
    triggerButtons.forEach((button) => { button.disabled = false; });
  }
}

function randomObjectId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function uploadAnnouncementPhoto(prepared) {
  const dateFolder = new Date().toISOString().slice(0, 10);
  const objectPath = `announcements/${dateFolder}/${randomObjectId()}.jpg`;
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/photos/${objectPath}`, {
    method: "POST",
    headers: headers({
      "Content-Type": "image/jpeg",
      "x-upsert": "false"
    }),
    body: prepared.blob
  });
  if (!response.ok) {
    let message = "Announcement photo upload failed.";
    try {
      const detail = await response.json();
      message = detail.message || detail.error || message;
    } catch {}
    throw new Error(message);
  }
  return `${config.supabaseUrl}/storage/v1/object/public/photos/${objectPath}`;
}

function combineLocalDateTime(dateValue, timeValue) {
  const value = new Date(`${dateValue}T${timeValue}`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function attachEvents() {
  document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => {
    activeTab = button.dataset.tab;
    render();
  }));
  document.getElementById("moderator-sort")?.addEventListener("change", (event) => {
    sortMode = event.target.value;
    render();
  });
  document.querySelectorAll("[data-photo-status]").forEach((button) => button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await api(`photos?id=eq.${encodeURIComponent(button.dataset.photoId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ status: button.dataset.photoStatus })
      });
      await refresh();
    } catch (error) {
      alert(error.message);
      button.disabled = false;
    }
  }));

  document.querySelectorAll("[data-open-announcement]").forEach((button) => button.addEventListener("click", openAnnouncementEditor));
  document.querySelectorAll("[data-close-announcement]").forEach((button) => button.addEventListener("click", closeAnnouncementEditor));
  document.querySelectorAll("[data-pick-announcement-photo]").forEach((button) => button.addEventListener("click", () => {
    const inputId = button.dataset.pickAnnouncementPhoto === "camera" ? "announcement-camera-input" : "announcement-upload-input";
    document.getElementById(inputId)?.click();
  }));
  document.getElementById("announcement-upload-input")?.addEventListener("change", (event) => selectAnnouncementPhoto(event.target.files?.[0], event.target));
  document.getElementById("announcement-camera-input")?.addEventListener("change", (event) => selectAnnouncementPhoto(event.target.files?.[0], event.target));
  document.querySelector("[data-remove-announcement-photo]")?.addEventListener("click", () => {
    preparedAnnouncementPhoto = null;
    removeAnnouncementPhoto = true;
    updatePhotoPreview();
  });

  document.getElementById("announcement-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const startsAt = combineLocalDateTime(form.get("starts_on"), form.get("starts_time"));
    const expiresAt = combineLocalDateTime(form.get("expires_on"), form.get("expires_time"));
    if (!startsAt || !expiresAt) return alert("Choose both a date and time for the start and expiration.");
    if (!(expiresAt > startsAt)) return alert("Expiration must be after the start time.");

    const publishButton = formElement.querySelector("[data-publish-announcement]");
    if (publishButton) {
      publishButton.disabled = true;
      publishButton.textContent = preparedAnnouncementPhoto ? "Uploading photo…" : "Publishing…";
    }

    try {
      let imageUrl = removeAnnouncementPhoto ? null : announcement?.image_url || null;
      if (preparedAnnouncementPhoto) imageUrl = await uploadAnnouncementPhoto(preparedAnnouncementPhoto);
      const payload = {
        title: String(form.get("title")).trim(),
        body: String(form.get("body")).trim(),
        image_url: imageUrl,
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString()
      };
      await api("announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(payload)
      });
      announcementEditorOpen = false;
      preparedAnnouncementPhoto = null;
      removeAnnouncementPhoto = false;
      await refresh();
      alert("Announcement published.");
    } catch (error) {
      alert(error.message);
      if (publishButton) {
        publishButton.disabled = false;
        publishButton.textContent = announcement ? "Publish updated announcement" : "Publish announcement";
      }
    }
  });

  document.querySelector("[data-clear-announcement]")?.addEventListener("click", async () => {
    if (!confirm("Clear the current announcement?")) return;
    try {
      await api("announcements?id=not.is.null", { method: "DELETE", headers: { Prefer: "return=minimal" } });
      announcement = null;
      await refresh();
    } catch (error) { alert(error.message); }
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && announcementEditorOpen) closeAnnouncementEditor();
});

app.innerHTML = `<main class="moderator-page"><div class="moderator-loading">Loading moderator tools…</div></main>`;
refresh().catch((error) => {
  app.innerHTML = `<main class="moderator-page"><div class="moderator-error"><h1>Moderator tools could not load</h1><p>${escapeHtml(error.message)}</p><p>Confirm the Supabase migration and deployment configuration.</p></div></main>`;
});
