# Verification — 2026-10-21

## 基线与范围

研究提交 a13ae7b523eba2cb0784bb23d4e6d6e4fc14cb51 保留，未修改原研究报告。实施从其上继续，分支 codex/skill-provenance，独立 worktree 的共同基线为 7b1891e6fecaaa186c9918c25a641455aec560aa。用户后续明确授权创建 OpenSpec 并实施最小版本；新增 change 保留为活动状态，已同步独立 capability 主规范。

未合并 Hooks 分支，未改原 main checkout、真实日志、全局 Skill、hook、安装记录或秘密配置。没有新增依赖或改锁文件；仅从已有缓存离线安装锁定依赖。实现模块没有网络、Git 子进程或写入来源文件的代码。

## 顺序验证结果

环境：Windows，Node.js v22.22.2。下列检查均在本 worktree 顺序执行：

| 检查 | 结果 |
| --- | --- |
| pnpm install --offline --frozen-lockfile | 成功，54 个包复用缓存，下载 0；未改锁文件 |
| pnpm run test | 140/140 通过，包含原 112 项、新来源 28 项及 TypeScript 类型负例编译 |
| pnpm run typecheck | 通过 |
| pnpm run test:cli | tsdown 构建通过；57/57 通过，包含原 44 项及新来源 CLI 13 项 |
| openspec validate add-skill-provenance-statistics --strict --no-interactive | 通过 |
| openspec validate --all --strict --no-interactive | 7/7 通过 |
| openspec validate --archived --strict --no-interactive | 5/5 通过；未执行归档 |
| UTF-8、文档本地链接、git diff --check / --cached --check | 通过 |

普通沙盒最初无法访问 Corepack 缓存，离线安装在获得沙盒权限后成功；测试使用所需相同进程权限。没有更换依赖版本、联网获取包或绕过校验。OpenSpec 检查设置 OPENSPEC_TELEMETRY=0。

## 合成覆盖

- 发行方与原作者分开；文件 E3 与用户 U，作者缺失、多人数组、多值、许可范围和 conflict。
- .system/官方风格名称/OpenAI 清单自声明不会自动认证；公开仓库和携带凭据的 repository 不出现在来源输出。
- standalone 同名、完整插件命名空间、聚合别名跨身份/部分未知、旧版本后缀和多个注册版本，不静默按短名称选择。
- 映射未知键、错误类型/枚举、重复 selector/作者/别名、长度/项数边界与不支持的文件输入；错误泛化并在日志扫描前退出，不写目标报告。
- portable 与兼容清单优先级、自定义路径拒绝、复杂/重复/引号别名 YAML 键、非字符串 YAML 标量、无效 UTF-8、超限文件和目录截断。
- Windows junction 与显式链接根拒绝跟随；源文件字节与目录清单前后不变；新增资料不输出绝对路径、邮箱、URL 或不安全原始别名。
- 历史合成调用保持旧计数与时间，新来源仅 current_reference_only；registered 身份不声称已安装。
- 默认 Skill JSON 键集不变，MCP/Markdown/既有计数回归通过；新增 JSON/Markdown 完整，表格 limit 生效；中文目录和中文作者直接写无 BOM UTF-8 文件，stdout 为空。

## 覆盖限制与后续集成

只覆盖所支持的简单 YAML、standalone 根和一个显式插件版本根；没有全量真实 Skill 或所有宿主版本兼容认证。只有 E3/U 声明，无 E1 安装认证、E2 上游固定版本内容核对、历史快照或按作者重分配调用次数。版本身份来自清单声明，观察 ID 仅在当前显式根内有效，不能跨根作为全局稳定身份。

链接检查针对静态观察，不防御并发恶意文件替换；本版本不采集仓库 URL、维护者角色或上游关系链。原有 JSON 的 projects 等私人信息仍需分享前审查，来源模块的局部限制不等于整个报告已经脱敏。

本分支修改 CLI、package.json 测试脚本、README、MAINTENANCE、contracts 与 Markdown 接线；总控集成 Hooks 分支时需要合并这些公共文件，并同时保留全部测试入口。构建产物未提交。未推送、发布、合并 main、归档或删除 worktree。
