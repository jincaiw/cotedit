# GPUI 原生 CotEdit 迁移与对齐计划

## 目标与边界

以 CotEditor `main` 分支当前源码快照（提交 `0288c37ece7cc37c6f4c8d5ad4b4f5b6d9e320ed`，`7.2.0-alpha`）、菜单 storyboard、默认设置和帮助文档为功能基线；同时保留 CotEditor 7.1.2 稳定版作为发布版参照；以 `longbridge/gpui-kit` 的 GPUI Kit 0.7.x 为跨平台桌面 UI 技术栈。

本仓库现以 `app/` 下 GPUI 应用作为唯一应用实现；Electron/CodeMirror 运行时代码、Node/npm 依赖与旧发布入口已删除，历史对齐记录仅供提取需求。CotEditor 上游源码、storyboard、默认设置和帮助仍是功能基线。逐项移植并进行平台验收的工作继续开放；功能差异与“完全一致”验收条件见矩阵，编译成功不代表界面或行为完全一致。

## 检查结论

- CotEditor 当前 `main` 快照为 `7.2.0-alpha`，提交 `0288c37ece7cc37c6f4c8d5ad4b4f5b6d9e320ed`；稳定版参照为 7.1.2。当前上游 `main` 提供 Swift/Cocoa 原生文本编辑器、设置、检查器、脚本、语法/主题/片段管理、文件夹查找及原生平台服务。
- 旧 Electron 1.0.7 的功能与测试记录保留于历史文档和 GitHub Release；Electron/CodeMirror 源码及 npm 发行依赖已从当前分支移除。
- BetterNotepad 是 macOS Rust/GPUI Kit 应用，提供了可核对的 GPUI 文稿/标签、文件菜单、会话恢复、编辑器、状态栏和主题实例。它不是 CotEditor 的完整功能替代，也未作为跨平台实现的验收依据。
- GPUI Kit 提供原生 GPUI `Editor` / `Textarea`、Action/key binding、菜单、Root、对话框、主题和窗口能力；逐功能迁移仍需建立文稿模型、编码/行尾、语法配置、设置持久化与平台适配。
- 工作树起始状态为 `master`，已有 `.agents/`、`.claude/`、`.tmp/` 与 `skills-lock.json` 未跟踪内容；迁移实施需保留这些既有文件，不清理或重写。

## 当前审查结果与实施顺序

审查快照：CotEditor `main` / `7.2.0-alpha` 提交 `0288c37ece7cc37c6f4c8d5ad4b4f5b6d9e320ed`，GPUI Kit 0.7.3；稳定发布参照 CotEditor 7.1.2。GitHub CotEdit 最新 GPUI prerelease 为 `gpui-v0.1.14-preview.1`；Electron 正式版 `v1.0.7` 仅是历史发布。当前工作树保留 `.agents/`、`.claude/`、`.tmp/` 与 `skills-lock.json` 未跟踪内容。

| 阶段 | 目标 | 关键实现范围 | 完成/验收条件 |
|---|---|---|---|
| A. 桌面壳层与命令 | 优先让窗口、菜单和键盘行为形成一致工作流 | macOS 应用菜单与 Services；File > Open Recent；File/Edit/Format/View/Text/Find/Window/Help 菜单；活动窗口勾选/禁用状态；可复用命令层；标签、状态栏、查找焦点与常用键位 | 逐项对应 storyboard 静态菜单及 `lib/shortcuts.json` 的跨平台映射；macOS/Windows/Linux 菜单和物理键盘记录分别验收 |
| B. 文本编辑核心 | 补齐 CotEditor 高频文本命令 | 查找选项与命中导航、选择行/词、多光标、缩进配置、注释/行操作、Unicode 转换、剪贴板、撤销边界 | 每个命令明确选区、无选区、Undo 和菜单可用状态；没有对应 GPUI 能力时补 command handler。缩进转换、尾随空白清理、行复制/删除/移动/反转/去重/合并已接入，其他行处理仍待完成 |
| C. 文稿与偏好 | 对齐文件生命周期和可配置行为 | 格式状态恢复、滚动/光标状态、自动保存恢复、Mode/缩进、编码与换行边界、字体/主题/设置页 | 持久化兼容、损坏文件恢复、大文稿性能与覆盖保护检查 |
| D. CotEditor 专属能力 | 逐域迁移编辑器之外的工作流 | 大纲/折叠/补全、Inspector、文件夹浏览、片段/替换/语法包、打印/导出、辅助功能 | 每域有明确平台替代方案或被矩阵记录为未支持；检查文件系统边界和权限 |
| E. 三平台交付 | 让 GPUI 成为可下载、可安装、可更新的独立发行物 | macOS/Windows/Linux 构建矩阵、依赖安装、应用图标/文件关联、版本号、签名/公证和 GitHub Release | 原生 runner 构建及独立 GPUI 分发归档工作流已配置；仍缺完整安装器、文件关联、签名/公证、自动更新和运行验收；旧 Electron `v1.0.7` 资产保留在既有 GitHub Release |

