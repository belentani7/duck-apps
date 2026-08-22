import { readFile } from "node:fs/promises";
import { Script } from "node:vm";

// Duck is a collection of self-contained HTML apps. Keep CI strict about
// executable integrity, while treating presentation/accessibility metadata
// as warnings until it can be improved in the documents themselves.
const roots = ["index.html", "station/index.html", "fl/index.html"];
const errors = [];
const warnings = [];
const scriptPattern = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;

for (const file of roots) {
  const html = await readFile(file, "utf8");
  const scripts = [...html.matchAll(scriptPattern)];

  if (!scripts.length) errors.push(`${file}: missing inline JavaScript`);
  scripts.forEach(([, source], i) => {
    try {
      new Script(source, { filename: `${file}#script-${i + 1}` });
    } catch (error) {
      errors.push(`${file}#script-${i + 1}: ${error.message}`);
    }
  });

  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) errors.push(`${file}: missing viewport`);
  if (!/<title>[^<]+<\/title>/i.test(html)) errors.push(`${file}: missing title`);
  if (!/<html[^>]+lang=["'][^"']+["']/i.test(html)) errors.push(`${file}: missing html lang`);

  if (!/<meta[^>]+name=["']description["']/i.test(html)) warnings.push(`${file}: missing description`);
  if (!/<meta[^>]+name=["']theme-color["']/i.test(html)) warnings.push(`${file}: missing theme-color`);
  if (!/<main\b/i.test(html)) warnings.push(`${file}: no <main> landmark (app shell)`);

  const blankLinks = [...html.matchAll(/<a\b[^>]*target=["']_blank["'][^>]*>/gi)];
  for (const [tag] of blankLinks) {
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1] ?? "";
    const safe = /rel=["'][^"']*noopener/i.test(tag);
    const external = /^(?:https?:)?\/\//i.test(href);
    if (external && !safe) warnings.push(`${file}: external target=_blank link without noopener`);
  }
}

if (warnings.length) {
  console.warn("DUCK AUDIT WARNINGS");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length) {
  console.error("DUCK AUDIT FAILED");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`DUCK AUDIT OK — ${roots.length} apps: JavaScript syntax and required document invariants passed.`);
