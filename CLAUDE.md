# straven-mcp

Obsidian community plugin that runs a local HTTP+SSE MCP server. Replaces `mcp-obsidian` entirely — gives Claude full vault access: notes, canvas, and (phase 2) bases.

## Architecture

Claude Code / Claude Desktop → MCP over HTTP+SSE (localhost:27124) → Obsidian Plugin → Obsidian Internal API

**Transport:** HTTP+SSE (2024-11-05 spec). NOT Streamable HTTP (2025-03-26) — not yet supported by Claude Code/Desktop.

## Project Structure

```
src/
  main.ts              # Plugin entry, onload/onunload, MCP server startup
  server.ts            # HTTP+SSE MCP server setup
  tools/
    notes.ts           # vault_* tools
    canvas.ts          # canvas_* tools
    bases.ts           # base_* tools (Phase 2, all return BASES_NOT_AVAILABLE)
  __mocks__/
    obsidian.ts        # Obsidian API mock for vitest
manifest.json
package.json
esbuild.config.mjs
```

## Dev Commands

```bash
npm install
npm run build    # production build → main.js
npm run dev      # watch mode (for Hot Reload plugin)
npm test         # vitest
```

## Build Requirements (CRITICAL)

- `target: "es2020"` — MCP SDK needs it (NOT es2018, the Obsidian template default)
- `format: "cjs"`
- `external`: `obsidian`, `electron`, all Node.js builtins
- Everything else bundled (MCP SDK, Hono/Express, cors, zod) → ~1-2MB main.js is fine

## Plugin Lifecycle (NON-NEGOTIABLE)

- `onload()` — start HTTP server, bind port 27124, register tools
- `onunload()` — MUST call `server.close()`. Skipping this crashes Obsidian on plugin reload.
- Port conflict → show Obsidian `Notice`, don't fail silently
- SSE cleanup → close dangling connections on client disconnect

## Step 0 Gate (MUST PASS BEFORE WRITING TOOLS)

- [ ] `npm run build` succeeds with es2020 target
- [ ] Hot Reload plugin picks up changes
- [ ] Claude Code connects to `http://127.0.0.1:27124/sse` and calls `ping`

Do not proceed to notes/canvas tools until all three pass.

## Phase 1 Scope

**In:** Notes layer (`vault_*`) + Canvas layer (`canvas_*`)
**Out:** Bases (all return `BASES_NOT_AVAILABLE`), metadata layer, auth, mobile, community distribution

## Tool Surface

### Notes
`vault_list` `vault_read` `vault_create` `vault_update` `vault_delete`
`vault_search` `vault_append` `vault_patch` `vault_get_properties` `vault_set_property`

### Canvas
`canvas_list` `canvas_read` `canvas_create` `canvas_add_file_node`
`canvas_add_text_node` `canvas_add_group` `canvas_add_edge` `canvas_update_node` `canvas_create_dashboard`

## Error Model

All errors: `{ "error": { "code": "...", "message": "..." } }`
All successes: `{ "result": <data> }`

Codes: `VAULT_NOT_READY` `FILE_NOT_FOUND` `FILE_EXISTS` `INVALID_PATH`
`BASES_NOT_AVAILABLE` `CANVAS_PARSE_ERROR` `HEADING_NOT_FOUND` `INTERNAL_ERROR`

## vault_patch Rules

Heading match is exact text, no `#` prefix, **CASE-SENSITIVE**, special chars literal.
`heading_level` default: first occurrence.

## canvas_create_dashboard Coordinates

Obsidian Canvas origin = center, Y increases downward:
- Title node: `x=0, y=-350, width=400, height=60`
- Section[0]: `x=0, y=0, width=300, height=200`
- Section[N]: `x=0, y=N*220, width=300, height=200`

## Testing

Framework: `vitest` + mock at `src/__mocks__/obsidian.ts` (stubs `app.vault`, `app.metadataCache`, `Notice`)

Required cases: `vault_patch` all 3 modes + HEADING_NOT_FOUND + case-sensitivity, `vault_create` FILE_EXISTS,
`vault_search` timeout truncation, `canvas_create_dashboard` coordinates, `canvas_read` CANVAS_PARSE_ERROR,
path traversal → INVALID_PATH, port conflict → Notice called, `onunload()` → server.close() called.

## MCP Client Config

```json
{
  "mcpServers": {
    "obsidian": { "url": "http://127.0.0.1:27124/sse" }
  }
}
```

## Plugin Manifest

```json
{
  "id": "straven-mcp",
  "name": "Straven MCP",
  "version": "0.1.0",
  "minAppVersion": "1.7.0",
  "description": "MCP server for Claude — notes, canvas, and bases",
  "author": "mykolasarry",
  "isDesktopOnly": true
}
```

## Prior Art

- `mcp-tools` community plugin — study esbuild config + MCP SDK bundling before Step 0
- `mcp-obsidian` tool surface — parity baseline for notes tools

## Design Doc

`Straven-Notes/Projects/straven-obsidian-claude-mcp/Design - Straven Obsidian Claude MCP.md`
