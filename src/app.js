import {
  SAMPLE_STEPS,
  calculateWorkflow,
  formatDuration,
  formatMoney,
  makeMarkdownReport,
  toCsv
} from "./flow-cost-core.js";

const STORAGE_KEY = "flow-cost-card-state-v1";

const state = loadState();
const elements = {
  workflowName: document.querySelector("[data-testid='workflow-name']"),
  runsPerDay: document.querySelector("[data-testid='runs-per-day']"),
  workdaysPerMonth: document.querySelector("[data-testid='workdays-per-month']"),
  stepList: document.querySelector("[data-testid='step-list']"),
  addStep: document.querySelector("[data-testid='add-step']"),
  resetSample: document.querySelector("[data-testid='reset-sample']"),
  copyReport: document.querySelector("[data-testid='copy-report']"),
  downloadJson: document.querySelector("[data-testid='download-json']"),
  downloadCsv: document.querySelector("[data-testid='download-csv']"),
  output: document.querySelector("[data-testid='report-output']"),
  status: document.querySelector("[data-testid='status']"),
  summary: document.querySelector("[data-testid='summary']"),
  warnings: document.querySelector("[data-testid='warnings']")
};

bindControls();
renderAll();

function bindControls() {
  elements.workflowName.addEventListener("input", () => {
    state.workflowName = elements.workflowName.value;
    saveState();
    renderResults();
  });

  elements.runsPerDay.addEventListener("input", () => {
    state.runsPerDay = elements.runsPerDay.value;
    saveState();
    renderResults();
  });

  elements.workdaysPerMonth.addEventListener("input", () => {
    state.workdaysPerMonth = elements.workdaysPerMonth.value;
    saveState();
    renderResults();
  });

  elements.addStep.addEventListener("click", () => {
    state.steps.push(makeBlankStep(state.steps.length + 1));
    saveState();
    renderAll();
    setStatus("Step added");
  });

  elements.resetSample.addEventListener("click", () => {
    Object.assign(state, getDefaultState());
    saveState();
    renderAll();
    setStatus("Sample restored");
  });

  elements.copyReport.addEventListener("click", async () => {
    const text = elements.output.value;
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Report copied");
    } catch {
      elements.output.focus();
      elements.output.select();
      document.execCommand("copy");
      setStatus("Report selected");
    }
  });

  elements.downloadJson.addEventListener("click", () => {
    const result = calculateWorkflow(state);
    downloadFile("flow-cost-card.json", JSON.stringify({ ...state, result }, null, 2), "application/json");
    setStatus("JSON saved");
  });

  elements.downloadCsv.addEventListener("click", () => {
    downloadFile("flow-cost-card.csv", toCsv(calculateWorkflow(state)), "text/csv");
    setStatus("CSV saved");
  });

  elements.stepList.addEventListener("input", handleStepEdit);
  elements.stepList.addEventListener("change", handleStepEdit);
  elements.stepList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action='remove']");
    if (!button) return;
    const index = Number(button.closest("[data-index]").dataset.index);
    state.steps.splice(index, 1);
    if (!state.steps.length) state.steps.push(makeBlankStep(1));
    saveState();
    renderAll();
    setStatus("Step removed");
  });
}

function handleStepEdit(event) {
  const field = event.target.name;
  const row = event.target.closest("[data-index]");
  if (!field || !row) return;
  state.steps[Number(row.dataset.index)][field] = event.target.value;
  saveState();
  renderResults();
}

function renderAll() {
  elements.workflowName.value = state.workflowName;
  elements.runsPerDay.value = state.runsPerDay;
  elements.workdaysPerMonth.value = state.workdaysPerMonth;
  renderStepRows();
  renderResults();
}

function renderStepRows() {
  elements.stepList.innerHTML = state.steps.map(renderStepRow).join("");
}

