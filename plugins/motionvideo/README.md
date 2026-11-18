# MotionVideo

Search the [motionvideo.xyz](https://motionvideo.xyz) catalog of AI-made motion videos, pull the original prompts behind them, and browse the motion tools and studios around them — then adapt the prompts into your own motion design work.

Bundled here: the MotionVideo MCP server (`search-videos`, `get-video`, `search-directory`, `list-filters`, plus the video gallery and detail views) and the `motionvideo` skill that teaches the search → pull prompt → adapt → credit workflow. Sign in with a motionvideo.xyz account that has [MotionVideo Pro or Business](https://motionvideo.xyz/pro), and `search-moves` and `get-move-prompt` add copy-ready prompts from the Moves library.

## Use it

- "Find motion video references for a kinetic typography intro."
- "Pull the original prompt behind twoclipping-5cba86 and adapt it for my brand."
- "Which motion studios can I hire for a product launch video?"

In Claude Code, install it in one step (2.1.275 or later):

```
/plugin install motionvideo --marketplace motionvideohq/motionvideo-mcp
```

## Data

Every tool is read-only. Public catalog queries and requested slugs pass through `https://mcp.motionvideo.xyz/mcp` to motionvideo.xyz's query endpoints; the list of filter values is cached in memory for ten minutes. The four catalog tools need no account. Catalog resources, the `remix-video` prompt, and the account tools require OAuth sign-in with a free motionvideo.xyz account; Pro tools additionally require a Pro or Business plan, including a Business seat. Use an OAuth-capable client and leave authorization discovery enabled rather than forcing “No Auth.” Account/Pro tools forward the verified bearer token to motionvideo.xyz; the site checks the plan for Pro tools, and successful moves lists are cached per account for ten minutes. The bundled skill stores no data; the host client manages OAuth credentials. Nothing is written back to the site. Results link to motionvideo.xyz pages and credit the original creators.

Release 1.1.1 fixes the portable authentication override and release metadata. Building this bundle does not deploy the remote server; see the repository's [release verification](https://github.com/motionvideohq/motionvideo-mcp#release-111) for smoke evidence and authorized checks.

## License

MIT. The MotionVideo brand and catalog content belong to motionvideo.xyz.
