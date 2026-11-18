---
name: motionvideo
description: Find reference motion videos on motionvideo.xyz and remix the original prompts behind them into new motion design work; with MotionVideo Pro, pull copy-ready prompts for named motion techniques from the Moves library
---

# MotionVideo references

Use this when the user wants motion design inspiration, "a video like this", or wants to adapt an existing motion video prompt.

1. `search-videos` to find references: keywords plus any of `categories`, `models` (e.g. "Opus 5.5"; a bare "5.5" covers every 5.5 model; "Gemini" covers the family), `colors` (red, orange, …), `creators`, and `type`. Several values in one filter mean "any of them"; different filters all apply, so "Opus 5.5 videos in red or orange" is `models: ["Opus 5.5"], colors: ["red", "orange"]`. Page with `offset`. `list-filters` lists every category, model and colour with counts.
2. `get-video` with the chosen slug to read the original prompt, the model and effort behind it, and links to the preview, full video, and post.
3. Adapt the prompt to the user's brief: keep the choreography, timing structure, and constraints that work; swap in the user's brand, copy, palette, aspect ratio, and audio.
4. Build the video yourself in the user's stack (HTML/JS with styles computed inside `seek(t)`, Remotion, or their editor of choice). Ask before defaulting on brand-critical choices.
5. Credit the source: link the video's page (`pageUrl`) when you share results.

`search-directory` finds production help in one section: `tools` (filter by pricing), `skills` (agent skills that make videos; filter by renderer such as remotion, sort by stars), `creatives` (studios and designers for hire; filter by specialty such as product-films), or `extras` (articles and resources).

## Moves (MotionVideo Pro)

Use these when the user wants a specific motion technique (an easing, a kinetic-type effect, a transition, a camera move) rather than a whole reference video.

1. `search-moves` with a keyword and/or a `family` (timing, type, transitions, ui, vector, generative, camera, texture, data, sound) to find the move by name, other names, summary, or good-for tags.
2. `get-move-prompt` with the move's slug for its copy-ready prompt and the parameters worth tuning.
3. Fill in the bracketed placeholders from the user's brief, keep the parameters within their listed ranges unless the user asks otherwise, and link the move's page (`pageUrl`).

These tools sign the user in with their motionvideo.xyz account (the client offers that on first use) and need a MotionVideo Pro or Business plan on that account; Business seat holders are included. If they say the account has no plan, tell the user once: get Pro at https://motionvideo.xyz/pro, then carry on with the free tools.
