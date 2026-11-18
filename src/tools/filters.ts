// list-filters: every value search-videos, search-directory and search-moves
// filter by, with counts, from the site's facets endpoint.

import { z } from "zod";

import { loadFacets } from "../catalog.js";
import { readOnly, server } from "../mcp-server.js";

const countSchema = z.object({ count: z.number().int(), id: z.string() });

/** "a (3), b (1)". */
const counted = (values: { id: string; count: number }[]) =>
  values.map(({ id, count }) => `${id} (${count})`).join(", ");

export const listFilters = server.tool(
  {
    annotations: readOnly,
    description:
      "List every filter value on motionvideo.xyz with how many items carry it: video categories (with descriptions), models, named colours and types for search-videos; each directory section's filters, categories and sorts for search-directory; and the move families for search-moves. Call it when unsure which values exist.",
    inputSchema: z.strictObject({
      scope: z
        .enum(["videos", "directories", "moves"])
        .optional()
        .describe("Only one group of filters. Defaults to all"),
    }),
    name: "list-filters",
    outputSchema: z.object({
      directories: z
        .array(
          z.object({
            categories: z.array(countSchema),
            filters: z.array(countSchema),
            section: z.string(),
            sorts: z.array(z.string()),
            total: z.number().int(),
          })
        )
        .optional(),
      moves: z
        .object({ families: z.array(countSchema), total: z.number().int() })
        .optional(),
      videos: z
        .object({
          categories: z.array(
            countSchema.extend({
              description: z.string(),
              title: z.string(),
              url: z.string(),
            })
          ),
          colors: z.array(countSchema.extend({ hex: z.string() })),
          creators: z.number().int().describe("How many creators have videos"),
          models: z.array(
            countSchema.extend({ family: z.string(), fullName: z.string() })
          ),
          sorts: z.array(z.string()),
          total: z.number().int(),
          types: z.array(countSchema),
        })
        .optional(),
    }),
    securitySchemes: [{ type: "noauth" }],
    title: "List search filters",
  },
  async ({ scope }) => {
    const facets = await loadFacets();
    const sections: string[] = [];
    if (!scope || scope === "videos") {
      const { videos } = facets;
      sections.push(
        [
          `Videos (${videos.total}, by ${videos.creators} creators) — search-videos:`,
          ...videos.categories.map(
            (category) =>
              `- category ${category.id} (${category.count}): ${category.description}`
          ),
          `- models: ${counted(videos.models)}`,
          `- colours: ${counted(videos.colors)}`,
          `- types: ${counted(videos.types)}`,
        ].join("\n")
      );
    }
    if (!scope || scope === "directories") {
      sections.push(
        [
          "Directories — search-directory:",
          ...facets.directories.map(
            (section) =>
              `- ${section.section} (${section.total}): filters ${counted(section.filters)}; categories ${counted(section.categories)}; sorts ${section.sorts.join(", ")}`
          ),
        ].join("\n")
      );
    }
    if (!scope || scope === "moves") {
      sections.push(
        `Moves (${facets.moves.total}) — search-moves families: ${counted(facets.moves.families)}`
      );
    }
    return {
      content: [{ text: sections.join("\n\n"), type: "text" as const }],
      structuredContent: {
        directories:
          !scope || scope === "directories" ? facets.directories : undefined,
        moves: !scope || scope === "moves" ? facets.moves : undefined,
        videos: !scope || scope === "videos" ? facets.videos : undefined,
      },
    };
  }
);
