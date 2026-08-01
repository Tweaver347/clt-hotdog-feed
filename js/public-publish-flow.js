function simplifyPublishStep(root = document) {
  const scope = root?.querySelector ? root : document;
  const consent = scope.querySelector("#photo-consent") || document.getElementById("photo-consent");
  if (!consent) return;

  // Preserve the existing upload-state contract while removing the extra
  // participant action from the event flow.
  if (!consent.checked) {
    consent.checked = true;
    consent.dispatchEvent(new Event("change", { bubbles: true }));
  }

  consent.closest(".checkbox-row")?.remove();

  const headings = scope.querySelectorAll?.(".section-heading") || [];
  for (const heading of headings) {
    if (!heading.textContent?.includes("Publish to the test feed")) continue;
    heading.innerHTML = '<span aria-hidden="true">3️⃣</span> Publish to the feed';
  }
}

function observePublishFlow() {
  simplifyPublishStep(document);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) simplifyPublishStep(node);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

observePublishFlow();
