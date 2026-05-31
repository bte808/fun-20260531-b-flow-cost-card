export const SAMPLE_STEPS = [
  {
    id: "classify",
    name: "Classify request",
    type: "model",
    group: "1",
    count: 1,
    inputTokens: 1600,
    outputTokens: 180,
    inputCostPerM: 0.15,
    outputCostPerM: 0.6,
    fixedCost: 0,
    p50Seconds: 2.2,
    p95Seconds: 5.8,
    note: "cheap model"
  },
  {
    id: "lookup",
    name: "Search internal docs",
    type: "tool",
    group: "2",
    count: 2,
    inputTokens: 0,
    outputTokens: 0,
    inputCostPerM: 0,
    outputCostPerM: 0,
    fixedCost: 0.001,
    p50Seconds: 1.1,
    p95Seconds: 3.5,
    note: "parallel-safe"
  },
  {
    id: "draft",
    name: "Draft answer",
    type: "model",
    group: "3",
    count: 1,
    inputTokens: 5200,
    outputTokens: 950,
    inputCostPerM: 0.35,
    outputCostPerM: 1.4,
    fixedCost: 0,
    p50Seconds: 5.6,
    p95Seconds: 14,
    note: "main cost"
  },
  {
    id: "check",
    name: "Policy check",
    type: "model",
    group: "4",
    count: 1,
    inputTokens: 1900,
    outputTokens: 120,
    inputCostPerM: 0.15,
    outputCostPerM: 0.6,
    fixedCost: 0,
    p50Seconds: 1.9,
    p95Seconds: 4.9,
    note: "guardrail"
  }
];

const TYPE_LABELS = {
  model: "Model",
  tool: "Tool",
  human: "Human",
  other: "Other"
};

export function calculateWorkflow(input) {
  const workflowName = String(input.workflowName || "Untitled workflow").trim() || "Untitled workflow";
  const runsPerDay = clampNumber(input.runsPerDay, 1, 0, 100000);
  const workdaysPerMonth = clampNumber(input.workdaysPerMonth, 22, 0, 31);
  const steps = (input.steps || []).map(normalizeStep).filter((step) => step.name);

  const enrichedSteps = steps.map((step) => {
    const tokenCost =
      (step.inputTokens * step.inputCostPerM + step.outputTokens * step.outputCostPerM) / 1_000_000;
    const unitCost = tokenCost + step.fixedCost;
    const costPerRun = unitCost * step.count;
    const p50RunSeconds = step.p50Seconds * step.count;
    const p95RunSeconds = step.p95Seconds * step.count;

    return {
      ...step,
      typeLabel: TYPE_LABELS[step.type] || TYPE_LABELS.other,
      tokenCost,
      unitCost,
      costPerRun,
      costPerDay: costPerRun * runsPerDay,
      costPerMonth: costPerRun * runsPerDay * workdaysPerMonth,
      p50RunSeconds,
      p95RunSeconds
    };
  });

  const groups = buildGroups(enrichedSteps);
  const sequentialP50 = sum(enrichedSteps.map((step) => step.p50RunSeconds));
  const sequentialP95 = sum(enrichedSteps.map((step) => step.p95RunSeconds));
  const wallP50 = sum(groups.map((group) => group.p50RunSeconds));
  const wallP95 = sum(groups.map((group) => group.p95RunSeconds));
  const costPerRun = sum(enrichedSteps.map((step) => step.costPerRun));
  const costPerDay = costPerRun * runsPerDay;
  const costPerMonth = costPerDay * workdaysPerMonth;
  const bottleneckCost = maxBy(enrichedSteps, "costPerRun");
  const bottleneckLatency = maxBy(enrichedSteps, "p95RunSeconds");
  const modelShare = safeRatio(
    sum(enrichedSteps.filter((step) => step.type === "model").map((step) => step.costPerRun)),
    costPerRun
  );
  const warnings = buildWarnings(enrichedSteps, costPerMonth, wallP95);

  return {
    workflowName,
    runsPerDay,
    workdaysPerMonth,
    steps: enrichedSteps,
    groups,
    totals: {
      costPerRun,
      costPerDay,
      costPerMonth,
      sequentialP50,
      sequentialP95,
      wallP50,
      wallP95,
      parallelP95Saved: Math.max(0, sequentialP95 - wallP95),
      modelShare
    },
    bottleneckCost,
    bottleneckLatency,
    warnings
  };
}

