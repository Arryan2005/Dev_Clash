"use strict";

const API_BASE_URL = window.location.protocol === "file:"
  ? "http://127.0.0.1:8000/api"
  : `${window.location.origin}/api`;
const RESULT_POLL_INTERVAL_MS = 3000;
const RESULT_POLL_TIMEOUT_MS = 120000;

document.addEventListener("DOMContentLoaded", async () => {
  let data = loadResultData();

  if (!data) {
    const jobId = getQueryParam("job_id");
    if (jobId) {
      data = await fetchResultWithPolling(jobId);
      if (data) {
        localStorage.setItem("analysisResult", JSON.stringify(data));
      }
    }
  }

  if (!data) {
    showResultError("No analysis data found. Please go back and upload an interview.");
    return;
  }

  console.log("[IRAS Result] Rendering data:", data);

  try {
    populateScores(data);
    populateSpeechMetrics(data);
    populateSummary(data);
    populateRejectionReasons(data);
    populateWeakMoments(data);
    populateImprovementPlan(data);
    populateTranscript(data);
    animateScoreRing(data?.scores?.overall ?? 0);
    if (typeof renderScoreChart === "function") renderScoreChart(data);
    if (typeof renderFillerChart === "function") renderFillerChart(data);

  } catch (err) {
    console.error("[IRAS Result] Render error:", err);
  }
});
function hasResultPayload(data) {
  if (!data || typeof data !== "object") return false;
  if (data.scores || data.speech_metrics || data.summary || data.improvement_plan) {
    return true;
  }
  return false;
}
function loadResultData() {
  try {
    const raw = localStorage.getItem("analysisResult");
    if (!raw) {
      console.warn("[IRAS Result] No 'analysisResult' key in localStorage.");
      return null;
    }
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      console.warn("[IRAS Result] Parsed data is not an object.");
      return null;
    }
    return parsed;
  } catch (err) {
    console.error("[IRAS Result] Failed to parse localStorage data:", err);
    return null;
  }
}

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

