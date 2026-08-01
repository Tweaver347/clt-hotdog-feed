const OBSERVED_ROOT = document.getElementById("app");

function updatePublicUploadUi(root = document) {
  const libraryLabel = root.querySelector?.('label[for="library-photo-input"]');
  if (libraryLabel) libraryLabel.remove();

  const libraryInput = root.querySelector?.("#library-photo-input");
  if (libraryInput) libraryInput.remove();

  const cameraLabel = root.querySelector?.('label[for="camera-photo-input"]');
  if (cameraLabel) {
    cameraLabel.querySelector("strong")?.replaceChildren("Capture this moment");
    cameraLabel.querySelector("small")?.replaceChildren("Take a live photo during the crawl.");
  }

  const photoPanel = cameraLabel?.closest(".panel");
  if (photoPanel) {
    const heading = photoPanel.querySelector(".section-heading");
    if (heading) heading.innerHTML = '<span aria-hidden="true">2️⃣</span> Capture your stop';

    const help = photoPanel.querySelector(".section-help");
    if (help) {
      help.textContent = "Live photos only—stay in the moment, then scan and share again at another stop. Add as many photos as you like throughout the crawl.";
    }

    const sourceHelp = photoPanel.querySelector(".photo-source-help");
    if (sourceHelp) {
      sourceHelp.textContent = "Your device will open its camera. Come back and share another moment whenever the hot dog reaches a new stop.";
    }
  }

  root.querySelectorAll?.(".panel").forEach((panel) => {
    const heading = panel.querySelector(".section-heading");
    if (!heading) return;

    if (heading.textContent.includes("Publish to the test feed")) {
      heading.innerHTML = '<span aria-hidden="true">3️⃣</span> Share with everyone at the crawl';
    }
  });

  const submitButton = root.querySelector?.("#submit-photo");
  if (submitButton && !submitButton.disabled) {
    submitButton.innerHTML = '<span aria-hidden="true">⬆</span> Share to the Crawl';
  }
}

function guardCameraInput(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.id !== "camera-photo-input") return;
  if (!input.hasAttribute("capture")) input.setAttribute("capture", "environment");
}

export function initializeCameraOnlyPublicUpload() {
  updatePublicUploadUi(document);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) updatePublicUploadUi(node);
      }
    }
    updatePublicUploadUi(document);
  });

  if (OBSERVED_ROOT) observer.observe(OBSERVED_ROOT, { childList: true, subtree: true });
  document.addEventListener("change", guardCameraInput, true);
}
