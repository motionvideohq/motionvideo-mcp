/** View for the get-video tool: player, original prompt, and remix actions. */
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

interface VideoDetail {
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

const DetailSkeleton = () => (
  <div className="flex animate-pulse flex-col gap-3 p-3">
    <div className="aspect-video w-full rounded-xl bg-zinc-200 dark:bg-zinc-800" />
    <div className="h-5 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
    <div className="h-3 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
    <div className="h-28 w-full rounded-xl bg-zinc-200 dark:bg-zinc-800" />
  </div>
);

const MetaChips = ({ data }: { data: VideoDetail }) => {
  const size =
    data.width && data.height ? `${data.width}×${data.height}` : null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {data.promptShared && <Chip tone="yellow">Prompt</Chip>}
      {data.tags.includes("skill") && <Chip>Skill</Chip>}
      {data.model && <Chip>{data.model}</Chip>}
      {data.effort && <Chip>effort: {data.effort}</Chip>}
      {data.iterations && <Chip>{data.iterations}</Chip>}
      {data.stack && <Chip>{data.stack}</Chip>}
      {size && <Chip>{size}</Chip>}
      {data.contentTags.map((tag) => (
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
      <pre className="m-0 max-h-72 overflow-y-auto px-3 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">
        {prompt}
      </pre>
    </div>
  );
};

const NeighbourNav = ({
  isPending,
  next,
  onSelect,
  previous,
}: {
  isPending: boolean;
  next?: string;
  onSelect: (slug: string) => void;
  previous?: string;
}) => {
  if (!previous && !next && !isPending) {
    return null;
  }
  return (
    <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-900">
      {previous ? (
        <button
          type="button"
          className="cursor-pointer rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          onClick={() => onSelect(previous)}
        >
          ← {previous}
        </button>
      ) : (
        <span />
      )}
      {isPending && <span className="text-xs text-zinc-400">Loading…</span>}
      {next && (
        <button
          type="button"
          className="cursor-pointer rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          onClick={() => onSelect(next)}
        >
          {next} →
        </button>
      )}
    </div>
  );
};

const VideoDetailView = () => {
  const view = useToolContext<"get-video">();
  const nav = useCallTool("get-video");
  const openExternal = useOpenExternal();
  const sendFollowUp = useSendFollowUp();
  const { hostCapabilities } = useHostContext();

  const canOpenExternal = hostCapabilities?.openLinks !== undefined;
  const canFollowUp = hostCapabilities?.message !== undefined;

  const openUrl = (url: string | undefined) => {
    if (url && canOpenExternal) {
      void openExternal({ url });
    }
  };

  const goToVideo = async (slug: string) => {
    try {
      await nav.callTool({ slug });
    } catch {
      // Neighbour hops are a convenience; a failure keeps this video open.
    }
  };

  const remixInChat = async (data: VideoDetail) => {
    if (!canFollowUp) {
      return;
    }
    try {
      await sendFollowUp({
        prompt: `Let's remake "${data.title}" (${data.pageUrl}) for my project. Adapt the original prompt to my brief — ask me what to change first — then build it.`,
      });
    } catch {
      // The host refused the follow-up; the card stays usable either way.
    }
  };

  const body = (() => {
    if (view.status === "error") {
      return (
        <div className="p-6 text-sm text-red-500">
          Could not load the video: {view.error.message}
        </div>
      );
    }
    if (view.status === "pending") {
      return <DetailSkeleton />;
    }

    const data: VideoDetail = nav.data?.structuredContent ?? view.toolOutput;

    return (
      <div className="flex flex-col gap-3 p-3">
        <div
          className="overflow-hidden rounded-xl bg-black"
          style={
            data.width && data.height
              ? { aspectRatio: `${data.width} / ${data.height}` }
              : undefined
          }
        >
          <video
            key={data.slug}
            src={data.video}
            poster={data.poster}
            autoPlay
            muted
            loop
            playsInline
            controls
            className="h-full w-full object-contain"
          />
        </div>

        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {data.title}
            </h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              @{data.handle} · {formatDate(data.date)}
              {data.category ? ` · ${data.category}` : ""}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canOpenExternal}
              className="inline-flex cursor-pointer items-center rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              onClick={() => openUrl(data.pageUrl)}
            >
              Open on motionvideo.xyz
            </button>
            {data.tweetUrl && (
              <button
                type="button"
                disabled={!canOpenExternal}
                className="inline-flex cursor-pointer items-center rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                onClick={() => openUrl(data.tweetUrl)}
              >
                Original post
              </button>
            )}
            <button
              type="button"
              disabled={!canFollowUp}
              className="inline-flex cursor-pointer items-center rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/85"
              onClick={() => remixInChat(data)}
            >
              Remix in chat
            </button>
          </div>
        </div>

        <MetaChips data={data} />

        {data.description && (
          <p className="m-0 text-sm text-zinc-600 dark:text-zinc-300">
            {data.description}
          </p>
        )}

        {data.prompt ? (
          <PromptBlock key={data.slug} prompt={data.prompt} />
        ) : (
          <p className="m-0 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
            No prompt was shared for this one — it works as a visual reference.
          </p>
        )}

        {data.skillUrl && (
          <button
            type="button"
            disabled={!canOpenExternal}
            className="w-fit cursor-pointer rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            onClick={() => openUrl(data.skillUrl)}
          >
            Skill file for this video
          </button>
        )}

        <NeighbourNav
          isPending={nav.isPending}
          next={data.neighbours.next}
          onSelect={goToVideo}
          previous={data.neighbours.previous}
        />
      </div>
    );
  })();

  const modelContext = (() => {
    if (view.status === "error") {
      return "Motion video detail failed to load.";
    }
    if (view.status === "pending") {
      return "Loading a motion video detail from the catalog.";
    }
    const data: VideoDetail = nav.data?.structuredContent ?? view.toolOutput;
    return `Motion video detail: "${data.title}" by @${data.handle} (slug ${data.slug}, ${data.pageUrl}).${data.prompt ? " The original prompt behind the video is visible." : " No prompt was shared for this entry."}`;
  })();

  return (
    <ThemeProvider>
      <div
        data-card-shell
        className="w-full overflow-hidden rounded-3xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-950"
      >
        <ModelContext content={modelContext} />
        {body}
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

export default VideoDetailView;
