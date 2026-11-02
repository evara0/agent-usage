## ADDED Requirements

### Requirement: 链接与 junction 不得被跟随

项目 SHALL 将 Windows junction 与符号链接同等对待。任何受支持的读取路径，若其本身或任一路径组件是链接或 junction，MUST 被拒绝或计入 `skippedLinks`，不得读取或跟随目标。

#### Scenario: 显式根是 junction

- **WHEN** 显式技能根或其上级组件是 junction
- **THEN** 不读取目标目录中的技能，`inventory` 不包含它们
- **AND** `diagnostics.skippedLinks` 至少增加 1

#### Scenario: 文件路径的中间组件是 junction

- **WHEN** 配置、映射或证据文件路径的中间组件是 junction
- **THEN** provenance 将该路径标记为 `skipped_link`，证据读取以 `file.link` 失败
- **AND** 不返回目标文件内容

#### Scenario: 普通路径保持原行为

- **WHEN** 路径不含符号链接与 junction
- **THEN** 判定通过，读取与统计行为与修复前一致
