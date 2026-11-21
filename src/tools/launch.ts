// Launch Videos tools (OAuth + a plan with Launch Videos): search launch films
// and their scenes, compile one film or scene into a renderer prompt, and
// compose scenes from different films into one storyboard prompt. The site's
// `/api/mcp/launch-videos` endpoints do the search and compile; these tools
// forward the verified access token and format the answer. Keep the field
// names in sync with motionvideo.xyz/src/server/launch-compiler.ts and the
// site's `/api/mcp/launch-videos` routes.

import { z } from "zod";

import { SITE_URL } from "../catalog.js";
import { readOnly, server, toolError } from "../mcp-server.js";
import { fetchSiteApi } from "../site-api.js";

const LAUNCH_PATH = "/api/mcp/launch-videos";
const LAUNCH_MAX_LIMIT = 30;
const MAX_STORYBOARD_SCENES = 16;

const ASPECTS = ["16:9", "9:16", "1:1", "4:5"] as const;
const MODES = ["adapt", "exact"] as const;
const RENDERERS = ["remotion", "hyperframes", "editframe", "fframes"] as const;

const NOT_FOUND_MESSAGE =
  "motionvideo.xyz has no such launch film or scene (or Launch Videos is not live yet). Use search-launch-scenes to find a film slug or scene id.";

const ACCESS =
  "Signs in with the user's motionvideo.xyz account (the client offers that on first use) and needs a MotionVideo Pro or Business plan (Business seat holders are included).";

const fpsSchema = z.object({
  den: z.number().int().min(1),
  num: z.number().int().min(1),
});

/** Options shared by get-launch-prompt and compose-launch-prompt. */
const compileOptions = {
  aspect: z
    .enum(ASPECTS)
    .optional()
    .describe("Output aspect ratio. Defaults to the source film's"),
  finalize: z
    .boolean()
    .optional()
    .describe(
      "Ask for a finished prompt: true refuses (422) while required inputs are missing instead of leaving placeholders"
    ),
  fps: fpsSchema
    .optional()
    .describe("Output frame rate as a fraction, e.g. {num: 30, den: 1}"),
  inputs: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      "Brand inputs keyed by slot key (product name, tagline, colours, URLs...). Adapt mode fills the scenes' slots with them; run once without to see the slots"
    ),
  mode: z
    .enum(MODES)
    .describe(
      "exact: recreate the film as made. adapt: keep the structure and timing, swap in the user's brand from inputs"
    ),
  renderer: z
    .enum(RENDERERS)
    .describe("The video framework the prompt targets"),
  targetSeconds: z
    .number()
    .positive()
    .optional()
    .describe("Retime the output to about this many seconds"),
};

const promptInputSchema = z.object({
  ...compileOptions,
  filmSlug: z.string().describe("Film slug from search-launch-scenes"),
  sceneId: z
    .string()
    .optional()
    .describe("One scene of the film; omit for the whole film"),
});

const composeInputSchema = z.object({
  ...compileOptions,
  joins: z
    .array(
      z.object({
        after: z
          .number()
          .int()
          .min(0)
          .describe("Index of the scene the join follows"),
        frames: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Bridge length in output frames"),
        kind: z.enum(["cut", "bridge"]),
      })
    )
    .optional()
    .describe(
      "How consecutive scenes meet; defaults keep original joins and cut elsewhere"
    ),
  sceneIds: z
    .array(z.string())
    .min(1)
    .max(MAX_STORYBOARD_SCENES)
    .describe(
      `Scene ids from search-launch-scenes, in storyboard order (1-${MAX_STORYBOARD_SCENES})`
    ),
  versions: z
    .array(z.number().int().min(1).nullable())
    .max(MAX_STORYBOARD_SCENES)
    .optional()
    .describe(
      "Recipe version per position in sceneIds (null or omitted = latest)"
    ),
});

