# GPUI 版本 CotEditor 功能对齐矩阵

基线：CotEditor 7.1.2 源码发布 tag；Rust UI 使用 gpui-kit 0.7.3；参考应用 BetterNotepad 1.3.1。此表记录迁移目标和本仓库 `app/` 当前状态。Electron 列只说明旧实现现状，不能作为 Rust 行为已验证的证据。

| 功能域 | CotEditor 7.1.2 核对入口 | CotEdit 1.0.7 历史实现记录（Electron 源码已移除） | GPUI 当前实现 | 平台/验收关注点 |
|---|---|---|---|---|
| 文稿窗口与标签 | `CotEditor/Sources/Document Window/`、`DocumentWindow.swift`、`Main.storyboard` | 多窗口、标签、保存/恢复与重开流程 | 独立窗口、多标签；按窗口保存最近文稿、恢复已保存文稿和未保存文本快照，并恢复光标行列；标签栏可横向滚动并逐标签关闭；Window > Close Window 可走窗口关闭确认流程 | 纯格式未保存状态、滚动位置和实时光标移动持久化、应用级退出确认、标签重排及逐平台窗口生命周期仍缺/待验收 |
| 新建、打开、保存 | `Document.swift`、`DocumentViewController.swift`、File 菜单 | 文稿读写、原子保存、另存为、远程文件流程 | 原生文件选择器；多编码和行尾首版、跨平台原子保存、SHA-256 外部修改提示；File > Revert to Saved 可重载磁盘版本，未保存时确认丢弃 | 非文本文件判断待实现；保存检查与替换之间有并发竞态，平台 ACL/扩展元数据保留需验收 |
| 编码与换行符 | `Packages/EditorCore/Sources/DocumentFile/`、Format 菜单、检查器 | 多编码、BOM、六种行尾、混合行尾统计/保留 | BOM 优先、严格 UTF-8 / chardetng 常见编码识别；支持 UTF-8/UTF-16LE/BE、Windows-1252、Shift_JIS、GBK、Big5 的显式选择和无损编码检查；识别六类行尾，基于行文本差异保留未改行的原行尾，Format 菜单可统一且勾选当前编码/默认行尾 | 还需错误编码/二进制文稿处理、不同 charset 检测边界和大文稿压力验收；已修改行使用当前默认行尾，行差异映射不是 CotEditor 的增量行尾缓存算法 |
| 编辑器与语法 | `EditorTextViewController.swift`、`ModeOptions.swift`、`Resources/Syntaxes/` | CodeMirror 6、72 个内置语法及 `.cotsyntax` 子集 | GPUI Editor；20 种 Tree-sitter 语言映射；行号、不可见空白、软换行可切换 | Tree-sitter token/编辑语义、字体与语法范围对齐；折叠、大纲、补全及大文稿/IMEs待验收 |
| Undo、文本编辑与多光标 | `Packages/EditorCore/Sources/TextEditing/`、Edit/Text 菜单 | 常用命令、批量替换、选区与多光标 | 编辑器内置基本 Undo/Redo、剪贴板、全选 | 命令覆盖、撤销边界、选区、IME 和多个光标需逐项核对 |
| 查找/替换与正则 | `Packages/EditorCore/Sources/TextFind/`、Find 菜单 | 查找、替换、多重替换及 ICU 子集 | GPUI Kit 搜索面板支持文本查找、大小写敏感切换、替换当前命中、全部替换及行号跳转；`secondary-L` 打开行号对话框 | 正则/整词/选区范围搜索、ICU 语义、命中导航和其他搜索快捷键待核对 |
| 菜单/命令/快捷键 | `CotEditor/Storyboards/Base.lproj/Main.storyboard`、`KeyBindingManager.swift` | 菜单、共享快捷键表、用户自定义和三平台映射 | File/Edit/Format/View/Text/Find/Window/Help 与 About/Quit 菜单首版；macOS 应用名显示为 CotEdit，应用菜单含 Services、Hide/Hide Others/Show CotEdit；File > Open Recent 与 Revert to Saved；Format 菜单按 CotEditor 顺序列出 Line Endings、Text Encoding、Syntax 与 Reset Syntax Analysis；Format > Syntax 可手动选择并标记当前语法；Help 可打开 README 和问题反馈；New/新窗口/新标签、Close Window、查找前后项、将选区用于查找/替换（Cmd+E / Cmd+Shift+E）、行号跳转、标签切换、缩放/最小化快捷键；View 勾选态随活动窗口更新 | 未实现完整菜单、设置和快捷键配置页及全平台实体键盘验收；Services 仅由 macOS 系统提供，Windows/Linux 上 GPUI 系统菜单支持待核验 |
| 格式与缩进 | `ModeSettingsView.swift`、Format/View 菜单、`DefaultSettings.swift` | 按语法缩进、Tab、行操作及文本转换 | Format > Syntax 可手动选择 Plain Text 与 16 种 Tree-sitter 语法、重置语法分析并勾选当前语言；View > Tab Width 支持 2/4/8 与自定义 1–99 列，并可切换空格缩进，选项按文稿会话恢复；变更时同步保存当前语法模式默认值，新建文稿和切换语法时应用对应默认值；Text 菜单接入 Indent/Outdent | 手动语法选择持久化、缩进检测、注释、行操作、转换、排序待实现 |
| 查找导航/大纲/导航栏 | `NavigationBar.swift`、`OutlineNavigator.swift`、Find/View 菜单 | 大纲提取、导航栏和转到行 | 未实现 | 语法 outline 与键盘选择、文稿/位置焦点同步 |
| 分屏与辅助面板 | `ContentViewController.swift`、Inspector 源码 | 编辑器分屏、文稿/Unicode/警告 Inspector | 未实现 | 可调整分隔线、辅助面板焦点与尺寸记忆 |
| 外观、主题、字体与缩放 | `Settings Window/Panes/AppearanceSettingsView.swift`、`ThemeView.swift`、`FontPicker.swift` | 14 个上游主题及自定义主题编辑、字体设置 | 使用 GPUI Kit 当前主题默认值 | CotEditor 主题导入、颜色 token、字号/行高、浅暗外观和 rem 缩放待迁移 |
| 设置、Mode 与快捷键设置页 | `Settings Window/Panes/`、Settings storyboard | 编辑/外观/格式/窗口/Mode/快捷键/片段等设置 | 未实现 | 持久化 schema、默认值、导入导出、重置及多窗口更新 |
| 片段、替换、语法包和脚本 | `SnippetManager.swift`、`ReplacementManager.swift`、`SyntaxManager.swift`、`ScriptManager.swift` | 片段、替换定义、语法包子集、脚本命令 | 未实现 | 不执行未经审查的脚本；格式/兼容性、安全边界和导入验证 |
| 文件夹浏览/拖放/远程编辑 | `DirectoryDocument.swift`、File Drop/Remote 源码 | 文件夹浏览搜索、受限预览、拖放模板、rmate | 未实现 | 根目录 containment、符号链接、防 TOCTOU、IPC/网络边界 |
| 字符、编码与文稿检查器 | `DocumentInspectorView.swift`、`WarningInspectorView.swift` | 统计、文件元数据、Unicode 摘要、编码警告 | 仅行/列状态文本 | 大文稿异步统计、陈旧结果抛弃、平台文件元数据 |
| 打印/导出/服务 | `DocumentViewController.swift`、Print 菜单、Services | HTML 打印、PDF 等导出、外部服务近似 | 未实现 | GPUI/操作系统打印后端、字体、页边距及各平台真实验收 |
| 拼写、替换、语音和连续互通 | `Main.storyboard`、Mode/文本系统设置、Edit 菜单 | Chromium 字典/语音及固定文本替换近似 | 未实现 | Cocoa 服务只在 macOS 可能直接接入；Windows/Linux 应使用真实 OS 能力或标明不支持 |
| 可访问性与本地化 | CotEditor SwiftUI/AppKit 全部视图与本地化资源 | Electron 辅助技术和简体中文仍有差距 | 使用 GPUI Kit 语义控件和英文初始 copy | VoiceOver、NVDA、Orca、读屏器、焦点顺序、动态播报及中英长度验收 |
| 安装、文件关联和更新 | Xcode 工程、Info plist、发行配置 | electron-builder 三平台安装包 | 独立 GPUI 构建与 `gpui-v*` 归档工作流可生成 macOS `.app` ZIP、Windows ZIP、Linux tar.gz；尚无正式安装器、文件关联、签名/公证或自动更新 | Windows/Linux/macOS 原生安装、关联、签名/公证和更新渠道 |

