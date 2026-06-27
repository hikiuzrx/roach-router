// Generates a "Rendered diagrams" section for README.md.
// For every ```mermaid block in the README, emits an <img> pointing at kroki.io
// with the deflated source embedded in the URL — no external files committed,
// no Chromium dependency, renders in any markdown viewer.
//
// Usage: bun scripts/render-diagrams.ts
import { deflateSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";

const README = `${import.meta.dir}/../README.md`;
const START = "<!-- BEGIN:RENDERED-DIAGRAMS -->";
const END = "<!-- END:RENDERED-DIAGRAMS -->";

const krokiUrl = (mermaid: string): string => {
  const deflated = deflateSync(Buffer.from(mermaid, "utf-8"), { level: 9 });
  const b64 = deflated
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `https://kroki.io/mermaid/svg/${b64}`;
};

const main = (): void => {
  const text = readFileSync(README, "utf-8");

  const blocks: { title: string; code: string }[] = [];
  const lines = text.split("\n");
  let currentHeading = "Diagram";
  let inMermaid = false;
  let buf: string[] = [];
  for (const line of lines) {
    const h = line.match(/^##\s+(.+)$/);
    if (h) currentHeading = h[1]!.trim();
    if (line.trim() === "```mermaid") {
      inMermaid = true;
      buf = [];
      continue;
    }
    if (inMermaid && line.trim() === "```") {
      inMermaid = false;
      blocks.push({ title: currentHeading, code: buf.join("\n") });
      continue;
    }
    if (inMermaid) buf.push(line);
  }

  const rendered: string[] = [START, "", "## Diagrams (rendered)", "", "Image versions of every Mermaid block above — visible in any markdown viewer, no extension required.", ""];
  for (const b of blocks) {
    rendered.push(`### ${b.title}`);
    rendered.push("");
    rendered.push(`![${b.title}](${krokiUrl(b.code)})`);
    rendered.push("");
  }
  rendered.push(END);
  const newSection = rendered.join("\n");

  let next: string;
  if (text.includes(START) && text.includes(END)) {
    next = text.replace(new RegExp(`${START}[\\s\\S]*?${END}`), newSection);
  } else {
    next = `${text.trimEnd()}\n\n${newSection}\n`;
  }
  writeFileSync(README, next);
  console.log(`Rendered ${blocks.length} diagram(s) into ${README}`);
};

main();
