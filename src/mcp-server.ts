// The MotionVideo MCP server instance, its OAuth setup and the cross-cutting
// middleware. Tools, resources and the prompt register themselves on it from
// src/tools/*; index.ts re-exports their refs and the server.

import { MCPServer } from "mcp-use";
import { oauthBetterAuthProvider } from "mcp-use/oauth/better-auth";
import type { BetterAuthOAuthUser } from "mcp-use/oauth/better-auth";

import packageJson from "../package.json" with { type: "json" };
import { CatalogError, SITE_URL } from "./catalog.js";

// The protected resource this server is for OAuth 2.1 purposes: Better Auth
// stamps access tokens with this audience and the `account` scope, and
// every signed-in request is checked against both. It must equal the site's
// `mcp({ resource })` and the `resource` its `/api/mcp/*` routes verify.
const MCP_RESOURCE =
  process.env.MOTIONVIDEO_MCP_RESOURCE ?? "https://mcp.motionvideo.xyz/mcp";
const ACCOUNT_SCOPE = "account";

// Anonymous catalog tools stay open; the account and Pro tools sign users in
// with their motionvideo.xyz account (OAuth 2.1, dynamic client registration,
// consent on the site). The MCP server holds no account secrets: signed-in
// tools forward the verified access token to the site's `/api/mcp/*`.
export const server = new MCPServer<BetterAuthOAuthUser>({
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
    "Use search-videos to find motion video references by keywords, content categories, models (e.g. Opus 5.5), named colours, and creators; several values in one filter mean any of them, and different filters all apply. Then use get-video to read the original prompt and how it was made so you can adapt it. search-directory covers the tools, agent skills, creatives (studios and designers) and extras (articles and resources) directories; list-filters lists every filter value with counts. When you remix a prompt, credit the source video page. Catalog tools work without an account; list-bookmarks and my-featured sign the user in with their motionvideo.xyz account and the client offers that on first use. MotionVideo Pro users can also search-moves in the Moves library of named motion techniques and get-move-prompt for a move's copy-ready prompt; these sign the user in the same way and need a MotionVideo Pro or Business plan on that account (Business seat holders included; plans at https://motionvideo.xyz/pro). With Launch Videos on the plan, search-launch-scenes finds real product launch films and their scenes, get-launch-prompt turns a film or scene into a frame-accurate Remotion, HyperFrames, Editframe or fframes prompt (mode exact recreates it; mode adapt swaps in the user's brand via inputs), and compose-launch-prompt mixes scenes from several films into one storyboard prompt. Run without inputs first to see the slots, then ask the user for the missing ones.",
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
  version: packageJson.version,
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

// The catalog is fetched live from motionvideo.xyz, so an unreachable site or
// a rejected filter is an operational state, not a programming error: report
// it the way a missing slug is reported instead of failing the JSON-RPC call.
server.use("mcp:tools/call", async (_ctx, next) => {
  try {
    return await next();
  } catch (error) {
    if (!(error instanceof CatalogError)) {
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
    if (!(error instanceof CatalogError)) {
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
    if (!(error instanceof CatalogError)) {
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

/** Annotations shared by every tool: all of them only read. */
export const readOnly = {
  destructiveHint: false,
  openWorldHint: false,
  readOnlyHint: true,
} as const;

/** An expected tool failure the model should read and relay. */
export const toolError = (text: string) => ({
  content: [{ text, type: "text" as const }],
  isError: true as const,
});
