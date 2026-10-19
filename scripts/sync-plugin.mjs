// Keeps the plugin package's embedded copies of the skill and the icon in sync
// with their canonical sources, so `plugins/motionvideo/` always matches what
// the MCP server and the site ship. Run with `pnpm plugin:sync`; lefthook runs
// it before commits that touch either source.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const copies = [
  [
    "skills/motionvideo/SKILL.md",
    "plugins/motionvideo/skills/motionvideo/SKILL.md",
  ],
  [
    "skills/motionvideo/SKILL.md",
    "plugins/antigravity/skills/motionvideo/SKILL.md",
  ],
  [
    "skills/motionvideo/mcp.json",
    "plugins/motionvideo/skills/motionvideo/mcp.json",
  ],
  ["kimi.plugin.json", "plugins/motionvideo/kimi.plugin.json"],
  ["public/icon.svg", "plugins/motionvideo/assets/icon.svg"],
];

const results = await Promise.all(
  copies.map(async ([from, to]) => {
    const [next, current] = await Promise.all([
      readFile(path.resolve(root, from)),
      readFile(path.resolve(root, to)).catch(() => null),
    ]);

    if (current?.equals(next)) {
      return `up to date  ${to}`;
    }

    const target = path.resolve(root, to);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, next);
    return `synced      ${to}`;
  })
);

for (const line of results) {
  console.log(line);
}

const changed = results.filter((result) => result.startsWith("synced")).length;
console.log(
  changed === 0 ? "Plugin copies are in sync." : `Synced ${changed} file(s).`
);
