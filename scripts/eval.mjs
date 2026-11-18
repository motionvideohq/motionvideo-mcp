// Agent eval: does a real model call the right tool with the right filters?
// Starts the production build, gives each request in evals/catalog.json to
// Claude Code (`claude -p`) with only this MCP server connected, and checks
// the tool calls it made against the scenario's expectations.
//
//   pnpm build && pnpm eval
//   EVAL_MODEL=haiku EVAL_ONLY=colors-all,limit pnpm eval
//
// Uses the local `claude` CLI and its sign-in; each scenario is one short
// session. MOTIONVIDEO_SITE_URL points the server at another site (e.g. a
// local `pnpm dev` of motionvideo.xyz).

import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 4324;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MODEL = process.env.EVAL_MODEL ?? "sonnet";
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY ?? 4);
const ONLY = process.env.EVAL_ONLY?.split(",").filter(Boolean);
const TOOL_PREFIX = "mcp__motionvideo__";

const { scenarios } = JSON.parse(
  await readFile(new URL("../evals/catalog.json", import.meta.url), "utf-8")
);
const selected = ONLY
  ? scenarios.filter((scenario) => ONLY.includes(scenario.id))
  : scenarios;

/** One matcher against one argument value; returns a failure or undefined. */
const checkArg = (name, value, matcher) => {
  const shown = JSON.stringify(value);
  if ("absentOr" in matcher) {
    return value === undefined || value === matcher.absentOr
      ? undefined
      : `${name}=${shown}, wanted absent or ${matcher.absentOr}`;
  }
  if (value === undefined) {
    return `${name} missing`;
  }
  if ("equals" in matcher) {
    return value === matcher.equals
      ? undefined
      : `${name}=${shown}, wanted ${JSON.stringify(matcher.equals)}`;
  }
  const values = Array.isArray(value) ? value.map(String) : [String(value)];
  if ("set" in matcher) {
    const same =
      values.length === matcher.set.length &&
      matcher.set.every((wanted) => values.includes(wanted));
    return same
      ? undefined
      : `${name}=${shown}, wanted ${JSON.stringify(matcher.set)}`;
  }
  if ("includes" in matcher) {
    return matcher.includes.every((wanted) => values.includes(wanted))
      ? undefined
      : `${name}=${shown}, wanted to include ${JSON.stringify(matcher.includes)}`;
  }
  if ("match" in matcher) {
    const pattern = new RegExp(matcher.match, "iu");
    return values.some((item) => pattern.test(item))
      ? undefined
      : `${name}=${shown}, wanted /${matcher.match}/`;
  }
  return `${name}: unknown matcher ${JSON.stringify(matcher)}`;
};

/** Failures of one call against a scenario's expected arguments. */
const checkCall = (input, expected) =>
  Object.entries(expected).flatMap(
    ([name, matcher]) => checkArg(name, input[name], matcher) ?? []
  );

const mcpConfig = JSON.stringify({
  mcpServers: { motionvideo: { type: "http", url: `${ORIGIN}/mcp` } },
});

/** Runs one scenario through `claude -p`; resolves with its tool calls. */
const runScenario = async (scenario) => {
  const child = spawn(
    "claude",
    [
      "-p",
      `${scenario.prompt}\n\nUse the motionvideo tools to answer. Keep the answer short.`,
      "--model",
      MODEL,
      "--mcp-config",
      mcpConfig,
      "--strict-mcp-config",
      "--allowedTools",
      `${TOOL_PREFIX}*`,
      "--tools",
      "",
      "--output-format",
      "stream-json",
      "--verbose",
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
  let buffer = "";
  let error = "";
  const calls = [];
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (event.type === "result" && event.is_error) {
          error = String(event.result ?? "error");
        }
        for (const block of event.message?.content ?? []) {
          if (block.type === "tool_use") {
            calls.push({
              input: block.input ?? {},
              tool: block.name.replace(TOOL_PREFIX, ""),
            });
          }
        }
      } catch {
        // Not a JSON event line.
      }
    }
  });
  child.stderr.on("data", (chunk) => {
    error += chunk;
  });
  const [code] = await once(child, "close");
  return { calls, code, error };
};

const grade = (scenario, { calls, code, error }) => {
  const toTool = calls.filter((call) => call.tool === scenario.tool);
  if (toTool.length === 0) {
    const made = calls.map((call) => call.tool).join(", ") || "none";
    return {
      ok: false,
      reason: `no ${scenario.tool} call (made: ${made})${code ? `; exit ${code}: ${error.trim().slice(0, 200)}` : ""}`,
    };
  }
  const attempts = toTool.map((call) => checkCall(call.input, scenario.args));
  const passing = attempts.findIndex((failures) => failures.length === 0);
  if (passing !== -1) {
    return { calls: toTool[passing].input, ok: true };
  }
  return {
    calls: toTool.at(-1)?.input,
    ok: false,
    reason: attempts.at(-1)?.join("; "),
  };
};

const server = spawn(
  "pnpm",
  ["exec", "mcp-use", "start", "--port", String(PORT)],
  { detached: true, stdio: "ignore" }
);

const waitForServer = async (attemptsLeft = 60) => {
  try {
    await fetch(`${ORIGIN}/.well-known/oauth-protected-resource/mcp`);
  } catch {
    if (attemptsLeft === 0) {
      throw new Error(`server did not start on ${ORIGIN}`);
    }
    await sleep(500);
    await waitForServer(attemptsLeft - 1);
  }
};

const results = [];
try {
  await waitForServer();
  const queue = [...selected];
  const worker = async () => {
    const scenario = queue.shift();
    if (!scenario) {
      return;
    }
    const outcome = grade(scenario, await runScenario(scenario));
    results.push({ id: scenario.id, ...outcome });
    console.log(
      `${outcome.ok ? "pass" : "FAIL"} ${scenario.id}: ${JSON.stringify(outcome.calls ?? {})}${outcome.ok ? "" : ` — ${outcome.reason}`}`
    );
    await worker();
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
} finally {
  process.kill(-server.pid, "SIGTERM");
}

const passed = results.filter((result) => result.ok).length;
console.log(`\n${passed}/${results.length} scenarios passed (model ${MODEL}).`);
process.exitCode = passed === results.length ? 0 : 1;
