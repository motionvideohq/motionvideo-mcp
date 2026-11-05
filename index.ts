// MotionVideo MCP server — the motionvideo.xyz catalog as MCP tools, views,
// resources, and a prompt. Scaffolded from the mcp-use `mcp-apps` template.

import { MCPServer, completable } from "mcp-use";
import { oauthBetterAuthProvider } from "mcp-use/oauth/better-auth";
import type { BetterAuthOAuthUser } from "mcp-use/oauth/better-auth";
import { z } from "zod";

import {
  browseDirectory as browseDirectoryPage,
  CatalogUnavailableError,
  catalogStats,
  DIRECTORY_MAX_LIMIT,
  DIRECTORY_SECTIONS,
  directoryCategories,
  findVideo,
  listCategories as categorySummaries,
  loadVideos,
  MOTION_CATEGORIES,
  SEARCH_MAX_LIMIT,
  searchVideos as searchCatalog,
  toDetail,
  videoPageUrl,
} from "./src/catalog.js";
import {
  loadProMove,
  loadProMoves,
  MOVE_FAMILIES,
  MOVES_MAX_LIMIT,
  movePageUrl,
  searchMoves as searchProMoves,
} from "./src/pro.js";

// Public site that serves the catalog and hosts the MotionVideo account
// (Better Auth) this server signs users in with. Overridable for local
// development against `pnpm dev` on the site.
const SITE_URL = (
  process.env.MOTIONVIDEO_SITE_URL ?? "https://motionvideo.xyz"
).replace(/\/$/u, "");

// The protected resource this server is for OAuth 2.1 purposes: Better Auth
// stamps access tokens with this audience and the `account` scope, and
// every signed-in request is checked against both.
const MCP_RESOURCE =
  process.env.MOTIONVIDEO_MCP_RESOURCE ?? "https://mcp.motionvideo.xyz/mcp";
const ACCOUNT_SCOPE = "account";

// Anonymous catalog tools stay open; the account and Pro tools below sign
// users in with their motionvideo.xyz account (OAuth 2.1, dynamic client
// registration, consent on the site). The MCP server holds no account
// secrets: signed-in tools forward the verified access token to the site's
// `/api/mcp/*`.
const server = new MCPServer<BetterAuthOAuthUser>({
  description:
    "The motionvideo.xyz catalog: AI-made motion videos with the prompts and skills behind them. Search references, pull original prompts to remix, and browse motion tools and studios.",
  icons: [
    {
      mimeType: "image/svg+xml",
      sizes: ["any"],
      src: "icon.svg",
    },
  ],
  instructions:
    "Use search-videos to find motion video references (keywords and/or a content category), then get-video to read the original prompt and how it was made so you can adapt it. list-categories explains the catalog categories; browse-directory covers motion tools and studios. When you remix a prompt, credit the source video page. Catalog tools work without an account; list-bookmarks and my-featured sign the user in with their motionvideo.xyz account and the client offers that on first use. MotionVideo Pro users can also search-moves in the Moves library of named motion techniques and get-move-prompt for a move's copy-ready prompt; these sign the user in the same way and need a MotionVideo Pro or Business plan on that account (Business seat holders included; plans at https://motionvideo.xyz/pro).",
  mixedAuth: true,
  name: "motionvideo",
  oauth: oauthBetterAuthProvider({
    authURL: `${SITE_URL}/api/auth`,
    requiredScopes: [ACCOUNT_SCOPE],
    resource: MCP_RESOURCE,
    resourceName: "MotionVideo",
    scopesSupported: [
      "openid",
      "profile",
      "email",
      "offline_access",
      ACCOUNT_SCOPE,
    ],
  }),
  title: "MotionVideo",
  version: "1.1.2",
  websiteUrl: "https://motionvideo.xyz",
});

// OpenAI app-directory domain verification. Set OPENAI_APPS_CHALLENGE to the
// token OpenAI shows in its dashboard (Manufact → Environment variables) and
// this serves it at
// https://mcp.motionvideo.xyz/.well-known/openai-apps-challenge; without the
// env var the path stays a 404.
server.get("/.well-known/openai-apps-challenge", (c) => {
  const token = process.env.OPENAI_APPS_CHALLENGE;

  if (!token) {
    return c.notFound();
  }

  return c.text(token);
});

// ---------------------------------------------------------------------------
// Catalog access
// ---------------------------------------------------------------------------

