# GPUI 原生 CotEdit 迁移与对齐计划

## 目标与边界

以 CotEditor 7.1.2 发布版源码、storyboard、默认设置、帮助文档为功能基线；以 `longbridge/gpui-kit` 的 GPUI Kit 0.7.x 为跨平台桌面 UI 技术栈；参考 `sachithrrra/betternotepad` 的 Rust 应用组织、文稿实体、菜单/Action、GPUI 文本编辑器及会话保存实践。

当前仓库已经有 Electron/CodeMirror 桌面应用和大量 CotEditor 对齐工作。本计划不移除或覆盖现有实现；`app/` 是新的 Rust 原生实现，旧应用继续作为行为说明、功能基线和可运行版本。逐域迁移后再决定是否切换默认发布入口。产品目标是尽量复现 CotEditor 的可移植功能与工作流，并在各平台采用惯用窗口/菜单行为。AppKit 专属服务无法在 Windows/Linux 字面复刻时，按平台能力实现等价结果或在兼容性矩阵中明确缺项；“完全一致”需通过逐项功能、交互、菜单、快捷键和平台实机验收证明，不能由单次构建推断。

## 检查结论

- CotEditor 7.1.2 是 Swift/Cocoa macOS 编辑器，功能入口分布于 `Document Window`、`Settings Window`、Inspector、Script/Mode/Theme/Snippet 管理、菜单 storyboard 和帮助资源。
- 当前 CotEdit 已实现丰富的跨平台文本编辑、文件夹浏览、语法/主题子集、设置、检查器、快捷键、打印和恢复流程；它自身的 `docs/parity-plan.md`、`docs/menu-parity.md`、`docs/mode-options-parity.md` 记录了差异与平台边界。
- BetterNotepad 是 macOS Rust/GPUI Kit 应用，提供了可核对的 GPUI 文稿/标签、文件菜单、会话恢复、编辑器、状态栏和主题实例。它不是 CotEditor 的完整功能替代，也未作为跨平台实现的验收依据。
- GPUI Kit 提供原生 GPUI `Editor` / `Textarea`、Action/key binding、菜单、Root、对话框、主题和窗口能力；逐功能迁移仍需建立文稿模型、编码/行尾、语法配置、设置持久化与平台适配。
- 工作树起始状态为 `master`，已有 `.agents/`、`.claude/`、`.tmp/` 与 `skills-lock.json` 未跟踪内容；迁移实施需保留这些既有文件，不清理或重写。

## 当前审查结果与实施顺序

审查快照：CotEditor 7.1.2 源码提交 `f90e70a`、GPUI Kit 0.7.3、CotEdit 提交 `49ed99267`；GitHub 最新正式发行仍是 Electron `v1.0.7`。当前工作树保留 `.agents/`、`.claude/`、`.tmp/` 与 `skills-lock.json` 未跟踪内容。

| 阶段 | 目标 | 关键实现范围 | 完成/验收条件 |
|---|---|---|---|
| A. 桌面壳层与命令 | 优先让窗口、菜单和键盘行为形成一致工作流 | macOS 应用菜单与 Services；File > Open Recent；File/Edit/Format/View/Text/Find/Window/Help 菜单；活动窗口勾选/禁用状态；可复用命令层；标签、状态栏、查找焦点与常用键位 | 逐项对应 storyboard 静态菜单及 `lib/shortcuts.json` 的跨平台映射；macOS/Windows/Linux 菜单和物理键盘记录分别验收 |
| B. 文本编辑核心 | 补齐 CotEditor 高频文本命令 | 查找选项与命中导航、选择行/词、多光标、缩进配置、注释/行操作、Unicode 转换、剪贴板、撤销边界 | 每个命令明确选区、无选区、Undo 和菜单可用状态；没有对应 GPUI 能力时补 command handler |
| C. 文稿与偏好 | 对齐文件生命周期和可配置行为 | 格式状态恢复、滚动/光标状态、自动保存恢复、Mode/缩进、编码与换行边界、字体/主题/设置页 | 持久化兼容、损坏文件恢复、大文稿性能与覆盖保护检查 |
| D. CotEditor 专属能力 | 逐域迁移编辑器之外的工作流 | 大纲/折叠/补全、Inspector、文件夹浏览、片段/替换/语法包、打印/导出、辅助功能 | 每域有明确平台替代方案或被矩阵记录为未支持；检查文件系统边界和权限 |
| E. 三平台交付 | 让 GPUI 成为可下载、可安装、可更新的独立发行物 | macOS/Windows/Linux 构建矩阵、依赖安装、应用图标/文件关联、版本号、签名/公证和 GitHub Release | 已配置独立 GPUI 原生 runner 构建工作流并上传二进制 CI artifacts，等待远程运行结果；三平台发行包构建成功并启动验收、安装器与 release workflow 接入后再发行；Electron 包继续可用 |