## 首个 GPUI 增量明细

| 命令/状态 | 实现方式 | 状态 |
|---|---|---|
| 新建标签、切换标签和窗口 | GPUI `CotEdit` 实体拥有多个 `EditorState`；New Window 创建独立工作区 | 已接入，需多窗口实机验收；标签行可滚动并含独立关闭按钮；Window > Close Window、Cmd/Ctrl+Shift+W 使用窗口脏文稿确认流程 |
| 打开 | GPUI 原生文件选择器；chardetng/encoding_rs 解码、六类行尾归一化和格式快照 | 已实现首版，自动检测为启发式，支持格式菜单覆盖 |
| 保存/另存为 | GPUI 保存路径提示；目标编码往返检查、BOM、逐行行尾写回、同目录原子替换和目标文件冲突确认 | 已实现首版；提交竞态和平台元数据待验收 |
| 最近文稿/会话 | GPUI 配置目录 JSON；File > Open Recent 菜单动态列出最近文稿，按窗口恢复 | 已实现首版；未保存文本以 500ms 延迟写入/恢复，并保存光标行列；会话 v3 保存每篇文稿缩进与每种语法的默认缩进；滚动位置、实时光标移动及其他格式选项尚未持久化 |
| 编辑/查找 | GPUI Kit Editor、Tree-sitter 语言映射、内置 Undo/Redo、文本查找/替换和搜索面板 | 已接入基础能力；替换可按当前命中或全部执行，CotEditor 搜索语义未核对 |
| File/Edit/Find/Text/View/Window 菜单 | `Menu` + `Action`，先绑定 keymap 再注册菜单 | 已接入可用子集；File > Open Recent 按当前文稿历史动态构建；macOS 应用菜单包含 Services、Hide、Hide Others、Show CotEdit；有查找前/后项、About、Window Minimize/Zoom；View 勾选态跟随活动窗口；Tab Width 提供 2/4/8 列、自定义 1–99 列和 Use Spaces for Indentation，Custom 对话框校验范围；状态随活动文稿更新 |
| 快捷键 | `secondary-*` 映射 Command/Control；新建文稿 Cmd+N、新窗口 Cmd+Shift+N、新标签 Cmd+T；查找前/后项 Cmd+G / Cmd+Shift+G；重置语法分析 Cmd+R；使用选区查找/替换 Cmd+E / Cmd+Shift+E；标签切换 Cmd+Shift+[ / ] 并保留 Ctrl+Tab | 已配置；菜单中快捷键显示已在 macOS 实机核验，实体键盘操作和 Windows/Linux 映射待验收 |
| Dirty 状态 | 保存快照与当前文本/格式比较，显示标签/窗口编辑状态 | 已实现；关闭未保存标签或窗口会先确认丢弃 |
| 状态栏 | 活动文稿、编码、默认/混合行尾和光标位置 | 已实现基本显示；与 CotEditor 的选择器和编码警告入口尚有差异 |