// The catalog is fetched live from motionvideo.xyz, so an unreachable site is
// an operational state, not a programming error: report it the way a missing
// slug is reported instead of failing the whole JSON-RPC call.
server.use("mcp:tools/call", async (_ctx, next) => {
  try {
    return await next();
  } catch (error) {
    if (!(error instanceof CatalogUnavailableError)) {
      throw error;
    }
    return {
      content: [{ text: error.message, type: "text" as const }],
      isError: true,
    };
  }
});

server.use("mcp:resources/read", async (ctx, next) => {
  try {
    return await next();
  } catch (error) {
    if (!(error instanceof CatalogUnavailableError)) {
      throw error;
    }
    return {
      contents: [
        { mimeType: "text/plain", text: error.message, uri: ctx.params.uri },
      ],
    };
  }
});

server.use("mcp:prompts/get", async (_ctx, next) => {
  try {
    return await next();
  } catch (error) {
    if (!(error instanceof CatalogUnavailableError)) {
      throw error;
    }
    return {
      messages: [
        {
          content: { text: error.message, type: "text" as const },
          role: "user" as const,
        },
      ],
    };
  }
});

// Slug suggestions for resource reads and the remix prompt, from the (cached)
// live catalog; empty when the site can't be reached.
const completeVideoSlug = async (value: string): Promise<string[]> => {
  try {
    const prefix = value.trim().toLowerCase();
    const videos = await loadVideos();
    return videos
      .map((video) => video.slug)
      .filter((slug) => slug.toLowerCase().startsWith(prefix));
  } catch {
    return [];
  }
};

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const videoSummarySchema = z.object({
  avatar: z.string().describe("Creator avatar image URL"),
  contentTags: z.array(z.string()).describe("Motion content categories"),
  date: z.string().describe("Publish date (YYYY-MM-DD)"),
  description: z.string().optional(),
  effort: z.string().optional(),
  handle: z.string().describe("Creator handle on X"),
  height: z.number().int(),
  iterations: z.string().optional(),
  model: z.string().optional(),
  pageUrl: z.string().describe("Canonical page on motionvideo.xyz"),
  poster: z.string().describe("Poster image URL"),
  preview: z.string().describe("Short looping preview MP4 URL"),
  promptShared: z.boolean().describe("Whether the original prompt is public"),
  slug: z.string().describe("Stable catalog id, e.g. stephanlivera-df17a2"),
  tags: z.array(z.string()).describe("Entry tags: prompt, skill, ..."),
  title: z.string(),
  video: z.string().describe("Full video MP4 URL"),
  width: z.number().int(),
});

const videoDetailSchema = videoSummarySchema.extend({
  category: z.string().optional().describe("Primary content category"),
  categoryUrl: z.string().optional(),
  neighbours: z
    .object({
      next: z.string().optional(),
      previous: z.string().optional(),
    })
    .describe("Slugs before and after this entry in its category"),
  prompt: z
    .string()
    .optional()
    .describe("Original prompt behind the video, as shared by the creator"),
  skillUrl: z.string().optional(),
  stack: z.string().optional(),
  tweetUrl: z.string().optional(),
});

