"use strict";

let scoreChartInstance  = null;
let fillerChartInstance = null;

const CHART_DEFAULTS = {
  fontFamily: "'DM Sans', sans-serif",
  color:      "#8b949e",
};
const SCORE_COLORS = {
  clarity:     { bg: "rgba(0,212,170,0.25)",  border: "rgba(0,212,170,0.85)"  },
  relevance:   { bg: "rgba(0,168,135,0.25)",  border: "rgba(0,168,135,0.85)"  },
  specificity: { bg: "rgba(227,179,65,0.25)", border: "rgba(227,179,65,0.85)" },
  confidence:  { bg: "rgba(63,185,80,0.25)",  border: "rgba(63,185,80,0.85)"  },
};

const FILLER_PALETTE_BG = [
  "rgba(248,81,73,0.25)",
  "rgba(227,179,65,0.25)",
  "rgba(0,212,170,0.25)",
  "rgba(163,113,247,0.25)",
  "rgba(63,185,80,0.25)",
];

const FILLER_PALETTE_BORDER = [
  "rgba(248,81,73,0.9)",
  "rgba(227,179,65,0.9)",
  "rgba(0,212,170,0.9)",
  "rgba(163,113,247,0.9)",
  "rgba(63,185,80,0.9)",
];
function renderScoreChart(data) {
  const canvas = document.getElementById("scoreChart");
  if (!canvas) {
    console.warn("[IRAS Charts] #scoreChart canvas not found.");
    return;
  }

  const scores = data?.scores ?? {};

  const labels = ["Clarity", "Relevance", "Specificity", "Confidence"];
  const values = [
    Number(scores.clarity)     || 0,
    Number(scores.relevance)   || 0,
    Number(scores.specificity) || 0,
    Number(scores.confidence)  || 0,
  ];

  if (values.every((v) => v === 0)) {
    console.warn("[IRAS Charts] No score data — skipping score chart.");
    showChartPlaceholder(canvas, "No score data available");
    return;
  }

  if (scoreChartInstance) {
    scoreChartInstance.destroy();
    scoreChartInstance = null;
  }

  const colorKeys = ["clarity", "relevance", "specificity", "confidence"];
  const bgColors     = colorKeys.map((k) => SCORE_COLORS[k].bg);
  const borderColors = colorKeys.map((k) => SCORE_COLORS[k].border);

  scoreChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Score",
          data: values,
          backgroundColor: bgColors,
          borderColor: borderColors,
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    options: buildBarOptions({
      yMax: 100,
      label: "Score",
      showLegend: false,
    }),
  });
}

function renderFillerChart(data) {
  const canvas = document.getElementById("fillerChart");
  if (!canvas) {
    console.warn("[IRAS Charts] #fillerChart canvas not found.");
    return;
  }

  const topFillers = data?.speech_metrics?.top_fillers ?? null;

  if (!topFillers || typeof topFillers !== "object" || Object.keys(topFillers).length === 0) {
    console.warn("[IRAS Charts] No filler word data — skipping filler chart.");
    showChartPlaceholder(canvas, "No filler word data");
    return;
  }

  const entries = Object.entries(topFillers)
    .filter(([, v]) => Number(v) > 0)
    .sort(([, a], [, b]) => Number(b) - Number(a))
    .slice(0, 8);

  if (entries.length === 0) {
    showChartPlaceholder(canvas, "No filler words detected");
    return;
  }

  const labels = entries.map(([k]) => `"${k}"`);
  const values = entries.map(([, v]) => Number(v));
  const bgColors     = entries.map((_, i) => FILLER_PALETTE_BG[i % FILLER_PALETTE_BG.length]);
  const borderColors = entries.map((_, i) => FILLER_PALETTE_BORDER[i % FILLER_PALETTE_BORDER.length]);

  if (fillerChartInstance) {
    fillerChartInstance.destroy();
    fillerChartInstance = null;
  }

  fillerChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Count",
          data: values,
          backgroundColor: bgColors,
          borderColor: borderColors,
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    options: buildBarOptions({
      yMax: Math.max(...values) + 2,
      label: "Count",
      showLegend: false,
    }),
  });
}

function buildBarOptions({ yMax = 100, label = "Value", showLegend = false } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 800,
      easing: "easeOutQuart",
    },
    plugins: {
      legend: {
        display: showLegend,
        labels: {
          color: CHART_DEFAULTS.color,
          font: { family: CHART_DEFAULTS.fontFamily, size: 12 },
        },
      },
      tooltip: {
        backgroundColor: "#1c2333",
        borderColor: "#30363d",
        borderWidth: 1,
        titleColor: "#e6edf3",
        bodyColor: "#8b949e",
        titleFont: { family: CHART_DEFAULTS.fontFamily, size: 13, weight: "700" },
        bodyFont:  { family: CHART_DEFAULTS.fontFamily, size: 12 },
        padding: 10,
        callbacks: {
          label: (ctx) => ` ${label}: ${ctx.parsed.y}`,
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: "rgba(48,54,61,0.6)",
          drawBorder: false,
        },
        ticks: {
          color: CHART_DEFAULTS.color,
          font: { family: CHART_DEFAULTS.fontFamily, size: 12 },
        },
      },
      y: {
        min: 0,
        max: yMax,
        grid: {
          color: "rgba(48,54,61,0.6)",
          drawBorder: false,
        },
        ticks: {
          color: CHART_DEFAULTS.color,
          font: { family: CHART_DEFAULTS.fontFamily, size: 11 },
          stepSize: yMax <= 20 ? 2 : 10,
        },
      },
    },
  };
}

function showChartPlaceholder(canvas, message = "No data") {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#1c2333";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#484f58";
  ctx.font = "14px 'DM Sans', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(message, canvas.width / 2, canvas.height / 2);
}