## 决策记录

- 当前阶段以 GPUI Kit `EditorState` 为编辑器模型，避免自己重做焦点、文本输入、选择、Undo/Redo、搜索与语法高亮等基础编辑行为。
- 当前文件读写使用 `encoding_rs` / `chardetng`，支持 UTF-8、UTF-16LE/BE 与四种常用单字节/东亚编码；自动检测是启发式且只把识别映射到这些受支持编码。未识别 charset 会按 Windows-1252 解码，存在误判风险；无法无损编码时拒绝保存。
- 六种换行符均归一化为编辑器 LF 并记录元数据；保存时用行级 diff 把未改行的换行符映射回原值，新增/修改行使用 Format 菜单选定的默认行尾。该策略不是 CotEditor 的编辑事务级行尾跟踪，文件完全重排或重复行可能产生不同映射。
- 保存通过 `atomic-write-file` 在目标目录写入并提交临时文件；若原路径是符号链接，会先解析到目标文件再替换。保存前使用 SHA-256 对比磁盘内容，外部修改、删除或另存为目标已存在时先确认覆盖。校验与提交之间仍有并发竞态；原子写入未做三平台运行时验收，Windows ACL/扩展元数据保留仍需确认。
- `app/` 是当前唯一应用实现；Cargo lock 固定 GPUI crate 依赖。
- 历史 CotEdit 1.0.7 记录只供迁移时检查旧版功能范围；旧 Electron 源码和运行依赖已删除，不是 GPUI 行为或验收证据。
