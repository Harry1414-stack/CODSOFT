/**
 * app.js — VisionScript Frontend Logic
 * Image Captioning AI — Client-side controller
 */

// Use same origin when served by Flask, fallback to localhost for file:// dev
const API_BASE = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  ? `${location.protocol}//${location.hostname}:5000`
  : "http://localhost:5000";

// ── DOM refs ──────────────────────────────────────────────────
const dropZone        = document.getElementById("drop-zone");
const fileInput       = document.getElementById("file-input");
const dzPlaceholder   = document.getElementById("dz-placeholder");
const dzPreview       = document.getElementById("dz-preview");
const previewImg      = document.getElementById("preview-img");
const removeBtn       = document.getElementById("remove-btn");
const promptInput     = document.getElementById("prompt-input");
const generateBtn     = document.getElementById("generate-btn");

const uploadCard      = document.getElementById("upload-card");
const resultCard      = document.getElementById("result-card");
const captionText     = document.getElementById("caption-text");
const captionCursor   = document.getElementById("caption-cursor");
const metaEncoderVal  = document.getElementById("meta-encoder-val");
const metaDecoderVal  = document.getElementById("meta-decoder-val");
const metaDeviceVal   = document.getElementById("meta-device-val");
const copyBtn         = document.getElementById("copy-btn");
const tryAnotherBtn   = document.getElementById("try-another-btn");

const loadingOverlay  = document.getElementById("loading-overlay");
const loadingTitle    = document.getElementById("loading-title");
const loadingSub      = document.getElementById("loading-sub");
const step1           = document.getElementById("step-1");
const step2           = document.getElementById("step-2");
const step3           = document.getElementById("step-3");

const errorToast      = document.getElementById("error-toast");
const toastMsg        = document.getElementById("toast-msg");

const navModelInfo    = document.getElementById("nav-model-info");
const modalBackdrop   = document.getElementById("modal-backdrop");
const modalClose      = document.getElementById("modal-close");
const modalContent    = document.getElementById("modal-content");

// ── State ─────────────────────────────────────────────────────
let selectedFile = null;
let toastTimer   = null;
let lastCaption  = "";

// ── Drop Zone ─────────────────────────────────────────────────
dropZone.addEventListener("click", (e) => {
  if (e.target !== removeBtn && !removeBtn.contains(e.target)) {
    fileInput.click();
  }
});

dropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") fileInput.click();
});

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

removeBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  clearFile();
});

// ── File handling ─────────────────────────────────────────────
function handleFile(file) {
  const allowed = ["image/png","image/jpeg","image/gif","image/bmp","image/webp","image/tiff"];
  if (!allowed.includes(file.type)) {
    showToast("Unsupported file type. Please upload a PNG, JPG, GIF, BMP, or WebP image.");
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    showToast("File too large. Maximum size is 20 MB.");
    return;
  }

  selectedFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    dzPlaceholder.hidden = true;
    dzPreview.hidden = false;
    fileInput.style.pointerEvents = "none";
  };
  reader.readAsDataURL(file);

  generateBtn.disabled = false;
  generateBtn.querySelector(".btn-text").textContent = `Caption "${file.name}"`;
}

function clearFile() {
  selectedFile = null;
  fileInput.value = "";
  previewImg.src = "";
  dzPreview.hidden = true;
  dzPlaceholder.hidden = false;
  fileInput.style.pointerEvents = "auto";
  generateBtn.disabled = true;
  generateBtn.querySelector(".btn-text").textContent = "Generate Caption";
}

// ── Generate Caption ──────────────────────────────────────────
generateBtn.addEventListener("click", async () => {
  if (!selectedFile) return;
  await runCaption(selectedFile, promptInput.value.trim());
});

