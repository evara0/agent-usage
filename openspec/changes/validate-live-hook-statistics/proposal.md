# 真实 Hook 统计验证

## Why
离线 Hook 适配器已有合成测试，需要补充一次真实 Codex 命令 Hook 执行与原生生命周期通知的链路验证。

## What Changes
- 建立项目专属隔离测试目录，创建只写本地标记的 SessionStart Hook。
- 经用户在正常 Codex 流程审查信任后执行，不绕过信任。
- 捕获真实 hook/started、hook/completed，核对时间单位并导入现有 30 天统计。
- 记录 thread/start 与首次 turn/start 的触发差异和单次覆盖边界。

## Non-goals
不安装个人全局 Hook，不改变统计契约，不部署持续采集，不推送或归档。
