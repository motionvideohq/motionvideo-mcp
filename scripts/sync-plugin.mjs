// Refreshes bundled source copies and aligns host manifest versions with
// package.json. This updates repository artifacts only; deploying the MCP server
// and publishing host bundles are separate release steps.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const { version } = JSON.parse(
  await readFile(path.resolve(root, "package.json"), "utf-8")
);
const manifests = [
  "plugins/motionvideo/plugin.json",
  "plugins/motionvideo/.claude-plugin/plugin.json",
  "gemini-extension.json",
  "kimi.plugin.json",
  "plugins/antigravity/plugin.json",
];

// Finish canonical manifests before copying kimi.plugin.json into the bundle.
const versionResults = await Promise.all(
  manifests.map(async (file) => {
    const target = path.resolve(root, file);
    const current = await readFile(target, "utf-8");
    const manifest = JSON.parse(current);
    if (manifest.version === version) {
      return `up to date  ${file}`;
    }

    manifest.version = version;
    await writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`);
    return `synced      ${file}`;
  })
);

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

const allResults = [...versionResults, ...results];
for (const line of allResults) {
  console.log(line);
}

const changed = allResults.filter((result) =>
  result.startsWith("synced")
).length;
console.log(
  changed === 0 ? "Plugin copies are in sync." : `Synced ${changed} file(s).`
);
