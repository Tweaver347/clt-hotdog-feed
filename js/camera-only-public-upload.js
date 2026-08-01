const PUBLIC_UPLOAD_HASH = "#/upload";

function isPublicUploadView() {
  return window.location.hash.startsWith(PUBLIC_UPLOAD_HASH);
}

function updatePublicUploadUi() {
  if (!isPublicUploadView()) return;

  const libraryInput = document.getElementById("library-photo-input");
  const libraryLabel = libraryInput?.closest("label") || document.querySelector('label[for="library-photo-input"]');
  libraryLabel?.remove();
  libraryInput?.remove();

  const cameraLabel = document.querySelector('label[for="camera-photo-input"]');
  if (cameraLabel) {
    cameraLabel.querySelector("strong")?.replaceChildren("Capture this moment");
    cameraLabel.querySelector("small")?.replaceChildren("Open your camera and take a live photo from the crawl.");
  }

  const sourceGrid = document.querySelector(".photo-source-grid");
  sourceGrid?.classList.add("camera-only-source-grid");

  const sourceHelp = document.querySelector(".photo-source-help");
  if (sourceHelp) {
    sourceHelp.textContent = "Live photos only—stay in the moment. Scan again at every stop and add as many memories as you make during the crawl.";
  }

  document.querySelectorAll(".section-heading").forEach((heading) => {
    const text = heading.textContent || "";
    if (text.includes("Add one photo")) {
      heading.innerHTML = '<span aria-hidden="true">2️⃣</span> Capture a photo';
    }
    if (text.includes("Publish to the test feed")) {
      heading.innerHTML = '<span aria-hidden="true">3️⃣</span> Share with the crawl';
    }
  });

  const submitButton = document.getElementById("submit-photo");
  if (submitButton && !submitButton.disabled) {
    submitButton.innerHTML = '<span aria-hidden="true">⬆</span> Share to the Crawl';
  }

  const cameraInput = document.getElementById("camera-photo-input");
  if (cameraInput) {
    cameraInput.setAttribute("accept", "image/*");
    cameraInput.setAttribute("capture", "environment");
  }
}

function initializeCameraOnlyPublicUploads() {
  updatePublicUploadUi();

  const observer = new MutationObserver(() => updatePublicUploadUi());
  observer.observe(document.getElementById("app") || document.body, {
    childList: true,
    subtree: true
  });

  window.addEventListener("hashchange", updatePublicUploadUi);
}

initializeCameraOnlyPublicUploads();
