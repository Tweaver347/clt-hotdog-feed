import { config, escapeHtml } from "./utils.js";

const DISMISSED_KEY = "clt-hotdog-dismissed-announcements";

function headers() {
  return {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`
  };
}

function dismissedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function dismissAnnouncement(id) {
  const ids = dismissedIds();
  ids.add(id);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids].slice(-30)));
}

function announcementMarkup(item) {
  return `
    <div class="site-announcement-backdrop" data-announcement-backdrop></div>
    <aside class="site-announcement" role="dialog" aria-modal="true" aria-labelledby="site-announcement-title">
      ${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="" />` : ""}
      <div class="site-announcement-copy">
        <p class="site-announcement-kicker">Hot Dog Crawl Update</p>
        <h2 id="site-announcement-title">${escapeHtml(item.title)}</h2>
        <p>${escapeHtml(item.body)}</p>
        <button class="primary-button" type="button" data-dismiss-announcement>Got it</button>
      </div>
    </aside>
  `;
}

export async function initializeAnnouncements() {
  if (!config.supabaseUrl || !config.supabaseAnonKey) return;
  try {
    const now = new Date().toISOString();
    const query = new URLSearchParams({
      select: "id,title,body,image_url,starts_at,expires_at,updated_at",
      starts_at: `lte.${now}`,
      expires_at: `gt.${now}`,
      order: "updated_at.desc",
      limit: "1"
    });
    const response = await fetch(`${config.supabaseUrl}/rest/v1/announcements?${query}`, { headers: headers() });
    if (!response.ok) return;
    const [item] = await response.json();
    if (!item || dismissedIds().has(item.id)) return;

    const wrapper = document.createElement("div");
    wrapper.className = "site-announcement-layer";
    wrapper.innerHTML = announcementMarkup(item);
    document.body.appendChild(wrapper);

    const close = () => {
      dismissAnnouncement(item.id);
      wrapper.remove();
    };
    wrapper.querySelector("[data-dismiss-announcement]")?.addEventListener("click", close);
    wrapper.querySelector("[data-announcement-backdrop]")?.addEventListener("click", close);
    wrapper.querySelector("button")?.focus();
  } catch {
    // Announcements should never prevent the public app from loading.
  }
}

function activeCode() {
  return localStorage.getItem("clt-hotdog-active-dog") || "";
}

function activeNumber() {
  try {
    return JSON.parse(localStorage.getItem("clt-hotdog-active-dog-details") || "null")?.printed_number ?? null;
  } catch {
    return null;
  }
}

function scrubNode(root = document) {
  const scope = root?.querySelectorAll ? root : document;
  scope.querySelectorAll?.(".milestone-panel").forEach((panel) => panel.remove());

  const code = activeCode();
  if (!code) return;
  const number = activeNumber();
  const replacement = number != null ? `Hot Dog #${number}` : "this hot dog";
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (!node.nodeValue?.includes(code)) continue;
    node.nodeValue = node.nodeValue
      .replaceAll(`code ${code}`, replacement)
      .replaceAll(`Dog ${code}`, replacement)
      .replaceAll(code, replacement);
  }
}

export function scrubVisibleHotdogCodes() {
  scrubNode(document.body);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) scrubNode(node.parentNode || document.body);
        else if (node.nodeType === Node.ELEMENT_NODE) scrubNode(node);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
