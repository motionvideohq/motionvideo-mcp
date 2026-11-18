// MotionVideo MCP server — the motionvideo.xyz catalog as MCP tools, views,
// resources, and a prompt.
//
// The server is built in src/mcp-server.ts (not src/server.ts, which mcp-use
// would pick up as the entry); each src/tools/* module registers its part on
// it. Tool refs are re-exported here because mcp-env.d.ts types the views'
// `useCallTool` from this module's exports.

export { listBookmarks, myFeatured } from "./src/tools/account.js";
export { getVideo, searchVideos } from "./src/tools/catalog.js";
export { searchDirectory } from "./src/tools/directory.js";
export { listFilters } from "./src/tools/filters.js";
export { getMovePrompt, searchMoves } from "./src/tools/pro.js";
export { server as default } from "./src/mcp-server.js";
