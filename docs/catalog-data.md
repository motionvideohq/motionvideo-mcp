# Catalog data: one source of truth

How the motionvideo.xyz catalog gets into this server, and why it's built
this way. Written when the server switched from a bundled copy of the
catalog to reading the live site.

## The problem

The server needs the catalog (videos with prompts, tool/studio directories).
The catalog is authored and imported in the [motionvideo.xyz](https://github.com/motionvideohq/motionvideo.xyz)
repo — that's where `src/data/*.json` lives, where the import scripts write,
and what the site renders.

The first version of this server bundled **copies** of those files under
`data/` and refreshed them with a `catalog:sync` script. Two repositories
holding the same data means drift: the site ships a new video, the MCP server
keeps serving the old catalog until somebody remembers to run a script and
redeploy. Copies also give no way to tell which side is correct when they
disagree.

## The approach

**motionvideo.xyz stays the only place the catalog lives. This server reads
it from the site over HTTP at request time.**

```
motionvideo.xyz repo (source of truth)
  src/data/motion-catalog.json ──┐      src/data/resource-directories.json ──┐
                                 │                                          │
        GET /api/catalog ◄───────┘          GET /api/catalog/directories ◄──┘
        (site Worker, ETag + cache)          (site Worker, ETag + cache)
                 │                                    │
                 └──────────────┬─────────────────────┘
                                ▼
                    motionvideo-mcp (this repo)
                    src/catalog.ts fetches + caches each document
                                │
                                ▼
               tools · resources · prompt (unchanged shapes)
```

### Why the site owns the data

The catalog is *edited there*: `pnpm catalog:import:videos` and friends write
`src/data/*.json`, and the same files render the gallery, category pages, and
video pages. Any other copy is derived by definition, so the site is the only
candidate for the source of truth.

### Why HTTP endpoints (options considered)

| Option | Why not |
| --- | --- |
| Keep bundled copies + sync script | The problem being solved: silent drift, manual redeploys |
| Git submodule / shared npm package | Still a checkout-level copy; couples data updates to releases; more moving parts for a two-repo project |
| Upload a snapshot to R2 at site build time | Extra infra (bucket writes in CI) for no benefit over an endpoint the Worker already has in memory |
| Read the site's D1 database | The catalog isn't in D1 — it's build-time JSON bundled into the Worker |
| Scrape the rendered HTML | Fragile and wasteful; the data exists as JSON one layer down |
| **JSON endpoints on the site** | **No new infra: the data is already in the Worker's bundle, so one route serves it. Whatever the site ships is exactly what the MCP server reads — they cannot drift** |

## Site side: the two endpoints

Both live in the motionvideo.xyz repo, following its existing nested-route
pattern (`src/routes/api/webhook/dodo.ts`):

- `src/routes/api/catalog/index.ts` → `GET /api/catalog` — the same
  `{ importedAt, videos }` document the site renders from.
- `src/routes/api/catalog/directories.ts` → `GET /api/catalog/directories` —
  `{ importedAt, tools, studios }`.
- `src/server/catalog-api.ts` — shared response helper: serializes once per
  isolate, computes a SHA-256 ETag of the exact bytes, answers `If-None-Match`
  with `304`, and sets `Cache-Control` (5 min browser, 1 h CDN, stale-while-
  revalidate). The site's security headers apply as to any route.

The endpoints are public and read-only, like the pages they mirror. Since
they're built from the same bundle as the rendered site, a successful site
deploy updates the API and the pages atomically.

## This repo: fetch with cache and graceful degradation

`src/catalog.ts` is the whole data layer. Per document:

- **Cached for 10 minutes.** A warm process answers tool calls without any
  network hop.
- **ETag revalidation.** Refetches send `If-None-Match`; an unchanged document
  costs one `304` and no re-parse.
- **In-flight deduplication.** Concurrent cold calls share one fetch.
- **Stale-if-error.** If a refetch fails, the last good copy keeps serving and
  the next retry happens in 60 seconds (instead of hammering a downed site
  every call). The failure is logged.
- **Cold-start failure** (no copy yet) throws `CatalogUnavailableError`. Three
  middlewares (`mcp:tools/call`, `mcp:resources/read`, `mcp:prompts/get`)
  convert that into a readable answer — `isError: true` for tools, text for
  resources, a message for prompts — the same way a missing slug is reported.
  An unreachable site is an operational state, not a broken server, so it must
  not surface as a JSON-RPC protocol error.

Completions (slug autocomplete on the resource template and the `remix-video`
prompt) are callbacks over the cached catalog, so there's no startup snapshot
to go stale, and a cold catalog just yields no suggestions.

`MOTIONVIDEO_SITE_URL` points the whole data layer at another origin; local
development runs against a local site checkout:

```bash
# terminal 1 — site
cd ../motionvideo.xyz && pnpm dev
# terminal 2 — this server
MOTIONVIDEO_SITE_URL=http://localhost:3000 pnpm dev
```

In production the default (`https://motionvideo.xyz`) applies; no env vars
are needed on Manufact.

## Failure modes, at a glance

| What happens | What callers see |
| --- | --- |
| Site deploys new data | Old data for at most 10 min (per isolate), then the fresh document; ETag changes trigger refetch |
| Site briefly unreachable | Last good copy keeps serving; refetch retried every 60 s |
| Site down, process cold | Clear `isError`/text explaining the catalog is temporarily unavailable |
| Site slow | Fetch aborted after 10 s, then the stale-if-error path above |

Because both projects run on Cloudflare (same account), a regional incident
takes the site down along with the server — which is exactly when the cache
and the stale fallback matter most.

## Deploy order

Endpoints first, consumer second:

1. Push **motionvideo.xyz** (adds `/api/catalog*`, Workers Builds deploys).
2. Verify `https://motionvideo.xyz/api/catalog` returns the catalog.
3. Push **motionvideo-mcp** (Manufact auto-deploys on push to `main`).

Rolling the MCP server back to a bundled copy would just mean restoring
`data/` and the import in `src/catalog.ts`; nothing else depends on the
transport.

## Coupling to keep in mind

- Field names in the fetched documents must match this repo's `MotionVideo` /
  directory interfaces (they mirror `motionvideo.xyz/src/lib/motion-catalog.ts`).
  A schema change on the site without one here shows up as missing fields, not
  as a type error — the loader casts the remote JSON. A runtime schema check
  (e.g. zod parsing of the fetched documents) is the natural next step if the
  shapes start moving.
- Media (posters, previews, videos) was never duplicated: it has always been
  served from `assets.motionvideo.xyz`, which the views' CSP already allows.
