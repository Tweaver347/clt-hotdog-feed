import { config } from "./utils.js";

const moderatorPath = String(config.moderatorPath || "/moderator-8f3c2a").replace(/\/$/, "");
const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
const isModerator = currentPath === moderatorPath;

if (!isModerator) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input?.url;
    if (url && /\/rest\/v1\/photos\?/.test(url) && (!init?.method || init.method === "GET")) {
      const parsed = new URL(url, window.location.origin);
      if (!parsed.searchParams.has("status")) parsed.searchParams.set("status", "eq.visible");
      input = typeof input === "string" ? parsed.toString() : new Request(parsed.toString(), input);
    }
    return originalFetch(input, init);
  };

  await import("./app.js");
  const { initializeAnnouncements, scrubVisibleHotdogCodes } = await import("./public-enhancements.js");
  initializeAnnouncements();
  scrubVisibleHotdogCodes();
} else {
  document.title = "CLT Hot Dog Feed Moderator";
  await import("./moderator.js");
}
