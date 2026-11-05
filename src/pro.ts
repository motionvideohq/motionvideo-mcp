// Pro access to the motionvideo.xyz Moves library.
//
// Pro tools need the user signed in with their motionvideo.xyz account
// (OAuth 2.1, `account` scope) and an active MotionVideo Pro or Business plan
// on it, or a Business seat. This module forwards the verified access token
// unchanged to the site's `/api/mcp/moves` endpoints as
// `Authorization: Bearer <token>`; the site checks the plan and serves the
// copy-ready prompts. Keep the field names in sync with
// motionvideo.xyz/src/lib/moves.ts and the site's `/api/mcp/moves` routes.

import { z } from "zod";

import { SITE_URL } from "./catalog.js";

const PRO_URL = "https://motionvideo.xyz/pro";

const MOVES_PATH = "/api/mcp/moves";

/** A successful list response is served this long per user before refetching. */
const CACHE_TTL_MS = 10 * 60 * 1000;
/** Abandon a single fetch after this long. */
const FETCH_TIMEOUT_MS = 10 * 1000;

export const MOVE_FAMILIES = [
  "timing",
  "type",
  "transitions",
  "ui",
  "vector",
  "generative",
  "camera",
  "texture",
  "data",
  "sound",
] as const;

export const proMoveSchema = z.object({
  aka: z.array(z.string()),
  family: z.enum(MOVE_FAMILIES),
  goodFor: z.array(z.string()),
  name: z.string(),
  parameters: z.array(z.string()),
  prompt: z.string(),
  slug: z.string(),
  summary: z.string(),
});

export type ProMove = z.infer<typeof proMoveSchema>;

const movesResponseSchema = z.object({ moves: z.array(proMoveSchema) });
const moveResponseSchema = z.object({ move: proMoveSchema });

/** A move's page on the site: `/moves/<family>/<slug>`. */
export const movePageUrl = (move: Pick<ProMove, "family" | "slug">): string =>
  `https://motionvideo.xyz/moves/${move.family}/${move.slug}`;

const NO_PLAN_MESSAGE = `This is a MotionVideo Pro tool, and the signed-in motionvideo.xyz account has no MotionVideo Pro or Business plan (Business seat holders are included). Get one at ${PRO_URL}, then try again.`;

const SIGN_IN_INVALID_MESSAGE =
  "motionvideo.xyz did not accept this sign-in: it has expired or is no longer valid. Sign out and back in from the MCP client to reconnect your motionvideo.xyz account, then try again.";

/** The signed-in caller, from the verified OAuth access token. */
export interface ProCaller {
  /** Access token the MCP server verified; forwarded to the site unchanged. */
  accessToken: string;
  /** Better Auth user id; keys the moves cache. */
  userId: string;
}

export type ProResult<T> = { data: T } | { error: string };

interface CacheEntry {
  expiresAt: number;
  moves: ProMove[];
}

/** Moves lists keyed by user id: access depends on that user's plan. */
const cache = new Map<string, CacheEntry>();

const pruneCache = (now: number) => {
  for (const [userId, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(userId);
    }
  }
};

const errorBodySchema = z.object({ error: z.string() });

/** The `error` code of a JSON error body, if the site sent one. */
const readErrorCode = async (
  response: Response
): Promise<string | undefined> => {
  try {
    const body = errorBodySchema.safeParse(await response.json());
    return body.success ? body.data.error : undefined;
  } catch {
    return undefined;
  }
};

const errorFor = async (response: Response): Promise<string> => {
  if (response.status === 401) {
    return SIGN_IN_INVALID_MESSAGE;
  }
  if (
    response.status === 403 &&
    (await readErrorCode(response)) === "no_plan"
  ) {
    return NO_PLAN_MESSAGE;
  }
  if (response.status === 503) {
    return "motionvideo.xyz couldn't check your plan right now; try again in a moment.";
  }
  return `motionvideo.xyz rejected the request (HTTP ${response.status}); try again in a moment.`;
};

const fetchPro = async (
  path: string,
  accessToken: string
): Promise<{ body: unknown } | { error: string; status?: number }> => {
  let response: Response;
  try {
    response = await fetch(`${SITE_URL}${path}`, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    return {
      error: `${SITE_URL} could not be reached; try again in a moment.`,
    };
  }
  if (!response.ok) {
    return { error: await errorFor(response), status: response.status };
  }
  try {
    return { body: await response.json() };
  } catch {
    return { error: `${SITE_URL} returned an unreadable response.` };
  }
};

/** Every move with its prompt, cached per user for 10 minutes. */
export const loadProMoves = async ({
  accessToken,
  userId,
}: ProCaller): Promise<ProResult<ProMove[]>> => {
  const now = Date.now();
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > now) {
    return { data: cached.moves };
  }

  const result = await fetchPro(MOVES_PATH, accessToken);
  if ("error" in result) {
    return { error: result.error };
  }
  const parsed = movesResponseSchema.safeParse(result.body);
  if (!parsed.success) {
    return { error: `${SITE_URL} returned moves in an unexpected shape.` };
  }

  pruneCache(now);
  cache.set(userId, {
    expiresAt: now + CACHE_TTL_MS,
    moves: parsed.data.moves,
  });
  return { data: parsed.data.moves };
};

/** One move with its prompt; `undefined` data for an unknown slug. */
export const loadProMove = async (
  accessToken: string,
  slug: string
): Promise<ProResult<ProMove | undefined>> => {
  const result = await fetchPro(
    `${MOVES_PATH}/${encodeURIComponent(slug)}`,
    accessToken
  );
  if ("error" in result) {
    return result.status === 404
      ? { data: undefined }
      : { error: result.error };
  }
  const parsed = moveResponseSchema.safeParse(result.body);
  if (!parsed.success) {
    return { error: `${SITE_URL} returned the move in an unexpected shape.` };
  }
  return { data: parsed.data.move };
};

export interface MoveSearchInput {
  query?: string;
  family?: (typeof MOVE_FAMILIES)[number];
  limit?: number;
}

export const MOVES_MAX_LIMIT = 30;

/** Case-insensitive match on name, aka, summary, and good-for tags. */
export const searchMoves = (
  moves: ProMove[],
  { query, family, limit = 12 }: MoveSearchInput
) => {
  const needle = query?.trim().toLowerCase();
  const matches = moves.filter((move) => {
    if (family && move.family !== family) {
      return false;
    }
    if (!needle) {
      return true;
    }
    return [move.name, move.summary, ...move.aka, ...move.goodFor].some(
      (field) => field.toLowerCase().includes(needle)
    );
  });
  return { moves: matches.slice(0, limit), total: matches.length };
};
