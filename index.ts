// MotionVideo MCP server — the motionvideo.xyz catalog as MCP tools, views,
// resources, and a prompt. Scaffolded from the mcp-use `mcp-apps` template.

import { MCPServer, completable } from "mcp-use";
import { z } from "zod";

import {
  browseDirectory as browseDirectoryPage,
  catalogStats,
  DIRECTORY_MAX_LIMIT,
  DIRECTORY_SECTIONS,
  directoryCategories,
  findVideo,
  listCategories as categorySummaries,
  MOTION_CATEGORIES,
  SEARCH_MAX_LIMIT,
  searchVideos as searchCatalog,
  toDetail,
  videoPageUrl,
} from "./src/catalog.js";

const server = new MCPServer({
  name: "motionvideo",
  title: "MotionVideo",
  version: "1.0.0",
  description:
    "The motionvideo.xyz catalog: AI-made motion videos with the prompts and skills behind them. Search references, pull original prompts to remix, and browse motion tools and studios.",
  instructions:
    "Use search-videos to find motion video references (keywords and/or a content category), then get-video to read the original prompt and how it was made so you can adapt it. list-categories explains the catalog categories; browse-directory covers motion tools and studios. When you remix a prompt, credit the source video page.",
  websiteUrl: "https://motionvideo.xyz",
  icons: [
    {
      src: "icon.svg",
      mimeType: "image/svg+xml",
      sizes: ["any"],
    },
  ],
});

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const videoSummarySchema = z.object({
  slug: z.string().describe("Stable catalog id, e.g. stephanlivera-df17a2"),
  title: z.string(),
  handle: z.string().describe("Creator handle on X"),
  avatar: z.string().describe("Creator avatar image URL"),
  date: z.string().describe("Publish date (YYYY-MM-DD)"),
  description: z.string().optional(),
  contentTags: z.array(z.string()).describe("Motion content categories"),
  tags: z.array(z.string()).describe("Entry tags: prompt, skill, ..."),
  poster: z.string().describe("Poster image URL"),
  preview: z.string().describe("Short looping preview MP4 URL"),
  video: z.string().describe("Full video MP4 URL"),
  width: z.number().int(),
  height: z.number().int(),
  promptShared: z.boolean().describe("Whether the original prompt is public"),
  model: z.string().optional(),
  effort: z.string().optional(),
  iterations: z.string().optional(),
  pageUrl: z.string().describe("Canonical page on motionvideo.xyz"),
});

const videoDetailSchema = videoSummarySchema.extend({
  prompt: z
    .string()
    .optional()
    .describe("Original prompt behind the video, as shared by the creator"),
  skillUrl: z.string().optional(),
  tweetUrl: z.string().optional(),
  stack: z.string().optional(),
  category: z.string().optional().describe("Primary content category"),
  categoryUrl: z.string().optional(),
  neighbours: z
    .object({
      previous: z.string().optional(),
      next: z.string().optional(),
    })
    .describe("Slugs before and after this entry in its category"),
});

const searchInputSchema = z.object({
  query: z
    .string()
    .optional()
    .describe(
      "Keywords; every word must appear in the title, prompt, creator handle, or content tags"
    ),
  category: z
    .enum(MOTION_CATEGORIES)
    .optional()
    .describe("Filter to one content category (see list-categories)"),
  type: z
    .enum(["prompt", "skill"])
    .optional()
    .describe("Only entries that shared a prompt, or that shipped a skill"),
  sort: z
    .enum(["newest", "oldest"])
    .optional()
    .describe("Sort order by publish date. Defaults to newest"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(SEARCH_MAX_LIMIT)
    .optional()
    .describe(`Max results to return (1-${SEARCH_MAX_LIMIT}). Defaults to 12`),
});

const getVideoInputSchema = z.object({
  slug: z.string().describe("Catalog slug from search-videos, e.g. twoclipping-5cba86"),
});

const browseDirectoryInputSchema = z.object({
  section: z
    .enum(DIRECTORY_SECTIONS)
    .optional()
    .describe("Directory to browse. Defaults to tools"),
  query: z
    .string()
    .optional()
    .describe("Keywords matched against name, description, and category"),
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
    .describe(`Max entries to return (1-${DIRECTORY_MAX_LIMIT}). Defaults to 24`),
});

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

const viewCsp = {
  resourceDomains: ["https://assets.motionvideo.xyz"],
};

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export const searchVideos = server.tool(
  {
    name: "search-videos",
    title: "Search motion videos",
    description:
      "Search the motionvideo.xyz catalog of AI-made motion videos. Match by keywords and/or content category, sorted newest or oldest. Results include preview and full MP4 links plus the page URL.",
    inputSchema: searchInputSchema,
    outputSchema: z.object({
      total: z.number().int().describe("Total matches before the limit"),
      shown: z.number().int(),
      videos: z.array(videoSummarySchema),
    }),
    view: {
      name: "video-gallery",
      description:
        "Interactive gallery of matching motion videos with inline player and the prompt behind each entry",
      prefersBorder: false,
      csp: viewCsp,
    },
    annotations: readOnly,
  },
  async ({ query, category, type, sort, limit }) => {
    const { total, videos } = searchCatalog({
      query,
      category,
      type,
      sort,
      limit,
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
          type: "text" as const,
          text: [header, "", ...lines, "", hint].join("\n"),
        },
      ],
      structuredContent: { total, shown: videos.length, videos },
    };
  }
);

