import { config, escapeHtml } from "./utils.js";

const DEFAULT_STATS = [
  { emoji: "🌭", value: "427", label: "hot dogs demolished" },
  { emoji: "🐕", value: "36", label: "dogs in attendance" },
  { emoji: "🟡", value: "1,284", label: "mustard packets sacrificed" }
];

let settings = null;
let saving = false;

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

function styles() {
  if (document.getElementById("moderator-rewind-styles")) return;
  const style = document.createElement("style");
  style.id = "moderator-rewind-styles";
  style.textContent = `
    .rewind-settings-grid { display: grid; gap: 12px; }
    .rewind-stat-editor { display: grid; grid-template-columns: 72px 110px minmax(0, 1fr); gap: 10px; align-items: end; padding: 12px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface-muted); }
    .rewind-stat-editor label { display: grid; gap: 6px; font-size: 13px; font-weight: 750; }
    .rewind-stat-editor input, .rewind-copy-grid input, .rewind-copy-grid textarea { width: 100%; min-height: 46px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--text); font: inherit; }
    .rewind-copy-grid { display: grid; gap: 12px; margin-top: 16px; }
    .rewind-copy-grid label { display: grid; gap: 7px; font-weight: 750; }
    .rewind-copy-grid textarea { min-height: 100px; resize: vertical; }
    .rewind-settings-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
    .rewind-settings-actions .primary-button, .rewind-settings-actions .secondary-button { width: auto; }
    .rewind-settings-status { margin: 10px 0 0; color: var(--muted); font-size: 13px; }
    @media (max-width: 620px) { .rewind-stat-editor { grid-template-columns: 70px 1fr; } .rewind-stat-editor label:last-child { grid-column: 1 / -1; } }
  `;
  document.head.appendChild(style);
}

function panelMarkup() {
  const stats = Array.isArray(settings?.fun_stats) && settings.fun_stats.length ? settings.fun_stats : DEFAULT_STATS;
  return `
    <section class="moderator-panel" id="rewind-settings-panel">
      <div class="moderator-section-heading">
        <div>
          <p class="moderator-eyebrow">Post-event memory page</p>
          <h2>Crawl rewind</h2>
          <p>Edit the intentionally unofficial fun stats and closing message shown at <strong>/rewind</strong>.</p>
        </div>
        <a class="secondary-button" href="/rewind" target="_blank" rel="noopener">Open rewind</a>
      </div>
      <form id="rewind-settings-form">
        <div class="rewind-settings-grid">
          ${stats.slice(0, 3).map((stat, index) => `
            <div class="rewind-stat-editor">
              <label>Emoji<input name="emoji_${index}" maxlength="8" value="${escapeHtml(stat.emoji || "🌭")}" /></label>
              <label>Number<input name="value_${index}" maxlength="20" required value="${escapeHtml(String(stat.value || ""))}" /></label>
              <label>Label<input name="label_${index}" maxlength="80" required value="${escapeHtml(stat.label || "")}" /></label>
            </div>
          `).join("")}
        </div>
        <div class="rewind-copy-grid">
          <label>Closing headline<input name="closing_title" maxlength="120" required value="${escapeHtml(settings?.closing_title || "Thanks for making the crawl legendary.")}" /></label>
          <label>Closing message<textarea name="closing_body" maxlength="500" required>${escapeHtml(settings?.closing_body || "Charlotte showed up, passed the hot dogs around, and made one very strange little piece of history together.")}</textarea></label>
        </div>
        <div class="rewind-settings-actions">
          <button class="primary-button" type="submit" ${saving ? "disabled" : ""}>${saving ? "Saving…" : "Save rewind settings"}</button>
          <button class="secondary-button" type="button" data-reset-rewind>Reset joke defaults</button>
        </div>
        <p class="rewind-settings-status" id="rewind-settings-status" aria-live="polite">These numbers are meant to be fun, not factual.</p>
      </form>
    </section>
  `;
}

function insertPanel() {
  const page = document.querySelector(".moderator-page");
  if (!page || document.getElementById("rewind-settings-panel")) return;
  const firstPanel = page.querySelector(".moderator-panel");
  if (firstPanel) firstPanel.insertAdjacentHTML("afterend", panelMarkup());
  else page.insertAdjacentHTML("beforeend", panelMarkup());
  attachEvents();
}

async function loadSettings() {
  try {
    const rows = await api("rewind_settings?select=fun_stats,closing_title,closing_body&id=eq.1&limit=1");
    settings = rows?.[0] || null;
  } catch {
    settings = null;
  }
  insertPanel();
}

async function saveSettings(event) {
  event.preventDefault();
  if (saving) return;
  const form = event.currentTarget;
  const data = new FormData(form);
  const funStats = [0, 1, 2].map((index) => ({
    emoji: String(data.get(`emoji_${index}`) || "🌭").trim() || "🌭",
    value: String(data.get(`value_${index}`) || "").trim(),
    label: String(data.get(`label_${index}`) || "").trim()
  }));
  if (funStats.some((stat) => !stat.value || !stat.label)) {
    document.getElementById("rewind-settings-status").textContent = "Each fun stat needs a number and label.";
    return;
  }
  saving = true;
  const button = form.querySelector('button[type="submit"]');
  if (button) { button.disabled = true; button.textContent = "Saving…"; }
  try {
    const payload = {
      fun_stats: funStats,
      closing_title: String(data.get("closing_title") || "").trim(),
      closing_body: String(data.get("closing_body") || "").trim(),
      updated_at: new Date().toISOString()
    };
    const rows = await api("rewind_settings?id=eq.1&select=fun_stats,closing_title,closing_body", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(payload)
    });
    settings = rows?.[0] || payload;
    document.getElementById("rewind-settings-status").textContent = "Rewind settings saved.";
  } catch (error) {
    document.getElementById("rewind-settings-status").textContent = error.message;
  } finally {
    saving = false;
    if (button) { button.disabled = false; button.textContent = "Save rewind settings"; }
  }
}

function resetDefaults() {
  DEFAULT_STATS.forEach((stat, index) => {
    const emoji = document.querySelector(`[name="emoji_${index}"]`);
    const value = document.querySelector(`[name="value_${index}"]`);
    const label = document.querySelector(`[name="label_${index}"]`);
    if (emoji) emoji.value = stat.emoji;
    if (value) value.value = stat.value;
    if (label) label.value = stat.label;
  });
}

function attachEvents() {
  document.getElementById("rewind-settings-form")?.addEventListener("submit", saveSettings);
  document.querySelector("[data-reset-rewind]")?.addEventListener("click", resetDefaults);
}

styles();
loadSettings();

const observer = new MutationObserver(() => {
  if (!document.getElementById("rewind-settings-panel")) insertPanel();
});
observer.observe(document.body, { childList: true, subtree: true });
