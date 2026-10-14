# CotEditor Mode 选项对齐矩阵（历史 Electron 版）

> 历史资料：CotEdit 1.0.7 的实现与验证已随 Electron 源码移除。当前 GPUI 的 Mode/设置状态以 [GPUI 对齐矩阵](gpui-parity-matrix.md) 为准。

本矩阵以 CotEditor 7.1.2 与上游快照 `f90e70a644d968e33d48cc6b8258e72a06957f32` 为基线。模式字段和 general/code 默认值来自该提交的 [`ModeOptions.swift`](https://github.com/coteditor/CotEditor/blob/f90e70a644d968e33d48cc6b8258e72a06957f32/CotEditor/Sources/Models/ModeOptions.swift)；控件范围来自同提交的 [`ModeSettingsView.swift`](https://github.com/coteditor/CotEditor/blob/f90e70a644d968e33d48cc6b8258e72a06957f32/CotEditor/Sources/Settings%20Window/Panes/ModeSettingsView.swift)。CotEdit 状态描述当前 1.0.7 实现，发布信息见 [`parity-plan.md`](parity-plan.md)。

“general/code”列为 CotEditor 内置 Mode 类别的默认值。`CompletionWordTypes` 的“standard/document/syntax”分别对应系统标准词典、当前文稿词和语法包词。CotEdit 一列描述历史 1.0.7 实现，当前源码已删除。

| CotEditor Mode 字段 | general 默认 | code 默认 | CotEdit 当前实现与验证状态 |
|---|---:|---:|---|
| `fontType` | standard | monospaced | **已实现。**按语法覆写并可恢复 Mode 默认；旧全局 `fontType` 迁移兼容。浏览器字体选择及 Cocoa 字体面板差异另见[兼容性记录](compatibility.md)。 |
| `smartInsertDelete` | on | off | **未实现。**Edit > Substitutions 的智能复制/粘贴项保持禁用；CodeMirror 没有 NSTextView 的系统智能空格编辑语义。 |
| `automaticQuoteSubstitution` | off | off | **近似实现。**按语法启停，单插入光标以固定英文弯引号转换；不调用 Apple 地区化替换服务。 |
| `automaticDashSubstitution` | off | off | **近似实现。**按语法启停，连续两个 ASCII 连字符转为 em dash；不随系统地区改变。 |
| `automaticTextReplacement` | on | on | **工作流已实现。**按语法启停 CotEdit 本地规则；单条规则另需启用“输入时自动应用”。不读取或同步 macOS 系统替换词库。 |
| `automaticPeriodSubstitution` | off | off | **近似实现。**1.0.6 按语法启停；输入第二个空格时把前一空格改为句点。规则固定，不使用 macOS 地区化行为。 |
| `automaticSymbolBalancing` | off | on | **近似实现。**CodeMirror `closeBrackets()` 按语法设置，纯文本默认关、代码默认开；编辑器上下文与 IME 行为未证明等同 NSTextView。 |
| `continuousSpellChecking` | on | off | **受限实现。**按语法映射到编辑器 `spellcheck`，菜单同步；实际词典依赖 Chromium/Electron 与系统安装。general/code 默认映射见 `spellCheckingModeDefault()`。 |
| `grammarChecking` | off | off | **未实现。**CotEdit 没有 Cocoa 语法检查服务，菜单保持禁用。 |
| `automaticSpellingCorrection` | off | off | **未实现。**没有 CotEditor 使用的系统自动更正开关；未以 HTML 属性假称等价控制。 |
| `completionWordTypes.standard` | on | off | **未实现。**CotEditor 的系统标准词典来源在 CotEdit 中禁用并说明原因。 |
| `completionWordTypes.document` | on | on | **已实现。**当前文稿词可按语法设置；general/code 默认均包含。 |
| `completionWordTypes.syntax` | off | on | **近似实现。**语法包词可按语法设置；Code 类默认启用，Plain Text 默认关闭，导入 Mode 分类用于判定。 |
| `automaticCompletion` | off | off | **默认值已对齐，设置粒度不同。**自动补全默认关闭；CotEdit 以全局开关和逐语法覆写控制，未提供独立的 Mode `automaticCompletion` 字段。 |
| `indentOptions.expandsTab` | 未自定义 | 未自定义 | **已实现。**新增按语法“跟随模式默认/展开为空格/插入制表符”，显式设置优先于文稿缩进检测；跟随默认时检测结果优先于全局 `autoExpandTab`。设置面板可单独修改全局默认；有活动文稿时 Format 菜单切换当前语法覆写，无文稿时切换全局偏好。软 Tab 仍使用全局 Tab 显示宽度，和上游 Mode `width` 的组合行为有差异。 |
| `indentOptions.width` | 未自定义 | 未自定义 | **部分对齐。**每种语法可选 Tab 或 1–99 列空格缩进，并可恢复全局设置；CotEdit 的 Tab 显示宽度仍独立且全局，与上游 Mode 的 `width` 并非同一字段。 |

## 证据与边界

- CotEditor Mode 分类的默认值是 `Syntax.Kind.defaultOptions`；导入的语法 Mode 可提供 `general` 或 `code` 分类。CotEdit 对内置语法及导入语法分别使用其分类或现有回退规则，未声称所有语法包分类完全覆盖。
- CotEdit 相关实现主要位于 [`src/main.js`](../src/main.js)、[`lib/settings.js`](../lib/settings.js)、[`lib/automatic-substitutions.js`](../lib/automatic-substitutions.js) 与 [`index.html`](../index.html)。逐项自动化覆盖分散在 `test/settings.test.js`、`test/settings-file.test.js`、`test/indent-style-detection.test.js`、`test/automatic-substitutions.test.js`、`test/menu-state.test.js`、`test/menu-coverage.test.js` 和 `test/electron-ui-smoke.cjs`。
- 1.0.6 发布时 Node 单测 891/891、Electron UI smoke 4/4、生产构建和变更 JavaScript 语法检查通过。这些验证证明 CotEdit 路由和桌面烟测覆盖范围，不证明 macOS 原生文本服务或 VoiceOver 行为等价。
- CotEditor 7.1.1 的引用仍保留在兼容性记录中，用来标注当时的源码依据或历史改动；历史段落中出现的旧版本号、测试计数和“未发行”状态属于当时记录，不代表 CotEdit 当前版本。当前版本和发布结果以 README 版本记录、功能对应表及本文矩阵为准。
