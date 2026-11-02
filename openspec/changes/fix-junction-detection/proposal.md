## Why

现有路径安全检查依赖 `lstat().isSymbolicLink()` 识别链接。Windows 上 junction 是目录 reparse point，`lstat` 将其报告为普通目录（Node 22.22.1 与 24.14.0 实测均为 `isSymbolicLink=false`、`isDirectory=true`），因此经 junction 传入的显式技能根、映射路径或中间路径组件会被跟随，与“显式传入的链接根也拒绝”的约定及既有测试相反。

该缺陷使 `tests/provenance.test.ts` 在 Windows 上恒为失败：模块测试 111 通过 / 1 失败，而归档验证记录声称 112 项通过。

## What Changes

- 新增共享的路径组件判定：符号链接，或目录的 `realpath` 与 `resolve` 结果不一致（覆盖 junction 与目录挂载点）。
- `provenance` 的 `noLinks()` 与证据文件读取的 `noLinks()` 共用该判定，保持 `skippedLinks` 与 `file.link` 语义不变。
- 增加“中间组件是 junction”的回归用例，并复跑模块测试、类型检查、构建与样本重放。

## Capabilities

### New Capabilities
- `path-safety`: 统一符号链接与 Windows junction 的拒绝规则，任何经过链接的路径不得被读取或跟随。

## Impact

新增 `src/path-safety.ts`；修改 `src/provenance.ts`、`src/skill-evidence-io.ts`、`tests/provenance.test.ts`。不改变统计口径、JSON 契约或 CLI 参数；不自动归档、不推送。
