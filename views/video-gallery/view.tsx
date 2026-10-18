/** View for the search-videos tool: a motion video grid with inline detail. */
import {
  ModelContext,
  ThemeProvider,
  useCallTool,
  useHostContext,
  useOpenExternal,
  useSendFollowUp,
  useToolContext,
} from "mcp-use/react";
import { useState } from "react";

interface Video {
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
  pageUrl: string;
}

interface VideoDetail extends Video {
  prompt?: string;
  skillUrl?: string;
  tweetUrl?: string;
  stack?: string;
  category?: string;
  categoryUrl?: string;
  neighbours: { previous?: string; next?: string };
}

const formatDate = (isoDate: string): string => {
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return parsed.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

const Chip = ({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "yellow";
}) => (
  <span
    className={
      tone === "yellow"
        ? "inline-flex items-center rounded-full bg-[#FFBE25]/20 px-2 py-0.5 text-[11px] font-medium text-[#8a6200] dark:text-[#ffd875]"
        : "inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
    }
  >
    {children}
  </span>
);

const MetaChips = ({ video }: { video: Video }) => {
  const size =
    video.width && video.height ? `${video.width}×${video.height}` : null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {video.promptShared && <Chip tone="yellow">Prompt</Chip>}
      {video.tags.includes("skill") && <Chip>Skill</Chip>}
      {video.model && <Chip>{video.model}</Chip>}
      {video.effort && <Chip>effort: {video.effort}</Chip>}
      {video.iterations && <Chip>{video.iterations}</Chip>}
      {size && <Chip>{size}</Chip>}
      {video.contentTags.map((tag) => (
        <Chip key={tag}>{tag}</Chip>
      ))}
    </div>
  );
};

const PromptBlock = ({ prompt }: { prompt: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyText(prompt);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <span className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          Prompt behind it
        </span>
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 transition-colors hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          onClick={handleCopy}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="m-0 max-h-64 overflow-y-auto px-3 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">
        {prompt}
      </pre>
    </div>
  );
};

const VideoPlayer = ({
  detail,
  className,
}: {
  detail: VideoDetail;
  className?: string;
}) => (
  <div
    className={`overflow-hidden rounded-xl bg-black ${className ?? ""}`}
    style={
      detail.width && detail.height
        ? { aspectRatio: `${detail.width} / ${detail.height}` }
        : undefined
    }
  >
    <video
      key={detail.slug}
      src={detail.video}
      poster={detail.poster}
      autoPlay
      muted
      loop
      playsInline
      controls
      className="h-full w-full object-contain"
    />
  </div>
);

const GalleryCard = ({
  video,
  onOpen,
}: {
  video: Video;
  onOpen: () => void;
}) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      className="group flex cursor-pointer flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-2 text-left transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="relative block aspect-video w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900">
        {hovered ? (
          <video
            src={video.preview}
            poster={video.poster}
            autoPlay
            muted
            loop
            playsInline
            className="h-full w-full object-cover"
          />
        ) : (
          <img
            src={video.poster}
            alt={video.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        )}
        <span className="absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
          Open
        </span>
      </span>
      <span className="flex flex-col gap-1 px-1 pb-1">
        <span className="line-clamp-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {video.title}
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          @{video.handle} · {formatDate(video.date)}
          {video.model ? ` · ${video.model}` : ""}
        </span>
        <span className="mt-1 flex flex-wrap gap-1">
          {video.promptShared && <Chip tone="yellow">Prompt</Chip>}
          {video.contentTags.slice(0, 2).map((tag) => (
            <Chip key={tag}>{tag}</Chip>
          ))}
        </span>
      </span>
    </button>
  );
};

const SkeletonGrid = () => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    {[0, 1, 2, 3].map((index) => (
      <div
        key={index}
        className="flex animate-pulse flex-col gap-2 rounded-2xl border border-zinc-200 p-2 dark:border-zinc-800"
      >
        <div className="aspect-video w-full rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="mx-1 h-4 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mx-1 mb-1 h-3 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
    ))}
  </div>
);

