#!/usr/bin/env node
/**
 * Sync the MotionVideo catalog and resource directories from the sibling
 * motionvideo.xyz checkout into ./data.
 *
 * Usage:
 *   node scripts/sync-catalog.mjs [path-to-motionvideo.xyz]
 *   MOTIONVIDEO_DIR=/path/to/motionvideo.xyz node scripts/sync-catalog.mjs
 */
import { copyFileSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(
  process.argv[2] ?? process.env.MOTIONVIDEO_DIR ?? join(root, "..", "motionvideo.xyz")
);

const files = [
  ["src/data/motion-catalog.json", "data/motion-catalog.json"],
  ["src/data/resource-directories.json", "data/resource-directories.json"],
];

let failures = 0;

for (const [from, to] of files) {
  const sourcePath = join(source, from);
  const targetPath = join(root, to);
  try {
    statSync(sourcePath);
    copyFileSync(sourcePath, targetPath);
    const parsed = JSON.parse(readFileSync(targetPath, "utf8"));
    const count = parsed.videos
      ? `${parsed.videos.length} videos`
      : Object.values(parsed)
          .reduce((total, section) => total + (section?.entries?.length ?? 0), 0)
          .toString()
          .concat(" entries");
    const importedAt = parsed.importedAt ? ` (imported ${parsed.importedAt})` : "";
    console.log(`synced ${to}: ${count}${importedAt}`);
  } catch (error) {
    failures += 1;
    console.error(`failed to sync ${from}: ${error.message}`);
  }
}

if (failures > 0) {
  console.error(
    `\nChecked source directory: ${source}\nPass the motionvideo.xyz checkout path, e.g.:\n  node scripts/sync-catalog.mjs /path/to/motionvideo.xyz`
  );
  process.exit(1);
}

console.log("Catalog up to date.");
