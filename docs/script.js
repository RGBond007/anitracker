const copyButton = document.querySelector("[data-copy-target]");

copyButton?.addEventListener("click", async () => {
  const target = document.getElementById(copyButton.dataset.copyTarget);

  if (!target) return;

  try {
    await navigator.clipboard.writeText(target.textContent.replace(/^\$ /gm, "").trim());
    copyButton.textContent = "Copied";
    window.setTimeout(() => {
      copyButton.textContent = "Copy commands";
    }, 1800);
  } catch {
    copyButton.textContent = "Select and copy";
  }
});