async function runCaption(file, promptText) {
  showLoading(true);
  animateSteps();

  const formData = new FormData();
  formData.append("image", file);
  if (promptText) formData.append("prompt", promptText);

  try {
    const response = await fetch(`${API_BASE}/caption`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Server error ${response.status}`);
    }

    showLoading(false);
    displayResult(data);

  } catch (err) {
    showLoading(false);
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      showToast("Cannot connect to backend. Make sure the server is running on port 5000.");
    } else {
      showToast(err.message || "An unexpected error occurred.");
    }
  }
}

// ── Display Result ────────────────────────────────────────────
function displayResult(data) {
  lastCaption = data.caption;

  // Update meta
  metaEncoderVal.textContent = data.encoder || "ViT-B/16";
  metaDecoderVal.textContent = data.decoder || "Transformer";
  metaDeviceVal.textContent  = data.device  || "CPU";

  // Show result card
  uploadCard.hidden = true;
  resultCard.hidden = false;

  // Typewriter effect
  captionText.textContent = "";
  captionCursor.classList.remove("hidden");
  typeWriter(data.caption, captionText, () => {
    captionCursor.classList.add("hidden");
  });
}

function typeWriter(text, el, onDone, i = 0) {
  if (i < text.length) {
    el.textContent += text[i];
    const delay = text[i] === "." ? 120 : text[i] === "," ? 80 : 28;
    setTimeout(() => typeWriter(text, el, onDone, i + 1), delay);
  } else {
    if (onDone) onDone();
  }
}

// ── Try Another ───────────────────────────────────────────────
tryAnotherBtn.addEventListener("click", () => {
  resultCard.hidden = true;
  uploadCard.hidden = false;
  clearFile();
  promptInput.value = "";
  captionText.textContent = "";
});

// ── Copy Caption ──────────────────────────────────────────────
copyBtn.addEventListener("click", () => {
  if (!lastCaption) return;
  navigator.clipboard.writeText(lastCaption).then(() => {
    copyBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Copied!
    `;
    setTimeout(() => {
      copyBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
        Copy
      `;
    }, 2000);
  });
});

// ── Loading Overlay ───────────────────────────────────────────
function showLoading(show) {
  loadingOverlay.hidden = !show;
  if (show) resetSteps();
}

function resetSteps() {
  [step1, step2, step3].forEach(s => {
    s.classList.remove("active", "done");
    s.querySelector(".step-dot").classList.remove("active", "done");
  });
  step1.classList.add("active");
  step1.querySelector(".step-dot").classList.add("active");
  loadingTitle.textContent = "Analyzing Image...";
  loadingSub.textContent = "Extracting visual features with ViT encoder";
}

function animateSteps() {
  const steps = [
    { el: step1, title: "Analyzing Image...",     sub: "Extracting visual features with ViT encoder",  delay: 0    },
    { el: step2, title: "Generating Caption...",  sub: "Transformer decoder generating tokens",         delay: 2000 },
    { el: step3, title: "Refining Output...",      sub: "Beam search selecting best caption",            delay: 4000 },
  ];

  steps.forEach(({ el, title, sub, delay }, idx) => {
    setTimeout(() => {
      if (loadingOverlay.hidden) return;

      // Mark previous as done
      if (idx > 0) {
        const prev = steps[idx - 1].el;
        prev.classList.remove("active");
        prev.classList.add("done");
        prev.querySelector(".step-dot").classList.remove("active");
        prev.querySelector(".step-dot").classList.add("done");
      }

      el.classList.add("active");
      el.querySelector(".step-dot").classList.add("active");
      loadingTitle.textContent = title;
      loadingSub.textContent = sub;
    }, delay);
  });
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg) {
  if (_suppressToast) return;
  toastMsg.textContent = msg;
  errorToast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => errorToast.classList.remove("show"), 5000);
}

// ── Model Info Modal ──────────────────────────────────────────
navModelInfo.addEventListener("click", async (e) => {
  e.preventDefault();
  modalBackdrop.hidden = false;
  modalContent.innerHTML = '<p class="modal-loading">Fetching model info...</p>';

  try {
    const resp = await fetch(`${API_BASE}/model-info`);
    if (!resp.ok) throw new Error();
    const info = await resp.json();

    modalContent.innerHTML = `
      <table class="modal-info-table">
        <tr><td>Model</td><td>${info.model}</td></tr>
        <tr><td>Source</td><td>${info.source}</td></tr>
        <tr><td>Vision Encoder</td><td>${info.vision_encoder}</td></tr>
        <tr><td>Language Decoder</td><td>${info.language_decoder}</td></tr>
        <tr><td>Pre-trained on</td><td>${info.pretrained_on}</td></tr>
        <tr><td>Decoding</td><td>${info.decoding_strategy}</td></tr>
        <tr><td>Paper</td><td><a href="${info.paper}" target="_blank">arxiv.org ↗</a></td></tr>
      </table>
    `;
  } catch {
    modalContent.innerHTML = `
      <p style="color: var(--text-secondary);">
        Could not reach the backend. Start the server with <code>python app.py</code> and try again.
      </p>
    `;
  }
});

modalClose.addEventListener("click", () => { modalBackdrop.hidden = true; });
modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) modalBackdrop.hidden = true;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") modalBackdrop.hidden = true;
});

// ── Paste image from clipboard ────────────────────────────────
let _suppressToast = false;

document.addEventListener("paste", (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        _suppressToast = true;
        handleFile(file);
        setTimeout(() => { _suppressToast = false; }, 200);
      }
      break;
    }
  }
});
