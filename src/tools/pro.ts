// Pro tools (OAuth + plan): search the Moves library and fetch a move's
// copy-ready prompt. Data access and the per-user cache live in src/pro.ts.

import { z } from "zod";

import { MOVE_FAMILIES } from "../catalog.js";
import { readOnly, server, toolError } from "../mcp-server.js";
import {
  loadProMove,
  loadProMoves,
  MOVES_MAX_LIMIT,
  movePageUrl,
  searchMoves as searchProMoves,
} from "../pro.js";

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
      signal: ctx.signal,
      userId: ctx.auth.user.id,
    });
    if ("error" in result) {
      return toolError(result.error);
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
    const result = await loadProMove(
      { accessToken: ctx.auth.accessToken, signal: ctx.signal },
      slug
    );
    if ("error" in result) {
      return toolError(result.error);
    }
    const move = result.data;
    if (!move) {
      return toolError(
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