export function makeMarkdownReport(input, existingResult) {
  const result = existingResult || calculateWorkflow(input);
  const lines = [
    `# ${result.workflowName} cost card`,
    "",
    `Runs/day: ${formatNumber(result.runsPerDay)} | Workdays/month: ${formatNumber(result.workdaysPerMonth)}`,
    "",
    `Cost/run: ${formatMoney(result.totals.costPerRun)}`,
    `Cost/day: ${formatMoney(result.totals.costPerDay)}`,
    `Cost/month: ${formatMoney(result.totals.costPerMonth)}`,
    `P95 wall time: ${formatDuration(result.totals.wallP95)}`,
    "",
    "| Step | Type | Group | Count | Cost/run | P95 | Note |",
    "| --- | --- | --- | ---: | ---: | ---: | --- |"
  ];

  for (const step of result.steps) {
    lines.push(
      `| ${escapePipes(step.name)} | ${step.typeLabel} | ${escapePipes(step.group)} | ${formatNumber(
        step.count
      )} | ${formatMoney(step.costPerRun)} | ${formatDuration(step.p95RunSeconds)} | ${escapePipes(
        step.note
      )} |`
    );
  }

  lines.push("");
  lines.push(
    `Cost bottleneck: ${
      result.bottleneckCost ? `${result.bottleneckCost.name} (${formatMoney(result.bottleneckCost.costPerRun)})` : "none"
    }`
  );
  lines.push(
    `Latency bottleneck: ${
      result.bottleneckLatency ? `${result.bottleneckLatency.name} (${formatDuration(result.bottleneckLatency.p95RunSeconds)})` : "none"
    }`
  );

  if (result.warnings.length) {
    lines.push("");
    lines.push("Watch list:");
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return lines.join("\n");
}

export function toCsv(result) {
  const rows = [
    [
      "step",
      "type",
      "group",
      "count",
      "input_tokens",
      "output_tokens",
      "cost_per_run",
      "p50_seconds",
      "p95_seconds",
      "note"
    ],
    ...result.steps.map((step) => [
      step.name,
      step.typeLabel,
      step.group,
      step.count,
      step.inputTokens,
      step.outputTokens,
      roundCurrency(step.costPerRun),
      roundMetric(step.p50RunSeconds),
      roundMetric(step.p95RunSeconds),
      step.note
    ])
  ];

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function formatMoney(value) {
  const number = Number.isFinite(value) ? value : 0;
  if (number === 0) return "$0.00";
  if (Math.abs(number) < 0.01) return `$${number.toFixed(4)}`;
  if (Math.abs(number) < 1000) return `$${number.toFixed(2)}`;
  return `$${number.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function formatDuration(seconds) {
  const number = Math.max(0, Number(seconds) || 0);
  if (number < 60) return `${roundMetric(number)}s`;
  const minutes = Math.floor(number / 60);
  const rest = Math.round(number % 60);
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function normalizeStep(step, index) {
  return {
    id: String(step.id || `step-${index + 1}`),
    name: String(step.name || "").trim(),
    type: ["model", "tool", "human", "other"].includes(step.type) ? step.type : "other",
    group: String(step.group || index + 1).trim() || String(index + 1),
    count: clampNumber(step.count, 1, 0, 10000),
    inputTokens: clampNumber(step.inputTokens, 0, 0, 1000000000),
    outputTokens: clampNumber(step.outputTokens, 0, 0, 1000000000),
    inputCostPerM: clampNumber(step.inputCostPerM, 0, 0, 1000000),
    outputCostPerM: clampNumber(step.outputCostPerM, 0, 0, 1000000),
    fixedCost: clampNumber(step.fixedCost, 0, 0, 1000000),
    p50Seconds: clampNumber(step.p50Seconds, 0, 0, 86400),
    p95Seconds: clampNumber(step.p95Seconds, 0, 0, 86400),
    note: String(step.note || "").trim()
  };
}

function buildGroups(steps) {
  const map = new Map();
  for (const step of steps) {
    if (!map.has(step.group)) {
      map.set(step.group, {
        group: step.group,
        steps: [],
        costPerRun: 0,
        p50RunSeconds: 0,
        p95RunSeconds: 0
      });
    }
    const group = map.get(step.group);
    group.steps.push(step);
    group.costPerRun += step.costPerRun;
    group.p50RunSeconds = Math.max(group.p50RunSeconds, step.p50RunSeconds);
    group.p95RunSeconds = Math.max(group.p95RunSeconds, step.p95RunSeconds);
  }
  return [...map.values()];
}

function buildWarnings(steps, costPerMonth, wallP95) {
  const warnings = [];
  const missingRates = steps.filter(
    (step) =>
      step.type === "model" &&
      (step.inputTokens > 0 || step.outputTokens > 0) &&
      step.inputCostPerM === 0 &&
      step.outputCostPerM === 0
  );
  const slowSteps = steps.filter((step) => step.p95RunSeconds >= 30);

  if (missingRates.length) {
    warnings.push(`${missingRates.length} model step(s) have token volume but no price rate.`);
  }
  if (costPerMonth >= 100) {
    warnings.push(`Monthly run-rate is ${formatMoney(costPerMonth)}; verify rate cards before launch.`);
  }
  if (wallP95 >= 60) {
    warnings.push(`P95 wall time is ${formatDuration(wallP95)}; consider parallel groups or caching.`);
  }
  if (slowSteps.length) {
    warnings.push(`${slowSteps.length} step(s) take 30s+ at P95.`);
  }

  return warnings;
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function maxBy(items, key) {
  if (!items.length) return null;
  return items.reduce((best, item) => (item[key] > best[key] ? item : best), items[0]);
}

function safeRatio(part, whole) {
  if (!whole) return 0;
  return part / whole;
}

function escapePipes(value) {
  return String(value || "").replaceAll("|", "\\|");
}

function csvCell(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function roundCurrency(value) {
  return Math.round((Number(value) || 0) * 1000000) / 1000000;
}

function roundMetric(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
}
