// Account tools (OAuth): the signed-in user's bookmarks and featured
// submissions, read from the site's `/api/mcp/*` with their access token.

import { z } from "zod";

import { SITE_URL } from "../catalog.js";
import { readOnly, server, toolError } from "../mcp-server.js";
import { fetchSiteApi } from "../site-api.js";

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

/** GET a signed-in endpoint and check it against the schema the tool returns. */
const loadAccountData = async <T extends z.ZodType>(
  path: string,
  schema: T,
  { accessToken, signal }: { accessToken: string; signal: AbortSignal }
): Promise<{ data: z.infer<T> } | { error: string }> => {
  const result = await fetchSiteApi(path, { accessToken, signal });
  if ("error" in result) {
    return { error: result.error };
  }
  const parsed = schema.safeParse(result.body);
  return parsed.success
    ? { data: parsed.data }
    : { error: `${SITE_URL} returned an unexpected response.` };
};

export const listBookmarks = server.tool(
  {
    annotations: { ...readOnly, title: "List my bookmarks" },
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
    const result = await loadAccountData(
      "/api/mcp/bookmarks",
      z.object({ bookmarks: z.array(bookmarkSchema) }),
      { accessToken: ctx.auth.accessToken, signal: ctx.signal }
    );
    if ("error" in result) {
      return toolError(`Could not load bookmarks: ${result.error}`);
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
    annotations: { ...readOnly, title: "My featured submissions" },
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
    const result = await loadAccountData(
      "/api/mcp/featured",
      z.object({ submissions: z.array(featuredSubmissionSchema) }),
      { accessToken: ctx.auth.accessToken, signal: ctx.signal }
    );
    if ("error" in result) {
      return toolError(`Could not load featured submissions: ${result.error}`);
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
