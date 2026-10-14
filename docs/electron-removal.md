# Electron 移除与 GPUI 独立切换

CotEdit 仓库现以 `app/` 下的 Rust + GPUI Kit 应用作为唯一应用实现。Electron 主进程、预加载脚本、CodeMirror 页面、Node/npm 清单、Electron 专属脚本和测试已从当前源码树移除。旧 CotEdit `v1.0.7` 发布资产仍留在 GitHub Release；Git 提交历史保留此前源码。

## 切换后状态

移除 Electron 不等于已把 Electron 版的全部功能迁入 GPUI。GPUI 当前可独立构建，提供基础文稿、标签/窗口、编码和行尾处理、文件保存、Tree-sitter 高亮、查找/替换及首批菜单；文件夹浏览、丰富的设置和主题、全部文本命令、检查器、打印、脚本、辅助功能等范围仍按 [功能矩阵](gpui-parity-matrix.md) 标记。CotEditor 对照项目以 7.1.2 源码、storyboard、默认设置和帮助为准。

`docs/compatibility.md`、`docs/menu-parity.md`、`docs/parity-plan.md` 和 `docs/mode-options-parity.md` 保存旧 Electron 版本的历史实现证据，供迁移时提取需求；其中 Electron/CodeMirror 描述不构成 GPUI 功能或验证结论。

## 发行边界

GPUI 原生 runner 已构建并上传 CI 归档。新的发行工作流只接受 `gpui-v*` 标签，避免将旧 Electron `v*` 发布版本覆盖；制作完整安装器、文件关联、签名/公证、自动更新，以及 macOS/Windows/Linux 实机交互验收后，再建立正式 GPUI 版本。
