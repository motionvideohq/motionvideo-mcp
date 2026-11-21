// Production-build smoke: starts `.mcp-use/build` and checks what every
// client depends on before signing in. Run after `pnpm build`:
//
//   pnpm smoke
//
// - `initialize` reports the package.json version;
// - `tools/list` lists exactly the expected tools;
// - the RFC 9728 metadata names the MCP resource and the motionvideo.xyz
//   authorization server;
// - an anonymous call to a signed-in tool gets an HTTP 401 challenge that
//   points at that metadata (what makes clients start OAuth), while a
//   catalog tool answers without one.
//
// Uses the production OAuth config and the live public catalog, or the site
// at MOTIONVIDEO_SITE_URL (its issuer and catalog) for a local check.

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 4321;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const RESOURCE = "https://mcp.motionvideo.xyz/mcp";
const SITE = (
  process.env.MOTIONVIDEO_SITE_URL ?? "https://motionvideo.xyz"
).replace(/\/+$/u, "");
const ISSUER = `${SITE}/api/auth`;
const EXPECTED_TOOLS = [
  "compose-launch-prompt",
  "get-launch-prompt",
  "get-move-prompt",
  "get-video",
  "list-bookmarks",
  "list-filters",
  "my-featured",
  "search-directory",
  "search-launch-scenes",
  "search-moves",
  "search-videos",
];

const { version } = JSON.parse(await readFile("package.json", "utf-8"));
const failures = [];
const check = (ok, message) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
  if (!ok) {
    failures.push(message);
  }
};

const server = spawn(
  "pnpm",
  ["exec", "mcp-use", "start", "--port", String(PORT)],
  { detached: true, stdio: ["ignore", "pipe", "pipe"] }
);
let log = "";
server.stdout.on("data", (chunk) => {
  log += chunk;
});
server.stderr.on("data", (chunk) => {
  log += chunk;
});

let nextId = 0;
const rpc = async (method, params) => {
  nextId += 1;
  const response = await fetch(`${ORIGIN}/mcp`, {
    body: JSON.stringify({ id: nextId, jsonrpc: "2.0", method, params }),
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": "2025-06-18",
    },
    method: "POST",
  });
  const text = await response.text();
  const json = text.startsWith("{")
    ? JSON.parse(text)
    : JSON.parse(
        text
          .split("\n")
          .find((line) => line.startsWith("data:"))
          ?.slice(5) ?? "{}"
      );
  return { json, response };
};

/** Poll until the server answers, every 500 ms for up to 30 s. */
const waitForServer = async (attemptsLeft = 60) => {
  try {
    await fetch(`${ORIGIN}/.well-known/oauth-protected-resource/mcp`);
  } catch {
    if (attemptsLeft === 0) {
      throw new Error(`server did not start on ${ORIGIN}\n${log}`);
    }
    await sleep(500);
    await waitForServer(attemptsLeft - 1);
  }
};

try {
  await waitForServer();

  const init = await rpc("initialize", {
    capabilities: {},
    clientInfo: { name: "motionvideo-smoke", version: "0" },
    protocolVersion: "2025-06-18",
  });
  check(
    init.json.result?.serverInfo?.version === version,
    `initialize reports version ${version}`
  );

  const list = await rpc("tools/list", {});
  const tools = (list.json.result?.tools ?? [])
    .map((tool) => tool.name)
    .toSorted();
  check(
    JSON.stringify(tools) === JSON.stringify(EXPECTED_TOOLS),
    `tools/list: ${tools.join(", ")}`
  );

  const metadataResponse = await fetch(
    `${ORIGIN}/.well-known/oauth-protected-resource/mcp`
  );
  const metadata = await metadataResponse.json();
  check(
    metadata.resource === RESOURCE &&
      metadata.authorization_servers?.includes(ISSUER),
    `protected resource metadata: ${metadata.resource} via ${metadata.authorization_servers}`
  );

  const anonymousPro = await rpc("tools/call", {
    arguments: {},
    name: "search-moves",
  });
  const challenge = anonymousPro.response.headers.get("www-authenticate") ?? "";
  check(
    anonymousPro.response.status === 401 &&
      challenge.includes("resource_metadata="),
    `anonymous search-moves: HTTP ${anonymousPro.response.status} with ${challenge ? "a" : "no"} WWW-Authenticate challenge`
  );

  // One anonymous call per site endpoint the catalog tools use.
  const catalogCalls = [
    ["list-filters", {}],
    ["search-videos", { limit: 1 }],
    ["search-directory", { limit: 1, section: "skills" }],
  ];
  const answers = await Promise.all(
    catalogCalls.map(([name, args]) =>
      rpc("tools/call", { arguments: args, name })
    )
  );
  for (const [index, answer] of answers.entries()) {
    const [name] = catalogCalls[index];
    check(
      answer.response.status === 200 && answer.json.result?.isError !== true,
      `anonymous ${name}: HTTP ${answer.response.status}, ${answer.json.result?.isError ? `tool error: ${answer.json.result.content?.[0]?.text}` : "answered"}`
    );
  }
} catch (error) {
  failures.push(String(error));
  console.error(error);
} finally {
  // `pnpm exec` spawns the server as a child; end the whole group.
  process.kill(-server.pid, "SIGTERM");
}

if (failures.length > 0) {
  console.error(`\n${failures.length} smoke check(s) failed.`);
  process.exit(1);
}
