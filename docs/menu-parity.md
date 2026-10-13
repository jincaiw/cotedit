# CotEditor 菜单与快捷键差异清单

对照基线：CotEditor 7.1.2 稳定版；当前 `main` 快照 `f90e70a644d968e33d48cc6b8258e72a06957f32`。上游菜单依据 [`Main.storyboard`](https://github.com/coteditor/CotEditor/blob/f90e70a644d968e33d48cc6b8258e72a06957f32/CotEditor/Storyboards/Base.lproj/Main.storyboard) 提取，快捷键以 `keyEquivalent` 为依据；该属性只证明静态默认值，不证明原生执行效果。CotEdit 当前菜单入口见 `electron/main.cjs`，动作登记见 `electron/preload.cjs`，快捷键登记见 `lib/shortcuts.json`。

| 上游菜单区 | CotEdit 当前情况 | 主要差异/下一步 |
|---|---|---|
| Edit > Spelling and Grammar | 每语法“输入时检查拼写”与勾选态已接入；系统字典建议和添加词通过 Electron 右键菜单 | “立即检查全文”“语法检查”“自动更正”及 Cocoa 拼写面板没有 Electron 等价 API，菜单显示为禁用；Windows/Linux 词典受已安装语言限制 |
| Edit > Substitutions | 手动替换命令与上游入口并存；智能引号、智能破折号、自动文本替换均有按语法持久化的开关；可为本地规则单独启用输入时替换；旧规则默认仍为手动 | 引号使用英文弯引号 `“”`/`‘’`，两个连字符转换为 `—`；语言地区特定的 Apple 替换规则、Smart Copy/Paste、双空格句点与 Show Substitutions 面板尚未复刻；禁用项在菜单中说明原因，参照 [`ModeOptions.swift`](https://github.com/coteditor/CotEditor/blob/f90e70a644d968e33d48cc6b8258e72a06957f32/CotEditor/Sources/Models/ModeOptions.swift) |
| Edit > Speech | 开始/停止朗读已实现；选择非空文本时读主选区，否则读全文；菜单状态随平台 Web Speech API 更新 | 需要在 macOS、Windows、Linux 核验本地语音可用性、暂停/取消、长文本、读屏器与平台菜单交互；不等同 AppKit Speech 子系统 |
| Edit > Insert from iPhone or iPad | 未实现 | Apple Continuity 设备协同依赖 macOS/iCloud，不在 Windows/Linux 伪造同名入口；检查 macOS 专属真实实现是否可由 Electron 安全接入 |
| Format > Font | 字体类型、大小、连字已实现 | Show Fonts 原生字体面板与 Antialias 切换未实现。评估跨平台字体选择器；栅格化/抗锯齿保持平台差异 |
| View > Inspector | 文稿检查器、大纲、Unicode 字符、警告分别有 CotEdit 面板；新增整体“显示检查器”复选项和 `CmdOrCtrl+I` 快捷键，打开时默认显示文稿检查器；已有任一检查器打开时再次触发会关闭该面板 | 行为以四类浮动/停靠面板作跨平台近似；不提供 CotEditor 原生 inspector split view、侧栏尺寸或驻留记忆；需逐项验收焦点返回和平台快捷键 |
| View > Split Editor | 菜单项名为“分屏编辑器”，状态反映当前分屏；另有显式关闭入口。CotEditor storyboard 的 Split Editor/Stack Editors Vertically 无静态快捷键 | CotEdit 已移除自行设定的 `CmdOrCtrl+Backslash`；焦点切换按 storyboard 的 macOS `Command+Backquote` 与 alternate `Option+Command+Backquote` 对齐，非 macOS 使用 `Ctrl+Backquote` / `Ctrl+Shift+Backquote` 映射；目标平台仍需验证物理键盘布局与菜单键位注册 |
| Window | 已有置顶、所有窗口置前及常见窗口命令 | CotEditor Console 面板未实现；Electron DevTools 不能直接冒充用户 Console 面板 |
| Help | 本地使用说明、快捷键列表，以及新版本、发行说明、报告问题和项目主页外链均已接入系统默认浏览器 | 仍未提供 CotEditor AppleScript 字典、专属 bug report diagnostics、Apple 帮助书籍/脚本对象模型；链接固定指向 CotEdit 项目，外链仅由用户点击触发 |
| 键盘等价 | 共享快捷键注册表，支持跨平台映射和自定义键位 | 逐项核对上游按键、菜单标签、Electron accelerator 与 renderer 分派；特别检查物理键盘布局、IME、重复键、上下文冲突和非 macOS 替代组合 |

## 实施顺序

1. P1：Inspector 总开关和快捷键已加入；分屏菜单没有上游未声明的打开快捷键，焦点切换按 macOS Command+Backquote / Option+Command+Backquote 映射。Electron UI smoke 核验菜单状态、分屏焦点和标签溢出菜单；物理键盘布局及目标平台菜单仍待实测。
2. P2：Show Fonts 可移植字体选择、各平台保存与实际字体回退；标明 Antialias 不可等同。
3. P2：已接入 CotEdit 发行说明、问题报告和项目主页；尚无原生 Console 和 Cocoa 字体面板，标明不可移植边界。
4. P3：三平台菜单栏/实体键盘/辅助技术实机核对；不以静态 storyboard 或模拟键盘测试宣称完全一致。

## 本轮完成

- Inspector：总开关与当前任一面板开关同步；`CmdOrCtrl+I` 支持菜单和快捷键表；显示时默认打开文稿检查器。
- Substitutions：按语法启停智能引号、智能破折号和自动文本替换；可为单条本地替换规则选择是否输入时应用，保留手动替换路径。
- 输入时拼写检查：按语法覆盖、设置文件持久化、菜单复选状态、平台字典建议/添加词。
- Speech：开始/停止朗读和选区/全文路由。
- Help：本地说明与快捷键、发行说明、报告问题、项目主页入口。
- 所有明确不可用的 Cocoa 拼写服务在菜单中显示为禁用项并说明原因。

尚未逐项完成的菜单和平台行为继续由[总实施计划](parity-plan.md)追踪。