export const getVideo = server.tool(
  {
    name: "get-video",
    title: "Get a motion video",
    description:
      "Fetch one motionvideo.xyz catalog entry: the original prompt behind the video, how it was made (model, effort, iterations), live media links, and neighbours to keep exploring.",
    inputSchema: getVideoInputSchema,
    outputSchema: videoDetailSchema,
    view: {
      name: "video-detail",
      description:
        "Player for one motion video with its original prompt, metadata, and remix actions",
      prefersBorder: false,
      csp: viewCsp,
    },
    annotations: readOnly,
  },
  async ({ slug }) => {
    const video = findVideo(slug);
    if (!video) {
      const { videos } = searchCatalog({ query: slug, limit: 5 });
      const suggestions = videos
        .map((entry) => `- ${entry.title} (${entry.slug}) — ${entry.pageUrl}`)
        .join("\n");
      return {
        content: [
          {
            type: "text" as const,
            text: `No catalog video with slug "${slug}". Use search-videos to find one.${suggestions ? `\nClosest titles:\n${suggestions}` : ""}`,
          },
        ],
        isError: true,
      };
    }

    const detail = toDetail(video);
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
          type: "text" as const,
          text: [
            `${detail.title} by @${detail.handle} — ${detail.pageUrl}`,
            madeWith ? `Made with ${madeWith}.` : undefined,
            detail.prompt
              ? "Original prompt included in structured content — adapt it to the user's brief and credit the source."
              : "No prompt was shared for this entry; it still works as a visual reference.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      structuredContent: detail,
    };
  }
);

export const listCategories = server.tool(
  {
    name: "list-categories",
    title: "List catalog categories",
    description:
      "List the motionvideo.xyz content categories with video counts and descriptions. Useful before search-videos to pick a category filter.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      categories: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          description: z.string(),
          count: z.number().int(),
          url: z.string(),
        })
      ),
    }),
    annotations: readOnly,
  },
  async () => {
    const categories = categorySummaries();
    const lines = categories.map(
      (category) =>
        `- ${category.id} — ${category.label} (${category.count} videos): ${category.description}`
    );
    return {
      content: [
        {
          type: "text" as const,
          text: ["Catalog categories:", "", ...lines].join("\n"),
        },
      ],
      structuredContent: { categories },
    };
  }
);

export const browseDirectory = server.tool(
  {
    name: "browse-directory",
    title: "Browse tools and studios",
    description:
      "Browse the motionvideo.xyz directories: motion tools, editors, AI generators, and resource sites (tools), or motion studios for hire (studios).",
    inputSchema: browseDirectoryInputSchema,
    outputSchema: z.object({
      section: z.string(),
      total: z.number().int(),
      shown: z.number().int(),
      categories: z.array(z.string()).describe("Categories available in this section"),
      entries: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string(),
          category: z.string(),
          url: z.string(),
          cover: z.string(),
        })
      ),
    }),
    annotations: readOnly,
  },
  async ({ section, query, category, limit }) => {
    const activeSection = section ?? "tools";
    const { total, entries } = browseDirectoryPage({
      section: activeSection,
      query,
      category,
      limit,
    });
    const label = activeSection === "tools" ? "tools & apps" : "motion studios";
    const lines = entries.map(
      (entry) =>
        `- ${entry.name} [${entry.category}] — ${entry.description} ${entry.url}`
    );
    return {
      content: [
        {
          type: "text" as const,
          text: [
            `${total} ${label}${query ? ` matching "${query}"` : ""}${category ? ` in ${category}` : ""}. Showing ${entries.length}.`,
            "",
            ...lines,
          ].join("\n"),
        },
      ],
      structuredContent: {
        section: activeSection,
        total,
        shown: entries.length,
        categories: directoryCategories(activeSection),
        entries,
      },
    };
  }
);

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

// Read-only overview of the catalog for clients that prefer resources.
const catalogOverview = server.resource(
  {
    name: "catalog-overview",
    uri: "motionvideo://catalog/overview",
    title: "MotionVideo catalog overview",
    description:
      "Counts, categories, and directory sections of the motionvideo.xyz catalog.",
    mimeType: "application/json",
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(catalogStats(), null, 2),
      },
    ],
  })
);

// One catalog entry per video, prompt included.
const videoResource = server.resourceTemplate(
  {
    name: "video",
    uriTemplate: "motionvideo://videos/{slug}",
    title: "Catalog video entry",
    description:
      "Full catalog entry for one motion video: original prompt, metadata, media links, and neighbours.",
    mimeType: "application/json",
    complete: {
      slug: searchCatalog({ limit: SEARCH_MAX_LIMIT }).videos.map(
        (video) => video.slug
      ),
    },
  },
  async (uri, params) => {
    const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
    const video = slug ? findVideo(slug) : undefined;
    if (!video) {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text: `No catalog video with slug "${slug ?? ""}". Use the search-videos tool to find one.`,
          },
        ],
      };
    }
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(toDetail(video), null, 2),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const remixVideo = server.prompt(
  {
    name: "remix-video",
    title: "Remix a catalog motion video",
    description:
      "Model-ready brief to recreate or adapt the motion video behind a catalog entry using its original prompt, model, and metadata.",
    schema: z.object({
      slug: completable(
        z
          .string()
          .describe('Catalog video slug, e.g. "stephanlivera-df17a2"'),
        searchCatalog({ limit: SEARCH_MAX_LIMIT }).videos.map(
          (video) => video.slug
        )
      ),
      direction: z
        .string()
        .optional()
        .describe(
          "Optional new direction: brand, subject, palette, duration, or platform changes"
        ),
    }),
  },
  async ({ slug, direction }) => {
    const video = findVideo(String(slug));
    if (!video) {
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `No catalog video with slug "${slug}". Use the search-videos tool to find one first.`,
            },
          },
        ],
      };
    }

    const detail = toDetail(video);
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
          role: "user" as const,
          content: { type: "text" as const, text: brief },
        },
      ],
    };
  }
);

export default server;
