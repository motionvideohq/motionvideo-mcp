// Data layer over the motionvideo.xyz catalog.
//
// The JSON files under data/ are synced from the site repo with
// `pnpm catalog:sync` (scripts/sync-catalog.mjs). Keep the field names in sync
// with motionvideo.xyz/src/lib/motion-catalog.ts.

import catalog from "../data/motion-catalog.json" with { type: "json" };
import directories from "../data/resource-directories.json" with { type: "json" };

/** Public site (video pages, category pages). */
export const SITE_URL = "https://motionvideo.xyz";

/** Reasoning effort the model ran at, as the creator reported it. */
export const EFFORTS = ["medium", "high", "max"] as const;

/** How many rounds of feedback the video took, as the creator reported it. */
export const ITERATIONS = ["one-shot", "few-rounds", "many-rounds"] as const;

export const MOTION_CATEGORIES = [
  "product-ui",
  "phone",
  "charts",
  "diagrams",
  "kinetic-type",
  "shapes",
  "particles",
  "characters",
  "photos",
  "music",
  "code",
] as const;

export type MotionCategory = (typeof MOTION_CATEGORIES)[number];

// Model-facing copy for each gallery category on the site.
export const CATEGORY_META: Record<
  MotionCategory,
  { label: string; description: string }
> = {
  "product-ui": {
    label: "Product UI",
    description:
      "Interface motion: buttons, loaders, music players, menus, toasts, and other product UI interactions.",
  },
  phone: {
    label: "Phone",
    description:
      "Mobile motion: phone mockups, app flows, and screen-on-screen animations.",
  },
  charts: {
    label: "Charts",
    description:
      "Data visualization: animated charts, dashboards, and infographic motion.",
  },
  diagrams: {
    label: "Diagrams",
    description:
      "Diagrams and explainers: flowcharts, system maps, and process animations.",
  },
  "kinetic-type": {
    label: "Kinetic type",
    description:
      "Kinetic typography: type-led videos, text animation, and lyric motion.",
  },
  shapes: {
    label: "Shapes",
    description:
      "Shapes and abstract forms: morphs, geometry, and graphic shape animation.",
  },
  particles: {
    label: "Particles",
    description:
      "Particles and simulations: physics-driven, generative, and reactive effects.",
  },
  characters: {
    label: "Characters",
    description:
      "Characters: animated mascots, figures, and character-driven storytelling.",
  },
  photos: {
    label: "Photos",
    description: "Photo motion: animated photos, collages, and cutout videos.",
  },
  music: {
    label: "Music",
    description:
      "Music and audio: audio-reactive visuals, lyric videos, and beat-synced edits.",
  },
  code: {
    label: "Code",
    description:
      "Code and developer themes: terminal, coding, and software-style motion.",
  },
};

export interface MotionVideo {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  contentTags: string[];
  promptShared: boolean;
  handle: string;
  avatar: string;
  poster: string;
  preview: string;
  video: string;
  width: number;
  height: number;
  prompt?: string;
  skillUrl?: string;
  tweetUrl?: string;
  description?: string;
  /** How it was made, as the creator reported it. */
  model?: string;
  stack?: string;
  effort?: string;
  iterations?: string;
}

export interface VideoSummary {
  slug: string;
  title: string;
  handle: string;
  avatar: string;
  date: string;
  description?: string;
  contentTags: string[];
  tags: string[];
  poster: string;
  preview: string;
  video: string;
  width: number;
  height: number;
  promptShared: boolean;
  model?: string;
  effort?: string;
  iterations?: string;
  /** Canonical page on motionvideo.xyz. */
  pageUrl: string;
}

export interface VideoDetail extends VideoSummary {
  prompt?: string;
  skillUrl?: string;
  tweetUrl?: string;
  stack?: string;
  /** Primary content category (also the site's category page segment). */
  category?: MotionCategory;
  categoryUrl?: string;
  neighbours: { previous?: string; next?: string };
}

export interface CategorySummary {
  id: MotionCategory;
  label: string;
  description: string;
  count: number;
  url: string;
}

export interface DirectoryEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  url: string;
  cover: string;
}

export const DIRECTORY_SECTIONS = ["tools", "studios"] as const;
export type DirectorySection = (typeof DIRECTORY_SECTIONS)[number];

const videos: MotionVideo[] = (catalog.videos ?? []) as unknown as MotionVideo[];

/** When the bundled catalog was imported from the site. */
export const catalogImportedAt: string | undefined = (
  catalog as { importedAt?: string }
).importedAt;

const isMotionCategory = (value: string): value is MotionCategory =>
  (MOTION_CATEGORIES as readonly string[]).includes(value);

/** The first content tag is the canonical category page segment on the site. */
export const primaryCategory = (
  video: MotionVideo
): MotionCategory | undefined => video.contentTags.find(isMotionCategory);

export const videoPageUrl = (slug: string): string =>
  `${SITE_URL}/videos/${slug}`;

export const categoryPageUrl = (category: string): string =>
  `${SITE_URL}/category/${category}`;

export const creatorUrl = (handle: string): string =>
  `https://x.com/${handle}`;

