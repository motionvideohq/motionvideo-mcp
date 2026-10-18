import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";

export default defineConfig({
  extends: [core, react, antiSlop],
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    // mcp-use build output and generated env types are never hand-edited.
    ".mcp-use/**",
    "mcp-env.d.ts",
    // Skill copies installed per agent (see skills-lock.json); vendored verbatim.
    ".agents/**",
    ".claude/**",
    ".cursor/**",
  ],
});
