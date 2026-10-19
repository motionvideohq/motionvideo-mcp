# Plugin distribution

One plugin folder, two ecosystems. `plugins/motionvideo/` is a valid plugin for both the OpenAI directory (ChatGPT + Codex) and Anthropic's Claude directory, hosted in this repository rather than a separate one.

```
plugins/motionvideo/
├── .claude-plugin/plugin.json   Claude manifest (name, version, description…)
├── .mcp.json                    Claude MCP wiring  → https://mcp.motionvideo.xyz/mcp
├── plugin.json                  OpenAI portable manifest (+ extensions.com.openai)
├── mcp.json                     OpenAI portable MCP wiring (streamable-http, no auth)
├── skills/motionvideo/SKILL.md  synced copy of /skills/motionvideo
├── assets/icon.svg              synced copy of /public/icon.svg
├── assets/screenshots/*.png     carousel screenshots captured from the live views
└── README.md                    listing description (Claude shows this README)
```

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

## Let Manufact prepare the submission (do this first)

Manufact Cloud automates the server-side work every directory asks for, for this server:

1. **Publish → Checklist** — audits protocol compliance, tool schemas, metadata, and error handling, with "How to fix" guidance and an autofix flow. On Hobby and above it also runs **end-to-end checks in live ChatGPT and Claude** (tool calls + widget rendering). Basic runs are $0.10; E2E runs $2. A free anonymous report works at [manufact.com/mcp-catalog](https://manufact.com/mcp-catalog).
2. **Testing** — run test suites across clients and models, then try the server live via **Public Chat**.
3. **Publish → Submission pack** (Hobby+, $5/generation) — drafts the directory listing copy (name, descriptions, category), tool justifications, and reviewer test-case templates, and can generate the **demo video and carousel screenshots** the directories ask for.

Two honesty notes: Manufact prepares and pre-validates the materials, but it does not press publish in the stores — the final submission is still made in OpenAI's and Anthropic's portals. And the plugin manifests + skill bundle in this folder are what those portals consume; the checklist and submission pack cover the connector/server materials.

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

## Open items

- [ ] For OpenAI domain verification, set `OPENAI_APPS_CHALLENGE` to the token the portal shows (Manufact dashboard → Environment variables); the server serves it at `https://mcp.motionvideo.xyz/.well-known/openai-apps-challenge`.
- [ ] Record the demo walkthrough video required for OpenAI MCP review, or generate it with the Manufact Submission pack (Publish → Submission pack, Hobby+).
- [ ] Confirm the OpenAI category in the dashboard ("Productivity" in the manifest).
