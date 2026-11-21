// Signed-in calls to the site's `/api/mcp/*` endpoints.
//
// The account and Pro tools forward the access token the MCP server verified
// (`Authorization: Bearer <token>`); the site checks it again and answers for
// that account. Failures become one model-readable message per cause, so the
// agent can tell "sign in again" (401) from "needs a plan" (403 `no_plan`),
// "wait and retry" (429, 503) and "the site broke" (other 5xx). Only the
// first is fixed by signing in again; saying so for the others sends users on
// a detour.

import { z } from "zod";

import { SITE_URL } from "./catalog.js";

/** Abandon a single call after this long. */
const FETCH_TIMEOUT_MS = 10 * 1000;

const PRO_URL = "https://motionvideo.xyz/pro";

const SIGN_IN_INVALID_MESSAGE =
  "motionvideo.xyz did not accept this sign-in: it has expired or is no longer valid. Sign out and back in from the MCP client to reconnect your motionvideo.xyz account, then try again.";

const MISSING_SCOPE_MESSAGE =
  "This sign-in did not grant access to the motionvideo.xyz account. Sign out and back in from the MCP client and approve account access, then try again.";

const NO_PLAN_MESSAGE = `This is a MotionVideo Pro tool, and the signed-in motionvideo.xyz account has no MotionVideo Pro or Business plan (Business seat holders are included). Get one at ${PRO_URL}, then try again.`;

const errorBodySchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});

export type SiteResult =
  | { body: unknown }
  | {
      error: string;
      /** HTTP status when the site answered; absent for network failures. */
      status?: number;
    };

/** The `error` code and `message` of a JSON error body, if the site sent one. */
const readErrorBody = async (
  response: Response
): Promise<z.infer<typeof errorBodySchema> | undefined> => {
  try {
    return errorBodySchema.safeParse(await response.json()).data;
  } catch {
    return undefined;
  }
};

/** Seconds from a `Retry-After` header (delta-seconds or HTTP date). */
const retryAfterSeconds = (value: string | null): number | undefined => {
  if (!value) {
    return undefined;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, Math.ceil(seconds));
  }
  const date = Date.parse(value);
  return Number.isNaN(date)
    ? undefined
    : Math.max(0, Math.ceil((date - Date.now()) / 1000));
};

const describeFailure = async (response: Response): Promise<string> => {
  const { status } = response;
  if (status === 401) {
    return SIGN_IN_INVALID_MESSAGE;
  }
  if (status === 403) {
    if (
      response.headers.get("www-authenticate")?.includes("insufficient_scope")
    ) {
      return MISSING_SCOPE_MESSAGE;
    }
    const errorBody = await readErrorBody(response);
    const code = errorBody?.error;
    if (code === "no_plan") {
      return NO_PLAN_MESSAGE;
    }
    return "motionvideo.xyz refused this request for the signed-in account (HTTP 403).";
  }
  if (status === 404) {
    return "motionvideo.xyz has no such item (HTTP 404); check the slug or id with a search tool.";
  }
  if (status === 422) {
    const body = await readErrorBody(response);
    return `motionvideo.xyz rejected the request (${body?.error ?? "invalid_request"})${body?.message ? `: ${body.message}` : ""}. Fix the arguments and try again.`;
  }
  if (status === 429) {
    const seconds = retryAfterSeconds(response.headers.get("retry-after"));
    return `motionvideo.xyz is rate limiting requests; retry ${seconds === undefined ? "in a moment" : `after ${seconds}s`}.`;
  }
  if (status === 503) {
    return "motionvideo.xyz is temporarily unavailable; try again in a moment. This is not a sign-in problem.";
  }
  return `motionvideo.xyz failed to answer (HTTP ${status}); this is not a sign-in problem, so try again later.`;
};

/**
 * GET (or POST `body` as JSON to) a signed-in `/api/mcp/*` endpoint. Stops after 10 seconds or as soon as
 * `signal` aborts (the MCP client cancelled or disconnected).
 */
export const fetchSiteApi = async (
  path: string,
  {
    accessToken,
    body,
    signal,
  }: { accessToken: string; body?: unknown; signal: AbortSignal }
): Promise<SiteResult> => {
  const headers = new Headers({
    accept: "application/json",
    authorization: `Bearer ${accessToken}`,
    "user-agent": "motionvideo-mcp",
  });
  const init: RequestInit = {
    headers,
    signal: AbortSignal.any([AbortSignal.timeout(FETCH_TIMEOUT_MS), signal]),
  };
  if (body !== undefined) {
    headers.set("content-type", "application/json");
    init.body = JSON.stringify(body);
    init.method = "POST";
  }
  let response: Response;
  try {
    response = await fetch(`${SITE_URL}${path}`, init);
  } catch (error) {
    if (signal.aborted) {
      return { error: "The request was cancelled." };
    }
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return {
        error: `motionvideo.xyz did not answer within ${FETCH_TIMEOUT_MS / 1000} seconds; try again in a moment.`,
      };
    }
    return {
      error: `${SITE_URL} could not be reached; try again in a moment.`,
    };
  }
  if (!response.ok) {
    return { error: await describeFailure(response), status: response.status };
  }
  try {
    return { body: await response.json() };
  } catch {
    return { error: `${SITE_URL} returned an unreadable response.` };
  }
};
