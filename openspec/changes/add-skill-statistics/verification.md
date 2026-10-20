# Verification — 2026-10-20

## 最终结果

- pnpm install --offline --frozen-lockfile：成功，54个包来自缓存，无下载。
- pnpm run test：57/57核心回归通过；核心文件此后未改动。
- pnpm run typecheck：参数修复后通过。
- pnpm run test:cli：构建通过，26/26集成测试通过。
- openspec validate add-skill-statistics --strict --no-interactive：通过。
- 参数错误在进入命令与扫描前拒绝，非零退出，stdout为空，stderr有错误说明。覆盖已移除/未知参数、位置命令、非法数值、缺失值及未知参数与help组合。
- JSON普通/strict、daily/projects/aliases、完整列表与limit、证据表格、缺失目录、帮助和版本均通过进程测试。
- git check-ignore：handoff、node_modules、dist、.test-dist符合忽略规则；Git当前分支codex/skill-statistics，无提交、无远端、无暂存内容。
- 核心两个适配器、聚合器、归一化与57项测试的SHA256均与G:/skillusage来源一致；原项目未修改。
- 未提交、未推送、未发布、未归档；没有复制真实日志。

## 调试过程与环境边界

初轮CLI测试17/21通过，因框架静默接受未知参数而暂停。用户确认继续修复后，引入同一参数声明派生的Node内置严格预检。加强输出断言发现NaN错误由框架写入stdout，随后将数值检查加入预检，最终26/26通过。

初轮未知参数负测试意外触发默认只读扫描，输出留在进程内，未打印或保存真实记录；修复后参数错误均在扫描前阻断。测试数据使用临时合成日志。

普通沙盒出现setup refresh/helper_unknown_error，后续经批准通道执行；未修改系统ACL或沙盒配置，普通沙盒未恢复。验证主机为Windows，不代表完成Node20或POSIX主机验证。

上游源包声明MIT，但迁移快照缺独立LICENSE；已在README记录来源和许可边界，没有补造版权归属，没有发布。
