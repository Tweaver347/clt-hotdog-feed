const PUBLIC_CAMERA_STYLE_ID = "live-camera-only-styles";

let cameraStream = null;
let cameraLayer = null;
let bridgeInput = null;
let facingMode = "environment";
let cameraRequestInFlight = false;

function isModeratorRoute() {
  const configured = String(window.APP_CONFIG?.moderatorPath || "/moderator-8f3c2a").replace(/\/$/, "");
  const current = window.location.pathname.replace(/\/$/, "") || "/";
  return current === configured;
}

function injectStyles() {
  if (document.getElementById(PUBLIC_CAMERA_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = PUBLIC_CAMERA_STYLE_ID;
  style.textContent = `
    .photo-source-grid.live-camera-only-grid { grid-template-columns: 1fr; }
    .live-camera-only-button { width: 100%; text-align: left; }
    .live-camera-only-note {
      display: flex;
      align-items: flex-start;
      gap: 9px;
      margin: 10px 2px 0;
      color: var(--muted);
      font-size: calc(12px * var(--text-scale));
      line-height: 1.45;
    }
    .live-camera-only-note strong { color: var(--text); }
    .live-camera-layer {
      position: fixed;
      inset: 0;
      z-index: 13000;
      display: grid;
      place-items: center;
      padding: max(14px, env(safe-area-inset-top)) 14px max(14px, env(safe-area-inset-bottom));
    }
    .live-camera-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(9, 15, 20, .82);
      backdrop-filter: blur(5px);
    }
    .live-camera-dialog {
      position: relative;
      width: min(680px, 100%);
      max-height: calc(100vh - 28px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
      overflow: auto;
      border: 1px solid rgba(255, 255, 255, .18);
      border-radius: 22px;
      background: #101820;
      color: white;
      box-shadow: 0 24px 80px rgba(0, 0, 0, .46);
    }
    .live-camera-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 15px 16px;
    }
    .live-camera-header h2 { margin: 0; font-size: 1.1rem; }
    .live-camera-close {
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      border: 1px solid rgba(255, 255, 255, .25);
      border-radius: 999px;
      background: rgba(255, 255, 255, .08);
      color: white;
      font-size: 1.45rem;
    }
    .live-camera-video-wrap {
      position: relative;
      overflow: hidden;
      aspect-ratio: 3 / 4;
      max-height: 68vh;
      background: #05080a;
    }
    .live-camera-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .live-camera-copy {
      margin: 0;
      padding: 13px 16px 0;
      color: rgba(255, 255, 255, .78);
      font-size: .9rem;
      line-height: 1.45;
    }
    .live-camera-actions {
      display: grid;
      grid-template-columns: minmax(0, .75fr) minmax(0, 1.25fr);
      gap: 10px;
      padding: 14px 16px 18px;
    }
    .live-camera-actions button { width: 100%; }
    .live-camera-actions .secondary-button {
      background: rgba(255, 255, 255, .1);
      border-color: rgba(255, 255, 255, .25);
      color: white;
    }
    @media (max-width: 520px) {
      .live-camera-layer { align-items: end; padding: 0; }
      .live-camera-dialog {
        width: 100%;
        max-height: 96vh;
        border-radius: 22px 22px 0 0;
      }
      .live-camera-video-wrap { max-height: 64vh; }
    }
  `;
  document.head.appendChild(style);
}

function stopCameraTracks() {
  cameraStream?.getTracks?.().forEach((track) => track.stop());
  cameraStream = null;
}

function closeCamera() {
  stopCameraTracks();
  if (cameraLayer) {
    cameraLayer.remove();
    cameraLayer = null;
  }
  bridgeInput = null;
  document.body.classList.remove("live-camera-open");
}

function cameraErrorMessage(error) {
  if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
    return "Camera access was declined. Allow camera permission in your browser, then try again.";
  }
  if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
    return "No camera was found on this device.";
  }
  if (error?.name === "NotReadableError" || error?.name === "TrackStartError") {
    return "The camera is being used by another app. Close it there and try again.";
  }
  return "The camera could not be opened. Try Safari or Chrome on your phone.";
}

function showPublicError(message) {
  const region = document.getElementById("toast-region");
  if (!region) {
    window.alert(message);
    return;
  }
  const toast = document.createElement("div");
  toast.className = "toast error";
  toast.textContent = message;
  region.appendChild(toast);
  window.setTimeout(() => toast.remove(), 5000);
}

function createCameraLayer() {
  const layer = document.createElement("div");
  layer.className = "live-camera-layer";
  layer.innerHTML = `
    <div class="live-camera-backdrop" data-live-camera-close></div>
    <section class="live-camera-dialog" role="dialog" aria-modal="true" aria-labelledby="live-camera-title">
      <header class="live-camera-header">
        <h2 id="live-camera-title">Take a live photo</h2>
        <button class="live-camera-close" type="button" data-live-camera-close aria-label="Close camera">×</button>
      </header>
      <div class="live-camera-video-wrap">
        <video class="live-camera-video" autoplay playsinline muted></video>
      </div>
      <p class="live-camera-copy">This photo must be taken now. The public upload flow does not open your photo library.</p>
      <div class="live-camera-actions">
        <button class="secondary-button" type="button" data-live-camera-flip><span aria-hidden="true">↻</span> Flip camera</button>
        <button class="primary-button" type="button" data-live-camera-capture><span aria-hidden="true">📸</span> Take photo</button>
      </div>
    </section>
  `;
  layer.querySelectorAll("[data-live-camera-close]").forEach((button) => button.addEventListener("click", closeCamera));
  layer.querySelector("[data-live-camera-capture]")?.addEventListener("click", capturePhoto);
  layer.querySelector("[data-live-camera-flip]")?.addEventListener("click", flipCamera);
  return layer;
}

