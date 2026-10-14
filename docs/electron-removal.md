# Electron 移除与 GPUI 独立切换

CotEdit 仓库现以 `app/` 下的 Rust + GPUI Kit 应用作为唯一应用实现。Electron 主进程、预加载脚本、CodeMirror 页面、Node/npm 清单、Electron 专属脚本和测试已从当前源码树移除。旧 CotEdit `v1.0.7` 发布资产仍留在 GitHub Release；Git 提交历史保留此前源码。

## 切换后状态

移除 Electron 不等于已把 Electron 版的全部功能迁入 GPUI。GPUI 当前可独立构建，提供基础文稿、标签/窗口、编码和行尾处理、文件保存、Tree-sitter 高亮、查找/替换及首批菜单；文件夹浏览、丰富的设置和主题、全部文本命令、检查器、打印、脚本、辅助功能等范围仍按 [功能矩阵](gpui-parity-matrix.md) 标记。CotEditor 对照项目以 7.1.2 源码、storyboard、默认设置和帮助为准。

`docs/compatibility.md`、`docs/menu-parity.md`、`docs/parity-plan.md` 和 `docs/mode-options-parity.md` 保存旧 Electron 版本的历史实现证据，供迁移时提取需求；其中 Electron/CodeMirror 描述不构成 GPUI 功能或验证结论。

## 发行边界

GitHub Actions 运行 `38578139931` 已在 macOS、Windows、Linux 原生 runner 完成 release 构建并上传二进制；手动分发归档运行 `38578203180` 的 macOS `.app` ZIP、Windows ZIP、Linux tar.gz 均已构建并下载核对。macOS `Info.plist` lint 通过；Windows/Linux 桌面启动和安装流程未验收。此次是 `workflow_dispatch`，发布 job 被跳过，没有创建 GPUI Release。
