import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    // mcp-use build output and generated env types are never hand-edited.
    ".mcp-use/**",
    "mcp-env.d.ts",
    // Skill copies installed per agent (see skills-lock.json); vendored verbatim.
    ".agents/**",
    ".claude/**",
    ".cursor/**",
  ],
});