export const toSummary = (video: MotionVideo): VideoSummary => ({
  slug: video.slug,
  title: video.title,
  handle: video.handle,
  avatar: video.avatar ?? "",
  date: video.date,
  description: video.description,
  contentTags: video.contentTags ?? [],
  tags: video.tags ?? [],
  poster: video.poster,
  preview: video.preview,
  video: video.video,
  width: video.width ?? 0,
  height: video.height ?? 0,
  promptShared: Boolean(video.promptShared),
  model: video.model,
  effort: video.effort,
  iterations: video.iterations,
  pageUrl: videoPageUrl(video.slug),
});

export interface SearchInput {
  query?: string;
  category?: MotionCategory;
  type?: "prompt" | "skill";
  sort?: "newest" | "oldest";
  limit?: number;
}

export const SEARCH_MAX_LIMIT = 30;

/**
 * Mirrors the site's gallery filtering: every query word must appear in the
 * title, creator handle, prompt, or content tags.
 */
export const searchVideos = ({
  query,
  category,
  type,
  sort = "newest",
  limit = 12,
}: SearchInput): { total: number; videos: VideoSummary[] } => {
  const words =
    query
      ?.trim()
      .toLowerCase()
      .split(/\s+/u)
      .filter(Boolean) ?? [];

  const filtered = videos.filter((video) => {
    if (type && !(video.tags ?? []).includes(type)) {
      return false;
    }
    if (category && !(video.contentTags ?? []).includes(category)) {
      return false;
    }
    const text = [
      video.title,
      video.handle,
      video.prompt ?? "",
      ...(video.contentTags ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return words.every((word) => text.includes(word));
  });

  filtered.sort(
    (a, b) => (sort === "newest" ? -1 : 1) * a.date.localeCompare(b.date)
  );

  const shown = Math.max(1, Math.min(limit, SEARCH_MAX_LIMIT));
  return {
    total: filtered.length,
    videos: filtered.slice(0, shown).map(toSummary),
  };
};

export const findVideo = (slug: string): MotionVideo | undefined =>
  videos.find((video) => video.slug === slug);

export const videoNeighbours = (
  video: MotionVideo
): { previous?: string; next?: string } => {
  const category = primaryCategory(video);
  const pool = category
    ? videos.filter((entry) => (entry.contentTags ?? []).includes(category))
    : videos;
  const ordered = [...pool].sort(
    (a, b) => -1 * a.date.localeCompare(b.date)
  );
  const index = ordered.findIndex((entry) => entry.slug === video.slug);
  return {
    previous: index > 0 ? ordered[index - 1]?.slug : undefined,
    next: index >= 0 && index < ordered.length - 1
      ? ordered[index + 1]?.slug
      : undefined,
  };
};

export const toDetail = (video: MotionVideo): VideoDetail => {
  const category = primaryCategory(video);
  return {
    ...toSummary(video),
    prompt: video.prompt,
    skillUrl: video.skillUrl,
    tweetUrl: video.tweetUrl,
    stack: video.stack,
    category,
    categoryUrl: category ? categoryPageUrl(category) : undefined,
    neighbours: videoNeighbours(video),
  };
};

export const listCategories = (): CategorySummary[] =>
  MOTION_CATEGORIES.map((id) => ({
    id,
    label: CATEGORY_META[id].label,
    description: CATEGORY_META[id].description,
    count: videos.filter((video) =>
      (video.contentTags ?? []).includes(id)
    ).length,
    url: categoryPageUrl(id),
  }));

const directoryEntries = (section: DirectorySection): DirectoryEntry[] =>
  (
    (directories as Record<string, { entries?: DirectoryEntry[] }>)[section]
      ?.entries ?? []
  ).map((entry) => ({
    id: entry.id,
    name: entry.name,
    description: entry.description ?? "",
    category: entry.category ?? "",
    url: entry.url,
    cover: entry.cover ?? "",
  }));

export const directoryCategories = (section: DirectorySection): string[] =>
  [...new Set(directoryEntries(section).map((entry) => entry.category))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

export const DIRECTORY_MAX_LIMIT = 120;

export interface BrowseInput {
  section: DirectorySection;
  query?: string;
  category?: string;
  limit?: number;
}

export const browseDirectory = ({
  section,
  query,
  category,
  limit = 24,
}: BrowseInput): { total: number; entries: DirectoryEntry[] } => {
  const words =
    query
      ?.trim()
      .toLowerCase()
      .split(/\s+/u)
      .filter(Boolean) ?? [];

  const filtered = directoryEntries(section).filter((entry) => {
    if (
      category &&
      entry.category.toLowerCase() !== category.trim().toLowerCase()
    ) {
      return false;
    }
    if (words.length === 0) {
      return true;
    }
    const text = `${entry.name} ${entry.description} ${entry.category}`
      .toLowerCase();
    return words.every((word) => text.includes(word));
  });

  const shown = Math.max(1, Math.min(limit, DIRECTORY_MAX_LIMIT));
  return { total: filtered.length, entries: filtered.slice(0, shown) };
};

/** Compact catalog stats for the overview resource. */
export const catalogStats = () => ({
  site: SITE_URL,
  importedAt: catalogImportedAt,
  totalVideos: videos.length,
  videosWithPrompt: videos.filter((video) => video.promptShared).length,
  categories: listCategories(),
  directories: DIRECTORY_SECTIONS.map((section) => ({
    section,
    label: section === "tools" ? "Tools & apps" : "Motion studios",
    total: directoryEntries(section).length,
    categories: directoryCategories(section),
  })),
});
