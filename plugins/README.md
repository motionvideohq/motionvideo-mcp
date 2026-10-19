# Plugin distribution

One plugin folder, every ecosystem. `plugins/motionvideo/` is a single [Agent Plugin](https://agent-plugins.org) that targets the OpenAI directory (ChatGPT + Codex), Anthropic's Claude directory, the Cursor Marketplace, and the long tail of agent IDEs that load the standard — plus thin host-native manifests (Gemini CLI, Kimi Code, Antigravity, Kiro, ZCode, Droid, Devin) for the tools that want their own file.

```
plugins/motionvideo/
├── .claude-plugin/plugin.json   Claude manifest (name, version, description…)
├── .mcp.json                    Claude MCP wiring  → https://mcp.motionvideo.xyz/mcp
├── plugin.json                  OpenAI portable manifest (+ extensions.com.openai)
├── mcp.json                     OpenAI portable MCP wiring (streamable-http, no auth)
├── kimi.plugin.json             Kimi Code CLI manifest (synced copy)
├── skills/motionvideo/          synced copy of /skills/motionvideo: SKILL.md + Amp's sibling mcp.json
├── assets/icon.svg              synced copy of /public/icon.svg
├── assets/screenshots/*.png     carousel screenshots captured from the live views
└── README.md                    listing description (Claude shows this README)
```

The host files that live outside the folder (they must sit at the repo root, or belong to another host's bundle):

- `gemini-extension.json` at the absolute repo root — Gemini CLI installs and the gallery crawler both require it there.
- `kimi.plugin.json` at the repo root — same content as the plugin copy, for `/plugins install <repo URL>`.
- `plugins/antigravity/` — Antigravity bundle: `plugin.json`, `mcp_config.json`, and a synced skill copy.

Plus two repository marketplaces that make the plugin installable straight from git, for local testing and for anyone who wants it before store approval:

- `.claude-plugin/marketplace.json` — Claude Code (`claude plugin marketplace add`)
- `.agents/plugins/marketplace.json` — ChatGPT desktop / Codex repo marketplace

## Why this lives here and not in a new repo

- Anthropic reads the plugin from a subfolder: "If the plugin is one folder in a larger repository, give that folder as the plugin path when you submit; the directory reads and scans only that folder." The submission is repository `motionvideohq/motionvideo-mcp` + plugin path `plugins/motionvideo`.
- OpenAI accepts a ZIP built from the same folder, and reads the Claude-compatible manifests alongside the portable ones, so nothing is duplicated.
- The skill, the server, and the views stay in one place, so a version bump is a single commit — and the plugin can never drift from the deployed server.

## Commands

```bash
pnpm plugin:sync      # refresh the skill/icon copies (lefthook does this on commit)
pnpm plugin:validate  # claude plugin validate on the plugin and the marketplace
pnpm plugin:zip       # build dist/*.zip: one for the OpenAI portal, one for claude.ai
```

`plugin:zip` writes:

- `dist/motionvideo-openai-plugin.zip` — for the OpenAI submission portal. Contains `plugin.json`, `mcp.json`, `skills/`, `assets/`, `README.md`.
- `dist/motionvideo-claude-plugin.zip` — for a local upload test on claude.ai (Customize → Plugins → Add → Upload plugin).

The carousel screenshots in `plugins/motionvideo/assets/screenshots/` were captured from the live server with `mcp-use screenshot` and are linked from `extensions.com.openai.interface.screenshots`. Regenerate them after view changes:

```bash
pnpm exec mcp-use screenshot --mcp https://mcp.motionvideo.xyz/mcp \
  --tool search-videos 'query=kinetic typography' --width 1200 --delay 2000 \
  --output plugins/motionvideo/assets/screenshots/gallery-light.png
# …same with --theme dark, and with --tool get-video slug=twoclipping-5cba86
```

## Test it locally

- **Claude Code**: `claude --plugin-dir ./plugins/motionvideo` (skills appear as `/motionvideo:motionvideo`), or register the repo marketplace: `claude plugin marketplace add ./` then `/plugin install motionvideo@motionvideo`.
- **ChatGPT desktop / Codex**: the repo marketplace at `.agents/plugins/marketplace.json` shows up in the Plugins Directory after a restart.
- **Droid**: `droid plugin marketplace add ./` then `droid plugin install motionvideo@motionvideo`.
- **Gemini CLI**: `gemini extensions link .` from the repo root.
- **Kimi Code**: `kimi plugin install ./plugins/motionvideo`.
- **Antigravity**: `agy plugin install ./plugins/antigravity` (or `/plugin install ./plugins/antigravity` in the TUI).

## Free checks (no paid plans)

Everything here stays inside Manufact's free limits — nothing needs Hobby:

- **Free quality report** — paste `https://mcp.motionvideo.xyz/mcp` at [manufact.com/mcp-catalog](https://manufact.com/mcp-catalog): overall quality score, the same basic publishing checks as the dashboard, per-tool documentation feedback, no account needed.
- **Screenshots** — captured locally for free with `mcp-use screenshot` (see Commands) and committed in `plugins/motionvideo/assets/screenshots/`.
- **Demo video** — record it yourself (QuickTime, OBS): free.

Skipped on purpose (paid): dashboard checklist runs ($0.10), ChatGPT/Claude end-to-end checks ($2, Hobby+), and the Submission pack ($5, Hobby+). The free report covers the same basic publishing checks the dashboard runs.

## Submit to OpenAI (ChatGPT + Codex)

1. Verify the developer identity in the OpenAI organization settings, then open [platform.openai.com/plugins](https://platform.openai.com/plugins) → **Upload new or existing plugin** → upload `dist/motionvideo-openai-plugin.zip`.
2. **Connect MCP**: URL `https://mcp.motionvideo.xyz/mcp`, auth **none**. For domain verification, set `OPENAI_APPS_CHALLENGE` to the portal's token in the server's environment variables; the server then serves it at `https://mcp.motionvideo.xyz/.well-known/openai-apps-challenge`.
3. Resolve automated findings. The manifest already carries the five positive and three negative review test cases; enter the demo walkthrough URL in the portal.
4. Submit for review, then publish when approved. After publication, MCP tool changes are picked up by OpenAI's daily scans; metadata or skill changes need a new ZIP with a raised `version`.

## Submit to Claude

Claude wants **two submissions** from this repo — submit the connector first so the plugin can pair with it:

1. **MCP connector** — [claude.ai/directory/manage](https://claude.ai/directory/manage) → **MCP connector** → URL `https://mcp.motionvideo.xyz/mcp` → no authentication. Have ready: listing name/slug, categories, documentation URL, privacy policy (`https://motionvideo.xyz/privacy`), support contact (`https://motionvideo.xyz/contact`), icon, and 3–5 carousel screenshots (PNG, ≥1000px wide, cropped to the app UI — capture the video gallery and detail views). Declare allowed link URIs `https://motionvideo.xyz` and `https://assets.motionvideo.xyz`; third-party destinations (e.g. x.com links) stay unlisted and prompt the user.
2. **Plugin bundle** — same portal → **Plugin bundle** → repository `motionvideohq/motionvideo-mcp`, plugin path `plugins/motionvideo` → **Validate** → listing details come from `plugin.json` and `README.md`.

Notes: submitting needs a paid Claude plan; this repository is already public, so publishing is unblocked. Version bumps: raise `version` in both `plugin.json` files on every release.

## Submit to Cursor

`plugins/motionvideo/` is already a valid [Agent Plugin](https://agent-plugins.org) — the open standard Cursor loads natively (root `plugin.json`, `skills/`, `mcp.json`; no Cursor-specific manifest needed).

1. **Submit for review** — [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish) → repository `motionvideohq/motionvideo-mcp` (mention plugin path `plugins/motionvideo` if the form asks). Reviews are manual; plugins must be open source — this repo is public and MIT-licensed.
2. **Test locally first** — copy the folder to `~/.cursor/plugins/local/motionvideo`, reload Cursor, and confirm the skill and MCP server appear under Customize.
3. **One-click install for users** — `https://cursor.com/install-mcp?name=motionvideo&config=eyJ1cmwiOiAiaHR0cHM6Ly9tY3AubW90aW9udmlkZW8ueHl6L21jcCJ9` (the `cursor://anysphere.cursor-deeplink/...` form of the same link opens the desktop app directly).
4. **Community listing** — [cursor.directory](https://cursor.directory) accepts free MCP server submissions.

## Submit to Grok Bot (xAI — one form also covers Cursor)

[x.ai/bot/marketplace/submit-a-plugin](https://x.ai/bot/marketplace/submit-a-plugin) distributes a plugin or MCP server to Grok (coming soon), **Grok Bot**, and **Cursor** users, reviewed by hand. Everything the form asks for is ready below; only your name and work email are missing:

- **Organization Name** — MotionVideo
- **Organization Handle** — motionvideo
- **Website URL** — https://motionvideo.xyz
- **Logotype URL** — `https://raw.githubusercontent.com/motionvideohq/motionvideo-mcp/main/plugins/motionvideo/assets/icon.svg` (1:1 with background plate — verified live)
- **Where do you want to be listed?** — Grok Bot · Cursor
- **MCP Server URL or Public GitHub Repository** — `https://mcp.motionvideo.xyz/mcp`
- **Brief Description** — MotionVideo brings the motionvideo.xyz catalog of AI-made motion videos to your bot: find references by keyword or content category, pull the original prompt behind any entry, browse motion tools and studios, and adapt the prompts into new motion work. Read-only, no sign-in.
- **Testing Instructions** — Connect the MCP server `https://mcp.motionvideo.xyz/mcp` (no authentication). Then: 1) "Find motion video references for a kinetic typography intro" → a gallery of matching entries with previews. 2) "Pull the original prompt behind twoclipping-5cba86" → the full prompt, model metadata, and source link. 3) "Which motion studios can I hire for a product launch video?" → studio entries from the directory. All four tools (`search-videos`, `get-video`, `list-categories`, `browse-directory`) are read-only against a public catalog. Source: `https://github.com/motionvideohq/motionvideo-mcp` (plugin at `plugins/motionvideo`).

The "I've tested this plugin locally and in-app" box expects a real test in the Grok Bot app (macOS download, included with Premium and up) or Cursor — only tick it after doing that. Grok Bot itself needs a paid plan to install; if you don't have one, list for Cursor through the same form or skip the box.

## Grok, VS Code, and the rest

- **Grok (chat)** — no listing submission yet (the connector catalog is curated), but users can add the server themselves: [grok.com/connectors](https://grok.com/connectors) → New Connector → Custom → `https://mcp.motionvideo.xyz/mcp` (no auth). Grok CLI users: `grok mcp add --transport http motionvideo https://mcp.motionvideo.xyz/mcp`. The marketplace listing goes through the Grok Bot submission form above.
- **VS Code** — one-click install link (paste into a browser): `vscode:mcp/install?%7B%22name%22%3A%22motionvideo%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.motionvideo.xyz%2Fmcp%22%7D`. GitHub strips `vscode:` links in Markdown, so keep it in code blocks.
- **Aggregators (free)** — the Official MCP Registry (`mcp-publisher` CLI + a DNS TXT record on motionvideo.xyz), then Smithery; Glama, PulseMCP, and similar directories crawl the registry.

## More ADEs, agents, and terminals

Beyond the store listings, the same server installs across the rest of the agent tooling — natively where the host has a plugin format, one line where it doesn't:

### Amp

```bash
amp mcp add motionvideo https://mcp.motionvideo.xyz/mcp
```

Amp recommends bundling MCP inside skills, which this repo does: copy `skills/motionvideo/` (its sibling `mcp.json` declares the server) into `.agents/skills/`, and Amp keeps the tools hidden until the skill loads.

### Droid (Factory)

```bash
droid mcp add motionvideo https://mcp.motionvideo.xyz/mcp --type http   # MCP only
droid plugin marketplace add motionvideohq/motionvideo-mcp              # full plugin
droid plugin install motionvideo@motionvideo --scope user
```

Droid's marketplace loader falls back to `.claude-plugin/marketplace.json` and translates the Claude layout (`.claude-plugin/` → `.factory-plugin/`, `.mcp.json` → `mcp.json`), so everything in this repo works untouched.

### Gemini CLI

```bash
gemini extensions install https://github.com/motionvideohq/motionvideo-mcp
```

`gemini-extension.json` sits at the repo root (absolute root — the gallery crawler and installer both require it there), wires the server through `httpUrl`, and the extension ships the skill from `skills/`. The [gallery](https://geminicli.com/extensions/browse/) indexes any public repo carrying the `gemini-cli-extension` topic; this repo has it. (Google is moving free users to the Antigravity CLI below; Gemini CLI extensions remain for paid plans.)

### Antigravity (Gemini's successor)

`plugins/antigravity/` is a native bundle — `plugin.json`, `mcp_config.json`, and the skill:

```bash
git clone https://github.com/motionvideohq/motionvideo-mcp && cd motionvideo-mcp
agy plugin install ./plugins/antigravity
```

No clone? Copy the folder to `.agents/plugins/` in a workspace, or `~/.gemini/config/plugins/` globally. The official marketplace listing goes through the Discover tab's "submit a plugin" link, which opens an interest form.

### Kimi Code

```bash
kimi plugin install https://github.com/motionvideohq/motionvideo-mcp
```

or in the CLI: `/plugins install https://github.com/motionvideohq/motionvideo-mcp`. The `kimi.plugin.json` at the repo root (and inside `plugins/motionvideo/` for local installs) declares the skill and the MCP server. For the consumer Kimi app, the Plugin Builder converts an existing Claude/Codex plugin into one — the [submission guide](https://www.kimi.com/help/kimi-work/plugin-submission-guide) walks through it.

### Kiro

Powers panel → **Add Custom Power** → **Import power from GitHub** → `https://github.com/motionvideohq/motionvideo-mcp/tree/main/plugins/motionvideo`.

Kiro powers follow the Agent Plugins format, so our folder imports as-is — `plugin.json`, `mcp.json`, bundled skill, no POWER.md needed. The curated kiro.dev/powers listing uses its "Submit a power" flow; the GitHub import works today.

### ZCode

Settings → Plugins → Create → **Add marketplace** → `motionvideohq/motionvideo-mcp`, then install MotionVideo.

ZCode reads the repo's `.claude-plugin/marketplace.json`, and the plugin's `.claude-plugin/plugin.json` + `.mcp.json` (Claude-layout fallback is built in; `.zcode-plugin/plugin.json` is only its preferred prefix). MCP-only: add `https://mcp.motionvideo.xyz/mcp` on the MCP page, or import it from an already-configured client — ZCode reads Claude/Cursor/Codex configs.

### MiMo Code

`mimo mcp add`, or edit `mimocode.json` / `.mimocode/mimocode.json`:

```json
{ "mcp": { "motionvideo": { "type": "remote", "url": "https://mcp.motionvideo.xyz/mcp", "enabled": true } } }
```

Copy `skills/motionvideo/` into `.agents/skills/` for the skill — MiMo scans that compatibility folder by default.

### DeepSeek Harness

DSH talks MCP through its official `@deepseek-ai/dsh-mcp-client` bridge plugin — add a row to the profile's `cordis.patch.yml` (e.g. `$DSH_HOME/profiles/web/cordis.patch.yml`):

```yaml
- insert:
    - id: mcp-motionvideo
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: motionvideo
        transport: streamable-http
        url: https://mcp.motionvideo.xyz/mcp
```

Tools surface as `mcp__motionvideo__*`. If YAML isn't your thing, the community `dsh-mcp` plugin adds a Settings → MCP page with a search-based injection mode.

### Pi

```bash
pi install npm:pi-mcp-adapter   # MCP support for Pi
pi mcp add                      # walk through adding the server (or point it at an .mcp.json)
```

Skill: copy `skills/motionvideo/` into `.agents/skills/`.

### Devin

```bash
devin plugins install motionvideohq/motionvideo-mcp#plugins/motionvideo
```

Devin loads Agent Plugins 1.0.0 directly (root `plugin.json` + `mcp.json` + `skills/`), and Claude-layout plugins as-is — ours qualifies both ways.

### Herdr

Not a fit: Herdr plugins are executable workflow packages (`herdr-plugin.toml` + scripts), not MCP consumers. Agents running inside Herdr keep using their own MCP configs from the sections above.

## Open items

- [ ] For OpenAI domain verification, set `OPENAI_APPS_CHALLENGE` to the token the portal shows (Manufact dashboard → Environment variables); the server serves it at `https://mcp.motionvideo.xyz/.well-known/openai-apps-challenge`.
- [ ] Run the free quality report at manufact.com/mcp-catalog and fix anything it flags.
- [ ] Record the demo walkthrough video required for OpenAI MCP review (free: QuickTime or OBS).
- [ ] Submit via [x.ai/bot/marketplace/submit-a-plugin](https://x.ai/bot/marketplace/submit-a-plugin) — tick **Grok Bot** and **Cursor**; every field value is prepared in the Grok Bot section above.
- [ ] Alternative for Cursor only: [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish) with the repo link (optional path `plugins/motionvideo`).
- [ ] Confirm the OpenAI category in the dashboard ("Productivity" in the manifest).
- [ ] Optional, free: publish to the Official MCP Registry + Smithery so aggregator directories pick it up.
- [ ] Gemini gallery — the repo carries the `gemini-cli-extension` topic; the crawler lists it at geminicli.com/extensions within a day.
- [ ] Antigravity marketplace — the Discover tab's "submit a plugin" link (interest form) for the official listing.
- [ ] Kimi Work (consumer app) — Plugin Builder submission built from the Claude/Codex plugin, per the linked guide.
- [ ] Kiro curated listing — "Submit a power" on kiro.dev/powers (optional; the GitHub import works today).
