"use strict";

const API_BASE_URL = window.location.protocol === "file:"
  ? "http://127.0.0.1:8000/api"
  : `${window.location.origin}/api`;
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 180000; 
const DUMMY_RESULT = {
  job_id: "dev-sample-001",
  transcript_summary: { duration_sec: 420, word_count: 980 },
  speech_metrics: {
    wpm: 148,
    pace_label: "balanced",
    filler_count: 18,
    top_fillers: { um: 7, like: 5, actually: 3, so: 2 },
    long_pauses: 6,
    avg_pause_sec: 1.8,
  },
  scores: {
    overall: 68,
    clarity: 72,
    relevance: 64,
    specificity: 58,
    confidence: 70,
  },
  top_rejection_reasons: [
    "Answers were generic and lacked concrete examples",
    "Frequent hesitation during technical explanations",
    "Behavioral answers lacked strong outcome statements",
  ],
  weak_moments: [
    { start: 52, end: 78, reason: "High filler usage and vague explanation" },
    { start: 180, end: 210, reason: "Long pause before technical answer" },
  ],
  improvement_plan: [
    "Use STAR framework for behavioral answers",
    "Practice concise technical storytelling",
    "Reduce filler words in opening response",
  ],
  summary:
    "Your interview showed decent clarity but weak specificity and hesitation during technical answers.",
};
let fileInput, fileName, roleSelect, analyzeBtn, errorBox, errorText;
let processingSection, statusText, progressBar;
let step1, step2, step3, step4;
let dropZone, selectedFileInfo, clearFileBtn, devDummyBtn;
let pollTimer = null;
let pollStart = null;
let selectedFile = null;
document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  bindEvents();
});
function bindElements() {
  fileInput = document.getElementById("fileInput");
  fileName = document.getElementById("fileName");
  roleSelect = document.getElementById("roleSelect");
  analyzeBtn = document.getElementById("analyzeBtn");
  errorBox = document.getElementById("errorBox");
  errorText = document.getElementById("errorText");
  processingSection = document.getElementById("processingSection");
  statusText = document.getElementById("statusText");
  progressBar = document.getElementById("progressBar");
  step1 = document.getElementById("step1");
  step2 = document.getElementById("step2");
  step3 = document.getElementById("step3");
  step4 = document.getElementById("step4");
  dropZone = document.getElementById("dropZone");
  selectedFileInfo = document.getElementById("selectedFileInfo");
  clearFileBtn = document.getElementById("clearFileBtn");
  devDummyBtn = document.getElementById("devDummyBtn");
}
function bindEvents() {
  if (fileInput) {
    fileInput.addEventListener("change", handleFileChange);
  }
  if (dropZone) {
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("drag-over");
    });

    dropZone.addEventListener("dragleave", () => {
      dropZone.classList.remove("drag-over");
    });

    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove("drag-over");
      const file = e.dataTransfer?.files?.[0];
      if (file) setFile(file);
    });
  }
  if (clearFileBtn) {
    clearFileBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearFile();
      return false;
    });
  }
  if (analyzeBtn) {
    analyzeBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      console.log("[IRAS] Analyze button clicked");

      await handleAnalyze(e);
      return false;
    });
  }
  if (devDummyBtn) {
    devDummyBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      loadDummyResult();
      return false;
    });
  }
  document.querySelectorAll("form").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    });
  });
}
function handleFileChange(e) {
  const file = e.target.files?.[0];
  if (file) setFile(file);
}

function setFile(file) {
  selectedFile = file;
  const dropZoneInner = dropZone?.querySelector(".drop-zone-inner");
  if (dropZoneInner) dropZoneInner.classList.add("d-none");
  if (selectedFileInfo) selectedFileInfo.classList.remove("d-none");
  if (fileName) fileName.textContent = file.name;
  hideError();

  console.log(
    "[IRAS] File selected:",
    file.name,
    `(${(file.size / 1024 / 1024).toFixed(2)} MB)`
  );
}

