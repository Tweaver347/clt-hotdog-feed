const REWIND_PHOTO_LAYOUT_STYLE_ID = "rewind-photo-layout-styles";

function injectPhotoLayoutStyles() {
  if (document.getElementById(REWIND_PHOTO_LAYOUT_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = REWIND_PHOTO_LAYOUT_STYLE_ID;
  style.textContent = `
    body.rewind-memory-mode {
      background: #000 !important;
    }

    body.rewind-memory-mode::before,
    body.rewind-memory-mode::after,
    body.rewind-memory-mode #app::before,
    body.rewind-memory-mode #app::after,
    body.rewind-memory-mode .rewind::before,
    body.rewind-memory-mode .rewind::after,
    body.rewind-memory-mode .food-pattern,
    body.rewind-memory-mode .food-pattern-slow,
    body.rewind-memory-mode .food-pattern-fast {
      display: none !important;
      content: none !important;
      background: none !important;
    }

    body.rewind-memory-mode .rewind-photo-slide {
      z-index: 10;
      isolation: isolate;
      padding: 0;
      background: #000;
    }

    body.rewind-memory-mode .rewind-photo-slide::before,
    body.rewind-memory-mode .rewind-photo-slide::after {
      display: none !important;
      content: none !important;
    }

    body.rewind-memory-mode .rewind-photo {
      z-index: 1;
      opacity: 1 !important;
      filter: none !important;
      mix-blend-mode: normal !important;
      background: #000;
    }

    body.rewind-memory-mode .rewind-photo-shade {
      z-index: 2;
      background: linear-gradient(
        180deg,
        rgba(0, 0, 0, .24) 0,
        rgba(0, 0, 0, 0) 24%,
        rgba(0, 0, 0, 0) 74%,
        rgba(0, 0, 0, .30) 100%
      );
      pointer-events: none;
    }

    body.rewind-memory-mode .rewind-photo-copy {
      position: absolute;
      z-index: 4;
      inset: calc(48px + env(safe-area-inset-top)) 12px calc(12px + env(safe-area-inset-bottom));
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 14px;
      text-align: left;
      pointer-events: none;
    }

    body.rewind-memory-mode .rewind-photo-title-card {
      width: 100%;
      padding: 14px 16px 15px;
      border: 1px solid rgba(255, 255, 255, .22);
      border-radius: 18px;
      background: rgba(20, 15, 13, .84);
      box-shadow: 0 8px 28px rgba(0, 0, 0, .24);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    }

    body.rewind-memory-mode .rewind-photo-title-card .rewind-kicker {
      margin: 0 0 5px;
      font-size: 12px;
    }

    body.rewind-memory-mode .rewind-photo-title-card h2 {
      margin: 0;
      font-size: clamp(26px, 7vw, 36px);
      line-height: 1.04;
    }

    body.rewind-memory-mode .rewind-photo-title-card p {
      margin: 6px 0 0;
      color: rgba(255, 255, 255, .84);
      font-size: 14px;
      line-height: 1.35;
    }

    body.rewind-memory-mode .rewind-photo-actions {
      position: relative;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      width: 100%;
      margin: auto 0 0;
      pointer-events: auto;
    }

    body.rewind-memory-mode .rewind-photo-actions .rewind-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-width: 0;
      min-height: 50px;
      padding: 11px 8px;
      border-radius: 16px;
      background: rgba(20, 15, 13, .88);
      font-size: clamp(13px, 3.5vw, 15px);
      line-height: 1.15;
      text-align: center;
      white-space: normal;
      box-shadow: 0 8px 24px rgba(0, 0, 0, .24);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    }

    body.rewind-memory-mode .rewind-photo-actions .rewind-button.liked {
      background: #fff0ee;
      color: #a12520;
      border-color: #fff0ee;
    }

    body.rewind-memory-mode .rewind-tap-zone {
      top: calc(156px + env(safe-area-inset-top));
      bottom: calc(82px + env(safe-area-inset-bottom));
    }

    @media (min-width: 720px) {
      body.rewind-memory-mode .rewind-photo-copy {
        left: 14px;
        right: 14px;
      }
    }
  `;

  document.head.appendChild(style);
}

function polishPhotoSlide(slide) {
  if (!slide || slide.dataset.photoLayoutPolished === "true") return;

  const copy = slide.querySelector(".rewind-photo-copy");
  const actions = copy?.querySelector(".rewind-photo-actions");
  if (!copy || !actions) return;

  const titleCard = document.createElement("div");
  titleCard.className = "rewind-photo-title-card";

  const titleParts = [
    copy.querySelector(":scope > .rewind-kicker"),
    copy.querySelector(":scope > h2"),
    copy.querySelector(":scope > p")
  ].filter(Boolean);

  titleParts.forEach((part) => titleCard.appendChild(part));
  copy.insertBefore(titleCard, actions);
  slide.dataset.photoLayoutPolished = "true";
}

function polishPhotoSlides(root = document) {
  const slides = [];
  if (root?.matches?.(".rewind-photo-slide")) slides.push(root);
  root?.querySelectorAll?.(".rewind-photo-slide").forEach((slide) => slides.push(slide));
  slides.forEach(polishPhotoSlide);
}

function initializePhotoLayout() {
  document.body.classList.add("rewind-memory-mode");
  injectPhotoLayoutStyles();
  polishPhotoSlides(document);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) polishPhotoSlides(node);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

initializePhotoLayout();
