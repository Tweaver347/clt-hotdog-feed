import { config } from "./utils.js";

const moderatorPath = String(config.moderatorPath || "/moderator-8f3c2a").replace(/\/$/, "");
const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
const isModerator = currentPath === moderatorPath;
const isRewind = currentPath === "/rewind";

async function importPublicApp() {
  // app.js historically initializes from a DOMContentLoaded listener. Because
  // it is now loaded through a dynamic import, that event can fire before the
  // module finishes downloading, leaving #app empty. During the import, make
  // late DOMContentLoaded listeners run immediately once the DOM is ready.
  const nativeAddEventListener = window.addEventListener;

  window.addEventListener = function patchedAddEventListener(type, listener, options) {
    if (type === "DOMContentLoaded" && document.readyState !== "loading") {
      const event = new Event("DOMContentLoaded");
      queueMicrotask(() => {
        if (typeof listener === "function") listener.call(window, event);
        else listener?.handleEvent?.(event);
      });
      return;
    }

    return nativeAddEventListener.call(window, type, listener, options);
  };

  try {
    await import("./app.js");
  } finally {
    window.addEventListener = nativeAddEventListener;
  }
}

if (isRewind) {
  await import("./rewind.js?v=rewind-1");
  await import("./rewind-overrides.js?v=rewind-1");
} else if (!isModerator) {
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

  await importPublicApp();
  const { initializeAnnouncements, scrubVisibleHotdogCodes } = await import("./public-enhancements.js");
  initializeAnnouncements();
  scrubVisibleHotdogCodes();
  await import("./live-camera-only.js?v=camera-only-1");
  await import("./public-publish-flow.js?v=publish-flow-1");
} else {
  document.documentElement.classList.add("moderator-mode");
  document.body.classList.add("moderator-mode");
  document.title = "CLT Hot Dog Feed Moderator";
  await import("./moderator.js?v=moderation-2");
  await import("./moderator-rewind.js?v=rewind-1");
}
