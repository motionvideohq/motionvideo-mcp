# Plugin distribution

One plugin folder, every ecosystem. `plugins/motionvideo/` is a single [Agent Plugin](https://agent-plugins.org) that targets the OpenAI directory (ChatGPT + Codex), Anthropic's Claude directory, the Cursor Marketplace, and the long tail of agent IDEs that load the standard — plus thin host-native manifests (Gemini CLI, Kimi Code, Antigravity, Kiro, ZCode, Droid, Devin) for the tools that want their own file.

```
plugins/motionvideo/
├── .claude-plugin/plugin.json   Claude manifest (name, version, description…)
├── .mcp.json                    Claude MCP wiring  → https://mcp.motionvideo.xyz/mcp
├── plugin.json                  OpenAI portable manifest (+ extensions.com.openai)
├── mcp.json                     portable MCP wiring (streamable-http; client-managed OAuth)
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
- The skill, server, and views stay in one repository. `plugin:sync` aligns bundled copies and host manifest versions with `package.json`; building, deploying the server, and publishing client bundles remain separate release steps and can drift until each is completed.

## Commands

```bash
pnpm plugin:sync      # align manifest versions and refresh bundled skill/icon/Kimi copies
pnpm plugin:validate  # claude plugin validate on the plugin and the marketplace
pnpm plugin:zip       # build dist/*.zip: one for the OpenAI portal, one for claude.ai
```

`plugin:zip` writes:

- `dist/motionvideo-openai-plugin.zip` — for the OpenAI submission portal. Contains `plugin.json`, `mcp.json`, `skills/`, `assets/`, `README.md`.
- `dist/motionvideo-claude-plugin.zip` — for a local upload test on claude.ai (Customize → Plugins → Add → Upload plugin).

For release 1.1.1, the portable MCP configuration contains only its schema-backed transport and URL. [Agent Plugins §7.2](https://agent-plugins.org/specification#72-mcp-servers) leaves authorization discovery, sign-in, and credential storage to the client; it defines no portable OAuth fields. The removed `extensions.com.openai.auth.type: none` override both disabled the intended flow and was outside the MCP schema. The Claude manifest now supplies the directory's [`privacyPolicyUrl`](https://code.claude.com/docs/en/plugins-reference#directory-listing-fields); Gemini and Antigravity carry the same release version as the other manifests.

Run `plugin:sync` after changing the package version, build and smoke-test the server, then deploy and check the remote version/capabilities before publishing the ZIPs. See the root [release verification](../README.md#release-111) for smoke evidence and authenticated checks that require an authorized account.

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

## Signing in (account + Pro tools)

The four catalog tools work anonymously. The catalog resources and the `remix-video` prompt need sign-in with a free motionvideo.xyz account. Two optional tools read the user's own account, and the two Pro tools additionally require a plan. Use a client that supports MCP OAuth discovery and challenges, and allow its sign-in flow; do not force a “No Auth”/“No sign-in” override. Clients without OAuth are limited to the public catalog tools:

- `list-bookmarks` — the user's saved videos, tools, studios, skills, and resources, newest first (optional `kind` filter).
- `my-featured` — the user's community submissions that were featured in the catalog, with links to the featured entries.
- `search-moves` and `get-move-prompt` — the Moves library's copy-ready prompts, for accounts with an active MotionVideo Pro or Business plan, or a Business seat (seats are linked by email). Signed in without a plan, both return an error pointing to [motionvideo.xyz/pro](https://motionvideo.xyz/pro).

The configured flow, for reviewers:

1. A protected call returns an OAuth challenge with the required `account` scope and `resource_metadata` URL (`https://mcp.motionvideo.xyz/.well-known/oauth-protected-resource/mcp` for production). The client discovers the authorization server at `https://motionvideo.xyz/api/auth` and its dynamic client registration endpoint.
2. The OAuth-capable client opens the site's sign-in/consent flow and uses authorization code + PKCE. The issuer advertises `openid profile email offline_access account`; `account` is required by this server.
3. The MCP server verifies the token against the site's JWKS, the configured resource audience (`https://mcp.motionvideo.xyz/mcp` in production), and the required scope. Account/Pro tools forward the verified bearer token to the site's `/api/mcp/*` endpoints; `/moves` enforces the plan. No client secret belongs in the plugin bundle.

The local smoke verified anonymous challenges and metadata, not a completed authorized sign-in or entitlement check. Those need a legitimately authorized account; see the [release status](../README.md#release-111). For local OAuth, the explicit resource audience must match an endpoint allowed by the issuer; see [Development](../README.md#development).

All signed-in tools are strictly read-only; nothing on the site can be changed from chat. Signing in is optional — declining consent, or never calling these tools, leaves the public catalog tools fully usable.

## Submit to OpenAI (ChatGPT + Codex)

1. Verify the developer identity in the OpenAI organization settings, then open [platform.openai.com/plugins](https://platform.openai.com/plugins) → **Upload new or existing plugin** → upload `dist/motionvideo-openai-plugin.zip`.
2. **Connect MCP**: URL `https://mcp.motionvideo.xyz/mcp`; configure OAuth/discovery for the complete connector, not auth **none**. The four catalog tools remain anonymous; protected capabilities require sign-in. First deploy the OAuth-enabled server release and check its metadata. For domain verification, set `OPENAI_APPS_CHALLENGE` to the portal's token in the server's environment variables; the server then serves it at `https://mcp.motionvideo.xyz/.well-known/openai-apps-challenge`.
3. Resolve automated findings. The manifest already carries the five positive and three negative review test cases; enter the demo walkthrough URL in the portal.
4. Submit for review, then publish when approved. After publication, MCP tool changes are picked up by OpenAI's daily scans; metadata or skill changes need a new ZIP with a raised `version`.

## Submit to Claude

Claude wants **two submissions** from this repo — submit the connector first so the plugin can pair with it:

1. **MCP connector** — [claude.ai/directory/manage](https://claude.ai/directory/manage) → **MCP connector** → URL `https://mcp.motionvideo.xyz/mcp`; allow OAuth for account/Pro tools, catalog resources, and the prompt rather than declaring the whole connector unauthenticated. Have ready: listing name/slug, categories, documentation URL, privacy policy (`https://motionvideo.xyz/privacy`), support contact (`https://motionvideo.xyz/contact`), icon, and 3–5 carousel screenshots (PNG, ≥1000px wide, cropped to the app UI — capture the video gallery and detail views). Declare allowed link URIs `https://motionvideo.xyz` and `https://assets.motionvideo.xyz`; third-party destinations (e.g. x.com links) stay unlisted and prompt the user.
2. **Plugin bundle** — same portal → **Plugin bundle** → repository `motionvideohq/motionvideo-mcp`, plugin path `plugins/motionvideo` → **Validate** → listing details come from `plugin.json` and `README.md`.

Notes: submitting needs a paid Claude plan, and the complete connector also needs the OAuth-enabled server deployed and its authorized paths tested. For each release, raise `package.json`'s version and run `pnpm plugin:sync` to update the host manifests.

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
- **Brief Description** — MotionVideo brings the motionvideo.xyz catalog of AI-made motion videos to your bot: find references by keyword or content category, pull the original prompt behind any entry, browse motion tools and studios, and adapt the prompts into new motion work. Catalog tools are public and read-only; optional tools sign the user in with their MotionVideo account to list their saved bookmarks and featured submissions, and MotionVideo Pro or Business members get copy-ready prompts from the Moves library.
- **Testing Instructions** — Connect to `https://mcp.motionvideo.xyz/mcp`, leaving OAuth discovery enabled. Then: 1) "Find motion video references for a kinetic typography intro" → a gallery of matching entries with previews. 2) "Pull the original prompt behind twoclipping-5cba86" → the full prompt, model metadata, and source link. 3) "Which motion studios can I hire for a product launch video?" → studio entries from the directory. The four catalog tools (`search-videos`, `get-video`, `search-directory`, `list-filters`) are read-only and need no account. With the OAuth-enabled release deployed and an authorized free account, also test "List my bookmarks" through sign-in/consent and verify its result. Do not claim that authorized check passed without exercising it. Source: `https://github.com/motionvideohq/motionvideo-mcp` (plugin at `plugins/motionvideo`).

The "I've tested this plugin locally and in-app" box expects a real test in the Grok Bot app (macOS download, included with Premium and up) or Cursor — only tick it after doing that. Grok Bot itself needs a paid plan to install; if you don't have one, list for Cursor through the same form or skip the box.

## Grok, VS Code, and the rest

- **Grok (chat)** — no listing submission yet (the connector catalog is curated), but users can add the server themselves: [grok.com/connectors](https://grok.com/connectors) → New Connector → Custom → `https://mcp.motionvideo.xyz/mcp`; keep OAuth discovery enabled for protected capabilities. Grok CLI users: `grok mcp add --transport http motionvideo https://mcp.motionvideo.xyz/mcp`. The marketplace listing goes through the Grok Bot submission form above.
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
{
  "mcp": {
    "motionvideo": {
      "type": "remote",
      "url": "https://mcp.motionvideo.xyz/mcp",
      "enabled": true
    }
  }
}
```

Copy `skills/motionvideo/` into `.agents/skills/` for the skill — MiMo scans that compatibility folder by default.

### DeepSeek Harness

DSH talks MCP through its official `@deepseek-ai/dsh-mcp-client` bridge plugin — add a row to the profile's `cordis.patch.yml` (e.g. `$DSH_HOME/profiles/web/cordis.patch.yml`):

```yaml
- insert:
    - id: mcp-motionvideo
      name: "@deepseek-ai/dsh-mcp-client"
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

- [ ] Deploy this MCP server's 1.1.1 release and verify the remote version, eight tools, responding catalog calls, protected challenges, and OAuth metadata. The site's issuer discovery already exists; that alone does not update the stale MCP deployment.
- [ ] Complete authorized free-account resource/remix and account-tool checks, then verify no-plan and Pro/Business/seat outcomes with appropriate accounts. These were not exercised without authorized credentials.
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