const compiledSchema = z.object({
  assets: z
    .array(z.looseObject({ sceneId: z.string() }))
    .describe("Media the prompt references, per scene"),
  filmVersion: z.number().nullable(),
  fps: fpsSchema,
  height: z.number(),
  joins: z.array(
    z.object({
      after: z.number(),
      frames: z.number(),
      kind: z.enum(["original", "designed", "cut", "bridge"]),
    })
  ),
  markdown: z.string().describe("The renderer-ready prompt"),
  missing: z.array(z.string()).describe("Required slot keys still empty"),
  mode: z.enum(MODES),
  renderer: z.enum(RENDERERS),
  scenes: z
    .array(
      z.object({
        endFrame: z.number(),
        filmSlug: z.string(),
        sceneId: z.string(),
        startFrame: z.number(),
        title: z.string(),
        version: z.number(),
      })
    )
    .describe("Frame timeline on the output grid (half-open ranges)"),
  slots: z
    .array(z.looseObject({ filled: z.boolean(), key: z.string() }))
    .describe("Brand inputs the scenes take, and whether each is filled"),
  totalFrames: z.number(),
  warnings: z.array(z.string()),
  width: z.number(),
});

const promptResponseSchema = z.object({ prompt: compiledSchema });

const launchOutputSchema = compiledSchema.omit({ markdown: true });

type Compiled = z.infer<typeof compiledSchema>;

/** Markdown prompt as text; the timeline and slots as structured content. */
const formatCompiled = (compiled: Compiled) => {
  const { markdown, ...structured } = compiled;
  const notes = [
    compiled.missing.length > 0
      ? `Missing required inputs: ${compiled.missing.join(", ")}. Ask the user for them and call again with inputs.`
      : undefined,
    ...compiled.warnings.map((warning) => `Warning: ${warning}`),
  ].filter(Boolean);
  return {
    content: [
      {
        text:
          notes.length > 0
            ? `${markdown}\n\n---\n${notes.join("\n")}`
            : markdown,
        type: "text" as const,
      },
    ],
    structuredContent: structured,
  };
};

const postPrompt = async (
  path: string,
  body: z.infer<typeof promptInputSchema> | z.infer<typeof composeInputSchema>,
  ctx: { auth: { accessToken: string }; signal: AbortSignal }
) => {
  const result = await fetchSiteApi(`${LAUNCH_PATH}${path}`, {
    accessToken: ctx.auth.accessToken,
    body,
    signal: ctx.signal,
  });
  if ("error" in result) {
    return toolError(result.status === 404 ? NOT_FOUND_MESSAGE : result.error);
  }
  const parsed = promptResponseSchema.safeParse(result.body);
  if (!parsed.success) {
    return toolError(`${SITE_URL} returned the prompt in an unexpected shape.`);
  }
  return formatCompiled(parsed.data.prompt);
};

const filmItemSchema = z.looseObject({
  brand: z.string(),
  sceneIds: z.array(z.string()),
  seconds: z.number(),
  slug: z.string(),
  summary: z.string(),
  title: z.string(),
  url: z.string(),
});

const sceneItemSchema = z.looseObject({
  filmSlug: z.string(),
  id: z.string(),
  role: z.string(),
  seconds: z.number(),
  style: z.string(),
  title: z.string(),
  url: z.string(),
});

const searchResponseSchema = z.discriminatedUnion("view", [
  z.object({
    items: z.array(filmItemSchema),
    nextCursor: z.string().nullable().optional(),
    view: z.literal("films"),
  }),
  z.object({
    items: z.array(sceneItemSchema),
    nextCursor: z.string().nullable().optional(),
    view: z.literal("scenes"),
  }),
]);

