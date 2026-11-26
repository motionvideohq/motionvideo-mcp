// search-directory: the site's four directory sections (tools, skills,
// creatives, extras) with each section's own facet, categories and sorts.

import { z } from "zod";

import {
  DIRECTORY_FILTERS,
  DIRECTORY_MAX_LIMIT,
  DIRECTORY_SECTIONS,
  DIRECTORY_SORTS,
  searchDirectory as searchSite,
} from "../catalog.js";
import { readOnly, server } from "../mcp-server.js";

const SECTION_LABELS = {
  creatives: "creatives (studios and designers)",
  extras: "extras (articles and resources)",
  skills: "agent skills",
  tools: "tools and apps",
} satisfies Record<(typeof DIRECTORY_SECTIONS)[number], string>;

export const searchDirectory = server.tool(
  {
    annotations: { ...readOnly, title: "Search the directories" },
    description:
      'Search a motionvideo.xyz directory section: "tools" (editors, AI generators, mockups; filter by pricing: free, freemium, open-source, paid), "skills" (agent skills that make videos; filter by renderer: remotion, hyperframes, html, manim, adobe, blender, video-models, ffmpeg; sort by stars or updated), "creatives" (studios and designers for hire; filter by specialty: product-films, explainers, 3d, brand, ui-motion) or "extras" (articles and resources; filter by resource type). Several filters or categories are alternatives. list-filters shows each section\'s categories, filters and sorts with counts.',
    inputSchema: z.strictObject({
      categories: z
        .array(z.string())
        .max(10)
        .optional()
        .describe(
          'The section\'s categories, any of them, e.g. ["Editor"] for tools or ["Product films"] for skills'
        ),
      filters: z
        .array(z.enum(DIRECTORY_FILTERS))
        .max(DIRECTORY_FILTERS.length)
        .optional()
        .describe("The section's facet values, any of them (see description)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(DIRECTORY_MAX_LIMIT)
        .optional()
        .describe(
          `Entries per page (1-${DIRECTORY_MAX_LIMIT}). Defaults to 24`
        ),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Entries to skip, for the next page. Defaults to 0"),
      query: z
        .string()
        .optional()
        .describe(
          "Keywords matched against name, description, category, renderers and specialties"
        ),
      section: z.enum(DIRECTORY_SECTIONS).describe("Directory section"),
      sort: z
        .enum(DIRECTORY_SORTS)
        .optional()
        .describe(
          "added (tools, creatives, skills, extras), stars or updated (skills), newest or oldest (extras); without one, the site's curated order"
        ),
    }),
    name: "search-directory",
    outputSchema: z.object({
      entries: z.array(
        z.object({
          addedAt: z.string(),
          category: z.string(),
          cover: z.string().nullable(),
          description: z.string(),
          id: z.string(),
          name: z.string(),
          pricing: z.string().optional(),
          renderers: z.array(z.string()).optional(),
          resourceType: z.string().optional(),
          specialties: z.array(z.string()).optional(),
          stars: z.number().int().optional(),
          url: z.string(),
        })
      ),
      offset: z.number().int(),
      section: z.string(),
      shown: z.number().int(),
      total: z.number().int().describe("Total matches before paging"),
    }),
    securitySchemes: [{ type: "noauth" }],
    title: "Search the directories",
  },
  async ({ section, query, filters, categories, sort, limit, offset }) => {
    const result = await searchSite({
      category: categories,
      filter: filters,
      limit,
      offset,
      q: query,
      section,
      sort,
    });
    const { entries, total } = result;
    const facts = [
      query ? `matching "${query}"` : undefined,
      filters?.length ? `filter ${filters.join(" or ")}` : undefined,
      categories?.length ? `category ${categories.join(" or ")}` : undefined,
      sort ? `sorted by ${sort}` : undefined,
    ].filter(Boolean);
    const lines = entries.map((entry) => {
      const tags = [
        entry.pricing,
        ...(entry.renderers ?? []),
        ...(entry.specialties ?? []),
        entry.resourceType,
        entry.stars === undefined ? undefined : `${entry.stars}★`,
      ].filter(Boolean);
      return `- ${entry.name} [${entry.category}${tags.length > 0 ? `; ${tags.join(", ")}` : ""}] — ${entry.description} ${entry.url}`;
    });
    const range =
      entries.length > 0
        ? `Showing ${result.offset + 1}-${result.offset + entries.length}.`
        : "Showing none.";
    return {
      content: [
        {
          text: [
            `${total} ${SECTION_LABELS[section]}${facts.length > 0 ? ` ${facts.join(", ")}` : ""}. ${range}`,
            "",
            ...lines,
            result.offset + entries.length < total
              ? `\nMore with offset ${result.offset + entries.length}.`
              : "",
          ]
            .join("\n")
            .trim(),
          type: "text" as const,
        },
      ],
      structuredContent: {
        entries,
        offset: result.offset,
        section: result.section,
        shown: entries.length,
        total,
      },
    };
  }
);