async function requestCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("LIVE_CAMERA_UNSUPPORTED");
  }
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1920 },
      height: { ideal: 1440 }
    }
  });
}

async function openCamera(input) {
  if (cameraRequestInFlight) return;
  cameraRequestInFlight = true;
  closeCamera();
  bridgeInput = input;
  try {
    cameraStream = await requestCamera();
    cameraLayer = createCameraLayer();
    document.body.appendChild(cameraLayer);
    document.body.classList.add("live-camera-open");
    const video = cameraLayer.querySelector("video");
    video.srcObject = cameraStream;
    await video.play();
    cameraLayer.querySelector("[data-live-camera-capture]")?.focus();
  } catch (error) {
    closeCamera();
    const message = error?.message === "LIVE_CAMERA_UNSUPPORTED"
      ? "Live camera capture is not supported in this browser. Open the link in Safari or Chrome on a phone."
      : cameraErrorMessage(error);
    showPublicError(message);
  } finally {
    cameraRequestInFlight = false;
  }
}

async function flipCamera() {
  if (!cameraLayer || cameraRequestInFlight) return;
  cameraRequestInFlight = true;
  const flipButton = cameraLayer.querySelector("[data-live-camera-flip]");
  if (flipButton) flipButton.disabled = true;
  try {
    stopCameraTracks();
    facingMode = facingMode === "environment" ? "user" : "environment";
    cameraStream = await requestCamera();
    const video = cameraLayer.querySelector("video");
    video.srcObject = cameraStream;
    await video.play();
  } catch (error) {
    showPublicError(cameraErrorMessage(error));
  } finally {
    cameraRequestInFlight = false;
    if (flipButton) flipButton.disabled = false;
  }
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The photo could not be captured."))),
      "image/jpeg",
      0.92
    );
  });
}

function dispatchCapturedFile(input, file) {
  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
  } catch {
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [file]
    });
  }
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function capturePhoto() {
  const input = bridgeInput;
  const video = cameraLayer?.querySelector("video");
  const captureButton = cameraLayer?.querySelector("[data-live-camera-capture]");
  if (!input || !video || !video.videoWidth || !video.videoHeight) {
    showPublicError("The camera is still starting. Wait a moment and try again.");
    return;
  }
  if (captureButton) {
    captureButton.disabled = true;
    captureButton.textContent = "Preparing photo…";
  }
  try {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("The photo could not be captured.");
    if (facingMode === "user") {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await canvasBlob(canvas);
    const file = new File([blob], `hot-dog-live-${Date.now()}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now()
    });
    closeCamera();
    dispatchCapturedFile(input, file);
  } catch (error) {
    if (captureButton) {
      captureButton.disabled = false;
      captureButton.innerHTML = '<span aria-hidden="true">📸</span> Take photo';
    }
    showPublicError(error.message || "The photo could not be captured.");
  }
}

function enforceCameraOnlyUpload(root = document) {
  const scope = root?.querySelector ? root : document;
  const grid = scope.querySelector(".photo-source-grid") || document.querySelector(".photo-source-grid");
  const cameraInput = scope.querySelector("#camera-photo-input") || document.getElementById("camera-photo-input");
  if (!grid || !cameraInput || grid.dataset.liveCameraOnly === "true") return;

  grid.dataset.liveCameraOnly = "true";
  grid.classList.add("live-camera-only-grid");
  grid.querySelector('label[for="camera-photo-input"]')?.remove();
  grid.querySelector('label[for="library-photo-input"]')?.remove();
  grid.querySelector("#library-photo-input")?.remove();

  const launch = document.createElement("button");
  launch.type = "button";
  launch.className = "photo-source-button camera-source live-camera-only-button";
  launch.innerHTML = `
    <span class="photo-source-icon" aria-hidden="true">📸</span>
    <strong>Take a live photo</strong>
    <small>Open the camera and capture this moment now.</small>
  `;
  launch.addEventListener("click", () => openCamera(cameraInput));
  grid.prepend(launch);

  const existingHelp = grid.nextElementSibling?.classList.contains("photo-source-help")
    ? grid.nextElementSibling
    : null;
  const note = existingHelp || document.createElement("p");
  note.className = "photo-source-help live-camera-only-note";
  note.innerHTML = '<span aria-hidden="true">⚡</span><span><strong>Live moment only.</strong> Public participants cannot choose an existing image from their camera roll.</span>';
  if (!existingHelp) grid.after(note);
}

function observeUploads() {
  injectStyles();
  enforceCameraOnlyUpload(document);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) enforceCameraOnlyUpload(node);
      }
    }
    if (!document.getElementById("camera-photo-input")) closeCamera();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (!isModeratorRoute()) {
  observeUploads();
  window.addEventListener("pagehide", closeCamera);
  window.addEventListener("hashchange", () => {
    if (!window.location.hash.startsWith("#/upload")) closeCamera();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && cameraLayer) closeCamera();
  });
}
