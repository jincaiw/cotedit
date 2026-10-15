# CotEditor 当前上游对照基线

快照：CotEditor `main`，提交 [`0288c37ece7cc37c6f4c8d5ad4b4f5b6d9e320ed`](https://github.com/coteditor/CotEditor/commit/0288c37ece7cc37c6f4c8d5ad4b4f5b6d9e320ed)，Xcode 工程标记 `7.2.0-alpha`。本清单从该提交源码、`Main.storyboard`、`DefaultSettings.swift`、设置面板、帮助资源和上游 `KeyBindingManager` 核对；菜单快捷键记录表示 storyboard 默认值，不等于已经在所有硬件键盘上验证。稳定版 7.1.2 继续作为已发布版本参照。

GPUI 当前实际状态见 [功能对齐矩阵](gpui-parity-matrix.md)。本清单的“部分”仅表示存在可移植子集；没有写入 GPUI 矩阵为已实现的命令都仍属缺口。CotEditor 是 macOS 原生应用，Windows/Linux 目标需要逐项采用平台能力或明确记录不可移植差异，不能靠跨平台相同菜单名称推断一致。

## 上游主菜单逐项范围

| 菜单 | CotEditor 上游 7.2.0-alpha 的主要入口 | GPUI 当前对齐范围与缺口 |
|---|---|---|
| CotEditor | About、Donate、Settings (`⌘,`)、Services、Hide/Hide Others/Show All、Quit | About、Services、Hide/Hide Others、Quit；缺 Settings、Donate、Show All |
| File | New (`⌘N`)、New Window (`⇧⌘N`)、New Tab (`⌘T`)、Open (`⌘O`)、Open Recent/Clear Menu、Close (`⌘W`)、Save (`⌘S`)、Save As (`⇧⌘S`)、Revert to Saved、Show in Finder、Copy File Path、Share、Page Setup、Print | New/Open/Recent/Save/Save As/Revert/Close 已有子集；Show in File Manager 已接入（macOS/Windows 选择文件，Linux 打开所在目录），Copy File Path 复制完整路径到系统剪贴板；缺 Clear Recent、Share、页面设置和打印；Close/window/document 语义尚需逐项对齐 |
| Edit | Undo/Redo、Cut/Copy/Copy as Rich Text/Paste/Paste Exactly/Delete；Select All/Line/Word/Enclosing Symbols/Column Up/Down/Split Selection by Lines；Complete；Unicode 插入与设备连续互通；Spelling and Grammar；Substitutions；Speech | GPUI Editor 已提供 Undo/Redo/Cut/Copy/Paste/Select All；其余文本选择、列选、多光标、完成、Unicode 输入和设备入口缺失；拼写、替换、语音未移植到 GPUI |
| Format | Line Endings、Text Encoding、Syntax、Reset Syntax Analysis (`⌥⌘R`)、Font/Show Fonts/Font Type/字号/Antialias/Ligatures、Theme、Tab Width/Custom/Use Spaces、Show Invisibles/Indent Guides/Page Guide、Writing Direction、Wrap Lines、Prevent Editing | 行尾、编码、语法、重置语法、Tab Width、自定义宽度、空格缩进、不可见字符和软换行已有子集；字体、主题、显示引导线、页面参考线、方向、只读状态缺失 |
| View | Show Tab Bar (`⇧⌘T`)、Hide Toolbar (`⌥⌘T`)、Customize Toolbar、Quick Actions (`⌘K`)、Sidebar（File Browser、Folder Find、Show Sidebar）、Inspector（Document/Outline/Warnings/Show Inspector `⌘I`）、Navigation Bar、Line Numbers、Status Bar、分屏与编辑器焦点、全屏 (`⌃⌘F`) | 标签栏和行号已有；状态栏现可切换并按窗口记忆；缺工具栏定制、Quick Actions、侧栏/文件浏览/文件夹查找、检查器、导航栏、分屏/焦点路由和全屏 |
| Text | Insert Snippet/Edit Snippets；Comment（Toggle `⌘/`、Inline、Block、Uncomment）；Indentation（Shift Right/Left、转换空格/Tab）；Surround Selection；Trim Trailing Whitespace；Lines（Move、Sort/Pattern、Reverse、Shuffle、Deduplicate、Duplicate/Delete/Join）；Transformations；URL 编解码；Unicode Normalizations；Inspect Character；Advanced Character Count；Edit Color Code | 目前菜单只有 GPUI Indent/Outdent；其余逐项缺失，尤其行操作、注释、转换、Unicode 规范化和片段 |
| Find | Find (`⌘F`)、Next/Previous (`⌘G`/`⇧⌘G`)、Find All/Select All Matches、Use Selection (`⌘E`/`⇧⌘E`)、Jump to Selection、Replace/Replace and Find Next/Replace All/Multiple Replace、Highlight/Remove Highlights、Outline 导航、Go to Line (`⌘L`) | Find/Replace、Next/Previous、选区搜索/替换、Go to Line 已有首版；Find All、多重替换、跳选区、匹配高亮、Outline 导航及 regex/full-word/selection 范围语义缺失 |
| Window | Minimize (`⌘M`)、Zoom、Keep on Top、Bring All to Front、Console | Minimize/Zoom 已有；置顶、置前、Console 缺失 |
| Script | 系统枚举脚本并将命令发送给 CotEditor 文稿 | 未实现；需先定脚本权限、进程/文稿 API 和安全边界 |
| Help | CotEditor Help (`⌘?`)、Scripting Guide/AppleScript Dictionary、What’s New、Release Notes、Create Issue Report、Report Issue、Website | Help/Report Issue 已有；脚本/AppleScript 说明、新版与发行说明、诊断报告和项目主页缺失 |

## 桌面窗口与工作流差异

| 上游能力域 | 上游源码/界面证据 | GPUI 当前差异 |
|---|---|---|
| 文稿窗口 | `DocumentWindow`、文稿标签、可配置标签栏、多个编辑器分屏、窗口恢复和无文稿状态 | 已有窗口、多文稿标签和会话恢复；缺标签拖动/重排、分屏、完整启动/退出偏好和纯格式 dirty 状态 |
| 导航与辅助区域 | Navigation Bar、Outline、Document/Character/Warning Inspector、File Browser、Folder Find | 尚无侧栏、检查器、目录搜索和大纲导航 |
| 编辑表面 | 语法包、Tree-sitter 高亮、代码折叠、补全、多个插入点、注释、行编辑、Unicode 处理 | GPUI Editor、约 20 种语言映射和基础编辑；CotEditor 语法包、折叠/补全/多光标以及专属文本操作仍缺 |
| 设置与个性化 | General、Appearance、Edit、Format、Window、Mode、Shortcuts、Snippets、Integration 设置页；用户快捷键/主题/语法/替换导入导出 | GPUI 设置窗口和用户可编辑快捷键系统尚无；语法缩进默认偏好已持久化，但不等于完整 Mode 面板 |
| 文件生命周期 | 编码优先级、格式检测、行尾差异、文件夹文稿、预览、文件冲突、打印和恢复选项 | 基础编码/行尾/原子写入已有；文件夹、预览、批处理、Print、系统文件协调和跨平台元数据仍需移植与验收 |
| 外观与易用性 | 字体/主题、工具栏、快速操作栏、状态栏字段、焦点规则、菜单状态、原生窗口行为 | 当前界面为标签栏、编辑器、简化状态栏；缺完整配置、可发现性、焦点路径和平台专项 UI 验收 |
| 系统集成 | Services、Spell/Speech、分享、设备连续互通、文件关联、Sparkle 更新、VoiceOver、本地化 | macOS Services 菜单挂接；其他系统服务、安装/关联、更新、读屏及语言完整性尚未完成 |

## 快捷键核对说明

上游 storyboard 静态默认键位已按菜单树记录。GPUI 当前在 `install_commands` 中只注册一部分跨平台 Action；GPUI Kit Editor 自身键位不代表 CotEditor 默认键位一致。后续逐项比对必须记录动作、组合键、平台映射、焦点上下文和冲突处理，并确认菜单展示的键位实际可执行。尚未核验的上游键位不可据静态 storyboard 宣称行为一致；用户自定义键位设置目前也未实现。

## 目前可验证的新增对齐

- View > Show Status Bar 随窗口切换，复选状态即时同步，并写入会话；旧版会话缺少该字段时默认为显示。
- File > Show in File Manager 对已保存文稿调用平台文件管理器：macOS Finder 与 Windows Explorer 选择该文件，Linux 打开其父目录；未保存文稿时菜单禁用。
- File > Copy File Path 将活动已保存文稿的完整路径复制到系统剪贴板，并显示成功提示；未保存文稿时菜单禁用。
- 菜单基线快照：CotEditor `main` `0288c37`。每次更新上游比较时，应重新读取 `Main.storyboard`、快捷键和默认设置，再更新本页和 [功能对齐矩阵](gpui-parity-matrix.md)。