**当前优先批次：**继续按 CotEditor 上游源代码和历史兼容性记录补齐 GPUI 菜单、编辑命令、设置与检查器；每批记录实际平台结果，构建工作流验证三平台编译，安装/发行流程单独验收。Electron 源码已移除；历史 `v1.0.7` 资产仍可下载，GPUI 正式版本须等功能矩阵与平台发布门槛完成后再发布。

## 目标架构

```text
app/
├── Cargo.toml
└── src/
    ├── main.rs              # GPUI 初始化、窗口和应用 Actions
    ├── document.rs          # 文稿内容、路径、编码/行尾和 dirty 状态
    ├── workspace.rs         # 标签、焦点、窗口工作流
    ├── commands.rs          # File/Edit/Format/View/Text/Find/Window 命令
    ├── settings.rs          # 设置 schema、默认值与持久化
    ├── syntax.rs            # CotEditor syntax/Mode 可移植子集
    └── platform/            # 文件系统、字体、拼写、菜单、打印等平台能力
```

GPUI Kit 负责通用控件、编辑行为、菜单/焦点/对话框和主题系统；CotEdit 功能 crate 负责文本编辑器语义、文稿生命周期、命令策略和兼容性。平台适配集中在窄接口中，不把 Cocoa 行为伪装成所有系统都支持。

## 迁移阶段

### P0：基线、功能矩阵与项目骨架

- [x] 核实当前 CotEditor `main` (`7.2.0-alpha`) 提交 `0288c37ece7cc37c6f4c8d5ad4b4f5b6d9e320ed`、稳定版 CotEditor 7.1.2、GPUI Kit API 和当前 CotEdit 工作树。
- [x] Electron/CodeMirror 源码、Node/npm 依赖和旧发行工作流已从当前分支删除；历史对齐文档及 `v1.0.7` 已发布资产保留为迁移证据。
- [x] GPUI 已是唯一应用入口；三平台原生构建和 `gpui-v*` 分发归档工作流已建立。
- [x] GPUI 功能矩阵逐域记录实现状态、差异和平台验收，见 [`docs/gpui-parity-matrix.md`](gpui-parity-matrix.md)。
- [x] 从当前 CotEditor `main` storyboard 提取应用菜单及 File/Edit/Format/View/Text/Find/Window/Script/Help 子菜单层级并逐域登记缺口，见 [`docs/upstream-main-parity.md`](upstream-main-parity.md)。
- [ ] 逐项核对动态启用条件、状态变化、快捷键注册与键盘焦点；静态 storyboard 不作为运行行为验收。

### P1：编辑器和文稿核心

- [x] 单窗口多文稿标签、独立窗口、标签/窗口关闭确认首版；会话按窗口保存并恢复已保存文稿。
- [x] 未保存文本缓冲区按窗口延迟写入和恢复，并保存文稿光标行列；会话 v4 保存文稿缩进、语法模式默认缩进偏好、每窗口状态栏可见性和每篇文稿只读状态；滚动位置、实时光标移动及其他格式状态持久化仍缺。
- [x] 跨平台原子保存和保存前外部修改确认首版。
- [ ] 三平台窗口运行时验收及检查—提交并发竞态处理。
- [x] 最近文稿列表与按窗口会话恢复；未保存文本按窗口延迟写入/恢复并记住光标行列；会话 v4 保存文稿缩进、语法模式默认值和窗口状态栏可见性；滚动位置、实时光标移动和其他格式状态仍缺。
- [x] 编码检测/选择、BOM、混合及六类换行符、往返无损保存与不兼容字符告警（首版支持 UTF-8/UTF-16LE/BE、Windows-1252、Shift_JIS、GBK、Big5；自动检测和行差异映射仍需边界验收）。
- [ ] Undo/Redo、多光标、缩进/注释/行操作、Unicode 转换及命令边界核对。
- [x] GPUI Kit 文本查找、单处/全部替换与转到行（secondary-L）首版；搜索选项和 CotEditor 命中语义仍待对齐。
- [ ] 折叠、大纲、补全、Mode 设置、`.cotsyntax` 兼容读取；明确 Tree-sitter/自定义语法与 CotEditor 解析器的差异。
- [x] 行号和状态栏可在 View 菜单切换；不可见字符、软换行和 Tab Width（2/4/8、自定义 1–99 列、Use Spaces for Indentation）在 Format 菜单切换；状态按文稿会话持久化。
- [x] Tab Width 自定义宽度、按语法模式保存缩进偏好；三平台实体键盘验收仍待完成。
- [ ] 纵排、分屏、导航栏、文稿/字符/警告 Inspector。

