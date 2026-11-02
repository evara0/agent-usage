## 1. 修复
- [x] 1.1 新增共享链接判定，覆盖符号链接与 Windows junction
- [x] 1.2 provenance 与证据读取改用共享判定，保留 skippedLinks / file.link 语义
- [x] 1.3 增加 junction 作为中间路径组件的回归用例

## 2. 验证
- [x] 2.1 模块测试 112 项通过，并在 Node 22.22.1 复核该用例
- [x] 2.2 类型检查、构建与样本重放
- [x] 2.3 端到端核对 junction 显式根与普通路径
- [x] 2.4 OpenSpec 严格校验与差异检查
