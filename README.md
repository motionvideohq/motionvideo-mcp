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

Also included:

- **Resources** — `motionvideo://catalog/overview` for counts and sections, and `motionvideo://videos/{slug}` for any full catalog entry.
- **Prompt** — `remix-video` builds a model-ready brief from an entry's original prompt so an agent can adapt it to your brief.
- **Skill** — `skills/motionvideo` teaches agents the search → pull prompt → adapt → credit workflow.

## Development

```bash
pnpm install
pnpm dev        # dev server + Inspector at http://localhost:3000/mcp/inspector
pnpm typecheck  # refresh view types and run tsc
pnpm build      # production build in .mcp-use/build/
```

## Catalog data

The [motionvideo.xyz](https://motionvideo.xyz) repo is the single source of truth. The server fetches the catalog live from the site's public JSON endpoints — [`/api/catalog`](https://motionvideo.xyz/api/catalog) (videos) and [`/api/catalog/directories`](https://motionvideo.xyz/api/catalog/directories) (tools & studios) — and caches each document in memory for 10 minutes.

For local development against a local site checkout, point `MOTIONVIDEO_SITE_URL` at it:

```bash
MOTIONVIDEO_SITE_URL=http://localhost:3000 pnpm dev
```

## Deploy

```bash
pnpm deploy     # deploys to Manufact Cloud (linked on first run)
```

## License

MIT. The MotionVideo brand and catalog content belong to motionvideo.xyz.
