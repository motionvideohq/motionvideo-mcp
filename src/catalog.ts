// The motionvideo.xyz catalog, read through the site's query endpoints
// (`/api/catalog/search`, `/api/catalog/videos/{slug}`, `/api/catalog/facets`,
// `/api/catalog/directories/search`). The site owns the filters and their
// meaning; this module only calls it. Request and response types, and the
// value lists below, are generated from the site's OpenAPI document into
// src/generated/site-api.ts (`pnpm api:generate`).

import type {
  paths,
  SchemaDirectorySearchResult,
  SchemaFacets,
  SchemaInvalidParameter,
  SchemaVideoDetail,
  SchemaVideoNotFound,
  SchemaVideoSearchResult,
} from "./generated/site-api.js";

export {
  facetsDirectoriesSectionValues as DIRECTORY_SECTIONS,
  facetsMovesFamiliesIdValues as MOVE_FAMILIES,
  pathsApiCatalogDirectoriesSearchGetParametersQueryFilterValues as DIRECTORY_FILTERS,
  pathsApiCatalogDirectoriesSearchGetParametersQuerySortValues as DIRECTORY_SORTS,
  pathsApiCatalogSearchGetParametersQueryCategoryValues as MOTION_CATEGORIES,
  pathsApiCatalogSearchGetParametersQueryColorValues as COLOR_NAMES,
} from "./generated/site-api.js";

/** Public site. Point at a local dev server with MOTIONVIDEO_SITE_URL. */
export const SITE_URL = (
  process.env.MOTIONVIDEO_SITE_URL ?? "https://motionvideo.xyz"
).replace(/\/+$/u, "");

export const SEARCH_MAX_LIMIT = 50;
export const DIRECTORY_MAX_LIMIT = 100;

export type VideoSearchQuery = NonNullable<
  paths["/api/catalog/search"]["get"]["parameters"]["query"]
>;
export type DirectorySearchQuery =
  paths["/api/catalog/directories/search"]["get"]["parameters"]["query"];
export type VideoSearchResult = SchemaVideoSearchResult;
export type VideoDetail = SchemaVideoDetail;
export type Facets = SchemaFacets;
export type DirectorySearchResult = SchemaDirectorySearchResult;

/**
 * A failed catalog call the model should read (the site is down, or it
 * rejected a filter), not a server fault.
 */
export class CatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogError";
  }
}

const unavailable = (path: string, reason: string) =>
  new CatalogError(
    `The motionvideo.xyz catalog is temporarily unavailable (${path}: ${reason}). Retry in a moment.`
  );

/** The site rejected a parameter: say which, and what it accepts. */
const rejected = ({ message, parameter, allowed }: SchemaInvalidParameter) =>
  new CatalogError(
    `motionvideo.xyz rejected ${parameter}: ${message}${allowed?.length ? ` Allowed: ${allowed.join(", ")}.` : ""}`
  );

/** Abandon a single call after this long. */
const FETCH_TIMEOUT_MS = 10 * 1000;

type QueryValue = string | number | readonly string[] | undefined;

/** Lists go comma-separated, as the site's list parameters expect. */
const toSearchParams = (query: Record<string, QueryValue>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      if (value.length > 0) {
        params.set(key, value.join(","));
      }
    } else if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  const text = params.toString();
  return text ? `?${text}` : "";
};

/**
 * GET a catalog endpoint. 200 and 404 bodies come back to the caller; a 400
 * throws CatalogRequestError, anything else CatalogUnavailableError.
 */
const getJson = async (
  path: string,
  query: Record<string, QueryValue> = {}
): Promise<{ status: 200 | 404; body: unknown }> => {
  let response: Response;
  try {
    response = await fetch(`${SITE_URL}${path}${toSearchParams(query)}`, {
      headers: { accept: "application/json", "user-agent": "motionvideo-mcp" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    throw unavailable(
      path,
      error instanceof Error ? error.message : String(error)
    );
  }
  if (response.status === 400) {
    // SAFETY: the site answers 400 with the InvalidParameter body
    // documented in its OpenAPI document.
    throw rejected((await response.json()) as SchemaInvalidParameter);
  }
  if (response.status !== 200 && response.status !== 404) {
    throw unavailable(path, `HTTP ${response.status}`);
  }
  return { body: await response.json(), status: response.status };
};

export const searchVideos = async (
  query: VideoSearchQuery
): Promise<VideoSearchResult> => {
  const { body } = await getJson("/api/catalog/search", query);
  // SAFETY: a 200 from /api/catalog/search is a VideoSearchResult (OpenAPI).
  return body as VideoSearchResult;
};

export const getVideo = async (
  slug: string
): Promise<{ video: VideoDetail } | { notFound: SchemaVideoNotFound }> => {
  const { status, body } = await getJson(
    `/api/catalog/videos/${encodeURIComponent(slug)}`
  );
  // SAFETY: the endpoint answers 200 with VideoDetail and 404 with
  // VideoNotFound (OpenAPI).
  return status === 200
    ? { video: body as VideoDetail }
    : { notFound: body as SchemaVideoNotFound };
};

export const searchDirectory = async (
  query: DirectorySearchQuery
): Promise<DirectorySearchResult> => {
  const { body } = await getJson("/api/catalog/directories/search", query);
  // SAFETY: a 200 from the directory search is a DirectorySearchResult.
  return body as DirectorySearchResult;
};

/** Facets change only when the site deploys: keep them for 10 minutes. */
const FACETS_TTL_MS = 10 * 60 * 1000;
let facets: { data: Facets; fetchedAt: number } | undefined;

/** Every filter value with its count; the last good copy if the site is down. */
export const loadFacets = async (): Promise<Facets> => {
  if (facets && Date.now() - facets.fetchedAt < FACETS_TTL_MS) {
    return facets.data;
  }
  try {
    const { body } = await getJson("/api/catalog/facets");
    // SAFETY: a 200 from /api/catalog/facets is Facets (OpenAPI).
    facets = { data: body as Facets, fetchedAt: Date.now() };
    return facets.data;
  } catch (error) {
    if (facets) {
      return facets.data;
    }
    throw error;
  }
};

/** Slugs starting with `prefix`, for argument completion; [] on failure. */
export const completeVideoSlug = async (prefix: string): Promise<string[]> => {
  const wanted = prefix.trim().toLowerCase();
  try {
    const { videos } = await searchVideos({
      limit: SEARCH_MAX_LIMIT,
      q: wanted.split("-")[0] || undefined,
    });
    return videos
      .map((video) => video.slug)
      .filter((slug) => slug.startsWith(wanted));
  } catch {
    return [];
  }
};
