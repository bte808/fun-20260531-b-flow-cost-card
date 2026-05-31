import assert from "node:assert/strict";
import {
  SAMPLE_STEPS,
  calculateWorkflow,
  formatDuration,
  formatMoney,
  makeMarkdownReport,
  toCsv
} from "../src/flow-cost-core.js";

const base = {
  workflowName: "Support answer agent",
  runsPerDay: 10,
  workdaysPerMonth: 20,
  steps: SAMPLE_STEPS
};

const result = calculateWorkflow(base);

assert.equal(result.steps.length, 4);
assert.equal(result.workflowName, "Support answer agent");
assert.ok(result.totals.costPerRun > 0.003, "cost per run is calculated");
assert.ok(result.totals.costPerMonth > result.totals.costPerDay, "monthly cost scales");
assert.equal(result.groups.length, 4, "sample uses four serial groups");
assert.equal(result.totals.parallelP95Saved, 0, "serial groups do not claim saved latency");
assert.equal(result.bottleneckCost.name, "Draft answer");
assert.equal(result.bottleneckLatency.name, "Draft answer");

const parallel = calculateWorkflow({
  ...base,
  steps: [
    { ...SAMPLE_STEPS[0], group: "A", p95Seconds: 8 },
    { ...SAMPLE_STEPS[1], group: "A", p95Seconds: 3, count: 1 },
    { ...SAMPLE_STEPS[2], group: "B", p95Seconds: 12 }
  ]
});
assert.equal(parallel.groups.length, 2);
assert.equal(parallel.totals.wallP95, 20);
assert.equal(parallel.totals.parallelP95Saved, 3);

const missingRate = calculateWorkflow({
  ...base,
  steps: [{ ...SAMPLE_STEPS[0], inputCostPerM: 0, outputCostPerM: 0 }]
});
assert.ok(missingRate.warnings.some((warning) => warning.includes("no price rate")));

const markdown = makeMarkdownReport(base, result);
assert.ok(markdown.includes("# Support answer agent cost card"));
assert.ok(markdown.includes("| Draft answer | Model |"));
assert.ok(markdown.includes("Cost bottleneck: Draft answer"));

const csv = toCsv(result);
assert.ok(csv.startsWith("step,type,group"));
assert.ok(csv.includes("Policy check,Model"));

assert.equal(formatMoney(0.0042), "$0.0042");
assert.equal(formatMoney(12.4), "$12.40");
assert.equal(formatDuration(75), "1m 15s");

console.log("core ok");
