---
name: motionvideo
description: Find reference motion videos on motionvideo.xyz and remix the original prompts behind them into new motion design work; with MotionVideo Pro, pull copy-ready prompts for named motion techniques from the Moves library
---

# MotionVideo references

Use this when the user wants motion design inspiration, "a video like this", or wants to adapt an existing motion video prompt.

1. `search-videos` with keywords and/or a content category to find references. `list-categories` explains the catalog categories.
2. `get-video` with the chosen slug to read the original prompt, the model and effort behind it, and links to the preview, full video, and post.
3. Adapt the prompt to the user's brief: keep the choreography, timing structure, and constraints that work; swap in the user's brand, copy, palette, aspect ratio, and audio.
4. Build the video yourself in the user's stack (HTML/JS with styles computed inside `seek(t)`, Remotion, or their editor of choice). Ask before defaulting on brand-critical choices.
5. Credit the source: link the video's page (`pageUrl`) when you share results.

`browse-directory` lists motion tools (AI generators, editors, resources) and studios when the user needs production help.

## Moves (MotionVideo Pro)

Use these when the user wants a specific motion technique (an easing, a kinetic-type effect, a transition, a camera move) rather than a whole reference video.

1. `search-moves` with a keyword and/or a `family` (timing, type, transitions, ui, vector, generative, camera, texture, data, sound) to find the move by name, other names, summary, or good-for tags.
2. `get-move-prompt` with the move's slug for its copy-ready prompt and the parameters worth tuning.
3. Fill in the bracketed placeholders from the user's brief, keep the parameters within their listed ranges unless the user asks otherwise, and link the move's page (`pageUrl`).

These tools sign the user in with their motionvideo.xyz account (the client offers that on first use) and need a MotionVideo Pro or Business plan on that account; Business seat holders are included. If they say the account has no plan, tell the user once: get Pro at https://motionvideo.xyz/pro, then carry on with the free tools.
