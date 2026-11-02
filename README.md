<h1 align="center">agent-usage</h1>

<p align="center">
  <strong>Local, evidence-based usage statistics for Codex Skills, MCP tools and Hooks</strong><br>
  No API key · No telemetry · Nothing leaves your machine
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-2ea44f?style=flat-square"></a>
  <a href="package.json"><img alt="Node: ^22.18 || >=24.11" src="https://img.shields.io/badge/node-%5E22.18%20%7C%7C%20%3E%3D24.11-339933?style=flat-square&logo=nodedotjs&logoColor=white"></a>
  <img alt="Platform: Windows" src="https://img.shields.io/badge/platform-Windows-0078D6?style=flat-square&logo=windows&logoColor=white">
  <img alt="Runtime dependencies: 0" src="https://img.shields.io/badge/runtime%20deps-0-brightgreen?style=flat-square">
</p>

<p align="center">English | <a href="README.zh-CN.md">简体中文</a></p>

---

## Quick start

Requires Node.js `^22.18.0 || >=24.11.0` and pnpm. Run from the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm run build
node ./dist/index.mjs setup
node ./dist/index.mjs --days 30
```

Sample output (synthetic data; reproduce with `--skill-evidence docs/examples/skill-comparison-combined.json`):

```text
Date: 2026-10-28    Mode: Logs + Hooks    Counts Resolved evidence

│ Skill   │ Logs Explicit │ Logs Inferred │ Hooks │ Unique Total │ Last Recorded    │
│ handoff │             2 │             3 │     4 │            6 │ 2026-10-28 18:35 │

6 skill-turns · 1 skill
```

## Common commands

| Goal | Command |
| --- | --- |
| Default (deduplicated logs + hooks) | `--days 30` |
| Logs only / hooks only | `--skill-method logs` / `--skill-method hooks` |
| MCP calls | `--mcp --days 30` |
| Skill provenance and licenses | `--provenance` |
| Export JSON / Markdown | `--json --output a.json` / `--markdown --output a.md` |
| Refresh the mapping after adding skills or plugins | `skills refresh` |
| Install the live Hook collector | `hooks install` |

Append these to `node ./dist/index.mjs`; full flags are in `--help`.

## How to read the numbers

- **Logs Explicit**: an explicit request or injection. **Logs Inferred**: only a `SKILL.md` read (weak evidence). **Hooks**: evidence from the live collector.
- None of them prove that a skill executed successfully. `Unique Total` deduplicates by instance + session + turn + skill.
- Unresolved candidates are counted separately and excluded by default; `--skill-counts strict` shows `—` for counts affected by unresolved evidence.

## Notes

- Run `skills refresh` after plugin updates, otherwise reads of the new versions stay unmapped.
- Hook collection requires enabling Hooks in Codex and trusting PreToolUse / Bash via `/hooks`; it only covers records created afterwards.
- JSON / Markdown may contain skill names and path digests; review before sharing. Verified on Windows only.

Docs: [docs/](docs/) · Maintenance: [MAINTENANCE.md](MAINTENANCE.md) · License: [LICENSE](LICENSE). The Codex collectors derive from [skillusage](https://github.com/lovstudio/skillusage) (MIT); see [NOTICE](NOTICE).
