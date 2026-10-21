# Node 版本要求修复验证

日期：2026-10-21。环境：Windows / Node.js v22.22.2。

## 变更核对

- package.json 的 engines.node 为 ^22.18.0 || >=24.11.0；tsdown target 为 node22.18。
- README 与维护卡使用相同范围，注明实际验证环境及其他版本未实测。
- 锁定 gunshi 要求 >=22，tsdown 要求 ^22.18.0 || >=24.0.0，Babel 8 RC 依赖要求 ^22.18.0 || >=24.11.0；项目声明采用这些约束的交集。
- 当前四个配置/说明文件中旧 Node 20 声明已移除。没有修改依赖版本、锁文件、统计逻辑或历史归档。

## 检查结果

| 检查 | 结果 |
| --- | --- |
| node node_modules/typescript/bin/tsc --noEmit | 通过 |
| node node_modules/typescript/bin/tsc -p tsconfig.test.json | 通过 |
| node --test（package.json test 中的全部 8 个模块文件） | 151 passed，0 failed |
| node node_modules/tsdown/dist/run.mjs | 通过；输出确认 target=node22.18 |
| node --test（package.json test:cli 中的全部 5 个 CLI 文件） | 65 passed，0 failed |
| openspec validate --all --strict --no-interactive | 9 passed，0 failed |
| openspec validate --archived --strict --no-interactive | 9 passed，0 failed |
| git diff --check | 通过 |

pnpm 启动时 Corepack 尝试从 npm registry 获取包管理器，在当前受限网络下失败，故直接调用已安装的 tsc、tsdown 与 Node 测试运行器，执行与项目脚本等价的检查；未安装或升级包。模块回归在沙盒内首次为 150/151，通过日志确认唯一失败是现有 junction 测试创建临时链接时遭 EPERM；在沙盒外重跑全部模块后为 151/151。没有修改或跳过测试。

日志保存在忽略目录 .local/node-version-unit.log 与 .local/node-version-cli.log。未验证全新安装、Node 22.18.0 本身、Node 24 分支或 POSIX；版本范围基于锁定依赖要求，不代表这些环境全部经过运行验证。实现完成时保持活动状态；2026-10-21 按用户明确授权归档，并同步正式规范及维护卡链接。