const VideoGallery = () => {
  const view = useToolContext<"search-videos">();
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const detail = useCallTool("get-video");
  const openExternal = useOpenExternal();
  const sendFollowUp = useSendFollowUp();
  const { hostCapabilities } = useHostContext();

  const canOpenExternal = hostCapabilities?.openLinks !== undefined;
  const canFollowUp = hostCapabilities?.message !== undefined;

  const openVideo = (slug: string) => {
    setOpenSlug(slug);
    void detail.callTool({ slug });
  };

  const closeVideo = () => {
    setOpenSlug(null);
  };

  const openUrl = (url: string | undefined) => {
    if (url && canOpenExternal) {
      void openExternal({ url });
    }
  };

  const remixInChat = async (current: VideoDetail) => {
    if (!canFollowUp) {
      return;
    }
    try {
      await sendFollowUp({
        prompt: `Let's remake "${current.title}" (${current.pageUrl}) for my project. Adapt the original prompt to my brief — ask me what to change first — then build it.`,
      });
    } catch {
      // The host refused the follow-up; the gallery stays usable either way.
    }
  };

  const activeDetail: VideoDetail | undefined =
    detail.data?.structuredContent &&
    detail.data.structuredContent.slug === openSlug
      ? detail.data.structuredContent
      : undefined;
  const previous = activeDetail?.neighbours.previous;
  const next = activeDetail?.neighbours.next;

  const content = (() => {
    if (view.status === "error") {
      return (
        <div className="p-6 text-sm text-red-500">
          Failed to search the catalog: {view.error.message}
        </div>
      );
    }

    if (view.status === "pending") {
      return (
        <div className="p-3">
          <SkeletonGrid />
        </div>
      );
    }

    const { total, shown, videos } = view.toolOutput;

    if (openSlug) {
      return (
        <div className="flex flex-col gap-3 p-3">
          <button
            type="button"
            className="inline-flex w-fit cursor-pointer items-center gap-1 rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            onClick={closeVideo}
          >
            ← Back to results
          </button>
          {detail.error !== undefined && (
            <p className="text-sm text-red-500">{detail.error.message}</p>
          )}
          {activeDetail ? (
            <div className="flex flex-col gap-3">
              <VideoPlayer detail={activeDetail} />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <h2 className="m-0 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {activeDetail.title}
                  </h2>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    @{activeDetail.handle} · {formatDate(activeDetail.date)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canOpenExternal}
                    className="inline-flex cursor-pointer items-center rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    onClick={() => openUrl(activeDetail.pageUrl)}
                  >
                    Open on motionvideo.xyz
                  </button>
                  {activeDetail.tweetUrl && (
                    <button
                      type="button"
                      disabled={!canOpenExternal}
                      className="inline-flex cursor-pointer items-center rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      onClick={() => openUrl(activeDetail.tweetUrl)}
                    >
                      Original post
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!canFollowUp}
                    className="inline-flex cursor-pointer items-center rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/85"
                    onClick={() => remixInChat(activeDetail)}
                  >
                    Remix in chat
                  </button>
                </div>
              </div>
              <MetaChips video={activeDetail} />
              {activeDetail.prompt ? (
                <PromptBlock
                  key={activeDetail.slug}
                  prompt={activeDetail.prompt}
                />
              ) : (
                <p className="m-0 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
                  No prompt was shared for this one — it works as a visual
                  reference.
                </p>
              )}
              {(previous || next) && (
                <div className="flex items-center justify-between gap-2 pt-1">
                  {previous ? (
                    <button
                      type="button"
                      className="cursor-pointer rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      onClick={() => openVideo(previous)}
                    >
                      ← {previous}
                    </button>
                  ) : (
                    <span />
                  )}
                  {next && (
                    <button
                      type="button"
                      className="cursor-pointer rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      onClick={() => openVideo(next)}
                    >
                      {next} →
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex animate-pulse flex-col gap-3">
              <div className="aspect-video w-full rounded-xl bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-24 w-full rounded-xl bg-zinc-200 dark:bg-zinc-800" />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
          <h2 className="m-0 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {total === 0
              ? "No matches"
              : `${total} motion video${total === 1 ? "" : "s"}`}
          </h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {shown < total ? `showing ${shown}` : "showing all"}
          </span>
        </div>
        {videos.length === 0 ? (
          <p className="m-0 px-1 pb-2 text-sm text-zinc-500 dark:text-zinc-400">
            Nothing matched. Try broader keywords or a different category.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {videos.map((video) => (
              <GalleryCard
                key={video.slug}
                video={video}
                onOpen={() => openVideo(video.slug)}
              />
            ))}
          </div>
        )}
      </div>
    );
  })();

  const modelContext = (() => {
    if (view.status !== "ready") {
      return "Loading motion video search results.";
    }
    const { total, shown } = view.toolOutput;
    const filters = [
      view.toolInput?.query ? `query "${view.toolInput.query}"` : undefined,
      view.toolInput?.category
        ? `category ${view.toolInput.category}`
        : undefined,
      view.toolInput?.type ? `type ${view.toolInput.type}` : undefined,
    ]
      .filter(Boolean)
      .join(", ");
    const selection = activeDetail
      ? ` Open video: "${activeDetail.title}" by @${activeDetail.handle} (slug ${activeDetail.slug})${activeDetail.prompt ? " with its original prompt visible" : ""}.`
      : "";
    return `MotionVideo search${filters ? ` (${filters})` : ""}: ${shown} of ${total} matches shown in the gallery.${selection}`;
  })();

  return (
    <ThemeProvider>
      <div
        data-card-shell
        className="min-h-[420px] w-full overflow-hidden rounded-3xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-950"
      >
        <ModelContext content={modelContext} />
        {content}
        <div className="flex items-center justify-center border-t border-zinc-100 py-2 dark:border-zinc-900">
          <button
            type="button"
            disabled={!canOpenExternal}
            className="cursor-pointer border-0 bg-transparent text-[10px] font-medium tracking-wide text-zinc-400 uppercase transition-colors hover:text-zinc-600 disabled:cursor-not-allowed dark:text-zinc-500 dark:hover:text-zinc-300"
            onClick={() => openUrl("https://motionvideo.xyz")}
          >
            motionvideo.xyz — motion design, written in code
          </button>
        </div>
      </div>
    </ThemeProvider>
  );
};

export default VideoGallery;
