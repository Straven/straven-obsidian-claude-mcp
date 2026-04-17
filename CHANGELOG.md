# Changelog

## [0.2.0](https://github.com/Straven/straven-obsidian-claude-mcp/compare/straven-obsidian-mcp-v0.1.0...straven-obsidian-mcp-v0.2.0) (2026-04-17)


### Features

* add NotesTools scaffold with VaultError, resolvePath, wrap ([339b9ad](https://github.com/Straven/straven-obsidian-claude-mcp/commit/339b9adee942a9f8384cedd60a378d624a259263))
* implement vault_append tool ([883711f](https://github.com/Straven/straven-obsidian-claude-mcp/commit/883711fe405b7354ff2b9a83049ea213383028c7))
* implement vault_create, vault_update, vault_delete tools ([5d17391](https://github.com/Straven/straven-obsidian-claude-mcp/commit/5d1739156e22bc46e1ac9eb64994735a1da4b21d))
* implement vault_get_properties and vault_set_property tools ([89805ab](https://github.com/Straven/straven-obsidian-claude-mcp/commit/89805ab191d783ffdecf94003aafea90a65e73b3))
* implement vault_list tool ([34ed18d](https://github.com/Straven/straven-obsidian-claude-mcp/commit/34ed18d2b59d91a9278f88b2fd4934af772f04ee))
* implement vault_patch with replace/append/prepend modes ([5b4e94b](https://github.com/Straven/straven-obsidian-claude-mcp/commit/5b4e94ba986eb623a032482685a0236feb1a3036))
* implement vault_read tool ([79e9609](https://github.com/Straven/straven-obsidian-claude-mcp/commit/79e96091a980b7f723bbcafd635eec25a013c23e))
* implement vault_search with timeout ([4b93d79](https://github.com/Straven/straven-obsidian-claude-mcp/commit/4b93d7949f2ec4fe5ed5001dc1ac6cdd31ac2f52))
* initial plugin scaffold with MCP ping tool ([14bb55a](https://github.com/Straven/straven-obsidian-claude-mcp/commit/14bb55a1d6261bfeeff277320f25edda0384699e))
* wire NotesTools into plugin, expose 10 vault_* MCP tools ([1dc18df](https://github.com/Straven/straven-obsidian-claude-mcp/commit/1dc18dfc79686171b9ffd329212f0dbfa97bfe86))


### Bug Fixes

* align VaultErrorCode with spec, export errorResponse, add traversal guard ([96e5e48](https://github.com/Straven/straven-obsidian-claude-mcp/commit/96e5e48329b34ad001d49a0d388d96facf1a980b))
* resolve vault_search race condition, add truncation test ([f3777dd](https://github.com/Straven/straven-obsidian-claude-mcp/commit/f3777ddad7339ca76777908b73caf94fd80d89d8))
* update vault_patch spec, add timeout test, clean vault_list ([5dd1331](https://github.com/Straven/straven-obsidian-claude-mcp/commit/5dd1331fa68102197a45c345dee70c7442972091))
* use portable path.resolve in vitest config, add Plugin.app ([adbc9f4](https://github.com/Straven/straven-obsidian-claude-mcp/commit/adbc9f403acd97c5b66ba2e3e25a44f26b51dbfd))

## [0.1.0](https://github.com/Straven/straven-obsidian-claude-mcp/releases/tag/0.1.0) (2026-04-17)

### Features

* Initial plugin scaffold with HTTP+SSE MCP server on localhost:27124
* `ping` tool for Step 0 connection validation
* GitHub Actions release workflow with BRAT distribution support
