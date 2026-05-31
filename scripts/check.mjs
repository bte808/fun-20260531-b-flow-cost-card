import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const required = [
  "index.html",
  "styles.css",
  "src/app.js",
  "src/flow-cost-core.js",
  "README.md",
  "LICENSE",
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
assert.ok(html.includes("favicon.svg"), "favicon is wired");

const css = await readFile("styles.css", "utf8");
assert.ok(css.includes("@media (max-width: 720px)"), "mobile breakpoint exists");
assert.ok(!css.includes("letter-spacing: -"), "no negative letter spacing");

const readme = await readFile("README.md", "utf8");
assert.ok(readme.includes("Why it may be worth starring"), "README explains star value");
assert.ok(readme.includes("Inspiration"), "README records inspiration sources");
assert.ok(readme.includes("npm run verify:browser"), "README includes browser verification");

console.log("static check ok");
