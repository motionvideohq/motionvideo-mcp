// MotionVideo MCP server — the motionvideo.xyz catalog as MCP tools, views,
// resources, and a prompt. Scaffolded from the mcp-use `mcp-apps` template.

import { MCPServer, completable } from "mcp-use";
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

const server = new MCPServer({
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
    "Use search-videos to find motion video references (keywords and/or a content category), then get-video to read the original prompt and how it was made so you can adapt it. list-categories explains the catalog categories; browse-directory covers motion tools and studios. When you remix a prompt, credit the source video page.",
  name: "motionvideo",
  title: "MotionVideo",
  version: "1.0.0",
  websiteUrl: "https://motionvideo.xyz",
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
    title: "Search motion videos",
    view: {
      csp: viewCsp,
      description:
        "Interactive gallery of matching motion videos with inline player and the prompt behind each entry",
      name: "video-gallery",
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
    title: "Get a motion video",
    view: {
      csp: viewCsp,
      description:
        "Player for one motion video with its original prompt, metadata, and remix actions",
      name: "video-detail",
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