async function fetchResult(jobId) {
  try {
    const response = await fetch(`${API_BASE_URL}/result/${encodeURIComponent(jobId)}`);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `Server returned ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error("[IRAS Result] Failed to load result from backend:", err);
    return null;
  }
}

async function fetchResultWithPolling(jobId) {
  const start = Date.now();
  while (Date.now() - start < RESULT_POLL_TIMEOUT_MS) {
    const data = await fetchResult(jobId);
    if (!data) break;

    const status = String(data.status || "").toLowerCase();
    if (status === "completed" || hasResultPayload(data)) {
      return data.result && typeof data.result === "object"
        ? { ...data.result, status: "completed" }
        : data;
    }

    if (status === "failed" || status === "error") {
      const details = data.details ? ` ${data.details}` : "";
      showResultError(`Analysis failed.${details}`);
      return null;
    }

    await new Promise((resolve) => setTimeout(resolve, RESULT_POLL_INTERVAL_MS));
  }

  showResultError("The report is still processing. Please wait a moment and refresh this page.");
  return null;
}
function showResultError(message) {
  const content = document.getElementById("resultContent");
  const errEl   = document.getElementById("resultError");

  if (content) content.classList.add("d-none");
  if (errEl) {
    errEl.classList.remove("d-none");
    const errMsg = errEl.querySelector("p");
    if (errMsg && message) errMsg.textContent = message;
  }
}
function animateScoreRing(score) {
  const ring = document.getElementById("scoreRing");
  if (!ring) return;

  const clampedScore = Math.min(100, Math.max(0, Number(score) || 0));
  const circumference = 314;
  const offset = circumference - (clampedScore / 100) * circumference;

  requestAnimationFrame(() => {
    ring.style.strokeDashoffset = offset;

    if (clampedScore >= 75)      ring.style.stroke = "#3fb950";   
    else if (clampedScore >= 55) ring.style.stroke = "#00d4aa";   
    else if (clampedScore >= 40) ring.style.stroke = "#e3b341";   
    else                         ring.style.stroke = "#f85149";   
  });
}
function populateScores(data) {
  const scores = data?.scores ?? {};

  safeSetText("overallScore",    formatScore(scores.overall));
  safeSetText("clarityScore",    formatScore(scores.clarity));
  safeSetText("relevanceScore",  formatScore(scores.relevance));
  safeSetText("specificityScore",formatScore(scores.specificity));
  safeSetText("confidenceScore", formatScore(scores.confidence));
  safeSetText("overallLabel",    scoreLabel(scores.overall));
}

function formatScore(val) {
  const n = Number(val);
  return isNaN(n) ? "—" : String(Math.round(n));
}

function scoreLabel(score) {
  const n = Number(score);
  if (isNaN(n)) return "No Score";
  if (n >= 80) return "Strong";
  if (n >= 65) return "Fair";
  if (n >= 50) return "Needs Work";
  return "Weak";
}
function populateSummary(data) {
  safeSetText("summaryText", data?.summary ?? "No summary available.");
}
function populateSpeechMetrics(data) {
  const m = data?.speech_metrics ?? {};
  const t = data?.transcript_summary ?? {};

  const wpm   = m.wpm ?? null;
  const pace  = m.pace_label ?? "";
  const paceText = wpm !== null
    ? `${wpm}${pace ? " · " + pace : ""}`
    : "—";

  safeSetText("fillerCount",  m.filler_count  ?? "—");
  safeSetText("paceValue",    paceText);
  safeSetText("pauseCount",   m.long_pauses   ?? "—");
  safeSetText("durationValue",formatDuration(t.duration_sec));
}
function populateRejectionReasons(data) {
  const container = document.getElementById("rejectionReasons");
  if (!container) return;

  const reasons = Array.isArray(data?.top_rejection_reasons) ? data.top_rejection_reasons : [];

  if (reasons.length === 0) {
    container.innerHTML = `<p class="placeholder-text">No rejection reasons identified.</p>`;
    return;
  }

  container.innerHTML = reasons
    .map((reason, i) => `
      <div class="rejection-item">
        <span class="rejection-num">${i + 1}</span>
        <span>${escapeHTML(String(reason))}</span>
      </div>`)
    .join("");
}
function populateWeakMoments(data) {
  const container = document.getElementById("weakMoments");
  if (!container) return;

  const moments = Array.isArray(data?.weak_moments) ? data.weak_moments : [];

  if (moments.length === 0) {
    container.innerHTML = `<p class="placeholder-text">No weak moments detected.</p>`;
    return;
  }

  container.innerHTML = moments
    .map((m) => {
      const start  = m?.start  ?? 0;
      const end    = m?.end    ?? 0;
      const reason = m?.reason ?? "No details provided.";
      return `
        <div class="weak-item">
          <div class="weak-timestamp">
            <i class="bi bi-clock me-1"></i>${formatSeconds(start)} → ${formatSeconds(end)}
          </div>
          <p class="weak-reason">${escapeHTML(String(reason))}</p>
        </div>`;
    })
    .join("");
}
function populateImprovementPlan(data) {
  const container = document.getElementById("improvementPlan");
  if (!container) return;

  const plan = Array.isArray(data?.improvement_plan) ? data.improvement_plan : [];

  if (plan.length === 0) {
    container.innerHTML = `<p class="placeholder-text">No improvement suggestions available.</p>`;
    return;
  }

  const items = plan
    .map((item) => `
      <div class="plan-item">
        <i class="bi bi-check2-circle plan-icon"></i>
        <span>${escapeHTML(String(item))}</span>
      </div>`)
    .join("");

  container.innerHTML = `<div class="plan-grid">${items}</div>`;
}
function safeSetText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value ?? "—";
}
function formatDuration(seconds) {
  const n = Number(seconds);
  if (isNaN(n) || n < 0) return "—";
  const mins = Math.floor(n / 60);
  const secs = Math.floor(n % 60);
  return `${mins}m ${secs}s`;
}
function formatSeconds(seconds) {
  const n = Number(seconds);
  if (isNaN(n) || n < 0) return "0:00";
  const m = Math.floor(n / 60);
  const s = Math.floor(n % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
function escapeHTML(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
function populateTranscript(data) {
  const box = document.getElementById("transcriptBody");
  const toggleBtn = document.getElementById("toggleTranscriptBtn");
  const section = document.getElementById("transcriptSection");
  const copyBtn = document.getElementById("copyTranscriptBtn");

  if (!box || !toggleBtn || !section) return;

  const text = data?.transcript;

  if (!text || text.trim() === "") {
    box.textContent = "No transcript available.";
  } else {
    box.textContent = text.trim();
  }

  toggleBtn.addEventListener("click", () => {
    const isHidden = section.classList.contains("d-none");
    section.classList.toggle("d-none", !isHidden);
    toggleBtn.innerHTML = isHidden
      ? '<i class="bi bi-chevron-up me-1"></i>Hide'
      : '<i class="bi bi-chevron-down me-1"></i>Show';
  });

  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(box.textContent).then(() => {
        copyBtn.innerHTML = '<i class="bi bi-check2 me-1"></i>Copied!';
        setTimeout(() => {
          copyBtn.innerHTML = '<i class="bi bi-clipboard me-1"></i>Copy Transcript';
        }, 2000);
      });
    });
  }
}