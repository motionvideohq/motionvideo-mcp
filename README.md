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
| `search-videos` | Search the catalog by keywords and/or content category. Renders an interactive **video-gallery** view with hover previews and an inline player. |
| `get-video` | Fetch one entry: the original prompt, model/effort/iterations, media links, and neighbours. Renders a **video-detail** view with copy and remix actions. |
| `list-categories` | The catalog's content categories with counts and descriptions. |
| `browse-directory` | Motion tools, editors, AI generators, and studios for hire. |
| `search-moves` | **Pro.** Search the Moves library of named motion techniques by keyword and/or family (timing, type, transitions, ui, vector, generative, camera, texture, data, sound). Returns names, families, summaries, and slugs. |
| `get-move-prompt` | **Pro.** One move's copy-ready prompt, its tunable parameters, and its page on motionvideo.xyz. |
| `list-bookmarks` | **Account.** Read the signed-in user's saved catalog items, optionally filtered by kind. |
| `my-featured` | **Account.** Read the signed-in user's featured community submissions. |

Also included:

- **Resources** — `motionvideo://catalog/overview` for counts and sections, and `motionvideo://videos/{slug}` for any full catalog entry.
- **Prompt** — `remix-video` builds a model-ready brief from an entry's original prompt so an agent can adapt it to your brief.
- **Skill** — `skills/motionvideo` teaches agents the search → pull prompt → adapt → credit workflow.

The four catalog tools (`search-videos`, `get-video`, `list-categories`, `browse-directory`) work anonymously. The catalog resources, `remix-video` prompt, and account tools need OAuth sign-in with a free motionvideo.xyz account. The two Pro tools also need a qualifying plan. Use an OAuth-capable MCP client and allow its authorization discovery/sign-in flow; do not force **No Auth** or **No sign-in** for the full connector. Clients without OAuth can use only the public catalog tools.

## Pro tools

`search-moves` and `get-move-prompt` sign you in with your motionvideo.xyz account — the MCP client offers that the first time you call one (OAuth 2.1 with the site's own sign-in and consent pages) — and need an active [MotionVideo Pro or Business plan](https://motionvideo.xyz/pro) on that account. Business seat holders are included: a seat is linked to the email you sign in with. There is nothing to copy or paste; add the server URL as usual. The free catalog tools work without signing in.

The server forwards your verified access token unchanged to motionvideo.xyz (`/api/mcp/moves`), which checks your plan, and caches a successful moves list per signed-in user for 10 minutes. Signed in without a plan, the Pro tools answer with an error that links to [motionvideo.xyz/pro](https://motionvideo.xyz/pro).

## Development

```bash
pnpm install
pnpm dev        # dev server + Inspector at http://localhost:3000/mcp/inspector
pnpm typecheck  # refresh view types and run tsc
pnpm build      # production build in .mcp-use/build/
```

OAuth defaults to the production issuer (`https://motionvideo.xyz/api/auth`) and resource audience (`https://mcp.motionvideo.xyz/mcp`). A local server therefore advertises production discovery URLs unless `MOTIONVIDEO_MCP_RESOURCE` is set to its actual local MCP endpoint. For a self-contained local OAuth flow, that endpoint must also be an allowed resource at the issuer, and issued tokens must carry the matching audience and `account` scope. Changing `MOTIONVIDEO_SITE_URL` changes the catalog origin and issuer together; use a separate port for a local site and MCP server. Do not disable audience or scope validation to work around local setup.

## Catalog data

The [motionvideo.xyz](https://motionvideo.xyz) repo is the single source of truth. The server fetches the catalog live from the site's public JSON endpoints — [`/api/catalog`](https://motionvideo.xyz/api/catalog) (videos) and [`/api/catalog/directories`](https://motionvideo.xyz/api/catalog/directories) (tools & studios) — and caches each document in memory for 10 minutes.

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

Building, syncing plugin bundles, and deploying the remote server are separate steps. After deployment, check `initialize` reports the intended version, all eight tools are listed, public directory/category calls return, protected calls challenge anonymous requests, and `/.well-known/oauth-protected-resource/mcp` serves the expected audience and authorization server. Publish updated client bundles only after checking that remote cutover.

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