const searchInputSchema = z.object({
  category: z
    .enum(MOTION_CATEGORIES)
    .optional()
    .describe("Filter to one content category (see list-categories)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(SEARCH_MAX_LIMIT)
    .optional()
    .describe(`Max results to return (1-${SEARCH_MAX_LIMIT}). Defaults to 12`),
  query: z
    .string()
    .optional()
    .describe(
      "Keywords; every word must appear in the title, prompt, creator handle, or content tags"
    ),
  sort: z
    .enum(["newest", "oldest"])
    .optional()
    .describe("Sort order by publish date. Defaults to newest"),
  type: z
    .enum(["prompt", "skill"])
    .optional()
    .describe("Only entries that shared a prompt, or that shipped a skill"),
});

const getVideoInputSchema = z.object({
  slug: z
    .string()
    .describe("Catalog slug from search-videos, e.g. twoclipping-5cba86"),
});

const browseDirectoryInputSchema = z.object({
  category: z
    .string()
    .optional()
    .describe("Exact category filter, e.g. AI, Editor, Motion, Studio"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(DIRECTORY_MAX_LIMIT)
    .optional()
    .describe(
      `Max entries to return (1-${DIRECTORY_MAX_LIMIT}). Defaults to 24`
    ),
  query: z
    .string()
    .optional()
    .describe("Keywords matched against name, description, and category"),
  section: z
    .enum(DIRECTORY_SECTIONS)
    .optional()
    .describe("Directory to browse. Defaults to tools"),
});

const readOnly = {
  destructiveHint: false,
  openWorldHint: false,
  readOnlyHint: true,
} as const;

const viewCsp = {
  resourceDomains: ["https://assets.motionvideo.xyz"],
};

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export const searchVideos = server.tool(
  {
    annotations: readOnly,
    description:
      "Search the motionvideo.xyz catalog of AI-made motion videos. Match by keywords and/or content category, sorted newest or oldest. Results include preview and full MP4 links plus the page URL.",
    inputSchema: searchInputSchema,
    name: "search-videos",
    outputSchema: z.object({
      shown: z.number().int(),
      total: z.number().int().describe("Total matches before the limit"),
      videos: z.array(videoSummarySchema),
    }),
    securitySchemes: [{ type: "noauth" }],
    title: "Search motion videos",
    view: {
      csp: viewCsp,
      description:
        "Interactive gallery of matching motion videos with inline player and the prompt behind each entry",
      name: "video-gallery",
      permissions: { clipboardWrite: {} },
      prefersBorder: false,
    },
  },
  async ({ query, category, type, sort, limit }) => {
    const { total, videos } = await searchCatalog({
      category,
      limit,
      query,
      sort,
      type,
    });

    const filters = [
      query ? `matching "${query}"` : undefined,
      category ? `in ${category}` : undefined,
      type ? `with a ${type}` : undefined,
    ]
      .filter(Boolean)
      .join(" ");

    const lines = videos.map(
      (video) =>
        `- ${video.title} by @${video.handle}${video.model ? ` (${video.model})` : ""} — ${video.pageUrl}`
    );

    const header = `Found ${total} motion video${total === 1 ? "" : "s"}${filters ? ` ${filters}` : ""}. Showing ${videos.length}.`;
    const hint =
      total > videos.length
        ? "Raise the limit or narrow the query for more precision."
        : "Call get-video with a slug for the full prompt.";

    return {
      content: [
        {
          text: [header, "", ...lines, "", hint].join("\n"),
          type: "text" as const,
        },
      ],
      structuredContent: { shown: videos.length, total, videos },
    };
  }
);

export const getVideo = server.tool(
  {
    annotations: readOnly,
    description:
      "Fetch one motionvideo.xyz catalog entry: the original prompt behind the video, how it was made (model, effort, iterations), live media links, and neighbours to keep exploring.",
    inputSchema: getVideoInputSchema,
    name: "get-video",
    outputSchema: videoDetailSchema,
    securitySchemes: [{ type: "noauth" }],
    title: "Get a motion video",
    view: {
      csp: viewCsp,
      description:
        "Player for one motion video with its original prompt, metadata, and remix actions",
      name: "video-detail",
      permissions: { clipboardWrite: {} },
      prefersBorder: false,
    },
  },
  async ({ slug }) => {
    const video = await findVideo(slug);
    if (!video) {
      const { videos } = await searchCatalog({ limit: 5, query: slug });
      const suggestions = videos
        .map((entry) => `- ${entry.title} (${entry.slug}) — ${entry.pageUrl}`)
        .join("\n");
      return {
        content: [
          {
            text: `No catalog video with slug "${slug}". Use search-videos to find one.${suggestions ? `\nClosest titles:\n${suggestions}` : ""}`,
            type: "text" as const,
          },
        ],
        isError: true,
      };
    }

    const detail = await toDetail(video);
    const madeWith = [
      detail.model && `model ${detail.model}`,
      detail.effort && `effort ${detail.effort}`,
      detail.iterations && `${detail.iterations}`,
      detail.stack && `${detail.stack}`,
    ]
      .filter(Boolean)
      .join(", ");

    return {
      content: [
        {
          text: [
            `${detail.title} by @${detail.handle} — ${detail.pageUrl}`,
            madeWith ? `Made with ${madeWith}.` : undefined,
            detail.prompt
              ? "Original prompt included in structured content — adapt it to the user's brief and credit the source."
              : "No prompt was shared for this entry; it still works as a visual reference.",
          ]
            .filter(Boolean)
            .join("\n"),
          type: "text" as const,
        },
      ],
      structuredContent: detail,
    };
  }
);

export const listCategories = server.tool(
  {
    annotations: readOnly,
    description:
      "List the motionvideo.xyz content categories with video counts and descriptions. Useful before search-videos to pick a category filter.",
    inputSchema: z.object({}),
    name: "list-categories",
    outputSchema: z.object({
      categories: z.array(
        z.object({
          count: z.number().int(),
          description: z.string(),
          id: z.string(),
          label: z.string(),
          url: z.string(),
        })
      ),
    }),
    securitySchemes: [{ type: "noauth" }],
    title: "List catalog categories",
  },
  async () => {
    const categories = await categorySummaries();
    const lines = categories.map(
      (category) =>
        `- ${category.id} — ${category.label} (${category.count} videos): ${category.description}`
    );
    return {
      content: [
        {
          text: ["Catalog categories:", "", ...lines].join("\n"),
          type: "text" as const,
        },
      ],
      structuredContent: { categories },
    };
  }
);

export const browseDirectory = server.tool(
  {
    annotations: readOnly,
    description:
      "Browse the motionvideo.xyz directories: motion tools, editors, AI generators, and resource sites (tools), or motion studios for hire (studios).",
    inputSchema: browseDirectoryInputSchema,
    name: "browse-directory",
    outputSchema: z.object({
      categories: z
        .array(z.string())
        .describe("Categories available in this section"),
      entries: z.array(
        z.object({
          category: z.string(),
          cover: z.string(),
          description: z.string(),
          id: z.string(),
          name: z.string(),
          url: z.string(),
        })
      ),
      section: z.string(),
      shown: z.number().int(),
      total: z.number().int(),
    }),
    securitySchemes: [{ type: "noauth" }],
    title: "Browse tools and studios",
  },
  async ({ section, query, category, limit }) => {
    const activeSection = section ?? "tools";
    const { total, entries } = await browseDirectoryPage({
      category,
      limit,
      query,
      section: activeSection,
    });
    const label = activeSection === "tools" ? "tools & apps" : "motion studios";
    const lines = entries.map(
      (entry) =>
        `- ${entry.name} [${entry.category}] — ${entry.description} ${entry.url}`
    );
    return {
      content: [
        {
          text: [
            `${total} ${label}${query ? ` matching "${query}"` : ""}${category ? ` in ${category}` : ""}. Showing ${entries.length}.`,
            "",
            ...lines,
          ].join("\n"),
          type: "text" as const,
        },
      ],
      structuredContent: {
        categories: await directoryCategories(activeSection),
        entries,
        section: activeSection,
        shown: entries.length,
        total,
      },
    };
  }
);

// ---------------------------------------------------------------------------
// Pro tools (OAuth + plan)
// ---------------------------------------------------------------------------

// The Moves library's copy-ready prompts are MotionVideo Pro. These tools sign
// the user in with their motionvideo.xyz account and forward the verified
// access token to the site, which checks for an active Pro or Business plan
// (or a Business seat) on that account.

const proError = (text: string) => ({
  content: [{ text, type: "text" as const }],
  isError: true as const,
});

const moveSummarySchema = z.object({
  aka: z.array(z.string()).describe("Other names for the move"),
  family: z.enum(MOVE_FAMILIES),
  goodFor: z.array(z.string()).describe("What the move works well for"),
  name: z.string(),
  pageUrl: z.string().describe("The move's page on motionvideo.xyz"),
  slug: z.string().describe("Stable move id for get-move-prompt"),
  summary: z.string().describe("One sentence: what the move looks like"),
});

export const searchMoves = server.tool(
  {
    annotations: readOnly,
    description:
      "MotionVideo Pro: search the motionvideo.xyz Moves library of named motion techniques (easing, kinetic type, transitions, UI motion, camera moves, and more) by keyword and/or family. Returns names, families, summaries, and slugs for get-move-prompt. Signs in with the user's motionvideo.xyz account (the client offers that on first use) and needs a MotionVideo Pro or Business plan on it.",
    inputSchema: z.object({
      family: z
        .enum(MOVE_FAMILIES)
        .optional()
        .describe("Only moves in one family"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(MOVES_MAX_LIMIT)
        .optional()
        .describe(`Max moves to return (1-${MOVES_MAX_LIMIT}). Defaults to 12`),
      query: z
        .string()
        .optional()
        .describe(
          "Text matched case-insensitively against the move's name, other names, summary, and good-for tags"
        ),
    }),
    name: "search-moves",
    outputSchema: z.object({
      moves: z.array(moveSummarySchema),
      shown: z.number().int(),
      total: z.number().int().describe("Total matches before the limit"),
    }),
    securitySchemes: [{ scopes: [], type: "oauth2" }],
    title: "Search motion moves (Pro)",
  },
  async ({ query, family, limit }, ctx) => {
    const result = await loadProMoves({
      accessToken: ctx.auth.accessToken,
      userId: ctx.auth.user.id,
    });
    if ("error" in result) {
      return proError(result.error);
    }

    const { total, moves } = searchProMoves(result.data, {
      family,
      limit,
      query,
    });
    const summaries = moves.map((move) => ({
      aka: move.aka,
      family: move.family,
      goodFor: move.goodFor,
      name: move.name,
      pageUrl: movePageUrl(move),
      slug: move.slug,
      summary: move.summary,
    }));

    const filters = [
      query ? `matching "${query}"` : undefined,
      family ? `in ${family}` : undefined,
    ]
      .filter(Boolean)
      .join(" ");
    const lines = summaries.map(
      (move) =>
        `- ${move.name} [${move.family}] (${move.slug}) — ${move.summary}`
    );

    return {
      content: [
        {
          text: [
            `Found ${total} move${total === 1 ? "" : "s"}${filters ? ` ${filters}` : ""}. Showing ${summaries.length}.`,
            "",
            ...lines,
            "",
            "Call get-move-prompt with a slug for its copy-ready prompt.",
          ].join("\n"),
          type: "text" as const,
        },
      ],
      structuredContent: { moves: summaries, shown: summaries.length, total },
    };
  }
);

export const getMovePrompt = server.tool(
  {
    annotations: readOnly,
    description:
      "MotionVideo Pro: fetch the copy-ready prompt for one move from the motionvideo.xyz Moves library, with its tunable parameters and page URL. Signs in with the user's motionvideo.xyz account (the client offers that on first use) and needs a MotionVideo Pro or Business plan on it.",
    inputSchema: z.object({
      slug: z
        .string()
        .describe("Move slug from search-moves, e.g. squash-and-stretch"),
    }),
    name: "get-move-prompt",
    outputSchema: z.object({
      family: z.enum(MOVE_FAMILIES),
      name: z.string(),
      pageUrl: z.string().describe("The move's page on motionvideo.xyz"),
      parameters: z
        .array(z.string())
        .describe("Values worth tuning, with their working ranges"),
      prompt: z.string().describe("Copy-ready prompt; fill in the brackets"),
      slug: z.string(),
      summary: z.string(),
    }),
    securitySchemes: [{ scopes: [], type: "oauth2" }],
    title: "Get a move prompt (Pro)",
  },
  async ({ slug }, ctx) => {
    const result = await loadProMove(ctx.auth.accessToken, slug);
    if ("error" in result) {
      return proError(result.error);
    }
    const move = result.data;
    if (!move) {
      return proError(
        `No move with slug "${slug}". Use search-moves to find one.`
      );
    }

    const pageUrl = movePageUrl(move);
    return {
      content: [
        {
          text: [
            `${move.name} [${move.family}] — ${pageUrl}`,
            move.summary,
            "",
            "Prompt:",
            move.prompt,
            "",
            "Parameters:",
            ...move.parameters.map((parameter) => `- ${parameter}`),
          ].join("\n"),
          type: "text" as const,
        },
      ],
      structuredContent: {
        family: move.family,
        name: move.name,
        pageUrl,
        parameters: move.parameters,
        prompt: move.prompt,
        slug: move.slug,
        summary: move.summary,
      },
    };
  }
);

// ---------------------------------------------------------------------------
// Account tools (OAuth)
// ---------------------------------------------------------------------------

// Signed-in tools call the site's `/api/mcp/*` endpoints with the access
// token Better Auth issued for this server; it holds no account secrets.

const bookmarkKinds = ["video", "tool", "studio", "skill", "extra"] as const;

const bookmarkSchema = z.object({
  category: z
    .string()
    .optional()
    .describe("Directory category: tools, studios, skills, or resources"),
  creator: z.string().optional().describe("Video creator handle (videos only)"),
  description: z.string().optional(),
  id: z.string().describe("Catalog item id (video slug or directory entry id)"),
  kind: z.enum(bookmarkKinds),
  title: z.string(),
  url: z.string().describe("Page to open for the item"),
});

const featuredSubmissionSchema = z.object({
  description: z.string(),
  featuredItemId: z
    .string()
    .optional()
    .describe("Catalog item the submission became"),
  featuredUrl: z
    .string()
    .optional()
    .describe("Catalog page of the featured entry"),
  kind: z.enum(bookmarkKinds),
  status: z.literal("featured"),
  submittedAt: z.string().describe("ISO 8601 date the submission was filed"),
  title: z.string(),
  url: z.string().describe("The submitted URL"),
});

// A reachable-but-rejecting response means the session went stale, not that
// the catalog is down, so it gets its own message.
const fetchAccountApi = async <T>(
  path: string,
  accessToken: string
): Promise<{ data: T } | { error: string }> => {
  let response: Response;
  try {
    response = await fetch(`${SITE_URL}${path}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return {
      error: `${SITE_URL} could not be reached; try again in a moment.`,
    };
  }
  if (!response.ok) {
    return {
      error: `motionvideo.xyz rejected the request (HTTP ${response.status}). If this keeps happening, sign out and back in from the MCP client to refresh the session.`,
    };
  }
  return {
    // SAFETY: the site's /api/mcp/* endpoints return the shapes this file's
    // output schemas mirror, and `data` is only read through those schemas.
    data: (await response.json()) as T,
  };
};

export const listBookmarks = server.tool(
  {
    annotations: readOnly,
    description:
      "List the signed-in user's motionvideo.xyz bookmarks: saved motion videos, tools, studios, skills, and resources, newest first. Signs in with the user's MotionVideo account; the client offers that on first use.",
    inputSchema: z.object({
      kind: z
        .enum(bookmarkKinds)
        .optional()
        .describe("Return only bookmarks of one kind"),
    }),
    name: "list-bookmarks",
    outputSchema: z.object({ bookmarks: z.array(bookmarkSchema) }),
    securitySchemes: [{ scopes: [], type: "oauth2" }],
    title: "List my bookmarks",
  },
  async ({ kind }, ctx) => {
    const result = await fetchAccountApi<{
      bookmarks: z.infer<typeof bookmarkSchema>[];
    }>("/api/mcp/bookmarks", ctx.auth.accessToken);
    if ("error" in result) {
      return {
        content: [
          {
            text: `Could not load bookmarks: ${result.error}`,
            type: "text" as const,
          },
        ],
        isError: true,
      };
    }

    const bookmarks = kind
      ? result.data.bookmarks.filter((bookmark) => bookmark.kind === kind)
      : result.data.bookmarks;
    const lines = bookmarks.map(
      (bookmark) =>
        `- [${bookmark.kind}] ${bookmark.title}${bookmark.creator ? ` by ${bookmark.creator}` : ""} — ${bookmark.url}`
    );
    const text =
      bookmarks.length > 0
        ? [
            `${bookmarks.length} bookmark${bookmarks.length === 1 ? "" : "s"}${kind ? ` (${kind})` : ""}, newest first:`,
            "",
            ...lines,
            "",
            "Call get-video with a video's id to read its prompt.",
          ].join("\n")
        : `No ${kind ? `${kind} ` : ""}bookmarks yet. On motionvideo.xyz the bookmark button on any video or directory entry saves it here.`;

    return {
      content: [{ text, type: "text" as const }],
      structuredContent: { bookmarks },
    };
  }
);

export const myFeatured = server.tool(
  {
    annotations: readOnly,
    description:
      "List the signed-in user's motionvideo.xyz community submissions that were featured in the catalog, newest first, with links to the featured entries. Signs in with the user's MotionVideo account; the client offers that on first use.",
    inputSchema: z.object({}),
    name: "my-featured",
    outputSchema: z.object({
      submissions: z.array(featuredSubmissionSchema),
    }),
    securitySchemes: [{ scopes: [], type: "oauth2" }],
    title: "My featured submissions",
  },
  async (_input, ctx) => {
    const result = await fetchAccountApi<{
      submissions: z.infer<typeof featuredSubmissionSchema>[];
    }>("/api/mcp/featured", ctx.auth.accessToken);
    if ("error" in result) {
      return {
        content: [
          {
            text: `Could not load featured submissions: ${result.error}`,
            type: "text" as const,
          },
        ],
        isError: true,
      };
    }

    const { submissions } = result.data;
    const lines = submissions.map(
      (submission) =>
        `- [${submission.kind}] ${submission.title} — ${submission.featuredUrl ?? submission.url} (submitted ${submission.submittedAt.slice(0, 10)})`
    );
    const text =
      submissions.length > 0
        ? [
            `${submissions.length} featured submission${submissions.length === 1 ? "" : "s"}, newest first:`,
            "",
            ...lines,
          ].join("\n")
        : "None of the user's submissions have been featured yet. They can submit work at https://motionvideo.xyz/dashboard/submit.";

    return {
      content: [{ text, type: "text" as const }],
      structuredContent: { submissions },
    };
  }
);

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

// Read-only overview of the catalog for clients that prefer resources.
server.resource(
  {
    description:
      "Counts, categories, and directory sections of the motionvideo.xyz catalog.",
    mimeType: "application/json",
    name: "catalog-overview",
    title: "MotionVideo catalog overview",
    uri: "motionvideo://catalog/overview",
  },
  async (uri) => ({
    contents: [
      {
        mimeType: "application/json",
        text: JSON.stringify(await catalogStats(), null, 2),
        uri: uri.href,
      },
    ],
  })
);

// One catalog entry per video, prompt included.
server.resourceTemplate(
  {
    complete: {
      slug: completeVideoSlug,
    },
    description:
      "Full catalog entry for one motion video: original prompt, metadata, media links, and neighbours.",
    mimeType: "application/json",
    name: "video",
    title: "Catalog video entry",
    uriTemplate: "motionvideo://videos/{slug}",
  },
  async (uri, params) => {
    const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
    const video = slug ? await findVideo(slug) : undefined;
    if (!video) {
      return {
        contents: [
          {
            mimeType: "text/plain",
            text: `No catalog video with slug "${slug ?? ""}". Use the search-videos tool to find one.`,
            uri: uri.href,
          },
        ],
      };
    }
    return {
      contents: [
        {
          mimeType: "application/json",
          text: JSON.stringify(await toDetail(video), null, 2),
          uri: uri.href,
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

// Model-ready brief built from a catalog entry's original prompt.
server.prompt(
  {
    description:
      "Model-ready brief to recreate or adapt the motion video behind a catalog entry using its original prompt, model, and metadata.",
    name: "remix-video",
    schema: z.object({
      direction: z
        .string()
        .optional()
        .describe(
          "Optional new direction: brand, subject, palette, duration, or platform changes"
        ),
      slug: completable(
        z.string().describe('Catalog video slug, e.g. "stephanlivera-df17a2"'),
        completeVideoSlug
      ),
    }),
    title: "Remix a catalog motion video",
  },
  async ({ slug, direction }) => {
    const video = await findVideo(String(slug));
    if (!video) {
      return {
        messages: [
          {
            content: {
              text: `No catalog video with slug "${slug}". Use the search-videos tool to find one first.`,
              type: "text" as const,
            },
            role: "user" as const,
          },
        ],
      };
    }

    const detail = await toDetail(video);
    const madeWith = [
      detail.model && `model ${detail.model}`,
      detail.effort && `effort ${detail.effort}`,
      detail.iterations && `${detail.iterations}`,
      detail.stack && `stack ${detail.stack}`,
    ]
      .filter(Boolean)
      .join(", ");

    const brief = [
      `You are adapting a motion video from the MotionVideo catalog: "${detail.title}" by @${detail.handle}.`,
      `Reference page: ${videoPageUrl(detail.slug)}${detail.tweetUrl ? ` (original post: ${detail.tweetUrl})` : ""}`,
      madeWith ? `How it was made, per the creator: ${madeWith}.` : undefined,
      detail.prompt
        ? `Original prompt behind it:\n"""\n${detail.prompt}\n"""`
        : "The creator did not share the prompt; use the linked video as a visual reference only.",
      direction
        ? `New direction from the user: ${direction}.`
        : "The user has not specified a direction yet. Ask for the brand, copy, palette, duration, and aspect ratio before building.",
      "Deliverable: keep the choreography, timing structure, and constraints that make the original work, swap in the user's content, then build the video in the user's stack. When you share the result, credit the source page above.",
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      messages: [
        {
          content: { text: brief, type: "text" as const },
          role: "user" as const,
        },
      ],
    };
  }
);

export default server;