### P2：CotEditor 命令面和工作流

- [ ] 依 CotEditor `main` 当前 storyboard 逐项复刻 File/Edit/Format/View/Text/Find/Window/Help/Script 菜单、动态启用/勾选条件及菜单顺序；当前实现子集和未实现项见 [GPUI 对齐矩阵](gpui-parity-matrix.md)，View > Show Status Bar 已接入并按窗口保存，完整菜单与其他平台验收仍缺。
- [ ] 从上游默认键位表建立统一命令注册表；覆盖 macOS Command、Windows/Linux Control 映射、上下文、冲突检查及用户自定义键位。
- [ ] 设置窗口各页、设置导入/导出、主题管理、片段、替换定义、工具栏定制、脚本和外部集成。
- [x] File > Show in File Manager 对已保存文稿打开平台文件管理器（macOS Finder/Windows Explorer 选择文件，Linux 打开父目录）；无路径文稿时菜单禁用。
- [x] File > Copy File Path 将活动已保存文稿的完整路径写入系统剪贴板；无路径文稿时菜单禁用。
- [x] File > Open Recent > Clear Menu 清理跨窗口共享的最近文稿记录，并持久化清理结果。
- [x] Format > Prevent Editing 用 GPUI Editor 原生只读属性限制文本输入，仍允许焦点/选择/复制；替换入口禁用并按文稿会话保存。
- [ ] 文件夹浏览/搜索/预览、拖放规则、远程编辑、打印/导出及恢复管理。

### P3：平台适配与质量

- [ ] macOS：原生应用菜单/窗口、系统字体/拼写/语音、文件协调/标签、打印和 VoiceOver 集成。
- [ ] Windows：原生窗口/菜单、文件关联、系统字典/语音、打印和 UI Automation/NVDA。
- [ ] Linux：X11/Wayland、桌面文件关联、字典/语音、打印和 AT-SPI/NVDA/Orca。
- [ ] 为纯数据规则、文稿工作流、菜单状态、键位解析、文件格式、跨平台能力分别建立 Rust 单元/集成验证；在 macOS、Windows、Linux 实机审查 UI、实体键盘、缩放、拖放、辅助技术与打包产物。
- [x] 仓库源码入口已切换至 GPUI；正式 GPUI 发布仍需完成矩阵中的功能/平台验收、安装器、文件关联和签名/公证等交付条件。

## 第一阶段实施内容

应用以 `CotEdit` 标识启动；首批 Rust 增量建立了可独立启动的 GPUI 工作区，提供多窗口、多标签、可横向滚动的标签栏与单标签关闭、Window > Close Window 脏文稿确认、File > Open Recent 动态菜单、File > Revert to Saved 磁盘重载及未保存确认、按窗口保存和恢复已保存文稿及未保存文本缓冲区和光标行列、语法高亮编辑器、Format > Syntax 手动选择 Tree-sitter 语言和 Reset Syntax Analysis（Cmd+R）、原生文件选择、编码/BOM 与逐行换行符读写、原子保存和外部文件修改提示、Find/Replace/Go to Line/Find Next/Previous、将选区用于查找/替换；View 菜单提供行号和状态栏开关，Format 菜单提供不可见空白、软换行和 Tab Width 开关，各项勾选态跟随活动文稿；Format 菜单的编码、默认行尾与语法也标记当前选项、About、Help/Report Issue 链接、macOS Services/Hide/Hide Others、Window Minimize/Zoom、基础 File/Edit/Format/View/Text/Find/Window 菜单。新建文稿/窗口/标签键位已按 CotEditor storyboard 调整。Format > Tab Width 提供 2/4/8 列、自定义 1–99 列和 Use Spaces for Indentation；宽度和缩进方式按文稿会话保存，并在调整时更新当前语法模式默认值；新建文稿和切换语法时应用该模式默认值。View > Show Status Bar 可按窗口切换，状态随会话 v4 恢复；File > Open Recent > Clear Menu 清空进程共享列表并立即持久化；Text > Trim Trailing Whitespace 删除每行末尾空格与 Tab、保留换行符，并通过单次 Undo 事务应用，恢复活动选区；Text > Duplicate Line 与 Delete Line 对光标行/选中行执行整行操作，并通过单次 Undo 事务应用；Text > Move Up / Move Down（macOS `⌃⌘↑/↓`、Windows/Linux `Ctrl+Alt+↑/↓`）交换光标行或选区覆盖行与相邻行，支持末尾空行并保留活动选区；Text > Reverse Lines 无选区时反转全文、有选区时反转覆盖的整行，保留末尾换行并选中反转后的行内容；Text > Delete Duplicates 无选区时检查全文，有选区时仅检查选区覆盖的行，保留首次出现的行并映射光标；Text > Join Lines（`⌘J`）有选区时折叠选区内换行和相邻空白，无选区时合并光标行与后续行；单次 Undo 可还原。滚动位置、实时光标移动持久化、跨平台窗口运行时验收、完整 Script/Settings 菜单、搜索选项和设置页仍待实施。保存前检查无法消除检查与提交之间的并发修改竞态。

