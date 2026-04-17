# Straven MCP

An Obsidian community plugin that runs a local MCP (Model Context Protocol) server, giving Claude direct access to your vault — notes, canvas, and (coming soon) bases.

Replaces `mcp-obsidian` with a native plugin that uses Obsidian's internal API instead of a REST middleman.

## Features

**Phase 1 (current)**
- Full note CRUD: create, read, update, delete, search, append, patch by heading
- Frontmatter property read/write
- Canvas: create, read, add nodes/edges, build dashboards

**Phase 2 (planned)**
- Bases integration
- Auth token for shared machines

## Installation

Requires [BRAT](https://github.com/TfTHacker/obsidian42-brat).

1. Install BRAT from Obsidian community plugins
2. BRAT → "Add Beta plugin" → `Straven/straven-obsidian-claude-mcp`
3. Enable **Straven MCP** in community plugins

## MCP Client Config

Add to your Claude Code or Claude Desktop MCP config:

```json
{
  "mcpServers": {
    "obsidian": {
      "url": "http://127.0.0.1:27124/sse"
    }
  }
}
```

## Tools

### Notes

| Tool | Description |
|------|-------------|
| `vault_list` | List files and folders |
| `vault_read` | Read file content + frontmatter |
| `vault_create` | Create a new note |
| `vault_update` | Replace file content |
| `vault_delete` | Delete a file |
| `vault_search` | Full-text search (5s timeout, partial results ok) |
| `vault_append` | Append content to a file |
| `vault_patch` | Edit content under a heading (replace/append/prepend) |
| `vault_get_properties` | Read all frontmatter properties |
| `vault_set_property` | Write a single frontmatter property |

### Canvas

| Tool | Description |
|------|-------------|
| `canvas_list` | List all `.canvas` files |
| `canvas_read` | Read nodes and edges |
| `canvas_create` | Create a new canvas |
| `canvas_add_file_node` | Link a vault file into a canvas |
| `canvas_add_text_node` | Add a free text card |
| `canvas_add_group` | Add a colored group/label |
| `canvas_add_edge` | Connect two nodes |
| `canvas_update_node` | Move, resize, or recolor a node |
| `canvas_create_dashboard` | Build a dashboard layout from a section list |

## Development

```bash
git clone https://github.com/Straven/straven-obsidian-claude-mcp
cd straven-obsidian-claude-mcp
npm install
npm run build   # → main.js
npm run dev     # watch mode (use with Obsidian Hot Reload plugin)
npm test        # vitest
```

**Install into Obsidian:**
```bash
cp main.js manifest.json "<vault>/.obsidian/plugins/straven-mcp/"
```

**Release workflow:** commits follow [Conventional Commits](https://www.conventionalcommits.org/). Push to `main` → release-please opens a Release PR → merge it → GitHub release is created → BRAT picks it up automatically.

| Commit prefix | Version bump |
|---------------|-------------|
| `fix:` | patch (0.1.0 → 0.1.1) |
| `feat:` | minor (0.1.0 → 0.2.0) |
| `feat!:` / `BREAKING CHANGE:` | major (0.1.0 → 1.0.0) |

## License

MIT