export const searchLaunchScenes = server.tool(
  {
    annotations: readOnly,
    description: `MotionVideo Pro: search the motionvideo.xyz Launch Videos library of real product launch films, as whole films or as individual scenes (hook, reveal, feature, CTA...). Returns film slugs and scene ids for get-launch-prompt and compose-launch-prompt. ${ACCESS}`,
    inputSchema: z.object({
      aspect: z.enum(ASPECTS).optional().describe("Only this aspect ratio"),
      category: z.string().optional().describe("Only films in this category"),
      cursor: z
        .string()
        .optional()
        .describe("nextCursor from the previous page"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(LAUNCH_MAX_LIMIT)
        .optional()
        .describe(
          `Max items to return (1-${LAUNCH_MAX_LIMIT}). Defaults to 12`
        ),
      maxSeconds: z.number().min(0).optional().describe("Longest duration"),
      minSeconds: z.number().min(0).optional().describe("Shortest duration"),
      query: z
        .string()
        .optional()
        .describe("Text matched against titles, brands, and summaries"),
      roles: z
        .array(z.string())
        .optional()
        .describe(
          "Scene roles, any of them (e.g. hook, reveal, feature, cta); the films view matches through its scenes"
        ),
      styles: z
        .array(z.string())
        .optional()
        .describe("Scene styles, any of them"),
      view: z
        .enum(["films", "scenes"])
        .optional()
        .describe("Return whole films or single scenes. Defaults to films"),
    }),
    name: "search-launch-scenes",
    outputSchema: z.object({
      items: z.array(z.looseObject({})),
      nextCursor: z.string().nullable(),
      view: z.enum(["films", "scenes"]),
    }),
    securitySchemes: [{ scopes: [], type: "oauth2" }],
    title: "Search launch videos (Pro)",
  },
  async (input, ctx) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) {
        continue;
      }
      params.set(key, Array.isArray(value) ? value.join(",") : String(value));
    }
    const query = params.toString();
    const result = await fetchSiteApi(
      `${LAUNCH_PATH}/search${query ? `?${query}` : ""}`,
      { accessToken: ctx.auth.accessToken, signal: ctx.signal }
    );
    if ("error" in result) {
      return toolError(
        result.status === 404 ? NOT_FOUND_MESSAGE : result.error
      );
    }
    const parsed = searchResponseSchema.safeParse(result.body);
    if (!parsed.success) {
      return toolError(
        `${SITE_URL} returned launch videos in an unexpected shape.`
      );
    }
    const { view, items } = parsed.data;
    const nextCursor = parsed.data.nextCursor ?? null;
    const lines =
      parsed.data.view === "films"
        ? parsed.data.items.map(
            (film) =>
              `- ${film.title} — ${film.brand} (${film.slug}, ${film.seconds}s, ${film.sceneIds.length} scenes) — ${film.summary}`
          )
        : parsed.data.items.map(
            (scene) =>
              `- ${scene.title} [${scene.role}, ${scene.style}] (${scene.id}, film ${scene.filmSlug}, ${scene.seconds}s)`
          );

    return {
      content: [
        {
          text: [
            `Showing ${items.length} launch ${view}.`,
            "",
            ...lines,
            "",
            nextCursor
              ? `More results: call again with cursor "${nextCursor}".`
              : undefined,
            "Call get-launch-prompt with a film slug (and optional sceneId), or compose-launch-prompt with scene ids from several films.",
          ]
            .filter((line) => line !== undefined)
            .join("\n"),
          type: "text" as const,
        },
      ],
      structuredContent: { items, nextCursor, view },
    };
  }
);

export const getLaunchPrompt = server.tool(
  {
    annotations: readOnly,
    description: `MotionVideo Pro: compile one launch film, or one of its scenes, into a frame-accurate prompt for Remotion, HyperFrames, Editframe or fframes. exact mode recreates it as made; adapt mode keeps structure and timing and swaps in the user's brand from inputs. Returns the markdown prompt plus the frame timeline, brand slots, missing inputs, assets and warnings. ${ACCESS}`,
    inputSchema: promptInputSchema,
    name: "get-launch-prompt",
    outputSchema: launchOutputSchema,
    securitySchemes: [{ scopes: [], type: "oauth2" }],
    title: "Get a launch video prompt (Pro)",
  },
  (input, ctx) => postPrompt("/prompt", input, ctx)
);

export const composeLaunchPrompt = server.tool(
  {
    annotations: readOnly,
    description: `MotionVideo Pro: compose scenes from one or more launch films, in order, into one storyboard prompt for Remotion, HyperFrames, Editframe or fframes, with cuts or bridges between them. Same modes, inputs and result as get-launch-prompt. ${ACCESS}`,
    inputSchema: composeInputSchema,
    name: "compose-launch-prompt",
    outputSchema: launchOutputSchema,
    securitySchemes: [{ scopes: [], type: "oauth2" }],
    title: "Compose a launch storyboard prompt (Pro)",
  },
  (input, ctx) => postPrompt("/compose", input, ctx)
);
