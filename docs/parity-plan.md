# CotEditor 对齐实施计划

对照上游：CotEditor 7.1.2 稳定发布版，以及截至 2026-10-13 的 [`main` 快照](https://github.com/coteditor/CotEditor/commit/f90e70a644d968e33d48cc6b8258e72a06957f32)。当前 `main` 的 HEAD 为发布合并提交；若后续上游 `main` 前进，更新比较基线和本计划。

## 对齐原则

- 以官方源码、默认设置、菜单 storyboard、帮助及发布说明核实行为；为每项记录上游证据和 CotEdit 实际实现。
- 分别核对功能、默认值、菜单层级/可用状态、快捷键、键盘焦点与辅助技术；同名控件不视为行为等价。
- 可移植功能按 CotEditor 的工作流实现。AppKit、NSDocument、系统拼写服务等平台能力，优先调用目标平台可用接口；无法复现的行为明确标为平台限制。
- 每项完工后更新兼容性矩阵和相应用户说明，再进行实现验证；合并前检查 macOS、Windows、Linux 的构建配置与键位映射。

## 阶段与优先级

### P0：基线与差异清单（已完成初步盘点）

- [x] 核实稳定发行版、上游 `main` SHA 和 CotEdit 工作树状态。
- [ ] 从 Main.storyboard、Mode/默认设置模型、文稿操作及帮助内容生成可逐项追踪的矩阵；清理 `docs/compatibility.md` 中 7.1.1/7.1.2 与历史工作树状态混杂的摘要。
- [ ] 为每个差异标注：功能差异、交互差异、平台限制、快捷键差异、验证状态及上游证据。

### P1：模式设置和编辑输入

- [x] 本轮实施：补齐按语法设置的智能引号、智能破折号、自动文本替换开关；在同一输入事务中转换直引号/双连字符，并可选择对单条本地替换规则启用输入时应用。旧规则默认保持手动，避免升级后突然改写输入。Apple 地区化替换与 Smart Copy/Paste 仍是平台差异。
- [x] CotEditor Mode `fontType` 已按语法保存：general/纯文本默认标准、code 默认等宽；设置面板和 Format > Font 菜单共用覆盖，旧版全局选择保留为兼容映射，恢复 Mode 默认可清除单语法覆盖。
- [x] CotEditor Mode 的 `automaticPeriodSubstitution` 已接入按语法设置，默认关闭；输入第二个连续空格时在单一编辑事务把前一空格变为句点，设置面板、Edit > Substitutions 菜单及设置文件均支持。应用内固定规则不依赖 Apple 地区化服务。grammar checking、automatic spelling correction 与 smart insert/delete 仍需逐项核对并按平台能力记录。
- [ ] 逐项比对插入/删除、注释、选择、转换、查找替换和多重替换的菜单可用条件及 Undo/Redo 行为。
- [x] 本轮实施：为每种语法加入输入时拼写检查选项、编辑器 `spellcheck` 行为、系统建议/添加词右键菜单，并在 Edit 菜单提供同步当前文稿状态的开关。Cocoa 语法检查、自动更正和拼写面板列为平台差异。

### P2：桌面菜单、快捷键和常用操作

- [ ] 对上游菜单树逐项核对入口、顺序、分隔线、启用条件与复选状态；逐项对照快捷键注册表，覆盖平台映射、冲突和上下文分流。
- [x] 本轮菜单实现：Edit > Substitutions 的“双击空格插入句点”按当前语法持久化并默认关闭；菜单勾选状态跟随语法设置。实现固定应用规则，不声称等同随地区变化的 Apple 文本替换。
- [ ] 完成仍缺少的可移植操作，并为系统服务、设备协同、原生分享等平台专属功能定义真实平台实现或清楚的不可用状态。
- [x] 本轮快捷键核对：移除上游没有静态快捷键的 Split Editor 默认 `CmdOrCtrl+Backslash`；焦点切换在 macOS 使用 Command+Backquote 和 Option+Command+Backquote，非 macOS 保留 Ctrl 系映射。
- [x] 本轮菜单实现：View > Inspector 总开关同步四种现有检查器面板的可见状态；空闲时开启文稿检查器，已有面板时关闭当前面板；注册 `CmdOrCtrl+I` 并接入菜单及快捷键分派。
- [x] 本轮菜单与设置：Substitutions 菜单复选状态绑定当前语法；自动替换词可逐条启用输入时应用。双空格句点现为可用的固定应用规则；Smart Copy/Paste 和原生替换面板仍显示明确的平台差异。
- [x] 本轮菜单实现：Edit > Speech 提供开始/停止朗读；有选区时朗读主选区，否则朗读全文；菜单根据 Web Speech API、文稿和当前朗读状态启用/禁用。此为平台语音合成工作流，不声称等同 AppKit Speech 菜单。
- [x] 本轮菜单实现：Help 新增 CotEdit 发行说明、报告问题和项目主页入口；URL 固定在主进程白名单，通过系统默认浏览器打开。
- [ ] 核对菜单栏、工具栏、标签栏、侧栏、导航栏、检查器和对话框的焦点次序、键盘操作与动态播报；Electron UI smoke 已覆盖标签溢出菜单、分屏焦点、主要对话框和文件拖放管理器，其他控件及实体键盘仍待逐项审查。

### P3：设置窗口、文稿生命周期与打印

- [ ] 逐页核对 Appearance、Edit、Format、General、Mode、Window、Snippet 设置项、默认值、重置和持久化。
- [ ] 对齐新建/打开/保存/恢复、文件关联、外部编辑、打印预览及页面设置，并记录 NSDocument 与文件系统差异。
- [ ] 按 macOS、Windows、Linux 核实原生字体、系统服务、文件管理器、打印和文件关联体验。

### P4：语言、辅助技术和发布验收

- [ ] 核对界面本地化、语法包覆盖率、正则引擎差异、VoiceOver/NVDA 名称和操作路径。
- [ ] 在各平台真实桌面窗口逐项检查菜单、快捷键、滚动、缩放、拖放、焦点和打印；把未能实测的项目保留为未确认，不以静态或 Node 检查宣称等价。
- [x] Electron 多重替换与桌面烟测修正：修正 `regexAnchorsMatchLines` 默认已开启时的烟测逻辑；同步修复分屏按键的 CDP 平台修饰键、设置内管理按钮的触发和标签溢出菜单聚焦等待。完整 `npm run test:ui` 4/4 通过。
- [x] 发布验收：CotEdit 1.0.3 已完成 `npm test` 878/878、桌面 UI smoke 4/4 与本机构建；`v1.0.3` 的 GitHub Actions 三平台单测、构建和安装包任务全部通过，并发布 DEB/AppImage、macOS ARM64 DMG/ZIP、Windows x64 EXE。流程：[Actions run 38408446933](https://github.com/jincaiw/cotedit/actions/runs/38408446933)，[Release v1.0.3](https://github.com/jincaiw/cotedit/releases/tag/v1.0.3)。
- [x] 发布验收：CotEdit 1.0.4 已完成 `npm test` 885/885、`npm run test:ui` 4/4、生产构建及变更 JavaScript 语法检查；`v1.0.4` 的 GitHub Actions 三平台单测、构建与打包全部成功，发布 DEB/AppImage、macOS ARM64 DMG/ZIP、Windows x64 EXE。流程：[Actions run 38413922039](https://github.com/jincaiw/cotedit/actions/runs/38413922039)，[Release v1.0.4](https://github.com/jincaiw/cotedit/releases/tag/v1.0.4)。
- [x] 发布验收：CotEdit 1.0.5 已完成 `npm test` 888/888、`npm run test:ui` 4/4、生产构建及变更 JavaScript 语法检查；`v1.0.5` 的 GitHub Actions 三平台单测、构建与打包全部成功，发布 DEB/AppImage、macOS ARM64 DMG/ZIP、Windows x64 EXE。流程：[Actions run 38417349064](https://github.com/jincaiw/cotedit/actions/runs/38417349064)，[Release v1.0.5](https://github.com/jincaiw/cotedit/releases/tag/v1.0.5)。
- [x] 发布验收：CotEdit 1.0.6 已完成 `npm test` 891/891、`npm run test:ui` 4/4、生产构建及变更 JavaScript 语法检查；`v1.0.6` 的 GitHub Actions 三平台单测、构建与打包全部成功，发布 DEB/AppImage、macOS ARM64 DMG/ZIP、Windows x64 EXE。流程：[Actions run 38487797749](https://github.com/jincaiw/cotedit/actions/runs/38487797749)，[Release v1.0.6](https://github.com/jincaiw/cotedit/releases/tag/v1.0.6)。

## 当前限制

Electron/CodeMirror 无法提供 AppKit 控件的像素级和文本内核级一致性。拼写、语法服务、输入法、原生菜单、打印、窗口管理及屏幕阅读器必须按目标系统分别实现和验收；计划完成指可移植行为已对齐且平台特有差异均有明确结果，不把无法移植的系统实现伪装成相同功能。
