import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const required = [
  "index.html",
  "styles.css",
  "src/app.js",
  "src/flow-cost-core.js",
  "README.md",
  "LICENSE",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/calculation_case.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  "docs/demo.png",
  "favicon.svg"
];

for (const file of required) {
  const info = await stat(file);
  assert.ok(info.size > 50, `${file} should not be empty`);
}

const pkg = JSON.parse(await readFile("package.json", "utf8"));
assert.deepEqual(pkg.dependencies || {}, {}, "runtime dependencies stay empty");
assert.equal(pkg.private, false, "package is publishable metadata");

const html = await readFile("index.html", "utf8");
assert.ok(html.includes('type="module" src="src/app.js"'), "HTML loads app module");
assert.ok(html.includes("data-testid=\"step-list\""), "HTML exposes testable step list");
assert.ok(html.includes("data-testid=\"workflow-template\""), "HTML exposes starter templates");
assert.ok(html.includes("favicon.svg"), "favicon is wired");

const css = await readFile("styles.css", "utf8");
assert.ok(css.includes("@media (max-width: 720px)"), "mobile breakpoint exists");
assert.ok(!css.includes("letter-spacing: -"), "no negative letter spacing");

const readme = await readFile("README.md", "utf8");
assert.ok(readme.includes("github.io/fun-20260531-b-flow-cost-card"), "README links the live demo");
assert.ok(readme.includes("Project status"), "README explains project status");
assert.ok(readme.includes("Why it may be worth starring"), "README explains star value");
assert.ok(readme.includes("Inspiration"), "README records inspiration sources");
assert.ok(readme.includes("Roadmap"), "README includes a roadmap");
assert.ok(readme.includes("Starter templates"), "README documents starter templates");
assert.ok(readme.includes("Contributing"), "README points contributors to the workflow");
assert.ok(readme.includes("npm run verify:browser"), "README includes browser verification");

console.log("static check ok");
