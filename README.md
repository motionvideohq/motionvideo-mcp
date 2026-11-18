<div align="center">

<img src="public/icon.svg" alt="MotionVideo" width="96" />

# MotionVideo MCP

**The [motionvideo.xyz](https://motionvideo.xyz) catalog as an MCP app.**

Search AI-made motion videos, pull the original prompts behind them, and browse the motion tools and studios around them — from any MCP client.

</div>

---

## Tools

| Tool | What it does |
| --- | --- |
| `search-videos` | Search the catalog by keywords, content categories, models (e.g. Opus 5.5), named colours, creators, and type, a page at a time. Several values in one filter are alternatives (red or orange); different filters all apply. Says how each filter was read and, when nothing matches, how many videos each filter matches alone. Renders an interactive **video-gallery** view with hover previews and an inline player. |
| `get-video` | Fetch one entry: the original prompt, model/effort/iterations/stack, media links, neighbours, and the five most similar videos. Renders a **video-detail** view with copy and remix actions. |
| `search-directory` | Search one directory section: tools (by pricing), skills (by renderer; sort by stars or updated), creatives — studios and designers — (by specialty), or extras — articles and resources — (by resource type). |
| `list-filters` | Every filter value with its count: video categories, models, colours and types; each directory section's filters, categories and sorts; move families. |
| `search-moves` | **Pro.** Search the Moves library of named motion techniques by keyword and/or family (timing, type, transitions, ui, vector, generative, camera, texture, data, sound). Returns names, families, summaries, and slugs. |
| `get-move-prompt` | **Pro.** One move's copy-ready prompt, its tunable parameters, and its page on motionvideo.xyz. |
| `list-bookmarks` | **Account.** Read the signed-in user's saved catalog items, optionally filtered by kind. |
| `my-featured` | **Account.** Read the signed-in user's featured community submissions. |

Also included:

- **Resources** — `motionvideo://catalog/overview` for counts and sections, and `motionvideo://videos/{slug}` for any full catalog entry.
- **Prompt** — `remix-video` builds a model-ready brief from an entry's original prompt so an agent can adapt it to your brief.
- **Skill** — `skills/motionvideo` teaches agents the search → pull prompt → adapt → credit workflow.

The four catalog tools (`search-videos`, `get-video`, `search-directory`, `list-filters`) work anonymously. The catalog resources, `remix-video` prompt, and account tools need OAuth sign-in with a free motionvideo.xyz account. The two Pro tools also need a qualifying plan. Use an OAuth-capable MCP client and allow its authorization discovery/sign-in flow; do not force **No Auth** or **No sign-in** for the full connector. Clients without OAuth can use only the public catalog tools.

## Pro tools

`search-moves` and `get-move-prompt` sign you in with your motionvideo.xyz account — the MCP client offers that the first time you call one (OAuth 2.1 with the site's own sign-in and consent pages) — and need an active [MotionVideo Pro or Business plan](https://motionvideo.xyz/pro) on that account. Business seat holders are included: a seat is linked to the email you sign in with. There is nothing to copy or paste; add the server URL as usual. The free catalog tools work without signing in.

The server forwards your verified access token unchanged to motionvideo.xyz (`/api/mcp/moves`), which checks your plan, and caches a successful moves list per signed-in user for 10 minutes. Signed in without a plan, the Pro tools answer with an error that links to [motionvideo.xyz/pro](https://motionvideo.xyz/pro).

## Authentication

motionvideo.xyz is the OAuth 2.1 authorization server (Better Auth, issuer `https://motionvideo.xyz/api/auth`); this server is the protected resource `https://mcp.motionvideo.xyz/mcp`. Clients discover both from `https://mcp.motionvideo.xyz/.well-known/oauth-protected-resource/mcp`, register themselves (dynamic client registration), and send the user through the site's sign-in and consent pages.

1. An anonymous call to a signed-in tool gets an HTTP 401 with a `WWW-Authenticate` challenge; clients start sign-in from that challenge, not from tool errors. A call that fails after sign-in can't trigger a new sign-in by itself, so its message tells the user when to sign in again.
2. This server verifies each access token against the site's JWKS: signature, issuer, audience `https://mcp.motionvideo.xyz/mcp`, expiry, and the `account` scope.
3. Account and Pro tools forward that token to the site's `/api/mcp/*`, which verifies it again and answers for the account. The server stores no account data or secrets.

The audience must be identical in three places: the site's `mcp({ resource })`, the `resource` its `/api/mcp/*` routes verify, and this server's `MOTIONVIDEO_MCP_RESOURCE` (default above). A mismatch rejects every signed-in call.

When a signed-in call fails, the tool says what to do next. Only a rejected sign-in is fixed by signing in again:

| Site answer | Tool message |
| --- | --- |
| 401 | The sign-in expired or is invalid: sign out and back in from the client. |
| 403 `insufficient_scope` | The sign-in didn't grant account access: sign in again and approve it. |
| 403 `no_plan` | No Pro or Business plan on this account, with a link to motionvideo.xyz/pro. |
| 429 | Rate limited, retry after the `Retry-After` delay. |
| 503 | Temporarily unavailable, not a sign-in problem. |
| Other 5xx | The site failed (status included), not a sign-in problem. |
| No answer within 10 s | Timed out, try again. |

Each signed-in call stops after 10 seconds, or as soon as the client cancels or disconnects.

## Data boundaries

- Every tool is read-only; nothing on motionvideo.xyz can be changed from a client.
- Catalog tools send only their search arguments to the public catalog endpoints. Signed-in tools send the access token to motionvideo.xyz and nowhere else, and never return it.
- The only per-user state is the Pro moves list, kept in memory for 10 minutes per signed-in account.
- Don't put credentials or personal data in tool arguments; sign-in happens through the client's OAuth flow.

## Development

```bash
pnpm install
pnpm dev           # dev server + Inspector at http://localhost:3000/mcp/inspector
pnpm typecheck     # refresh view types and run tsc
pnpm check         # lint and formatting (ultracite)
pnpm build         # production build in .mcp-use/build/
pnpm smoke         # start the build; check version, tools, OAuth metadata, 401 challenge, catalog calls
pnpm api:generate  # regenerate src/generated/site-api.ts from the site's /openapi.json
pnpm api:check     # fail when src/generated/site-api.ts is stale
pnpm eval          # agent eval: real requests through `claude -p`, checked against evals/catalog.json
```

| Path | Contents |
| --- | --- |
| `index.ts` | Entry: default-exports the server and re-exports tool refs (views type `useCallTool` from them) |
| `src/mcp-server.ts` | Server instance, OAuth provider, shared middleware |
| `src/tools/catalog.ts` | `search-videos`, `get-video`, resources and the `remix-video` prompt |
| `src/tools/directory.ts`, `src/tools/filters.ts` | `search-directory`, `list-filters` |
| `src/tools/account.ts`, `src/tools/pro.ts` | Signed-in tools |
| `src/catalog.ts` | Calls to the site's catalog query endpoints |
| `src/generated/site-api.ts` | Types and value lists generated from the site's OpenAPI document; never edit |
| `src/pro.ts` | Moves data, per-user cache, search |
| `src/site-api.ts` | Signed-in `/api/mcp/*` calls: timeout, cancellation, error messages |
| `views/` | `video-gallery` and `video-detail` MCP Apps views |
| `evals/catalog.json` | Requests and the tool calls an agent should make for them |

Don't name a module `src/server.ts` or `src/index.ts`: the mcp-use CLI looks for those before `index.ts` and would treat it as the entry.

CI (`.github/workflows/checks.yml`) runs typecheck, `pnpm check`, `pnpm api:check`, the build and the smoke on pull requests and pushes to `main`. `api:check` and the smoke read the live site, so deploy a site API change before the MCP change that uses it.

`pnpm eval` needs the `claude` CLI signed in; each scenario is one short session (`EVAL_MODEL`, default `sonnet`; `EVAL_ONLY=id,id` for a subset). It isn't part of CI. Run it after changing a tool's name, description or inputs.

OAuth defaults to the production issuer (`https://motionvideo.xyz/api/auth`) and resource audience (`https://mcp.motionvideo.xyz/mcp`). A local server therefore advertises production discovery URLs unless `MOTIONVIDEO_MCP_RESOURCE` is set to its actual local MCP endpoint. For a self-contained local OAuth flow, that endpoint must also be an allowed resource at the issuer, and issued tokens must carry the matching audience and `account` scope. Changing `MOTIONVIDEO_SITE_URL` changes the catalog origin and issuer together; use a separate port for a local site and MCP server. Do not disable audience or scope validation to work around local setup.

## Catalog data

The [motionvideo.xyz](https://motionvideo.xyz) repo is the single source of truth, and it owns the filters. The catalog tools call the site's query endpoints — `/api/catalog/search`, `/api/catalog/videos/{slug}`, `/api/catalog/directories/search` and `/api/catalog/facets` ([API reference](https://motionvideo.xyz/docs/api)) — which run the same filters as the gallery and directory pages. Their request and response types come from the site's [OpenAPI document](https://motionvideo.xyz/openapi.json) via `pnpm api:generate`. The facets are kept in memory for 10 minutes; searches are not cached.

For local development against a local site checkout, point `MOTIONVIDEO_SITE_URL` at it:

```bash
MOTIONVIDEO_SITE_URL=http://localhost:3000 pnpm dev
```

## Deploy

```bash
pnpm plugin:sync # align host manifest versions/copies with package.json
pnpm build       # create production artifacts from the current source
pnpm deploy      # deploy to Manufact Cloud (linked on first run)
```

Building, syncing plugin bundles, and deploying the remote server are separate steps. Pushing to `main` deploys the server through Manufact. After deployment, check `initialize` reports the intended version, all eight tools are listed, public catalog calls return, protected calls challenge anonymous requests, and `/.well-known/oauth-protected-resource/mcp` serves the expected audience and authorization server (`pnpm smoke` checks the same against a local build). Publish updated client bundles only after checking that remote cutover.

### Unreleased

Signed-in tools now say what a failure means instead of suggesting a fresh sign-in for every error (see [Authentication](#authentication)), check the site's responses against their output schemas, and stop their site call when the client cancels or after 10 seconds. The server version now comes from `package.json`. The code is split from one `index.ts` into `src/mcp-server.ts`, `src/tools/*` and `src/site-api.ts`; CI and `pnpm smoke` were added.

The catalog tools now call the site's query endpoints instead of downloading the whole catalog and filtering it here, so filters behave exactly as on the site. `search-videos` filters by `categories`, `models` (names, full names, families like "Gemini", or bare versions like "5.5"), `colors` (with `colorMatch` any/all) and `creators`, each taking several values as alternatives, and pages with `offset`. It replaces the single `category` input with `categories`; unknown inputs are rejected instead of ignored. `get-video` adds the five most similar videos. `search-directory` replaces `browse-directory` and covers all four site sections (tools, skills, creatives, extras) with their filters and sorts. `list-filters` replaces `list-categories` and lists every filter value with its count. Types come from the site's OpenAPI document (`pnpm api:generate`, checked in CI), and `pnpm eval` checks the tool calls a real model makes for 24 requests.

### Release 1.1.2

Both video views now request the MCP Apps `clipboardWrite` sandbox permission so hosts can delegate access for the Copy action. Browser verification reproduced a denied clipboard write without the declaration, then checked exact prompt copies in both views after the host applied it. Clipboard-read access is not requested; hosts may still refuse clipboard access.

### Release 1.1.1

Removes the portable bundle's forced-disabled authentication setting, adds Claude directory privacy metadata, and aligns the portable, Claude, Gemini, Kimi, and Antigravity manifest versions with the package version via `plugin:sync`.

The production-build smoke exercises public catalog calls, signed resources, remix briefs, and slug completion with an isolated test issuer and live public catalog data. It also checks rejection of malformed, expired, wrong-issuer, wrong-audience, and insufficient-scope tokens. This does not verify real account consent or Pro/Business/seat entitlement outcomes; those require an authorized MotionVideo account. A successful local build does not update the linked deployment.

## Use it everywhere

Connect to `https://mcp.motionvideo.xyz/mcp` from a compatible MCP client; the capabilities available there depend on the deployed release described above. This repo also doubles as a plugin marketplace:

- **ChatGPT** — Settings → Apps → Advanced → Create app → paste the URL; enable OAuth/authorization discovery for protected capabilities rather than forcing No Auth.
- **Claude** — Settings → Connectors → Add custom connector → same URL; allow OAuth sign-in for protected capabilities rather than selecting No sign-in.
- **Claude Code** — `claude plugin marketplace add motionvideohq/motionvideo-mcp`, then `/plugin install motionvideo`.
- **Cursor** — [Add to Cursor](https://cursor.com/install-mcp?name=motionvideo&config=eyJ1cmwiOiAiaHR0cHM6Ly9tY3AubW90aW9udmlkZW8ueHl6L21jcCJ9), or Customize → MCPs → add the URL.
- **Grok** — grok.com/connectors → New Connector → Custom → paste the URL; CLI: `grok mcp add --transport http motionvideo https://mcp.motionvideo.xyz/mcp`.
- **VS Code and other MCP clients** — point them at the same URL; a one-click VS Code link is in [plugins/README.md](plugins/README.md).
- **More agents and ADEs** — Amp, Droid, Gemini CLI, Antigravity, Kimi Code, Kiro, ZCode, MiMo Code, DeepSeek Harness, Pi, Devin: each gets a one-line install in [plugins/README.md](plugins/README.md).

The same plugin folder targets ChatGPT, Claude, Cursor, Kiro, ZCode, Droid, Devin, and Kimi Code (Agent Plugins standard), and the repo ships native bundles for Gemini CLI and Antigravity: `plugins/motionvideo/` — submission steps in [plugins/README.md](plugins/README.md).

## License

MIT. The MotionVideo brand and catalog content belong to motionvideo.xyz.
