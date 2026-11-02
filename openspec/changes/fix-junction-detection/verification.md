# 实施验证

日期：2026-11-02。基线 main 0d4b8f0。未推送、未归档。

## 结果

- 模块测试：**112 项通过、0 项失败**（修复前 111 通过 / 1 失败）。原失败用例在 Node 22.22.1 与 24.14.0 下均通过。
- 类型检查：`tsc --noEmit` 通过。
- 构建：tsdown 输出到临时目录通过；`docs/examples/skill-comparison-combined.json` 重放结果不变（6 skill-turns / 1 skill）。
- 端到端：显式根位于 junction 下的映射路径得到 `unresolved` + `skipped_link`、`skippedLinks=1`；同一 fixture 中的普通路径仍为 `present`。
- 性能：`--provenance --limit 0` 本机约 0.26–0.27s（修复前约 0.34–0.38s），未因逐组件解析回退。
- 差异检查：`git diff --check` 无输出。

## 环境与限制

- 缺陷环境事实：Windows 上 `lstat(junction)` 返回 `isSymbolicLink=false` / `isDirectory=true`；`readlink(junction)` 返回 `EINVAL`；`realpath` 指向目标。Node 22.22.1 与 24.14.0 一致。
- CLI 回归（`tests/*.test.mjs`）本轮未执行：当前沙箱禁止子进程管道通信，`node --test` 无法派生子进程。需在普通终端运行 `pnpm run test:cli`。
- 未就地重建 `dist/`：沙箱仅允许写工作区根目录。构建后的行为已用临时目录产物验证，`pnpm run build` 后本机生效。
