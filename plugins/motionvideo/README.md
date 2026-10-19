# MotionVideo

Search the [motionvideo.xyz](https://motionvideo.xyz) catalog of AI-made motion videos, pull the original prompts behind them, and browse the motion tools and studios around them — then adapt the prompts into your own motion design work.

Bundled here: the MotionVideo MCP server (`search-videos`, `get-video`, `list-categories`, `browse-directory`, plus the video gallery and detail views) and the `motionvideo` skill that teaches the search → pull prompt → adapt → credit workflow.

## Use it

- "Find motion video references for a kinetic typography intro."
- "Pull the original prompt behind twoclipping-5cba86 and adapt it for my brand."
- "Which motion studios can I hire for a product launch video?"

In Claude Code, install it in one step (2.1.275 or later):

```
/plugin install motionvideo --marketplace motionvideohq/motionvideo-mcp
```

## Data

Every tool is read-only. The plugin sends your search queries and the slugs you request to the public motionvideo.xyz catalog through `https://mcp.motionvideo.xyz/mcp`, which fetches live data from motionvideo.xyz and caches each document in memory for ten minutes. No account, sign-in, or credentials are required, nothing is written back, and no data is stored by the plugin. Results link to motionvideo.xyz pages and credit the original creators.

## License

MIT. The MotionVideo brand and catalog content belong to motionvideo.xyz.