function renderStepRow(step, index) {
  return `
    <div class="step-row" data-index="${index}">
      <input name="name" value="${escapeHtml(step.name)}" aria-label="Step name" placeholder="Step name" />
      <select name="type" aria-label="Type">
        ${option("model", "Model", step.type)}
        ${option("tool", "Tool", step.type)}
        ${option("human", "Human", step.type)}
        ${option("other", "Other", step.type)}
      </select>
      <input name="group" value="${escapeHtml(step.group)}" aria-label="Group" inputmode="numeric" />
      <input name="count" value="${escapeHtml(step.count)}" aria-label="Count" inputmode="decimal" type="number" min="0" step="0.1" />
      <input name="inputTokens" value="${escapeHtml(step.inputTokens)}" aria-label="Input tokens" inputmode="numeric" type="number" min="0" step="1" />
      <input name="outputTokens" value="${escapeHtml(step.outputTokens)}" aria-label="Output tokens" inputmode="numeric" type="number" min="0" step="1" />
      <input name="inputCostPerM" value="${escapeHtml(step.inputCostPerM)}" aria-label="Input dollars per million" inputmode="decimal" type="number" min="0" step="0.001" />
      <input name="outputCostPerM" value="${escapeHtml(step.outputCostPerM)}" aria-label="Output dollars per million" inputmode="decimal" type="number" min="0" step="0.001" />
      <input name="fixedCost" value="${escapeHtml(step.fixedCost)}" aria-label="Fixed cost" inputmode="decimal" type="number" min="0" step="0.001" />
      <input name="p50Seconds" value="${escapeHtml(step.p50Seconds)}" aria-label="P50 seconds" inputmode="decimal" type="number" min="0" step="0.1" />
      <input name="p95Seconds" value="${escapeHtml(step.p95Seconds)}" aria-label="P95 seconds" inputmode="decimal" type="number" min="0" step="0.1" />
      <input name="note" value="${escapeHtml(step.note)}" aria-label="Note" placeholder="Note" />
      <button class="icon-button" type="button" data-action="remove" title="Remove step" aria-label="Remove step">x</button>
    </div>
  `;
}

function renderResults() {
  const result = calculateWorkflow(state);
  elements.summary.innerHTML = `
    ${summaryCard("Cost/run", formatMoney(result.totals.costPerRun), "run")}
    ${summaryCard("Cost/month", formatMoney(result.totals.costPerMonth), "month")}
    ${summaryCard("P95 wall", formatDuration(result.totals.wallP95), "latency")}
    ${summaryCard("Saved by groups", formatDuration(result.totals.parallelP95Saved), "saved")}
    ${summaryCard("Cost bottleneck", result.bottleneckCost?.name || "None", "bottleneck")}
    ${summaryCard("Latency bottleneck", result.bottleneckLatency?.name || "None", "bottleneck")}
  `;
  elements.warnings.innerHTML = result.warnings.length
    ? result.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")
    : "<li>No watch items</li>";
  elements.output.value = makeMarkdownReport(state, result);
}

function summaryCard(label, value, tone) {
  return `
    <article class="metric metric-${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.steps)) return saved;
  } catch {
    // Ignore invalid local drafts.
  }
  return getDefaultState();
}

function getDefaultState() {
  return {
    workflowName: "Support answer agent",
    runsPerDay: 35,
    workdaysPerMonth: 22,
    steps: SAMPLE_STEPS.map((step) => ({ ...step }))
  };
}

function makeBlankStep(position) {
  return {
    id: `custom-${Date.now()}`,
    name: `New step ${position}`,
    type: "model",
    group: String(position),
    count: 1,
    inputTokens: 1000,
    outputTokens: 200,
    inputCostPerM: 0.15,
    outputCostPerM: 0.6,
    fixedCost: 0,
    p50Seconds: 2,
    p95Seconds: 6,
    note: ""
  };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be blocked in private windows.
  }
}

function setStatus(message) {
  elements.status.textContent = message;
  window.clearTimeout(setStatus.timer);
  setStatus.timer = window.setTimeout(() => {
    elements.status.textContent = "Ready";
  }, 1800);
}

function downloadFile(filename, content, type) {
  const link = document.createElement("a");
  const blob = new Blob([content], { type });
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function option(value, label, current) {
  return `<option value="${value}" ${current === value ? "selected" : ""}>${label}</option>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
