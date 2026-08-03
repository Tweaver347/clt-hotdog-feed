const FEED_REWIND_STYLE_ID = "feed-rewind-link-styles";

function injectStyles() {
  if (document.getElementById(FEED_REWIND_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = FEED_REWIND_STYLE_ID;
  style.textContent = `
    .feed-hero .feed-rewind-link {
      margin-top: 10px;
      text-decoration: none;
    }
  `;
  document.head.appendChild(style);
}

function addRewindLink(root = document) {
  const hero = root?.matches?.(".feed-hero")
    ? root
    : root?.querySelector?.(".feed-hero") || document.querySelector(".feed-hero");
  if (!hero || hero.querySelector("[data-open-rewind]")) return;

  const link = document.createElement("a");
  link.className = "secondary-button feed-rewind-link";
  link.href = "/rewind";
  link.dataset.openRewind = "true";
  link.innerHTML = '<span aria-hidden="true">↻</span> Watch the crawl rewind';

  const addPhotoButton = hero.querySelector("[data-add-photo]");
  if (addPhotoButton) addPhotoButton.insertAdjacentElement("afterend", link);
  else hero.appendChild(link);
}

injectStyles();
addRewindLink(document);

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) addRewindLink(node);
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });
