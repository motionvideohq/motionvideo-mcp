# MotionVideo MCP

An MCP server for [motionvideo.xyz](https://motionvideo.xyz), the catalog of AI-made motion videos and the prompts behind them. Search videos by model, colour, category or creator, pull the original prompt to remix, find motion tools, agent skills and studios, and, with MotionVideo Pro, get copy-ready prompts for named motion techniques.

Server URL: `https://mcp.motionvideo.xyz/mcp` (Streamable HTTP). Catalog tools need no account; account and Pro tools sign in with OAuth.

## Connect

| Client | How |
| --- | --- |
| Claude (web, desktop, mobile) | Settings → Connectors → Add custom connector → `https://mcp.motionvideo.xyz/mcp` |
| ChatGPT | Settings → Apps → Advanced → Create app → paste the URL, authentication **OAuth** |
| Cursor | [Add to Cursor](https://cursor.com/install-mcp?name=motionvideo&config=eyJ1cmwiOiAiaHR0cHM6Ly9tY3AubW90aW9udmlkZW8ueHl6L21jcCJ9) |
| Claude Code | `claude mcp add --transport http motionvideo https://mcp.motionvideo.xyz/mcp` |
| Codex | `codex mcp add motionvideo --url https://mcp.motionvideo.xyz/mcp` |

Leave OAuth discovery on. Choosing "No auth" or "No sign-in" in a client hides the account and Pro tools; the catalog tools keep working either way.

`search-videos` and `get-video` render as MCP Apps views in clients that support them (Claude, ChatGPT and other MCP Apps hosts), and return the same data as text and JSON everywhere else.

`search-videos` and `get-video` render as [MCP Apps](https://modelcontextprotocol.io/docs/extensions/apps) views in clients that support them (Claude, ChatGPT and other MCP Apps hosts), and return the same data as text and JSON everywhere else.

| Tool | View |
| --- | --- |
| `search-videos` | Gallery of matching videos with hover previews, an inline player and the prompt behind each |
| `get-video` | Player for one video with its prompt, metadata, copy and remix actions, and previous/next |

## Setup

### Claude Code

```bash
claude mcp add --transport http motionvideo https://mcp.motionvideo.xyz/mcp
```

Or install the plugin, which adds the [`motionvideo` skill](skills/motionvideo/SKILL.md) too:

```bash
claude plugin install motionvideo@motionvideo
claude plugin install motionvideo
```

Run `/mcp` in a session to sign in when you want the account or Pro tools.

### Codex

```bash
codex mcp add motionvideo --url https://mcp.motionvideo.xyz/mcp
codex mcp login motionvideo   # only for account and Pro tools
```

The Codex CLI, desktop app and IDE extension share this configuration.

### Cursor

Use the [Add to Cursor](https://cursor.com/install-mcp?name=motionvideo&config=eyJ1cmwiOiAiaHR0cHM6Ly9tY3AubW90aW9udmlkZW8ueHl6L21jcCJ9) link, or add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "motionvideo": { "url": "https://mcp.motionvideo.xyz/mcp" }
  }
}
```

### VS Code

Add to `.vscode/mcp.json` (workspace) or your user `mcp.json`:

```json
{
  "servers": {
    "motionvideo": { "type": "http", "url": "https://mcp.motionvideo.xyz/mcp" }
  }
}
```

One-click install link (paste into a browser; GitHub strips `vscode:` links):

```text
vscode:mcp/install?%7B%22name%22%3A%22motionvideo%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.motionvideo.xyz%2Fmcp%22%7D
```

### OpenCode

In `opencode.json` (project) or `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "motionvideo": {
      "type": "remote",
      "url": "https://mcp.motionvideo.xyz/mcp",
      "enabled": true
    }
  }
}
```

### Amp, Gemini CLI, Grok

```bash
amp mcp add motionvideo https://mcp.motionvideo.xyz/mcp
gemini extensions install https://github.com/motionvideohq/motionvideo-mcp
grok mcp add --transport http motionvideo https://mcp.motionvideo.xyz/mcp
```

Droid, Antigravity, Kimi Code, Kiro, ZCode, MiMo Code, DeepSeek Harness, Pi and Devin each have a one-line install in [plugins/README.md](plugins/README.md).

## Sign-in and plans

| Tools | Needs |
| --- | --- |
| `search-videos`, `get-video`, `search-directory`, `list-filters` | Nothing |
| `list-bookmarks`, `my-featured`, the resources and the `remix-video` prompt | A free motionvideo.xyz account |
| `search-moves`, `get-move-prompt` | A [MotionVideo Pro or Business plan](https://motionvideo.xyz/pro) on that account, or a Business seat |

The first call to a signed-in tool makes the client open motionvideo.xyz's sign-in and consent pages (OAuth 2.1 with dynamic client registration). There is nothing to copy or paste. Business seats are matched by the email you sign in with.

When a signed-in call fails, the tool says what to do. Only an expired sign-in is fixed by signing in again:

| What happened | What the tool tells you |
| --- | --- |
| Sign-in expired or revoked (401) | Sign out and back in from the client |
| Sign-in didn't grant account access (403 `insufficient_scope`) | Sign in again and approve account access |
| No Pro or Business plan (403 `no_plan`) | Get a plan at motionvideo.xyz/pro |
| Rate limited (429) | Retry after the delay the site gives |
| Site unavailable or failing (503, other 5xx) | Try again later; not a sign-in problem |
| No answer within 10 seconds | Try again |

## Tools

### Videos

| Tool | Description |
| --- | --- |
| `search-videos` | Find videos by keywords, categories, models, named colours, creators and type, newest or oldest first, a page at a time |
| `get-video` | One video: its original prompt, model, effort, iterations, stack, media links, neighbours and the five most similar videos |

Several values in one filter are alternatives, and different filters all apply: "Opus 5.5 videos in red or orange" is `models: ["Opus 5.5"], colors: ["red", "orange"]`. Set `colorMatch: "all"` for videos that contain every colour.

- **Models** take a name (`Opus 5.5`), a full name (`Claude Opus 5.5`), a family (`Gemini`) or a bare version (`5.5`, which covers Opus 5.5 and Fable 5.5).
- **Colours** are the site's named colours: red, orange, yellow, green, teal, blue, purple, pink, brown, black, white and gray, matched like the `/color/<name>` pages.
- **Creators** take an X handle, with or without `@`, or a display name.
- **Answers** say how each filter was read ("5.5" matched Opus 5.5 and Fable 5.5), name models and creators the catalog doesn't have with close matches, and, when nothing matches, how many videos each filter matches on its own.
- **Unknown inputs** are rejected with the values that are allowed, so a misspelt filter never silently widens the search.

### Directories

| Tool | Description |
| --- | --- |
| `search-directory` | Search one section of the site's directories by keywords, its filter, categories and sort |

| Section | Filter | Sorts |
| --- | --- | --- |
| `tools` — editors, AI generators, mockups | pricing: free, freemium, open-source, paid | added |
| `skills` — agent skills that make videos | renderer: remotion, hyperframes, html, manim, adobe, blender, video-models, ffmpeg | stars, updated, added |
| `creatives` — studios and designers for hire | specialty: product-films, explainers, 3d, brand, ui-motion | added |
| `extras` — articles and resources | resource type: library, examples, prompts, directory, archive | newest, oldest, added |

### Filters

| Tool | Description |
| --- | --- |
| `list-filters` | Every filter value with how many items carry it: video categories with descriptions, models, colours and types; each directory section's filters, categories and sorts; and the move families |

### Moves (Pro)

| Tool | Description |
| --- | --- |
| `search-moves` | Search the Moves library of named motion techniques by keyword and family (timing, type, transitions, ui, vector, generative, camera, texture, data, sound) |
| `get-move-prompt` | One move's copy-ready prompt, the parameters worth tuning, and its page |

### Account

| Tool | Description |
| --- | --- |
| `list-bookmarks` | Your saved videos, tools, studios, skills and resources, newest first, optionally one kind |
| `my-featured` | Your community submissions that were featured in the catalog |

### Resources, prompt and skill

- `motionvideo://catalog/overview` — every filter value with its count, as JSON.
- `motionvideo://videos/{slug}` — one full catalog entry, with slug completion.
- `remix-video` prompt — a model-ready brief built from a video's original prompt and an optional new direction.
- [`motionvideo` skill](skills/motionvideo/SKILL.md) — teaches an agent the search → pull prompt → adapt → credit workflow. It ships in the plugins and is served over MCP.

## Data boundaries

Every tool is read-only: nothing on motionvideo.xyz can be changed from a client.

Catalog tools send only their search arguments to motionvideo.xyz's public API. Signed-in tools send your access token to motionvideo.xyz and nowhere else, and never return it. The server stores no account data; the only per-user state is the Pro moves list, kept in memory for 10 minutes. Don't put credentials or personal data in tool arguments: sign-in happens through the client's OAuth flow.

## How it works

motionvideo.xyz is the single source of truth. The catalog tools call its query endpoints — `/api/catalog/search`, `/api/catalog/videos/{slug}`, `/api/catalog/directories/search` and `/api/catalog/facets` ([API reference](https://motionvideo.xyz/docs/api)) — which run the same filters as the gallery and directory pages, so an answer here matches what the site shows. Request and response types are generated from the site's [OpenAPI document](https://motionvideo.xyz/openapi.json). Facets are cached for 10 minutes; searches aren't cached.

For sign-in, motionvideo.xyz is the OAuth 2.1 authorization server (Better Auth, issuer `https://motionvideo.xyz/api/auth`) and this server is the protected resource `https://mcp.motionvideo.xyz/mcp`, discovered at `/.well-known/oauth-protected-resource/mcp`. The server checks each token's signature, issuer, audience, expiry and `account` scope, then forwards it to the site's `/api/mcp/*`, which checks it again and answers for that account. The audience must match in three places: the site's `mcp({ resource })`, the `resource` its `/api/mcp/*` routes verify, and this server's `MOTIONVIDEO_MCP_RESOURCE`. A mismatch rejects every signed-in call.

## Development

Built with [mcp-use](https://github.com/mcp-use/mcp-use). Use Node 22 or newer and pnpm.

```bash
pnpm install
pnpm dev           # dev server + Inspector at http://localhost:3000/mcp/inspector
pnpm typecheck     # refresh view types and run tsc
pnpm check         # lint and formatting (ultracite)
pnpm build         # production build in .mcp-use/build/
pnpm smoke         # start the build; check version, tools, OAuth metadata, 401 challenge, catalog calls
pnpm api:generate  # regenerate src/generated/site-api.ts from the site's /openapi.json
pnpm api:check     # fail when src/generated/site-api.ts is stale
pnpm eval          # real requests through `claude -p`, checked against evals/catalog.json
```

| Path | Contents |
| --- | --- |
| `index.ts` | Entry: default-exports the server and re-exports tool refs (views type `useCallTool` from them) |
| `src/mcp-server.ts` | Server instance, OAuth provider, shared middleware |
| `src/tools/` | One module per area: `catalog.ts` (videos, resources, prompt), `directory.ts`, `filters.ts`, `pro.ts`, `account.ts` |
| `src/catalog.ts` | Calls to the site's catalog endpoints |
| `src/site-api.ts` | Signed-in `/api/mcp/*` calls: timeout, cancellation, error messages |
| `src/pro.ts` | Moves data, per-user cache, search |
| `src/generated/site-api.ts` | Generated from the site's OpenAPI document; don't edit |
| `views/` | `video-gallery` and `video-detail` views |
| `skills/motionvideo/` | The agent skill; `pnpm plugin:sync` copies it into the plugin bundles |
| `plugins/` | Plugin bundles for each client and how to submit them ([plugins/README.md](plugins/README.md)) |
| `evals/catalog.json` | Requests and the tool call an agent should make for each |

Don't name a module `src/server.ts` or `src/index.ts`: the mcp-use CLI looks for those before `index.ts` and would treat it as the entry.

**Against a local site.** `MOTIONVIDEO_SITE_URL` points the catalog and the issuer at another site, e.g. `MOTIONVIDEO_SITE_URL=http://localhost:3000 pnpm dev` with the site on another port. A local OAuth flow also needs `MOTIONVIDEO_MCP_RESOURCE` set to the local MCP endpoint, allowed as a resource at that issuer. Don't disable audience or scope checks to get around local setup.

**Changing a site API.** Deploy the site first, then run `pnpm api:generate` here and commit. CI's `api:check` and the smoke read the live site.

**Agent eval.** `pnpm eval` gives each request in `evals/catalog.json` to Claude Code with only this server connected and checks the tool calls it makes. It needs the `claude` CLI signed in (`EVAL_MODEL`, default `sonnet`; `EVAL_ONLY=id,id` for a subset). Run it after changing a tool's name, description or inputs.

**CI** (`.github/workflows/checks.yml`) runs typecheck, `pnpm check`, `pnpm api:check`, the build and the smoke on pull requests and pushes to `main`. Pushing to `main` deploys the server through Manufact; `pnpm deploy` deploys by hand.

## License

MIT. The MotionVideo brand and catalog content belong to motionvideo.xyz.
