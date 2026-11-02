# Design

Windows 的 junction 与目录符号链接都无法只用 `lstat` 识别：符号链接由 `isSymbolicLink()` 命中，junction 却返回普通目录。`readlink()` 对 junction 返回 `EINVAL`，只有 `realpath()` 会解析到目标。

判定逐组件执行：`lstat` 命中符号链接即视为链接；若组件是目录，再比较 `realpath(path)` 与 `resolve(path)`（win32 忽略大小写，其他平台逐字比较），不一致即视为链接。只在目录上调用 `realpath`，避免对普通文件增加无意义的解析；解析失败按“非链接”处理，由后续读取以原有错误路径暴露。

`realpath` 每次会打开目录句柄，同一前缀在逐个技能文件上会重复解析。判定结果因此在进程内用有界缓存复用（上限 4096 项，超出即清空）：缓存生命周期等于一次只读查询，不跨进程持久化。

两处 `noLinks` 只替换判定实现，保留原有诊断语义：provenance 计数 `skippedLinks` 并返回 false；证据读取抛出 `file.link`。判定放在独立模块，避免两份实现再次分叉。

不依赖 Node 未暴露的 reparse 标签，不依赖 `readlink`，不修改测试夹具的链接创建方式；POSIX 上 `realpath` 对普通目录返回同一路径，行为不变。

限制：以 8.3 短名传入的普通目录可能被误判为链接。该情况下选择保守拒绝，而不是读取可能错误的目标。