function clearFile() {
  selectedFile = null;
  if (fileInput) fileInput.value = "";
  if (fileName) fileName.textContent = "No file selected";

  const dropZoneInner = dropZone?.querySelector(".drop-zone-inner");
  if (dropZoneInner) dropZoneInner.classList.remove("d-none");
  if (selectedFileInfo) selectedFileInfo.classList.add("d-none");
}
async function handleAnalyze(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  hideError();
  if (!selectedFile) {
    return showError("Please select an interview audio or video file.");
  }

  if (!roleSelect?.value) {
    return showError("Please select the interview role type.");
  }

  setUIBusy(true);

  try {
    setStep(1, "active");
    setStatus("Uploading file...", 15);
    const jobId = await uploadFile(selectedFile, roleSelect.value);
    console.log("[IRAS] Upload complete. Job ID:", jobId);
    setStep(1, "done");
    setStep(2, "active");
    setStatus("Starting analysis engine...", 35);
    await startAnalysis(jobId);
    console.log("[IRAS] Analysis triggered.");
    setStep(2, "done");
    setStep(3, "active");
    setStatus("Processing audio — this may take a minute...", 55);
    await pollForResult(jobId);
  } catch (err) {
    console.error("[IRAS] Error:", err);
    showError(err.message || "An unexpected error occurred. Please try again.");
    setUIBusy(false);
  }
}
async function uploadFile(file, role) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("role", role);
  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const errText = await safeTextFromResponse(response);
    throw new Error(`Upload failed (${response.status}): ${errText}`);
  }
  const data = await safeParseJSON(response);
  if (!data || !data.job_id) {
    throw new Error("Upload response did not include a job ID.");
  }
  return data.job_id;
}
async function startAnalysis(jobId) {
  const response = await fetch(`${API_BASE_URL}/analyze/${jobId}`, {
    method: "POST",
  });

  if (!response.ok) {
    const errText = await safeTextFromResponse(response);
    throw new Error(`Failed to start analysis (${response.status}): ${errText}`);
  }

  await safeParseJSON(response); 
}
async function pollForResult(jobId) {
  pollStart = Date.now();

  return new Promise((resolve, reject) => {
    pollTimer = setInterval(async () => {
      try {
        const elapsed = Date.now() - pollStart;
        if (elapsed > POLL_TIMEOUT_MS) {
          clearInterval(pollTimer);
          pollTimer = null;
          setUIBusy(false);
          return reject(
            new Error(`Analysis timed out after ${Math.round(POLL_TIMEOUT_MS / 1000)} seconds.`)
          );
        }

        const response = await fetch(`${API_BASE_URL}/result/${jobId}`);

        if (!response.ok) {
          const errText = await safeTextFromResponse(response);
          throw new Error(`Failed to fetch result (${response.status}): ${errText}`);
        }

        const data = await safeParseJSON(response);
        console.log("[IRAS] Poll response:", data);

        if (!data || typeof data !== "object") {
          return; 
        }
        const status = String(data.status || "").toLowerCase();
        if (status === "processing" || status === "queued" || status === "pending") {
          setStatus("Processing audio — this may take a minute...", 65);
          return;
        }
        if (status === "failed" || status === "error") {
          clearInterval(pollTimer);
          pollTimer = null;

          setUIBusy(false);
          setStep(3, "error");

          const details = data.details ? ` (${data.details})` : "";
          const msg = data.message || "Analysis failed.";
          return reject(new Error(`${msg}${details}`));
        }
        if (status === "completed" || hasResultPayload(data)) {
          clearInterval(pollTimer);
          pollTimer = null;

          setStep(3, "done");
          setStep(4, "active");
          setStatus("Generating report...", 90);
          const finalResult = data.result && typeof data.result === "object"
            ? { ...data.result, status: "completed" }
            : data;
          if (!finalResult.job_id) {
            finalResult.job_id = jobId;
          }

          localStorage.setItem("analysisResult", JSON.stringify(finalResult));

          setStep(4, "done");
          setStatus("Done! Redirecting to report...", 100);

          setTimeout(() => {
            window.location.href = `result.html?job_id=${encodeURIComponent(jobId)}`;
          }, 700);

          return resolve(finalResult);
        }

        console.warn("[IRAS] Unknown poll response shape, continuing...", data);

      } catch (err) {
        clearInterval(pollTimer);
        pollTimer = null;
        setUIBusy(false);
        reject(err);
      }
    }, POLL_INTERVAL_MS);
  });
}

function hasResultPayload(data) {
  if (!data || typeof data !== "object") return false;
  if (data.scores || data.speech_metrics || data.summary || data.improvement_plan) {
    return true;
  }
  return false;
}

function setUIBusy(isBusy) {
  if (analyzeBtn) {
    const btnText = analyzeBtn.querySelector(".btn-text");
    const btnLoading = analyzeBtn.querySelector(".btn-loading");

    analyzeBtn.disabled = isBusy;

    if (btnText) btnText.classList.toggle("d-none", isBusy);
    if (btnLoading) btnLoading.classList.toggle("d-none", !isBusy);
  }

  if (processingSection) {
    processingSection.classList.toggle("d-none", !isBusy);
  }
}

function setStatus(text, progressPercent = null) {
  if (statusText) statusText.textContent = text;

  if (progressBar && typeof progressPercent === "number") {
    const clamped = Math.max(0, Math.min(100, progressPercent));
    progressBar.style.width = `${clamped}%`;
    progressBar.setAttribute("aria-valuenow", String(clamped));
  }
}

function setStep(stepNum, state) {
  const stepEl = [null, step1, step2, step3, step4][stepNum];
  if (!stepEl) return;

  stepEl.classList.remove("done", "active", "error");

  if (state === "done") {
    stepEl.classList.add("done");
    stepEl.innerHTML = stepEl.innerHTML.replace("bi-circle", "bi-check-circle-fill");
  } else if (state === "active") {
    stepEl.classList.add("active");
  } else if (state === "error") {
    stepEl.classList.add("error");
    stepEl.innerHTML = stepEl.innerHTML.replace("bi-circle", "bi-exclamation-circle-fill");
  }
}

function showError(message) {
  if (errorText) errorText.textContent = message || "Something went wrong.";
  if (errorBox) errorBox.classList.remove("d-none");
}

function hideError() {
  if (errorBox) errorBox.classList.add("d-none");
}
function loadDummyResult() {
  localStorage.setItem("analysisResult", JSON.stringify(DUMMY_RESULT));
  window.location.href = "result.html";
}
async function safeParseJSON(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
async function safeTextFromResponse(response) {
  try {
    return await response.text();
  } catch {
    return "Unable to read server response.";
  }
}