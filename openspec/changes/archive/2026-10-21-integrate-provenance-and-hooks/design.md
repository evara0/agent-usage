# 集成设计

## Context
主线共同基线为 7b1891e6fecaaa186c9918c25a641455aec560aa。来源分支为 codex/skill-provenance，包含调研与实施；Hooks 分支为 codex/hooks-statistics，另有总控完成的真实验证文档待提交。

## Decisions
先审查并复跑各分支已有检查。主线先快进来源分支，再合并 Hooks 分支，保留历史。共同文件包括 src/index.ts、package.json、README.md、MAINTENANCE.md，冲突按最终功能组合解决。来源增强只适用于 Skills，与 MCP/Hooks 互斥；所有来源专用参数要求 --provenance，在任何输入读取前拒绝非法组合。

保持默认 Skill JSON 键、source=codex、旧计数和 Markdown/JSON UTF-8 导出。来源仍为当前文件或用户声明，不认证官方或历史归属。Hooks 仅消费显式声明时间单位的离线通知，不安装生产者。

## Validation
使用正式 test、typecheck、test:cli 入口，保留来源和 Hooks 全部测试；补充跨功能互斥和异常参数不读取映射、不写输出的回归。重放已有真实 Hook 导入，不再次触发模型或 Hook。OpenSpec 校验涵盖所有活动变更、正式规范及已有归档；核对 Git 忽略规则，原始通知、认证及个人映射不提交。
