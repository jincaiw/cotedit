# CotEdit

CotEdit 是一个使用 Rust、GPUI 和 GPUI Kit 构建的跨平台文本编辑器，当前功能对照基线为 CotEditor `main` 分支提交 [`0288c37`](https://github.com/coteditor/CotEditor/commit/0288c37ece7cc37c6f4c8d5ad4b4f5b6d9e320ed)（`7.2.0-alpha`）。逐域对照源码、菜单、默认设置和帮助，并记录 macOS、Windows、Linux 的平台差异与验收状态。

## 当前状态

仓库当前只包含 GPUI 应用；Electron、CodeMirror、Node.js 应用入口及 Electron 发行依赖已从源码树移除。旧版 CotEdit 1.0.7 的 Electron 实现曾包含更多编辑器功能，其功能记录保留在 [历史兼容性文档](docs/compatibility.md) 和 [历史菜单清单](docs/menu-parity.md)，供 GPUI 迁移核对。旧版已发布的二进制不受仓库源码删除影响。

GPUI 版本仍在迁移中，尚未与 CotEditor 完全对齐，也未完成三平台窗口与实体键盘验收。当前实现范围、平台记录及未完成项见 [GPUI 对齐矩阵](docs/gpui-parity-matrix.md) 和 [迁移计划](docs/gpui-migration-plan.md)。本项目不会把“同名菜单”或“三平台编译成功”描述为完整功能一致。

## 构建与运行

需要 Rust stable 和 GPUI Kit 当前平台所需的原生开发库。

```sh
cargo run --locked
```

检查构建：

```sh
cargo check --locked
cargo build --release --locked
```

GitHub Actions 在 macOS、Windows 和 Linux 原生 runner 上构建 GPUI，并为版本标签生成平台分发归档。归档目前不是带安装器、文件关联、签名或自动更新的正式安装包；这些交付能力和实机验收仍在矩阵中追踪。

## CotEditor 对照

- [GPUI 功能对齐矩阵](docs/gpui-parity-matrix.md)：逐域记录实现、缺项与验收状态。
- [CotEditor 当前上游完整比较清单](docs/upstream-main-parity.md)：按当前 `main` 菜单、快捷键、窗口工作流和设置/集成功能核对差异。
- [GPUI 功能对齐收尾计划](docs/gpui-completion-plan.md)：剩余功能的依赖顺序、验收条件和三平台交付门槛。
- [GPUI 迁移计划](docs/gpui-migration-plan.md)：剩余工作与发布门槛。
- [历史兼容性记录](docs/compatibility.md)：旧版 Electron 对齐工作的参考资料，不代表当前 GPUI 实现。
- [历史菜单清单](docs/menu-parity.md)：旧版菜单核对资料，GPUI 状态以当前对齐矩阵为准。
- [Electron 移除记录](docs/electron-removal.md)：本次切换范围与旧版发行信息。

上游对照基线：CotEditor `main` 分支 `7.2.0-alpha`，快照提交 `0288c37ece7cc37c6f4c8d5ad4b4f5b6d9e320ed`。
