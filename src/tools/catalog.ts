// Anonymous video surface: search-videos and get-video (both with views), the
// catalog resources and the remix prompt. The site answers every query
// (src/catalog.ts); this module turns its answers into agent-readable text.

import { completable } from "mcp-use";
import { z } from "zod";

import {
  COLOR_NAMES,
  completeVideoSlug,
  getVideo as fetchVideo,
  loadFacets,
  MOTION_CATEGORIES,
  SEARCH_MAX_LIMIT,
  searchVideos as searchCatalog,
} from "../catalog.js";
import type {
  VideoDetail,
  VideoSearchQuery,
  VideoSearchResult,
} from "../catalog.js";
import { readOnly, server, toolError } from "../mcp-server.js";

const videoSummarySchema = z.object({
  avatar: z.string().describe("Creator avatar image URL"),
  colorNames: z
    .array(z.enum(COLOR_NAMES))
    .describe("Named colours in the video, from its palette"),
  contentTags: z.array(z.string()).describe("Motion content categories"),
  creatorName: z.string().optional().describe("Creator display name on X"),
  date: z.string().describe("Publish date (YYYY-MM-DD)"),
  description: z.string().optional(),
  effort: z.string().optional(),
  handle: z.string().describe("Creator handle on X"),
  height: z.number().int(),
  iterations: z.string().optional(),
  model: z.string().optional().describe("Model the creator reported using"),
  pageUrl: z.string().describe("Canonical page on motionvideo.xyz"),
  poster: z.string().describe("Poster image URL"),
  preview: z.string().describe("Short looping preview MP4 URL"),
  promptShared: z.boolean().describe("Whether the original prompt is public"),
  slug: z.string().describe("Stable catalog id, e.g. stephanlivera-df17a2"),
  stack: z.string().optional().describe("What rendered it, e.g. Remotion"),
  tags: z.array(z.string()).describe("Entry tags: prompt, skill, ..."),
  title: z.string(),
  video: z.string().describe("Full video MP4 URL"),
  width: z.number().int(),
});

const videoRefSchema = z.object({ slug: z.string(), title: z.string() });

const videoDetailSchema = videoSummarySchema.extend({
  category: z.string().optional().describe("Category page it belongs to"),
  categoryUrl: z.string().optional(),
  colors: z
    .array(z.string())
    .optional()
    .describe("Dominant colours as hex, largest first"),
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
  similar: z
    .array(videoRefSchema)
    .describe("The five most similar videos, best first"),
  skillInstall: z
    .string()
    .optional()
    .describe("Command that installs the skill"),
  skillUrl: z.string().optional(),
  tweetUrl: z.string().optional(),
});

const resolutionSchema = z.array(
  z.object({
    matched: z.array(z.string()),
    requested: z.string(),
    similar: z.array(z.string()).optional(),
  })
);

