import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { Script } from "node:vm";

const roots = ["index.html", "station/index.html", "fl/index.html"];
const scriptPattern = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
const problems = [];

for (const file of roots) {
  const html = await readFile(file, "utf8");
  const scripts = [...html.matchAll(scriptPattern)];
  if (!scripts.length) problems.push(`${file}: missing inline JavaScript`);
  scripts.forEach(([, source], i) => {
    try { new Script(source, { filename: `${file}#script-${i + 1}` }); }
    catch (error) { problems.push(`${file}#script-${i + 1}: ${error.message}`); }
  });

  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) problems.push(`${file}: missing viewport`);
  if (!/<title>[^<]+<\/title>/i.test(html)) problems.push(`${file}: missing title`);
  if (!/<meta[^>]+name=["']description["']/i.test(html)) problems.push(`${file}: missing description`);
  if (!/<html[^>]+lang=["'][^"']+["']/i.test(html)) problems.push(`${file}: missing html lang`);
  if (!/<main\b/i.test(html)) problems.push(`${file}: missing main landmark`);
  if (!/<meta[^>]+name=["']theme-color["']/i.test(html)) problems.push(`${file}: missing theme-color`);
  if (/<a\b[^>]+target=["']_blank["']/i.test(html) && !/rel=["'][^"']*noopener/i.test(html)) problems.push(`${file}: external target=_blank link without noopener`);
}

if (problems.length) {
  console.error("DUCK AUDIT FAILED");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
console.log("DUCK AUDIT OK — syntax, metadata, landmarks and security basics passed.");
