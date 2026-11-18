// Generates src/generated/site-api.ts from the site's OpenAPI document, so the
// MCP server's calls and value lists (categories, colours, sections, …) come
// from the site instead of hand-copied constants.
//
//   pnpm api:generate          # write the file
//   pnpm api:check             # fail when the file is stale (CI)
//
// Reads https://motionvideo.xyz/openapi.json, or MOTIONVIDEO_SITE_URL's.
// Deploy the site first: the check compares against the live document.
//
// openapi-typescript runs through `pnpm dlx` with TypeScript 5 pinned: it
// builds its output with the TypeScript 5 compiler API, which the project's
// TypeScript 7 (native) doesn't have.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const target = path.join(root, "src/generated/site-api.ts");
const site = (
  process.env.MOTIONVIDEO_SITE_URL ?? "https://motionvideo.xyz"
).replace(/\/+$/u, "");
const specUrl = `${site}/openapi.json`;
const check = process.argv.includes("--check");

const scratch = mkdtempSync(path.join(tmpdir(), "site-api-"));
const output = check ? path.join(scratch, "site-api.ts") : target;
try {
  execFileSync(
    "pnpm",
    [
      "dlx",
      "--package=typescript@5.9.3",
      "--package=openapi-typescript@7.13.0",
      "openapi-typescript",
      specUrl,
      "--enum-values",
      "--root-types",
      "--output",
      output,
    ],
    { cwd: scratch, stdio: ["ignore", "ignore", "inherit"] }
  );
  if (check) {
    const current = readFileSync(target, "utf-8");
    if (readFileSync(output, "utf-8") === current) {
      console.log(`src/generated/site-api.ts matches ${specUrl}.`);
    } else {
      console.error(
        `src/generated/site-api.ts is out of date with ${specUrl}. Run \`pnpm api:generate\`.`
      );
      process.exitCode = 1;
    }
  } else {
    console.log(`Wrote src/generated/site-api.ts from ${specUrl}.`);
  }
} finally {
  rmSync(scratch, { force: true, recursive: true });
}
