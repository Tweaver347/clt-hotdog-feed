import { config, escapeHtml } from "./utils.js";

const app = document.getElementById("app");
let photos = [];
let reports = [];
let activeTab = "visible";
let sortMode = "reports";

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

function announcementForm(item) {
  const current = item ?? {};
  const local = (value) => value ? new Date(value).toISOString().slice(0, 16) : "";
  return `
    <section class="moderator-panel">
      <div class="moderator-section-heading">
        <div><p class="moderator-eyebrow">Site-wide popup</p><h2>Current announcement</h2></div>
        <button class="secondary-button" type="button" data-clear-announcement ${current.id ? "" : "disabled"}>Clear</button>
      </div>
      <form id="announcement-form" class="moderator-form">
        <label>Title<input name="title" maxlength="100" required value="${escapeHtml(current.title || "")}" /></label>
        <label>Body<textarea name="body" maxlength="600" required>${escapeHtml(current.body || "")}</textarea></label>
        <label>Optional image URL<input name="image_url" type="url" value="${escapeHtml(current.image_url || "")}" placeholder="https://..." /></label>
        <div class="moderator-form-grid">
          <label>Start time<input name="starts_at" type="datetime-local" required value="${local(current.starts_at)}" /></label>
          <label>Expiration time<input name="expires_at" type="datetime-local" required value="${local(current.expires_at)}" /></label>
        </div>
        <button class="primary-button" type="submit">Publish announcement</button>
        <p class="moderator-help">Visitors see it once per device. Editing creates a new announcement ID so dismissed devices see the new version.</p>
      </form>
    </section>
  `;
}

async function loadAnnouncement() {
  const rows = await api("announcements?select=*&order=updated_at.desc&limit=1");
  return rows?.[0] || null;
}

async function render() {
  const announcement = await loadAnnouncement().catch(() => null);
  const list = sortedPhotos();
  app.innerHTML = `
    <main class="moderator-page">
      <header class="moderator-header">
        <div><p class="moderator-eyebrow">Unlisted event tools</p><h1>CLT Hot Dog Feed Moderator</h1><p>Review reports, hide or restore photos, and publish one timed site announcement.</p></div>
        <a class="secondary-button" href="/">Open public site</a>
      </header>
      ${announcementForm(announcement)}
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
  `;
  attachEvents();
}

async function refresh() {
  if (!config.supabaseUrl || !config.supabaseAnonKey) throw new Error("Supabase is not configured.");
  [photos, reports] = await Promise.all([
    api("photos?select=id,image_path,place_name,like_count,created_at,status,hotdogs(printed_number)&order=created_at.desc&limit=500"),
    api("reports?select=id,photo_id,reason,created_at&order=created_at.desc&limit=2000")
  ]);
  await render();
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
  document.getElementById("announcement-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startsAt = new Date(form.get("starts_at"));
    const expiresAt = new Date(form.get("expires_at"));
    if (!(expiresAt > startsAt)) return alert("Expiration must be after the start time.");
    const payload = {
      title: String(form.get("title")).trim(),
      body: String(form.get("body")).trim(),
      image_url: String(form.get("image_url") || "").trim() || null,
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString()
    };
    try {
      await api("announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(payload)
      });
      await render();
      alert("Announcement published.");
    } catch (error) { alert(error.message); }
  });
  document.querySelector("[data-clear-announcement]")?.addEventListener("click", async () => {
    if (!confirm("Clear all announcements?")) return;
    try {
      await api("announcements?id=not.is.null", { method: "DELETE", headers: { Prefer: "return=minimal" } });
      await render();
    } catch (error) { alert(error.message); }
  });
}

app.innerHTML = `<main class="moderator-page"><div class="moderator-loading">Loading moderator tools…</div></main>`;
refresh().catch((error) => {
  app.innerHTML = `<main class="moderator-page"><div class="moderator-error"><h1>Moderator tools could not load</h1><p>${escapeHtml(error.message)}</p><p>Run the included Supabase migration and confirm your config values.</p></div></main>`;
});
