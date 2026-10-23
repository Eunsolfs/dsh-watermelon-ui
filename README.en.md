# dsh-watermelon-ui

English | [简体中文](README.md)

[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Brings [Watermelon UI](https://ui.watermelon.sh) into DeepSeek Harness: one bundled skill, two offline catalog tools, and an optional connection to the official hosted MCP. Once installed, the agent first decides whether the project should use Watermelon at all, then produces the exact shadcn install command instead of making up slugs from memory.

## Capabilities

| Piece | What it does |
|---|---|
| Skill `watermelon-ui` | Stack gate (React + Tailwind + shadcn only), search flow, the four install steps, MIT attribution rules, common pitfalls |
| `watermelon_catalog_search` | Searches the offline catalog (Chinese/English lexical match); returns previews, dependencies and install commands |
| `watermelon_install_plan` | Produces an install plan for a slug: command, dependencies, pre-flight gates, post-install checks, attribution note |
| `watermelon-mcp` (off by default) | Connects the official hosted MCP at `https://mcp.watermelon.sh/mcp`: semantic search, component source, page composition plans |

The offline catalog is an index snapshot of Watermelon's public catalog API — 849 entries: 516 components, 131 animated components, 189 blocks, 12 dashboards, 1 template. The snapshot date is the `fetchedAt` field at the top of `data/catalog.json`. It contains **no component source**; for source, use the MCP `get_component` tool or the registry JSON.

Installs follow the shadcn model (source is copied into your project — this is not an npm package):

```bash
npx shadcn@latest add https://registry.watermelon.sh/r/<slug>.json
```

## Install

```bash
git clone https://github.com/Eunsolfs/dsh-watermelon-ui.git
```

Then use `plugin_manager` inside Harness, pointing `target` at the cloned directory:

```json
{ "action": "install_bundle", "target": "C:\\path\\to\\dsh-watermelon-ui" }
```

The change takes effect immediately: new sessions see the `watermelon-ui` skill and both tools. The `watermelon-mcp` entry ships as `disabled: true`; enable it when you want semantic search or source code (note that the entryId is `include:watermelon-mcp`, not `watermelon-mcp`):

```json
{ "action": "set_plugin", "target": "include:watermelon-mcp", "enabled": true }
```

What enabling costs: one extra network handshake at startup (it waits for the SDK timeout when the network is unreachable), and 8 `mcp__watermelon__*` tools in the model's tool table. Leave it off if you don't need it — the local tools already give you install commands.

Rollback:

```json
{ "action": "remove_bundle", "target": "dsh-watermelon-ui" }
```

## Local verification (before installing)

```bash
npm test        # same as: node scripts/verify.mjs
```

No network, no installs. It checks: JSON and snapshot fields, the tool SchemaSpec dialect, real execution and output contracts of both tools, Markdown rendering, the skill frontmatter, and the patch shape. The bundle is considered installable only when everything prints `ALL CHECKS PASSED`. CI (GitHub Actions) runs the same checks on Node 22 / 24.

## Refreshing the catalog snapshot

Watermelon adds entries over time; `data/catalog.json` is a point-in-time snapshot (see its `fetchedAt`). To refresh:

```bash
npm run snapshot                # fetch and write data/
npm run snapshot -- --dry-run   # print stats only, write nothing
```

The script only reads the public API (no auth). Upstream caps `limit` at 50, has no offset, and its summary does not list categories — so the script **reuses the category list in `data/summary.json` as its enumeration seed**, then merges in any category newly seen on the first page. It finally reconciles against the summary counts and **exits 1 without writing** when they disagree, so a partial snapshot can never be committed. Re-run `npm test` afterwards.

## Configuration

The `watermelon-ui` entry in `cordis.patch.yml` accepts two fields:

| Field | Default | Meaning |
|---|---|---|
| `defaultResults` | `5` | Default result count (1–8) for `watermelon_catalog_search` when `limit` is not passed explicitly |
| `skill` | `true` | Whether to register the bundled `watermelon-ui` skill (with `false`, both tools still work) |

## Project structure

```
index.js               Thin entry point (re-exports)
cordis.patch.yml       Bundle patch: this plugin's entry + the optional MCP entry
icon.svg / locale/     Display metadata (English and Chinese) and the original icon
skills/watermelon-ui/  Bundled skill body (SKILL.md)
data/catalog.json      Offline catalog snapshot (849 entries, no source)
scripts/verify.mjs     Pre-install self-check (offline)
scripts/snapshot.mjs   Regenerates the catalog snapshot (network, read-only public API)
lib/plugin/            Host adapter: apply, skill registration, SchemaSpec dialect guard
lib/tools/             The two model tools
lib/search/            Search scoring and the Chinese/English term lists
lib/repo/              Snapshot reading and derivation
lib/presentation/      Markdown rendering
```

## License

The plugin code is MIT. Watermelon UI's component source is also released under MIT; when you copy a component, keep its copyright and license notice and cite the source with a link to the entry (the terms on the [Watermelon copyright page](https://ui.watermelon.sh/copyright) govern). The catalog snapshot data comes from Watermelon's public catalog API.
