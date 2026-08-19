import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import { Script } from "node:vm";

const htmlFiles = ["index.html", "station/index.html", "fl/index.html"];
const scriptPattern = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;

for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  const scripts = [...html.matchAll(scriptPattern)];

  if (scripts.length === 0) {
    throw new Error(`${file}: no inline script found`);
  }

  scripts.forEach(([_, source], index) => {
    try {
      new Script(source, { filename: `${file}#script-${index + 1}` });
    } catch (error) {
      throw new Error(`${file}#script-${index + 1}: ${error.message}`, { cause: error });
    }
  });

  console.log(`ok ${relative(process.cwd(), file)} (${scripts.length} inline script)`);
}