**当前优先批次：**继续补 A 阶段的动态菜单状态（当前编码、默认行尾和视图选项）、应用菜单、最近文稿与窗口关闭工作流；随后把编辑命令从单体窗口文件中抽出并扩展文本操作。每批都先检查代码和目标源码，再编译，提交推送并更新矩阵。GPUI 与 Electron 目前是不同发行目标；E 阶段接入发行流水线前不将 GPUI 源码改动标称为已包含在 Electron 安装包中。

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

- [x] 确认当前 Electron 应用、CotEditor 7.1.2 源码、GPUI Kit API 和 BetterNotepad 架构。
- [x] 保留 Electron 版本作为迁移期间的行为/功能基线。
- [x] 新增独立 Cargo 应用骨架，先跑通 GPUI Kit、跨平台窗口、文本编辑实体、菜单 Actions 与基础文稿读写。
- [x] 按功能域建立 CotEditor、Electron 基线和 GPUI Rust 实现状态矩阵，记录上游入口、平台差异及验收关注点，见 [`docs/gpui-parity-matrix.md`](gpui-parity-matrix.md)。

### P1：编辑器和文稿核心

- [x] 单窗口多文稿标签、独立窗口、标签/窗口关闭确认首版；会话按窗口保存并恢复已保存文稿。
- [x] 未保存文本缓冲区按窗口延迟写入和恢复首版，并保存文稿光标行列；纯格式未保存状态、滚动位置及实时光标移动持久化仍缺。
- [x] 跨平台原子保存和保存前外部修改确认首版。
- [ ] 三平台窗口运行时验收及检查—提交并发竞态处理。
- [x] 最近文稿列表与按窗口会话恢复；未保存文本按窗口延迟写入/恢复并记住光标行列，纯格式未保存状态、滚动位置及实时光标移动持久化仍缺。
- [x] 编码检测/选择、BOM、混合及六类换行符、往返无损保存与不兼容字符告警（首版支持 UTF-8/UTF-16LE/BE、Windows-1252、Shift_JIS、GBK、Big5；自动检测和行差异映射仍需边界验收）。
- [ ] Undo/Redo、多光标、缩进/注释/行操作、Unicode 转换及命令边界核对。
- [x] GPUI Kit 文本查找、单处/全部替换与转到行（secondary-L）首版；搜索选项和 CotEditor 命中语义仍待对齐。
- [ ] 折叠、大纲、补全、Mode 设置、`.cotsyntax` 兼容读取；明确 Tree-sitter/自定义语法与 CotEditor 解析器的差异。
- [x] 行号、不可见空白字符和软换行可在 View 菜单切换。
- [ ] 纵排、分屏、导航栏、文稿/字符/警告 Inspector。

### P2：CotEditor 命令面和工作流

