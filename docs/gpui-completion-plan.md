# GPUI 功能对齐收尾计划

## 基线和目标

上游基线固定为 CotEditor `main` / `7.2.0-alpha`，提交 `0288c37ece7cc37c6f4c8d5ad4b4f5b6d9e320ed`。逐项依据 [`upstream-main-parity.md`](upstream-main-parity.md)、[`gpui-parity-matrix.md`](gpui-parity-matrix.md)、该提交的 storyboard、默认设置、快捷键表和源码。GPUI 预览版可按阶段发布，但只有所有可移植差异已实现、平台专属功能有经验证的替代方案或明确标为不支持，并完成三平台运行验收后，才可宣布功能对齐完成。

CotEditor 是 macOS 原生应用。“完全一致”不能仅靠同名菜单或三平台成功编译证明。Cocoa Services、拼写/语音、文件协调、打印、VoiceOver 等能力需采用各平台原生接口；无法提供等效能力时，应保留明确的平台差异及用户可见状态。

## 执行顺序

### 1. 菜单、动作和快捷键

- 补齐 File/Edit/Format/View/Text/Find/Window/Help/Script 的上游菜单入口、顺序、勾选/禁用状态，以及活动窗口切换时的状态刷新。
- 统一菜单、快捷键和上下文调用到同一 command handler；逐项对照 CotEditor `lib/shortcuts.json` 和 storyboard，记录 macOS Command 与 Windows/Linux Control 映射、焦点上下文、冲突及未实现项。
- 实现打开最近文稿清空、窗口/应用菜单、Prevent Editing 等可移植命令。
- 验收：每个菜单入口有动作或有明确 disabled/unsupported 理由；同一操作通过菜单和键盘得到相同结果；清空最近记录后，在其他窗口切换和重启时不复活。

### 2. 文本编辑和查找

- 完善 Undo/Redo 边界、行/词/列选择、多光标和 IME 行为。
- 增加缩进/反缩进、空格与 Tab 转换、注释、尾随空白清理、行移动/排序/去重/合并/复制/删除，以及 Unicode 编解码、规范化和字符检查。
- 查找支持正则、整词、选区范围、全部匹配选择/导航、高亮、多重替换和上游边界语义。
- 每条文本命令明确无选区/有选区行为、换行处理、Undo 分组、只读文稿可用性；采用 GPUI Editor 事务 API，避免整篇文本替换破坏选择、IME 或撤销历史。

### 3. 文稿、设置和窗口状态

- 将会话/文稿偏好迁移到有版本兼容的 schema；补充滚动位置、光标、编码/行尾/语法/缩进状态，并处理多窗口同时修改和损坏配置恢复。
- 建立 General、Appearance、Edit、Format、Window、Mode、Shortcuts、Snippets、Integration 设置入口；加入字体/主题、状态栏字段、用户快捷键的持久化和重置。
- 实现文件冲突竞态保护、非文本/错误编码边界、文件夹文稿/查找/预览、拖放、远程编辑、打印/导出。
- 验收：偏好重启与多窗口一致；损坏配置不丢弃用户文稿；大文件处理不阻塞窗口；所有覆盖/替换行为可恢复或有明确确认。

### 4. CotEditor 编辑器周边

- 迁移语法包和 Mode 子集、代码折叠、大纲/导航栏、补全、文稿/字符/警告 Inspector、片段/替换定义和工具栏/Quick Actions。
- 评估 Tree-sitter 与 CotEditor 解析器差异；自定义语法/脚本仅在格式兼容、权限和隔离设计完成后接入。
- 验收：20 种现有映射逐一对比 token/语言选择；错误或未知扩展名有稳定 fallback；大纲/Inspector 与活动文稿及焦点同步；导入格式验证失败时不给出部分损坏状态。

### 5. 平台交付与质量门槛

- macOS：应用菜单、Services、字体/拼写/语音、文件协调、打印、VoiceOver、签名/公证及安装/更新。
- Windows：窗口/菜单、文件关联、打印、系统辅助功能、安装/更新及签名。
- Linux：X11/Wayland、桌面文件关联、打印、AT-SPI、安装/更新。
- 自动化覆盖纯数据转换、命令规则、菜单状态、最近文稿多窗口一致性、序列化兼容、编码/行尾和文件系统错误；macOS/Windows/Linux 原生 runner 构建不替代实机交互验收。
- 发布前检查 clean diff 范围、格式、锁定构建、打包三平台归档；版本说明列出本批完成功能和所有尚未验收项。

## 本轮实施结果

- [x] **Open Recent > Clear Menu** 已完成：最近文稿列表在同一应用进程的所有窗口间共享；清空后更新全局菜单并立即保存会话。其他窗口激活/写会话不会把旧列表恢复。
- [x] **Format > Prevent Editing** 已完成首版：GPUI Editor 进入原生只读状态，保留焦点/选择/复制；替换入口禁用；状态按文稿会话保存。
- [x] 本轮构建、文档、提交与三平台预览发布完成。

| 领域 | 当前交付 | 剩余主要工作 |
|---|---|---|
| File | Open Recent > Clear Menu 已共享并持久化；Show in File Manager 与 Copy File Path 已接入 | Share、打印/页面设置及完整 Close 语义 |
| Format/View | Tab Width、Show Invisibles、Wrap Lines 和 Prevent Editing 已接入 Format 菜单并同步状态 | 字体/主题/页引导/纵排 |
| Text/Edit | GPUI 基础编辑和原生只读模式可用 | 选择、注释、行命令、Unicode 转换、Undo/Redo 边界及替换语义 |
| 查找/导航/检查器 | 文本查找/替换和转到行首版 | 正则/整词、多重替换、大纲/导航栏/检查器/分屏 |
| 设置/自定义 | 缩进默认偏好可持久化 | 设置窗口、主题/字体、Mode、用户快捷键、片段/语法包/脚本 |
| 文件夹/集成 | 最近文稿和单文稿工作流已接入 | 文件夹文稿与搜索、拖放规则、远程编辑、打印/导出及系统服务 |
| 平台/交付 | CI 三平台构建可通过 | 各系统实机交互、安装器、文件关联、签名/公证、自动更新及辅助技术验收 |