## 本轮移除记录

Electron/CodeMirror 应用源码、Node/npm 清单及锁文件、前端资源、JS 功能库与 Electron 测试已删除；旧 `v1.0.7` release 资产和 Git 提交历史保留。GPUI 成为唯一当前应用源码。三平台分发工作流以 `gpui-v*` 标签为触发条件，产出 macOS `.app` ZIP、Windows ZIP、Linux tar.gz；它们仍缺安装器、文件关联、签名/公证、自动更新和实机运行验收。

删除 Electron 没有自动迁移其全部能力。旧版功能覆盖远高于当前 GPUI；后续按[对齐矩阵](gpui-parity-matrix.md)继续迁移，正式 GPUI 发布门槛仍未达成。

## 本轮验证记录

- `cargo fmt --all --check`、`CARGO_TARGET_DIR=app/target cargo check --workspace --locked`、`CARGO_TARGET_DIR=app/target cargo build --workspace --release --locked`、`actionlint .github/workflows/gpui-build.yml .github/workflows/release.yml` 与 `git diff --check` 通过。Cargo crate 已改名为 `cotedit`，版本为 GPUI 预览基线 `0.1.0`，Cargo workspace/lockfile 已移至仓库根目录。
- GitHub Actions 运行 `38578139931` 的 macOS、Windows、Linux 原生 release build 和 binary artifact 上传全部成功；手动归档运行 `38578203180` 的三平台 package job 全部成功，Publish job 因 workflow_dispatch 在 master 上被跳过。
- 已下载并检查归档：macOS `CotEdit.app` ZIP 含可执行文件、ICNS 与 `Info.plist`，`plutil -lint` 通过；Windows ZIP 含 `CotEdit.exe` 和 README；Linux tar.gz 含 `CotEdit` 和 README。Windows/Linux 实际桌面启动、安装、文件关联和输入法仍未验收。
- macOS debug 窗口与菜单已实机核验：应用名、File 菜单、Format 顺序、Syntax 选项/Rust 勾选态、Cmd+R 与 Find 的 Cmd+E/Cmd+Shift+E 显示；未验证实际按键命令和跨平台运行交互。
- 本机 Windows x86_64 交叉检查在 `gpui-pre` 构建脚本因缺少 `llvm-rc` 中止；Linux x86_64 因缺少 `x86_64-linux-gnu-gcc` 中止。CI 已在原生 runner 编译通过，仍未对 Windows/Linux 实际窗口、菜单、输入法和文件操作进行运行验收。

## 验收原则

- 任何功能状态必须来自统一文稿/命令模型，菜单、快捷键和按钮只调用同一命令。
- 不以“有相同标签/按钮”视为功能一致；逐项核对结果、默认值、Undo、焦点、键盘和可用状态。
- 代码/API 以当前 GPUI Kit 实际导出为准；每阶段对新 `app` 执行 Cargo 编译检查。变更 UI 后还需在真实窗口检查亮/暗主题、重排/缩放、菜单、焦点与辅助技术。
- CotEditor 上游源码是唯一功能验收基线；Electron 历史文档只能帮助发现迁移需求，不能证明 GPUI 实现或验证。