- [ ] 依 CotEditor 7.1.2 storyboard 逐项复刻 File/Edit/Format/View/Text/Find/Window/Help/Script 菜单、动态启用/勾选条件及菜单顺序；GPUI 已加入首批可用菜单、活动窗口 View 勾选态、当前编码/默认行尾勾选态、About、macOS Services/Hide/Hide Others、动态 File > Open Recent、窗口缩放/最小化和新建/查找快捷键，完整菜单与其他平台验收仍缺。
- [ ] 从上游默认键位表建立统一命令注册表；覆盖 macOS Command、Windows/Linux Control 映射、上下文、冲突检查及用户自定义键位。
- [ ] 设置窗口各页、设置导入/导出、主题管理、片段、替换定义、工具栏定制、脚本和外部集成。
- [ ] 文件夹浏览/搜索/预览、拖放规则、远程编辑、打印/导出及恢复管理。

### P3：平台适配与质量

- [ ] macOS：原生应用菜单/窗口、系统字体/拼写/语音、文件协调/标签、打印和 VoiceOver 集成。
- [ ] Windows：原生窗口/菜单、文件关联、系统字典/语音、打印和 UI Automation/NVDA。
- [ ] Linux：X11/Wayland、桌面文件关联、字典/语音、打印和 AT-SPI/NVDA/Orca。
- [ ] 为纯数据规则、文稿工作流、菜单状态、键位解析、文件格式、跨平台能力分别建立 Rust 单元/集成验证；在 macOS、Windows、Linux 实机审查 UI、实体键盘、缩放、拖放、辅助技术与打包产物。
- [ ] 只有功能矩阵中每项均有实现或经明确接受的平台限制，且各平台验收记录齐全后，才切换默认发行入口并更新产品兼容性声明。

## 第一阶段实施内容

首批 Rust 增量建立了可独立启动的 GPUI 工作区，提供多窗口、多标签、可横向滚动的标签栏与单标签关闭、Window > Close Window 脏文稿确认、File > Open Recent 动态菜单、按窗口保存和恢复已保存文稿及未保存文本缓冲区和光标行列、语法高亮编辑器、原生文件选择、编码/BOM 与逐行换行符读写、原子保存和外部文件修改提示、Find/Replace/Go to Line/Find Next/Previous、行号/不可见空白/软换行开关及活动窗口 View 菜单勾选态、Format 编码与默认行尾勾选态、About、macOS Services/Hide/Hide Others、Window Minimize/Zoom、基础 File/Edit/Format/View/Text/Find/Window 菜单。新建文稿/窗口/标签键位已按 CotEditor storyboard 调整。未保存文本以 500ms 延迟保存；纯格式状态、滚动位置、实时光标移动持久化、跨平台窗口运行时验收、完整 Help/Script/Settings 菜单、搜索选项和设置页仍待实施。保存前检查无法消除检查与提交之间的并发修改竞态。

## 本轮验证记录

- `cargo fmt --manifest-path app/Cargo.toml --check`、macOS arm64 `cargo check`、macOS x86_64 `cargo check` 与 `git diff --check` 通过。
- Windows x86_64 交叉检查在依赖 `gpui-pre` 的构建脚本阶段因环境缺少 `llvm-rc` 中止；Linux x86_64 交叉检查因环境缺少 `x86_64-linux-gnu-gcc` 中止。两者均未达到应用 crate 的编译阶段，不代表目标平台源码已通过构建。
- 未运行测试或桌面窗口；三平台实机行为仍待验收。

## 验收原则

- 任何功能状态必须来自统一文稿/命令模型，菜单、快捷键和按钮只调用同一命令。
- 不以“有相同标签/按钮”视为功能一致；逐项核对结果、默认值、Undo、焦点、键盘和可用状态。
- 代码/API 以当前 GPUI Kit 实际导出为准；每阶段对新 `app` 执行 Cargo 编译检查。变更 UI 后还需在真实窗口检查亮/暗主题、重排/缩放、菜单、焦点与辅助技术。
- 现有 Electron 的测试和兼容性说明只证明其自身实现，不自动构成 GPUI 版本的验证。