// Values within one filter are alternatives; different filters all apply.
// Strict, so a misspelt or retired filter (e.g. `category`) is reported
// instead of silently widening the search to the whole catalog.
const searchInputSchema = z.strictObject({
  categories: z
    .array(z.enum(MOTION_CATEGORIES))
    .max(MOTION_CATEGORIES.length)
    .optional()
    .describe(
      'Content categories, any of them (see list-filters), e.g. ["product-ui"] for "product UI"'
    ),
  colorMatch: z
    .enum(["any", "all"])
    .optional()
    .describe(
      'With several colors: "any" (default) for red OR orange, "all" for videos that contain every one'
    ),
  colors: z
    .array(z.enum(COLOR_NAMES))
    .max(COLOR_NAMES.length)
    .optional()
    .describe(
      "Named colours the video contains, matched like the site's colour pages"
    ),
  creators: z
    .array(z.string())
    .max(10)
    .optional()
    .describe(
      "Creators, any of them: X handles (with or without @) or display names, ignoring case"
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(SEARCH_MAX_LIMIT)
    .optional()
    .describe(`Results per page (1-${SEARCH_MAX_LIMIT}). Defaults to 12`),
  models: z
    .array(z.string())
    .max(10)
    .optional()
    .describe(
      'Models the video was made with, any of them: a name ("Opus 5.5", "GPT-6 Astra"), a full name ("Claude Opus 5.5"), a family ("Gemini") or a bare version ("5.5" covers Opus 5.5 and Fable 5.5). list-filters lists them'
    ),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Results to skip, for the next page. Defaults to 0"),
  query: z
    .string()
    .optional()
    .describe(
      "Keywords; every word must appear in the title, prompt, creator handle, or categories. Use the other filters for models, colours, categories and creators rather than keywords"
    ),
  sort: z
    .enum(["newest", "oldest"])
    .optional()
    .describe("By post date. Defaults to newest"),
  type: z
    .enum(["prompt", "skill"])
    .optional()
    .describe("Only entries that shared a prompt, or that shipped a skill"),
});

type SearchInput = z.infer<typeof searchInputSchema>;

const viewCsp = {
  resourceDomains: ["https://assets.motionvideo.xyz"],
};

/** "a", "a or b", "a, b or c". */
const listWith = (items: readonly string[], conjunction: "and" | "or") =>
  items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} ${conjunction} ${items.at(-1)}`;

type Resolution = VideoSearchResult["resolved"]["models"];

// Resolved catalog values where there are any, else what was asked for (the
// notes explain an unknown model or creator).
const resolvedOrRequested = (
  entries: Resolution,
  format: (value: string) => string
) => {
  const matched = [...new Set(entries.flatMap((entry) => entry.matched))];
  return listWith(
    matched.length > 0
      ? matched.map(format)
      : entries.map((entry) => entry.requested),
    "or"
  );
};

/** Every filter the search applied, in words: "model Opus 5.5", … */
const appliedFilters = (input: SearchInput, result: VideoSearchResult) =>
  [
    result.resolved.models.length > 0
      ? `model ${resolvedOrRequested(result.resolved.models, (model) => model)}`
      : undefined,
    input.categories?.length
      ? `category ${listWith(input.categories, "or")}`
      : undefined,
    input.colors?.length
      ? `colour ${listWith(input.colors, input.colorMatch === "all" ? "and" : "or")}`
      : undefined,
    result.resolved.creators.length > 0
      ? `creator ${resolvedOrRequested(result.resolved.creators, (handle) => `@${handle}`)}`
      : undefined,
    input.type ? `type ${input.type}` : undefined,
    input.query ? `matching "${input.query}"` : undefined,
  ].filter((filter) => filter !== undefined);

type Facet = NonNullable<VideoSearchResult["perFacet"]>[number]["facet"];

const FACET_LABELS = {
  category: "category",
  color: "colour",
  creator: "creator",
  model: "model",
  q: "keywords",
  type: "type",
} satisfies Record<Facet, string>;

/**
 * How each model and creator was read, which ones the catalog doesn't have,
 * and why nothing matched, so the answer never silently drops a filter.
 */
const searchNotes = async (result: VideoSearchResult): Promise<string[]> => {
  const { models, creators } = result.resolved;
  const unknownModel = models.some((entry) => entry.matched.length === 0);
  const facets = unknownModel ? await loadFacets() : undefined;
  const knownModels = facets?.videos.models ?? [];
  const modelNotes = models.flatMap((entry) => {
    if (entry.matched.length === 0) {
      return `No model "${entry.requested}" in the catalog. Models: ${knownModels.map(({ id, count }) => `${id} (${count})`).join(", ")}.`;
    }
    return entry.matched.length > 1 || entry.matched[0] !== entry.requested
      ? `"${entry.requested}" matched model ${listWith(entry.matched, "and")}.`
      : [];
  });
  const creatorNotes = creators
    .filter((entry) => entry.matched.length === 0)
    .map(
      (entry) =>
        `No creator "${entry.requested}" in the catalog.${entry.similar.length > 0 ? ` Similar: ${entry.similar.map((handle) => `@${handle}`).join(", ")}.` : ""}`
    );
  const emptyNote = result.perFacet
    ? [
        `No video matches all filters together. Each alone: ${result.perFacet.map((entry) => `${FACET_LABELS[entry.facet]} → ${entry.total}`).join("; ")}.`,
      ]
    : [];
  return [...modelNotes, ...creatorNotes, ...emptyNote];
};

const toQuery = (input: SearchInput): VideoSearchQuery => ({
  category: input.categories,
  color: input.colors,
  colorMatch: input.colorMatch,
  creator: input.creators,
  limit: input.limit,
  model: input.models,
  offset: input.offset,
  q: input.query,
  sort: input.sort,
  type: input.type,
});

export const searchVideos = server.tool(
  {
    annotations: readOnly,
    description:
      'Search the motionvideo.xyz catalog of AI-made motion videos by keywords, content categories, models, named colours, creators and type, sorted newest or oldest, a page at a time. Several values in one filter are alternatives (colors ["red","orange"] = red or orange); different filters all apply ("Opus 5.5 videos in product UI" = models ["Opus 5.5"] + categories ["product-ui"]). The answer states which filters were applied, what each resolved to, and, when nothing matches, how many videos each filter matches alone. Results include preview and full MP4 links plus the page URL.',
    inputSchema: searchInputSchema,
    name: "search-videos",
    outputSchema: z.object({
      offset: z.number().int(),
      perFacet: z
        .array(z.object({ facet: z.string(), total: z.number().int() }))
        .optional()
        .describe("With no results: how many videos each filter matches alone"),
      resolved: z.object({
        creators: resolutionSchema.describe(
          "Catalog handles each requested creator resolved to"
        ),
        models: resolutionSchema.describe(
          "Catalog models each requested model resolved to"
        ),
      }),
      shown: z.number().int(),
      total: z.number().int().describe("Total matches before paging"),
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
  async (input) => {
    const result = await searchCatalog(toQuery(input));
    const { total, videos, offset } = result;
    const filters = appliedFilters(input, result);
    const notes = await searchNotes(result);

    const lines = videos.map((video) => {
      const facts = [
        video.model,
        video.colorNames.length > 0 ? video.colorNames.join(", ") : undefined,
        video.contentTags.join(", ") || undefined,
      ].filter(Boolean);
      return `- ${video.title} by @${video.handle}${facts.length > 0 ? ` (${facts.join("; ")})` : ""} — ${video.slug} — ${video.pageUrl}`;
    });

    const range =
      videos.length > 0
        ? `Showing ${offset + 1}-${offset + videos.length}.`
        : "Showing none.";
    const header = `Found ${total} motion video${total === 1 ? "" : "s"}${filters.length > 0 ? ` with ${filters.join(", ")}` : ""}. ${range}`;
    const hint =
      offset + videos.length < total
        ? `More with offset ${offset + videos.length}, or add filters.`
        : "Call get-video with a slug for the full prompt.";

    return {
      content: [
        {
          text: [header, ...notes, "", ...lines, "", total > 0 ? hint : ""]
            .join("\n")
            .trim(),
          type: "text" as const,
        },
      ],
      structuredContent: {
        offset,
        perFacet: result.perFacet,
        resolved: result.resolved,
        shown: videos.length,
        total,
        videos,
      },
    };
  }
);

/** "Made with model Opus 5.5, effort max, one-shot, Remotion". */
const madeWith = (video: VideoDetail) =>
  [
    video.model && `model ${video.model}`,
    video.effort && `effort ${video.effort}`,
    video.iterations,
    video.stack && `stack ${video.stack}`,
  ]
    .filter(Boolean)
    .join(", ");

export const getVideo = server.tool(
  {
    annotations: readOnly,
    description:
      "Fetch one motionvideo.xyz catalog entry: the original prompt behind the video, how it was made (model, effort, iterations, stack), live media links, its neighbours and the five most similar videos to keep exploring.",
    inputSchema: z.object({
      slug: z
        .string()
        .describe("Catalog slug from search-videos, e.g. twoclipping-5cba86"),
    }),
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
    const result = await fetchVideo(slug);
    if ("notFound" in result) {
      const { duplicateOf, suggestions } = result.notFound;
      const lines = suggestions.map(
        (entry) => `- ${entry.title} (${entry.slug})`
      );
      return toolError(
        [
          duplicateOf
            ? `"${slug}" was removed as a duplicate of ${duplicateOf}; call get-video with that slug.`
            : `No catalog video with slug "${slug}". Use search-videos to find one.`,
          lines.length > 0 ? "Same creator:" : "",
          ...lines,
        ]
          .filter(Boolean)
          .join("\n")
      );
    }

    const { video } = result;
    const how = madeWith(video);
    return {
      content: [
        {
          text: [
            `${video.title} by @${video.handle} — ${video.pageUrl}`,
            how ? `Made with ${how}.` : undefined,
            video.prompt
              ? "Original prompt included in structured content — adapt it to the user's brief and credit the source."
              : "No prompt was shared for this entry; it still works as a visual reference.",
            video.similar.length > 0
              ? `Similar: ${video.similar.map((entry) => entry.slug).join(", ")}.`
              : undefined,
          ]
            .filter(Boolean)
            .join("\n"),
          type: "text" as const,
        },
      ],
      structuredContent: video,
    };
  }
);

// Read-only overview of the catalog for clients that prefer resources.
server.resource(
  {
    description:
      "Every filter value of the motionvideo.xyz catalog with its count: video categories, models, colours and types, the directory sections, and the move families.",
    mimeType: "application/json",
    name: "catalog-overview",
    title: "MotionVideo catalog overview",
    uri: "motionvideo://catalog/overview",
  },
  async (uri) => ({
    contents: [
      {
        mimeType: "application/json",
        text: JSON.stringify(await loadFacets(), null, 2),
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
      "Full catalog entry for one motion video: original prompt, metadata, media links, neighbours and similar videos.",
    mimeType: "application/json",
    name: "video",
    title: "Catalog video entry",
    uriTemplate: "motionvideo://videos/{slug}",
  },
  async (uri, params) => {
    const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
    const result = slug ? await fetchVideo(slug) : undefined;
    if (!result || "notFound" in result) {
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
          text: JSON.stringify(result.video, null, 2),
          uri: uri.href,
        },
      ],
    };
  }
);

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
    const result = await fetchVideo(String(slug));
    if ("notFound" in result) {
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

    const { video } = result;
    const how = madeWith(video);
    const brief = [
      `You are adapting a motion video from the MotionVideo catalog: "${video.title}" by @${video.handle}.`,
      `Reference page: ${video.pageUrl}${video.tweetUrl ? ` (original post: ${video.tweetUrl})` : ""}`,
      how ? `How it was made, per the creator: ${how}.` : undefined,
      video.prompt
        ? `Original prompt behind it:\n"""\n${video.prompt}\n"""`
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
