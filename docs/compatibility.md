# CotEdit 与 CotEditor 兼容性

CotEditor 是 Swift/Cocoa 原生 macOS 应用，CotEdit 是 Electron/CodeMirror 跨平台实现。界面、菜单、快捷键和编辑操作按上游逐项核对；当前稳定基线为 CotEditor 7.1.2，上游 `main` 快照为 2026-10-13 的 `f90e70a644d968e33d48cc6b8258e72a06957f32`。源码级比对仍在推进，本页注明近似行为、缺项、平台实现边界和验证状态。执行顺序见[对齐实施计划](parity-plan.md)。

**2026-10-13 增量（按语法输入时检查拼写）：**CotEditor 7.1.2 的 Mode 选项包含 `continuousSpellChecking`，general 模式默认开启，code 模式默认关闭；其 Spelling and Grammar 菜单提供“Check Spelling While Typing”。CotEdit 现为每种语法提供“跟随模式默认/开启/关闭”，偏好随设置文件导入/导出持久化，并同步到主编辑器和分屏编辑器的 `spellcheck` 内容属性；Edit > 拼写和语法中的输入时检查开关与当前语法同步。编辑器拼写错误的右键菜单显示系统建议，允许替换单词或添加到系统/应用字典。默认映射按上游模式类别处理：Plain Text、Markdown 与声明为 general 的导入语法开启，code 语法关闭；其它内置 CodeMirror 模式暂以 code 类默认。拼写标记由 Chromium/Electron 的拼写引擎提供；macOS 使用系统语言检测，Windows/Linux 仅选择与操作系统区域设置精确匹配或语言基码匹配的一种 Electron 已安装字典，不主动下载字典；无匹配字典时系统拼写引擎不会提供有效检查。Electron 没有 CotEditor 使用的 Cocoa grammar checking、自动更正控制或原生拼写面板接口，所以这些菜单项显示为禁用；未启用网络语法服务，也不上传文稿。依据：[CotEditor ModeOptions.swift](https://github.com/coteditor/CotEditor/blob/7.1.2/CotEditor/Sources/Models/ModeOptions.swift)、[Mode 设置视图](https://github.com/coteditor/CotEditor/blob/7.1.2/CotEditor/Sources/Settings%20Window/Panes/ModeSettingsView.swift)与[主菜单 storyboard](https://github.com/coteditor/CotEditor/blob/7.1.2/CotEditor/Storyboards/Base.lproj/Main.storyboard)。当前实现覆盖拼写检查开关工作流，未覆盖字典选择/即时检查命令和 Cocoa 拼写面板；系统是否安装对应字典及真实红色标记需在各平台桌面验收。

**2026-10-13 增量（Edit > Speech）：**CotEditor 主菜单的 Speech 子菜单现有 Start Speaking/Stop Speaking，无静态快捷键。CotEdit 增加同层级命令：有选区时朗读主选区，否则朗读全文；运行时按 Web Speech API 是否可用、当前文稿是否有内容及朗读状态更新菜单启用项。操作交由系统/Chromium 当前平台的语音合成实现，不将正文发送给 CotEdit 自有网络服务。平台可用语音、语音面板、朗读队列/声音选择和辅助技术表现尚未实机逐项比对，因此此项只对齐可用工作流，不宣称 AppKit `NSSpeechSynthesizer` 或原生菜单完全一致。

**2026-10-13 增量（Edit > Substitutions）：**CotEditor Mode 默认智能引号、智能破折号关闭，自动文本替换开启。CotEdit 为三项提供逐语法“跟随默认/开启/关闭”，菜单复选状态同步当前语法；普通直引号按上下文替换为英文弯引号，连续双连字符替换为长破折号。自定义替换规则新增“输入时自动应用”独立选项，输入分隔符时在同一编辑事务替换触发词；既有规则迁移后保持手动，防止升级时改变既有输入行为。手动“替换文本”命令仍作用于选区。CotEdit 尚未复刻随系统地区变化的原生标点、Smart Copy/Paste 和双空格句点，相关菜单明确禁用；智能标点目前只处理单一插入光标、固定英文弯引号/长破折号映射，未核验多光标、复杂 IME 组合输入及各语言系统替换规则；Mode 默认值参照 [ModeOptions.swift](https://github.com/coteditor/CotEditor/blob/f90e70a644d968e33d48cc6b8258e72a06957f32/CotEditor/Sources/Models/ModeOptions.swift)。

**2026-10-13 增量（Inspector、分屏和帮助菜单）：**View > Inspector 新增总开关及 `CmdOrCtrl+I`，没有已打开的检查器时显示文稿检查器，已有面板时关闭当前面板；不同于 CotEditor 的原生 Inspector split view，焦点与菜单状态由 Electron UI 冒烟覆盖。分屏菜单移除未经上游静态声明的打开快捷键，焦点切换按 macOS `Command+Backquote` / `Option+Command+Backquote` 设置，非 macOS 使用 Ctrl 组合映射。Help 提供 CotEdit 发行说明、报告问题和项目主页，使用主进程内固定 HTTPS 白名单及 `shell.openExternal`；链接只在用户点击时打开浏览器，不附加文稿或诊断信息。真实物理键盘布局、各平台菜单绘制和外部浏览器行为仍需目标系统验收。

**2026-10-12 增量（不可见字符分类显示）：**依据 CotEditor 7.1.1 [不可见字符指南](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/howto_display_invisibles.html)、[`WindowSettingsView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Settings%20Window/Panes/WindowSettingsView.swift)、[`DefaultSettings.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift) 与[主菜单 storyboard](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Storyboards/Base.lproj/Main.storyboard)，CotEdit 现有独立的换行符、Tab、ASCII 空格、其他 Unicode 空白及控制字符开关，默认值依次为开、开、关、开、开，总显示开关默认关闭。类别偏好沿用本机设置和设置文件导入/导出；主/分屏编辑器立即重绘。View 菜单沿用单一显示命令，仅更正标签，不新增菜单或快捷键。CRLF 使用单个行尾标记；零宽连接符 U+200D 不替换，以保护 emoji/组合字形。CotEdit 采用 CodeMirror 替换装饰和跨平台符号近似，打印显示仍独立；显式 Node/静态检查不验证桌面字形、AppKit 菜单、原生文本布局或读屏行为 1:1。

**2026-10-12 增量（按语法自动插入闭括号与引号）：**依据 CotEditor 7.1.1 [`ModeOptions.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/ModeOptions.swift) 与[模式设置帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/settings_mode.html)，通用模式默认关闭、代码模式默认开启；CotEdit 在设置面板提供当前语法“跟随模式默认／开启／关闭”，覆写随既有本机偏好和设置文件导入/导出保存，并在文稿、语法或设置切换时重配主/分屏编辑器。此项不新增菜单或快捷键。实际插入由 CodeMirror `closeBrackets()` 提供，不能证明字符串/注释上下文、输入法组合输入、原生模式设置窗口或 AppKit 事件行为完全一致。

**2026-10-12 增量（匹配括号高亮开关）：**CotEditor 7.1.1 的编辑设置提供默认开启的全局 `highlightBraces` 选项；CotEdit 设置面板现有独立复选项，沿用既有偏好及设置文件导入/导出，并经独立 CodeMirror compartment 即时重配置主/分屏视图和切换文稿后的编辑器。此项不同于上段按语法控制的闭括号/引号自动插入，不增加菜单或快捷键。CotEditor 帮助描述插入点移动经过一对括号时短暂高亮；CodeMirror 则在光标邻接括号时显示匹配高亮，因此仅为可控近似，不代表 Cocoa 绘制或键鼠行为相同。依据：[编辑设置帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/settings_edit.html)、[`EditSettingsView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Settings%20Window/Panes/EditSettingsView.swift) 与 [`DefaultSettings.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift)。

**2026-10-12 增量：**依据 CotEditor 7.1.1 [大纲菜单指南](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/howto_show_outlinemenu.html)、[主窗口菜单定义](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Storyboards/Base.lproj/Main.storyboard) 和[默认设置源码](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift)，补入编辑器上方导航栏、大纲弹出选择、光标当前项与相邻项箭头；View 菜单可切换显隐，Find 菜单命令聚焦选择器；快捷键可自行分配但没有未经证实的默认组合。此实现复用 CotEdit 既有大纲解析器，静态/Node 测试不验证原生菜单弹出、桌面外观或读屏器。

**2026-10-12 增量（HFS+ Unicode 规范化）：**Text > 文本转换 > Unicode 规范化现增加 Modified NFD 与 Modified NFC，紧随标准形式；选区/光标单词目标与其他文本转换相同，不增加快捷键。CotEdit 使用生成的 Unicode 3.2 规范分解表、HFS+ 排除分解范围及 `Full_Composition_Exclusion` 分段合成，不调用 macOS 文件系统/CoreFoundation 接口；实现以 CotEditor 7.1.1 上游规则为依据，跨平台运行结果仍是受限复现，不证明 Foundation/macOS 的逐字节等价。高级字符计数现状与上游对照见紧接其后的独立增量。依据：[CotEditor 7.1.1 规范化源码](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/StringUtils/String%2BNormalization.swift)与 [Apple TN1150](https://developer.apple.com/library/archive/technotes/tn/tn1150.html)。

**2026-10-12 增量（高级字符计数规范化）：**依据 CotEditor 7.1.1 [`CharacterCountOptionsView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Accessory%20Views/Advanced%20Character%20Count/CharacterCountOptionsView.swift) 与 [`String+AdvancedCounting.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/StringUtils/String%2BAdvancedCounting.swift)，高级计数器的规范化选择现按标准形式与 Modified NFD/NFC 分组；字素簇计数仍隐藏该行，标量、UTF-16、字节单位均可用。算法复用 CotEdit 的跨平台 HFS+ 规则近似；选定形式写入现有偏好与设置文件，不改变入口或快捷键。Node 测试验证表单、转换和持久化，不能验证原生 SwiftUI 控件、VoiceOver 或 Foundation 实机行为。

**2026-10-12 增量（URL 自动链接）：**依据 CotEditor 7.1.1 [编辑设置帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/settings_edit.html) 的 Content parse 选项和[默认设置源码](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift)，新增默认关闭的“链接文稿中的 URL”偏好；开启后只扫描 CodeMirror 可见视口的有界文本，为有效 HTTP/HTTPS URL 加链接样式，Command/Control-单击经 preload IPC 交由主进程二次校验后用系统默认浏览器打开，普通单击保留文本选择。为避免越权打开本机文件或脚本，仅允许 HTTP/HTTPS 且拒绝凭据式 URL；对超长行和超大视口采用扫描上限。设置随现有偏好和设置文件导入/导出持久化，并即时作用于主/分屏编辑器。定向 Node 测试覆盖解析、白名单和接线，不验证真实桌面绘制、键鼠布局、系统浏览器或原生 Cocoa 点击行为。

**发行目录摘要未决（2026-10-12）：**本轮未修改 `dist/` 或 `release/`；本轮只读计数为 4/116，与先前记录的 4/115 不一致；只读重新计算的聚合摘要也与先前兼容记录不同。本轮缺少独立开始基线，且工作树无可用 Git 元数据，因此无法确认差异来源或发生时间。未尝试清理/修复，也不声称这些目录当前摘要与先前相同。

**2026-10-12 增量（按语法缩进继承）：**依据 CotEditor 7.1.1 [`ModeSettingsView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Settings%20Window/Panes/ModeSettingsView.swift) 中的 “Use custom settings” 选项与[7.1.0 发布说明](https://coteditor.com/releasenotes/7.1.0.en)，CotEdit 在“格式 > 当前语法的缩进宽度”加入“跟随全局设置”。选择后仅删除活动语法的 `indentByLanguage` 覆写，保留其他语法映射并回退至既有全局缩进 style/width；设置仍沿用现有本机偏好与设置文件导入/导出，不新增快捷键、文稿字段或 IPC 权限。原生菜单勾选状态使用活动文稿模式覆写状态同步。此项补齐继承/重置工作流，但没有复制 Cocoa Mode 设置窗口；Node/静态测试不验证真实桌面菜单显示或 AppKit 设置控件。

**2026-10-12 增量（文末过度滚动）：**CotEditor 7.1.1 Window 设置将 overscroll 设为 0–1、步长 0.1，默认 0；官方帮助说明 0% 停在文末，100% 可滚到仅剩末行可见。CotEdit 在设置面板加入 0–100%、10% 步长控件，并用 CodeMirror 内容末尾动态留白按视口高度比例近似该语义；偏好沿用现有设置持久化/导入/导出，不新增菜单、快捷键或文稿字段。当前实现只在横排文本生效，未实测原生滚轮/触控板手感或 Cocoa 布局。依据：[CotEditor WindowSettingsView.swift](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Settings%20Window/Panes/WindowSettingsView.swift)、[DefaultSettings.swift](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift) 与[设置帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/settings_window.html)。

**2026-10-12 增量（默认窗口尺寸留空回退）：**CotEditor 7.1.1 [Window 设置帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/settings_window.html)说明默认宽高留空时沿用上次打开窗口的大小。CotEdit 两个宽高控件默认留空且可分别留空；未配置的维度读取最近一次实际窗口尺寸，首次运行、损坏或缺失记录回退到 **1280×820**；显式宽度仍限制 **860–4000 px**、高度 **600–4000 px**。最近尺寸放在既有 renderer 本机 localStorage 的独立键中，随可见窗口调整更新并在关闭前同步落盘；它不进入可移植设置文件，只有宽高配置按原格式导入/导出。新建窗口先隐藏，renderer/编辑器初始化并经受限 preload IPC 应用尺寸后才显示，减少启动尺寸跳变。没有新增菜单、快捷键、文件、IPC 权限或恢复/隐私/文稿保留策略。显式 Node 测试与静态接线检查不验证实际桌面首帧、DPI、窗口管理器或原生菜单/UI 行为，不能据此宣称跨平台 1:1。

## 功能对应

| 工作流 | CotEdit 0.5.16 | 与 CotEditor 的关系 |
|---|---|---|
| 外观与状态栏 | 工作树增加默认关闭的“状态栏使用不透明背景”偏好；关闭时状态栏匹配编辑器主题背景，开启时使用应用面板底色；与既有“显示状态栏”偏好和 View 菜单复选项独立，随本机设置与设置文件导入/导出持久化 | CotEditor 7.1.0 在 Appearance 设置提供 Status bar 选项，7.1.1 默认 `prefersOpaqueBarBackground=false`；CotEdit 以主题纯色匹配模拟背景反映，不实现 macOS 27 原生材质/半透明合成；Node/CSS 静态验证不证明真实桌面绘制或视觉 1:1，见 [7.1.0 发布说明](https://coteditor.com/releasenotes/7.1.0.en)、[外观设置帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/settings_appearance.html) 与 [默认设置源码](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift) |
| 多窗口、最近文稿、打开/保存、草稿恢复、恢复已保存版本、文件路径操作、打印 | 已实现基础版本；最近列表存于本机；桌面版以每窗口独立快照保存未保存文稿（每窗口最多 20 份、全局最多 100 份），旧会话在导入和读回核验后迁移；恢复管理器支持恢复、稍后、删除所选和确认清空；可确认后恢复保存快照、复制路径或在文件管理器中显示；页面设置可选纸张、方向、边距、标题、代码字号和打印行号 | 仍不同于 NSDocument 文稿恢复、文件协调、Cocoa 页面设置/打印面板及其全部排版选项；本机恢复库未加密且不自动过期；纵排打印 HTML/CSS 已有单测，但真实打印排版未验证 |
| 语法高亮与自动补全 | 72 个内置模式；可导入 `.cotsyntax` 文件夹，支持文件映射、基本注释/字符串分隔符、受限 ICU 正则与字面量高亮、成对/跨行范围、大纲模板、块缩进定界符及 `Completion.json` 补全词；导入有 JSON 大小/符号链接限制并报告未启用规则数 | 不是完整 CotEditor 解析器；按上游提交 `efd522f9fc9362a5211aef528b96a87dcad11335` 扫描 70 个 `.cotsyntax` 包，共 12,550 条高亮、9,709 个补全词；当前工作树有 12,534 条高亮通过编译及逐行执行检查。16 条不启用：8 条被正则/翻译安全边界拒绝，另 8 条虽可编译却每个分支都必需消费 `\R`，因此不可能命中 CodeMirror 的逐行输入。后者为 Markdown `keywords[1,2]`、`strings[2]`、`types[1,2]` 与 reStructuredText `keywords[5]`、`numbers[5]`、`types[1]`；此前统计把这些编译成功但实际无 token 的规则算作活动。其余 8 条拒绝包括 Markdown 的缩进代码块和 FrontMatter，Perl 两条 here-doc，以及 reStructuredText 四条跨行/变宽引用规则。两条官方 Markdown 粗体/斜体规则有实际 CodeMirror 着色测试。另有 4 条大纲规则仍拒绝：Haskell class 因嵌套量词回溯风险；Pascal Type 使用当前不支持的 `\T`，Function/Procedure 在 44 KB 伪声明压力样例上约耗时 251 ms。全量 107 条大纲中 103 条启用。reStructuredText overline 规则仅对精确官方表达式移除紧邻行尾断言的 possessive 标记，真实提取器回归通过；1 MB 匹配/不匹配输入中位耗时分别为 8.07/15.55 ms。89 条缩进定界符已接入。导入提示会报告未启用规则总数；包可导入不等于包内规则都生效。官方说明见 [CotEditor 功能页](https://coteditor.com/) |
| 查找与正则替换 | 普通文字搜索以 Unicode NFD 校验规范等价、排除仅兼容等价；真正正则按 JavaScript RegExp 加 ICU `\R`、`\h`、`\v`、`\Q…\E`、Unicode `\w`/`\W`、`\d`/`\D`、`\b`/`\B`、绝对锚点及常见 POSIX 类转换；`\R` 覆盖 CRLF、LF、CR、VT、FF、NEL、LS、PS；支持受限前导模式标志、简单原子上的无界 `*+`/`++`，以及简单单原子或单原子非捕获组的可选 `?+`；可变宽原子 `\R?+` 和复合原子保持拒绝；各类行尾命中均映射到正确源行 | 仍是兼容子集，不是 ICU 引擎；`\X`、`\G`、`\T`、扩展模式、属性别名、字符类集合运算、复杂/其他有界 possessive 重复及部分跨行反向引用未完整实现；新增反向引用仅覆盖受限单原子有界捕获，复杂/变宽形式继续拒绝；固定宽度原子组可安全转换，依赖回溯的复合原子组会明确拒绝，避免静默误匹配，见 [ICU 正则说明](https://unicode-org.github.io/icu/userguide/strings/regexp.html) |
| 多重替换定义管理/导入 | 当前工作树支持定义及规则排序、启停、正则、忽略大小写、全文/选区范围和定义级“仅匹配整词”；可拖放 `.cotrpl` JSON5/JSON 与 UTF-8 TSV，也可通过“导入…”选择多个文件；同名覆盖前询问；文件限 64 KiB、每字段 4 KiB、每定义最多 100 条规则且遵守现有 48 KiB 总容量，不会因超限淘汰已有定义；批量替换以分离的 CodeMirror 编辑块提交，保留中间未命中的混合行尾，插入换行使用文稿回退样式且整组可一次撤销/重做 | 对齐 CotEditor 7.1.0 的定义列表拖放导入及官方 `.cotrpl`/TSV 文件格式；本实现尚未进入正式 0.5.16 包。CotEditor 7.1.1 的 `.cotrpl` `settings.matchesFullWord` 现可导入、在管理器中查看/编辑并随设置持久化，仅作用于非正则规则；CotEdit 现按 ICU 默认 `\b` 的 word/non-word 类别切换检查命中两端，字符集采用 Alphabetic、Mark、Nd、Pc、U+200C 与 U+200D；这是受限跨平台实现，不等同 Foundation/ICU 实机语义，UAX #29 `useUnicodeWordBoundaries`（位 64）现可导入、编辑并随定义持久化，使用宿主 `Intl.Segmenter` 对正则 `\b`/`\B` 作词段边界近似校验；不等同 Foundation/ICU，且 JS 正则先选分支、后校验边界可能使备选分支不被尝试。TSV 仅接受查找/替换两列，额外列会拒绝导入以避免静默丢弃数据；`unescapesReplacementString` 已支持导入、编辑和持久化，仅对正则规则按 CotEditor 转义集合解码一次；`textualOptions` 的 Foundation `caseInsensitive` 位（整数 1）与 `anchored` 位（整数 8）现映射到定义级文字规则选项；`literal` 位（整数 2）也识别为已支持，因为文字规则始终按字面转义后匹配，无需额外状态：前者忽略大小写，后者仅在整个文稿或每个选区范围的起点搜索，不逐行匹配；这是范围起点行为的受限实现，不代表 Foundation 全部 Unicode 搜索语义等价。`regexOptions` 的 Foundation `caseInsensitive` 位（整数 1）已映射为定义级正则规则忽略大小写；`regexOptions.allowCommentsAndWhitespace`（Foundation 位 2）现可导入、在管理器中查看/编辑并随设置持久化，仅作用于正则规则；受限预处理忽略未转义的 Unicode Pattern_White_Space 与 `#` 行尾注释，保留转义字面量、字符类内容及 `\Q…\E` 引用区。它不是 ICU 解析器，其他扩展语法及 Unicode 空白分类边界仍可能不同。两项分别只作用于对应规则类型，JavaScript RegExp 实现不保证与 Foundation/ICU 的逐字节或 Unicode 匹配语义相同。除 `textualOptions.caseInsensitive`（位 1）、`textualOptions.literal`（位 2，文字规则的既有字面匹配）、`textualOptions.anchored`（位 8）、`regexOptions.caseInsensitive`（位 1）、`regexOptions.allowCommentsAndWhitespace`（位 2）、`regexOptions.ignoreMetacharacters`（位 4）、`regexOptions.dotMatchesLineSeparators`（位 8）与 `regexOptions.anchorsMatchLines`（位 16）及 `regexOptions.useUnixLineSeparators`（位 32）与 `regexOptions.useUnicodeWordBoundaries`（位 64）外，其他选项位仍不应用并会提示。位 16（`anchorsMatchLines`）在非 Unix 模式下现按 ICU 默认行终止符集合识别 LF、VT、FF、CR、NEL、LS、PS，并把 CRLF 作为单一边界；CotEdit 用零宽断言避免在 CRLF 中间产生锚点。与 Apple 文档一致，位 32 的 `useUnixLineSeparators` 仍把锚点和注释终止限定为 LF；此处不改变 `.` 对所有 ICU 终止符的完整语义。位 32 按 Apple 定义只将 LF 视作行分隔符；CotEdit 以受限预处理令无 dotAll 的正则 `.` 匹配非 LF 字符，并在组合位 16 时仅以 LF 作多行锚点，在注释模式下令 `#` 注释止于 LF。此近似不影响显式 `\R` 转换，且不声明与 Foundation/ICU 的完整语义等价，见 [Apple caseInsensitive 选项](https://developer.apple.com/documentation/foundation/nsregularexpression/options-swift.struct/caseinsensitive)、[dotMatchesLineSeparators 选项](https://developer.apple.com/documentation/foundation/nsregularexpression/options-swift.struct/dotmatcheslineseparators) 与 [anchorsMatchLines 选项](https://developer.apple.com/documentation/foundation/nsregularexpression/options-swift.struct/anchorsmatchlines)、[allowCommentsAndWhitespace 选项](https://developer.apple.com/documentation/foundation/nsregularexpression/options-swift.struct/allowcommentsandwhitespace)、[anchored 搜索选项](https://developer.apple.com/documentation/foundation/nsstring/compareoptions/anchored) 及 [Foundation 开源选项位值](https://github.com/swiftlang/swift-corelibs-foundation/blob/main/Sources/Foundation/NSRegularExpression.swift)。CotEditor 7.1.1 按 `NSRegularExpression.Options.rawValue` 序列化该掩码，见[官方编码模型](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/MultipleReplace%2BCodable.swift)。管理器的独立“高亮”按钮会对当前文稿原文分别匹配每条启用规则并合并重叠命中，不修改文稿、不复用普通查找高亮；由于替换规则顺序执行，高亮集合可能不同于实际替换命中；编辑文稿或规则后清除装饰，且高亮不会跨应用重启持久化。证据：[7.1.0 发布说明](https://coteditor.com/releasenotes/7.1.0.en)、[7.1.1 修复说明](https://coteditor.com/releasenotes/7.1.1.en)、[官方 settings 编码模型](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/MultipleReplace%2BCodable.swift)、[Apple `anchorsMatchLines` 语义](https://developer.apple.com/documentation/foundation/nsregularexpression/options-swift.struct/anchorsmatchlines) |
| 文件夹导航/搜索/预览 | 可按窗口选择根目录、浏览子目录、前进/后退文稿；递归搜索现已并入文件夹侧栏，可切换正则/大小写并从命中行打开；单击文件显示最多 512 KiB 只读预览，可按扩展名模式打开、“以纯文本打开”、“在新窗口打开”或交给系统默认应用。新窗口与默认应用路径都在主进程复核根目录、真实路径和普通文件类型；列表/搜索/预览限制在根目录并跳过符号链接；目录列表最多 500 项，搜索最多 2,500 个文件/500 个结果；搜索和预览从已打开句柄读取，分别限制在 1 MiB 与 512 KiB，并额外读取至多 1 字节检查文件增长 | CotEditor 5.0 引入文件夹导航侧栏，5.0.1 在文件预览提供“Open as Plain Text”，7.0.7 记录预览文件“Open in New Window”，7.1.0 加入文件夹文稿历史前进/后退及文件夹内多文件文本搜索；GitHub Releases 标示 7.1.1。7.1.0 要求 macOS 26+，7.0.9 要求 macOS 15+；CotEdit 的预览容量、搜索限制和跨平台打开规则是本项目实现，不是 Finder/Cocoa 文件协调或 Quick Look 的等价行为，见 [5.0.0](https://coteditor.com/releasenotes/5.0.0.en)、[5.0.1](https://coteditor.com/releasenotes/5.0.1.en)、[7.0.7](https://coteditor.com/releasenotes/7.0.7.en)、[7.1.0](https://coteditor.com/releasenotes/7.1.0.en) 与 [官方 Releases](https://github.com/coteditor/CotEditor/releases) |
| 缩进与 Tab Width | 新/未设置偏好默认使用制表符；每个语法可选择 Tab 或 1–99 个空格。独立全局 Tab 显示宽度提供 2/4/8 与自定义 1–99 列（默认 4）；Tab 输入、自动缩进、参考线、编辑器呈现和 HTML 打印分别读取缩进单元与 Tab 显示宽度，设置文件会保留 `tabWidth`。工作树新增默认关闭的“Tab 键缩进选中行”偏好（尚未进入正式 0.5.16 包）：开启后 Tab/Shift-Tab 对多范围选区所触及的整行增加/减少当前缩进；关闭时 Tab 保留原有的选区替换行为，Shift-Tab 不作用于非空选区。已有显式缩进偏好不被迁移覆盖 | 对齐 CotEditor 7.1.0 的 Mode 级 style/width 工作流及全局 Tab Width 2/4/8/Custom 菜单；官方 Mode 宽度范围为 1–99，7.1.1 默认设置 `tabWidth=4`、`autoExpandTab=false`、`indentWithTabKey=false`。CotEdit 设置控件和偏好导入/导出有 Node 回归；CodeMirror 的逐行缩进不等同 AppKit 文本布局/选择语义，Electron/Cocoa 菜单与原生文本系统行为未逐平台验证，仍不宣称 1:1。参见 [CotEditor 编辑设置帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/settings_edit.html) 与 [7.1.1 默认设置源码](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift) |
| 文本转换与 Unicode 规范化 | Text > 转换支持大小写、首字母大写、全/半角转换、URL 组件编码/解码以及 NFC/NFD/NFKC/NFKD/NFKC Case-Fold/Modified NFD/Modified NFC；无选区时对光标所在单词操作，有选区时只转换选区；全大写/小写使用 JavaScript `toLocaleUpperCase` / `toLocaleLowerCase`；首字母大写在既有 Unicode 空白分段下，先对每个片段整体执行 `toLocaleLowerCase`，再本地化大写首个 Unicode 标量，以保留希腊词尾 sigma 等上下文映射；转换结果与源文本相同时不提交文稿变更，光标词目标仍会选中；空白分类、locale 协商和 Foundation 的字符映射仍可能不同，不声明语义等价 | 对齐 CotEditor 使用本地化大小写 API 的工作流；运行时默认 locale 与 Foundation 的 locale 协商及特定字符映射仍未在各目标平台逐项验证，其他规范化使用 JavaScript Unicode API，不承诺与 Foundation 逐字节相同，见 [CotEditor 转换源码](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView%2BTransformation.swift) 与 [规范化实现](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/StringUtils/String%2BNormalization.swift) |
| 编码 | BOM 优先、其余由 `chardet` 估计；支持常见编码读取与转换；“查看 > 检查器 > 警告”按严格 round-trip 列出不兼容字符、码位、首次行列及次数，结果最多显示 200 种 | 编码识别仍是启发式；警告面板是 CotEdit 的跨平台实现，不是 CotEditor 的原生 Inspector；全量检测对比所选编码下保存往返，而非估算，保存时也会阻止静默数据丢失 |
| 换行符 | 保存并映射每个 LF、CRLF、CR、NEL、LS、PS；状态栏可提示混合行尾，格式菜单“检查混合换行符…”在有混合行尾时启用；检查器按类型统计并列出有限行号样本，用户可保留或显式统一为主流格式；编辑/删除/插入时尽量保留未受影响的行尾；统一格式后，后续插入的新行采用所选行尾 | 已覆盖六种类型和混合格式的往返；新增回归验证统一行尾格式后，新插入行沿用该格式且文本编辑的 Undo/Redo 仍恢复准确的行尾元数据。CotEditor 7.1.1 正式发行说明也记录了混合行尾文稿中 Redo 和 Replace All 的行尾修复；CotEdit 此处是独立实现，不代表 Cocoa 文稿模型等价。诊断 UI 仍为 CotEdit 自有跨平台实现，见 [CotEditor 4.2 发布说明](https://coteditor.com/releasenotes/4.2.0.en) 与 [CotEditor 7.1.1 发布说明](https://coteditor.com/releasenotes/7.1.1.en) |
| 分屏、大纲、字符/警告检查器 | 已实现基础能力；导入语法的大纲模板可生成导航项；警告检查器报告当前编码无法无损表示的字符；文稿检查器现为非模态停靠面板，可在编辑不中断时实时显示文件、文本设置、计数和字符摘要，并可折叠各区段；文件区显示大小、可用的创建/修改时间和 POSIX 权限；完整本地路径旁可显式定位到系统文件管理器 | CotEditor 7.1.1 的文稿检查器以 `HostedPaneView` 与 DisclosureGroup 组织 File、Text Settings、Count、Character；CotEdit 现以跨平台近似覆盖四组可折叠工作流，Character 仅对首个完整选中字素显示码位，单标量附加名称/区块/类别。文件元数据取打开时或最近一次本地保存后的快照，外部修改不会自动刷新；Windows 不将 mode 位伪称 POSIX ACL。定位动作复用既有本地 reveal IPC，不提供远程或未保存文稿按钮。所有者现显示数值 UID/GID 快照（不解析账户名）；仍未复刻 Finder 标签、Cocoa 侧栏尺寸/驻留和原生交互，见 [DocumentInspectorView.swift](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Inspector/DocumentInspectorView.swift) |
| 行编辑命令 | 复制、删除、上移/下移、合并、拆分、缩进和注释等；0.5.2 增加最近匹配 `()`、`[]`、`{}` 和单双/反引号的内部内容选择；0.5.16 增加排序、按模式排序、反转、随机打乱和删除重复项。无选区时处理全文，有选区时处理完整行块；混合行尾随原行保留。Toggle Comment 的单一连续选区现按 CotEditor 7.1.1 默认的视觉缩进定位（空格 1 列、Tab 按当前 Tab 宽度计列），混合缩进时将分隔符放在共同视觉列；空白行不降低共同缩进 | 五项行菜单的顺序与 CotEditor storyboard 中 Sort、Sort by Pattern、Reverse、Shuffle、Delete Duplicates 一致；上游这五项均无静态快捷键，CotEdit 不臆造。行注释修正现覆盖单一连续选区及多个不连续选区的 Toggle Comment；所有选区合并后的唯一目标行共同计算最小视觉缩进，空白行不降低基准，多选区经同一事务保留；无目标行注释符而语法具有块注释符时，Toggle Comment 现回退到 CodeMirror 按行块注释。显式 Comment Out/Uncomment、同时提供行与块分隔符时的完整块 `canUncomment` 判断及 Foundation/Cocoa 行为仍未完整复现；Tab 跨越目标列时按 CotEditor 算法落在整字符边界、不拆分 Tab，并有回归覆盖。上移/下移复用 CodeMirror 命令；包围符号逻辑不解析注释或完整语言语法，仍非 Cocoa 原生行为。视觉缩进定义参照 [CotEditor 注释算法](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextEditing/String%2BCommenting.swift)、[默认偏好](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift) 与[编辑设置说明](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/settings_edit.html) |
| 菜单快捷键与键位帮助 | Electron 菜单含 File/Edit/Format/View/Text/Find/Window/Script/Help 分组；Edit 的 Delete、“选择 > 全选”、“精确粘贴”、“以富文本复制”、“插入反斜线”、“插入日元符号”和“按 Unicode 码点插入…”已接通；精确粘贴使用剪贴板纯文本原样替换选区（⌥⌘V；非 macOS 为 Ctrl+Alt+V）；View > Sidebar 含文件浏览器和文件夹查找（⌃⌘1/2；非 macOS 为 Ctrl+Alt+1/2）；Inspector 子菜单含文稿检查器、大纲、Unicode 字符和警告；新增“显示检查器”总开关，当前无面板时打开文稿检查器、已有面板时关闭当前面板（⌘I/Ctrl+I）；CotEditor storyboard 未给文稿检查器静态默认快捷键，CotEdit 不臆造；Window 菜单有置顶和全部窗口置前；Help 有本地使用说明；快捷键帮助从共享注册表生成，支持录入组合键、冲突拒绝、单项/全部恢复默认；自定义组合保存到应用偏好并更新 Electron 菜单快捷键字段 | 仍未逐项复刻所有菜单项/原生验证规则；Edit > 语音现通过 Web Speech API 按选区或全文请求平台语音朗读，不等同 CotEditor/AppKit 语音菜单及系统语音面板；文稿检查器现为非模态停靠面板近似，不等同 Cocoa `HostedPaneView`；设置文件只迁移 CotEdit 偏好；系统语法检查、立即检查命令、自动更正和原生拼写面板、从 iPhone/iPad 插入入口未复刻；最近码点历史仅在未发行工作源码中以 CotEdit 自有对话框近似；分享菜单仅在 macOS 使用 Electron `shareMenu` 角色；自定义组合由 renderer 分派以避免原生重复注册，默认组合及 AppKit 原生行为仍需目标平台实机验证 |
| 无障碍 | 标签页导航、状态播报、设置弹层聚焦、Escape 关闭、浮动面板焦点返回、主/分屏编辑区名称、状态描述与编辑器键盘焦点环已实现一部分；状态栏语法模式/编码/换行符选择器现在对键盘 `:focus-visible` 显示强调色轮廓，并由真实 Electron Tab 导航烟测验证 | 仍未完成 VoiceOver/NVDA 实机审计；复杂面板的焦点陷阱、Cocoa 原生辅助技术行为及全量动态播报不能视为等价；当前焦点环的 Electron/Xvfb 验证不能代替目标平台读屏实测 |
| 脚本、主题与语法包 | Script 菜单支持本地 JavaScript 文本转换；编辑器主题含 CotEditor 7.1.2 的 14 个内置主题，并支持最多 64 个用户主题的切换、改名、删除和颜色编辑；`.cotsyntax` 子集覆盖文件映射、注释/字符串、正则/字面量高亮、范围、大纲、块缩进和补全词 | 不提供 CotEditor 脚本 API、文稿/窗口对象模型或完整语法解析器；主题管理使用跨平台 Web 控件而非原生 SwiftUI ThemeEditor；selection、insertionPoint、highlight 分别使用 CSS `Highlight`、`CanvasText`、`AccentColor` 系统语义色并随应用浅/深色方案更新，不保证与 AppKit 色值完全相同；完整 ICU、部分复杂跨行/大纲规则与所有上下文解析仍缺失；可参阅 [脚本说明](https://github.com/coteditor/CotEditor/wiki/CotEditor-Scripts)、[附加主题](https://github.com/coteditor/CotEditor/wiki/Additional-Themes) 与 [附加语法样式](https://github.com/coteditor/CotEditor/wiki/Additional-Syntax-Styles) |
| 纵排文本（中日韩） | View 菜单和设置面板可切换 CSS 纵排；可见/活动行号来自实际文档行号；渲染列内鼠标点击与拖选使用浏览器原生竖排 caret 命中；Up/Down 按 Unicode 字素移动，Left/Right 在相邻书写列间移动并保留字素列；查找滚动延后到 CodeMirror 更新后读取几何，并跳过不在 `visibleRanges` 中的占位位置 | Linux Electron 180 行样例已实测：点击第90列能到“行90，列14”，拖动会选中正确中文，方向键从行90列1依次到行90列2、行91列2、行91列1、行90列1。900 行 UI 回归已覆盖远端转到行、大纲跳转、搜索 `line-900` 及中段横向滚动；新增 6,000 字符单行回归，确认具有可用纵向滚动范围且末端光标可见。它是 `writing-mode: vertical-rl` + CodeMirror 的近似适配，不是 Cocoa 文本内核；多行拖选仍有边界，全局偏好不随文稿保存；打印 HTML 只验证纵向 flow，未证明原生打印一致。CotEditor 官方介绍及 [2.2.0 发布说明](https://coteditor.com/releasenotes/2.2.0.en)确认其支持纵排文本 |
| 完整偏好设置与完整本地化 | 设置面板覆盖常用编辑器/打印偏好；工具栏可对 8 个现有项目逐项显隐、键盘上/下排序、取消/应用/恢复默认，设置跨窗口同步并纳入设置文件导入/导出；界面仍以简体中文为主 | CotEditor 5.0.6 发布说明明确记载将 Writing Tools 加入工具栏定制选项，7.1.0 开发记录提到重置工具栏定制，但这些来源未给出完整项目清单或排序交互；CotEdit 是跨平台近似工作流，不等同 Cocoa `NSToolbar` 原生定制面板，也不宣称行为 1:1，见 [5.0.6 发布说明](https://coteditor.com/releasenotes/5.0.6.en) 与 [7.1.0 发布说明](https://coteditor.com/releasenotes/7.1.0.en) |
| 文件拖放插入（File Drop） | 桌面版编辑区接受文件拖放；“编辑器设置 > 文件拖放…”可新增、删除、排序和编辑规则；按列表从上到下匹配语法及扩展名，空条件匹配全部，未命中时插入绝对路径；规则列表支持方向键浏览；支持 CotEditor 的 8 种路径/文件名/扩展名/目录变量，以及 `FILECONTENT`、`IMAGEWIDTH`、`IMAGEHEIGHT`。默认 Markdown 图片/链接、HTML 图片/脚本/页面链接、CSS `url(...)` 模板；HTML 默认图片模板含尺寸属性。相对路径按已保存的本地文稿目录计算；多文件按拖放顺序、以换行分隔。拖放点在当前选区内时替换该选区，否则在拖放点插入；一次最多 32 个文件、单路径最多 4 KiB、最终插入最多 64 KiB、规则数最多 100 且单格式最多 8 KiB。主进程重验规则；只有用户主动拖放且首条匹配规则模板明确引用 `FILECONTENT` 时，才安全读取普通文件；单文件及每次拖放正文累计均限 64 KiB，仅接受严格 UTF-8，并拒绝二进制、目录、符号链接及读取期间变化。只有模板显式引用尺寸变量时，才从有界文件头解析 PNG/GIF/JPEG/BMP/WebP 和经典 TIFF 尺寸（classic TIFF，不含 BigTIFF），每文件最多 1 MiB、每次拖放最多 4 MiB；仅提取尺寸元数据、不解码图像；格式未知或文件头无效时整次不插入。路径类模板不读取文件正文或图像文件头 | 按 [CotEditor 7.1.1 默认模板](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift)、[File Drop 帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/about_filedrop.html)和 [Snippets 设置帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/settings_snippets.html)及 [FileDropItem.swift 实现](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/Snippet/FileDropItem.swift)核对；官方默认 HTML 图片规则使用 `IMAGEWIDTH/IMAGEHEIGHT`，帮助将 `FILECONTENT` 限定为 UTF-8 文本。图片尺寸仅实现有界头部解析，不等同 `ImageIO` 支持的完整格式集合；经典 TIFF 仅支持宽/高 tag 的单值 BYTE/SHORT/LONG 头部形式，BigTIFF/HEIC/SVG 等仍未覆盖；macOS 专用 `.textClipping` 仍未实现。CotEdit 使用自己的 HTML 设置对话框而非 CotEditor 的 Cocoa Snippets 偏好窗格/表格控件；真实 Electron 拖放 smoke 仍只证明 Linux/Xvfb，不能替代 macOS/Windows 实机验收 |

按官方提交 `efd522f9fc9362a5211aef528b96a87dcad11335` 的实际规则索引，本轮确认没有一条剩余高风险候选能在现有行级 tokenizer 与受限 ICU 转换下同时做到语义等价、安全和有运行时证据，因此不放宽安全门槛。未启用的 9 条高亮规则是：Markdown `keywords[5]`（blockquote）、`strings[0]`（缩进代码块）、`strings[1]`（FrontMatter）；Perl `characters[0]`、`strings[0]`（here-doc）；reStructuredText `characters[1]`（codeblock）、`keywords[4]`（dt）、`numbers[4]`（table）和 `types[0]`（overline 标题）。另有 8 条表达式虽然能单独转成 JavaScript 正则，但每个有效分支都必需消费 `\R`，当前 CodeMirror 一次只对一行运行正则，无法命中其跨行语义；回归已验证它们不会静默产生局部 token：Markdown `keywords[1,2]`、`strings[2]`、`types[1,2]`，reStructuredText `keywords[5]`、`numbers[5]`、`types[1]`。

仍拒绝的 4 条大纲规则为 Haskell `Outlines.json[2]`（嵌套无界重复风险）及 Pascal `Outlines.json[0]`（ICU `\T` 语义未证实）、`[2]` Function、`[3]` Procedure（嵌套无界重复；44 KB 近似声明由子进程硬超时回归保护）。reStructuredText `Outlines.json[1]` 则是另一条独立规则：仅对精确官方 overline 表达式移除紧邻行尾的 possessive 标记，并已通过真实大纲提取测试。它不代表 reStructuredText **高亮** `Highlights.json` 的 `types[0]` 也可在逐行模型中启用。

## 已按上游源码核对的快捷键

以下键位按 CotEditor 7.1.1 正式发行版作为稳定对照，并补充核对本机上游 `main` checkout：commit `efd522f9fc9362a5211aef528b96a87dcad11335`（2026-10-05，项目版本字段为 7.2.0-alpha）。菜单键位来自 [storyboard](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Storyboards/Base.lproj/Main.storyboard) 的静态默认值；用户可在 CotEditor 设置中更改键位，开发分支和目标发行版也可能不同。CotEdit 在 macOS 保留可移植的默认组合；CotEditor 本身是 macOS 应用，所以 Windows/Linux 映射属于 CotEdit 的平台适配，不是上游保证。

CotEditor 7.1.1 发布说明明确加入“单次按键可产生多个字符”的快捷键支持。CotEdit 以浏览器逻辑 `KeyboardEvent.key` 捕获和匹配；键值做 NFC 规范化，多字符序列在录入、事件匹配、冲突判断、主进程 IPC 净化及设置持久化中保留大小写；单字符 ASCII/Unicode、功能键和命名键继续使用既有内部规范形式。帮助列表和菜单标签对非 ASCII 输出保留其逻辑键值（例如 `ß` 显示为 `ß`，不由 Unicode 大写转换扩展成 `SS`）。接受最多 16 个 Unicode 标量的无空白可打印键输出；IPC 只接收已登记命令 ID、裁剪非布尔修饰状态，并要求可打印键绑定至少有一个修饰键（F1–F24 除外）。多字符与非 ASCII 键由 renderer 派发，并作为菜单自定义标签显示，不注册为 Electron 原生 accelerator。上游源码允许非空多字符 key equivalent；CotEdit 保留较低的本地上限，避免无限长设置值扩散到 IPC/菜单标签。Node 测试不证明目标系统的物理键盘布局、输入法、原生菜单或 macOS 行为，证据为 [CotEditor 7.1.1 官方发布说明](https://coteditor.com/releasenotes/7.1.1.en)与[上游实现提交](https://github.com/coteditor/CotEditor/commit/897e55f1103c6c14e906bbbca536e6e715af04b4)。

| 操作 | CotEditor 已核实键位 | CotEdit 对应 | 状态 |
|---|---|---|---|
| 新建标签页 | ⌘T | ⌘T / Ctrl+T | 已实现为新建文稿标签 |
| 选择单词 | ⌘D | ⌘D / Ctrl+D | 已实现；纠正此前把该上游键位误记为复制行的问题 |
| 复制行 | ⇧⌘D | ⇧⌘D；Windows/Linux 为 Alt+Shift+↓ | 已实现；Windows/Linux 使用平台替代映射 |
| 删除行 | 当前 storyboard 未声明静态键位 | CotEdit 自定义为 ⇧⌘⌫ / Shift+Ctrl+Backspace | 已实现；不宣称与上游默认键位相同 |
| 合并行 | ⇧⌘J | ⇧⌘J / Ctrl+Shift+J | 已实现当前行与下一行合并 |
| 按行拆分选区 | ⌃L | macOS：Control+L；Windows/Linux：Alt+Shift+L | 已实现多选区；平台替代避免与转到行的 Ctrl+L 冲突 |
| 向上/向下选择列 | ⌃⇧↑ / ⌃⇧↓ | Control+Shift+↑ / ↓ | 已实现多选区列选择 |
| 选择行 | ⇧⌘A | ⇧⌘A / Ctrl+Shift+A | 已实现 |
| 转到行 | ⌘L | ⌘L / Ctrl+L | 已实现；无编辑器选区或编辑焦点不在编辑区时分派此命令 |
| 自定义包围选区 | ⌘L | ⌘L / Ctrl+L | 上游与“转到行”静态键位冲突；CotEdit 两个菜单项都显示该键，但不重复注册，由编辑焦点及非空选区上下文分流；两条路径均有 Electron/CDP 键盘回归 |
| 查找全部 / 选择所有查找匹配项 | ⇧⌘F（Find All）；后者无默认键位 | ⇧⌘F 打开查找面板并应用查询；独立菜单项“选择所有查找匹配项”创建多选区 | 已分开处理；可见匹配项实际高亮，Cocoa 查找面板行为仍未实机等价验证 |
| 高亮全部匹配项 | ⇧⌘H | ⇧⌘H / Ctrl+Shift+H | 已实现持久高亮，可通过“移除高亮”清除 |
| 移除高亮 | ⌃⇧⌘H | ⌃⇧⌘H / Ctrl+Alt+Shift+H | 已实现；非 macOS 组合为无冲突平台替代键 |
| 将选区用于查找/替换 | ⌘E / ⇧⌘E | ⌘E / ⇧⌘E；Windows/Linux 为 Ctrl 组合 | 已实现 |
| 切换注释 | ⌘/ | ⌘/ / Ctrl+/ | 已实现，实际注释语法取决于当前语言模式 |
| 调整缩进 | ⌘[ / ⌘] | Command+[ / ]，Windows/Linux 为 Ctrl+[ / ] | 已实现菜单命令 |
| 字号增大/减小/重置 | ⌘+ / ⌘- / ⌘0 | ⇧⌘= / ⌘- / ⌘0；Windows/Linux 为 Ctrl+Shift+= / Ctrl+- / Ctrl+0 | 已实现；加号通过物理等号键加 Shift 匹配 |
| 替换并查找下一个 | ⌥⌘G | ⌥⌘G / Ctrl+Alt+G | 已实现 |
| 重置语法分析 | 当前 storyboard 未声明静态键位 | ⌥⌘R / Ctrl+Alt+R | CotEdit 自定义，快捷键表与原生菜单共享注册表 |
| 跳转到选区 | ⌘J | ⌘J / Ctrl+J | 已实现；仅在有非空选区时启用 |
| 文件浏览器 / 文件夹查找 | ⌃⌘1 / ⌃⌘2 | ⌃⌘1 / ⌃⌘2；Windows/Linux 为 Ctrl+Alt+1 / Ctrl+Alt+2 | 已实现；按 CotEditor storyboard 默认组合映射 |
| 上/下一个大纲项 | ⌥⌘↑ / ⌥⌘↓ | macOS：同上；Windows/Linux：Ctrl+Alt+Shift+↑ / ↓ | 按光标行选择相邻条目；边界处不循环，当前无条目时不动作 |
| 显示标签栏 | ⇧⌘T | ⇧⌘T / Ctrl+Shift+T | 已接入原生菜单与现有偏好切换 |
| 显示工具栏 | ⌥⌘T | ⌥⌘T / Ctrl+Alt+T | 已接入原生菜单与现有偏好切换 |
| 显示文稿侧栏 | ⌃⌘S | ⌃⌘S / Ctrl+Alt+Shift+S | macOS 对齐 storyboard；非 macOS 使用平台替代 |
| 文稿检查器 | 当前 storyboard 未声明静态键位 | 无默认快捷键 | 菜单入口已接通；不臆造默认键位 |
| 显示字符 | ⌥⌘I | ⌥⌘I；Windows/Linux 为 Ctrl+Alt+I | 仅恰好一个完整字素选区启用并锚定；附 Unicode 17 名称、区块、类别和码点/编码字段；固定检查器仍按光标位置工作 |
| 关闭分屏编辑器 | 无静态键位 | 无新增快捷键 | 仅在分屏启用时可用，复用现有分屏关闭行为 |
| 上移/下移行 | ⌃⌘↑ / ⌃⌘↓ | macOS：⌃⌘↑ / ⌃⌘↓；Windows/Linux：Ctrl+Alt+↑ / ↓ | macOS 键位已修正为 storyboard 默认值；非 macOS 组合为平台替代 |
| 插入日元符号 | ⌘Y | ⌘Y / Ctrl+Y | Edit 菜单与共享快捷键动作已接通 |
| 插入反斜线 | `keyEquivalent="¥"`（CotEditor 7.1.1） | macOS：⌘¥；Windows/Linux：Ctrl+Alt+Y（CotEdit 替代） | renderer 派发非 ASCII 键；真实键盘布局及原生菜单行为仍待实机验证，非 macOS 键位不声称上游一致 |
| 高级字符计数… | 无静态键位 | 无新增快捷键 | Text 菜单与状态栏入口启动/设置；实时按任一非空选区集合或全文计数，支持字素簇/Unicode 标量/UTF-16/字节与规范化形式 NFD/NFC/NFKD/NFKC/NFKC Case-Fold/Modified NFD/Modified NFC、忽略换行/空白、合并连续空白及当前支持的 8 种编码。字节计数最多处理 1,200 万 UTF-16 单元；规范化形式已按 CotEditor 分组提供 NFD/NFC/NFKD/NFKC/NFKC Case-Fold 与 HFS+ Modified NFD/NFC；与上游相同，字素簇单位隐藏规范化选择 |

CotEditor 当前 storyboard 的主菜单分组为应用菜单、File、Edit、Format、View、Text、Find、Window、Script、Help。CotEdit 0.5.11 保留这些主分组顺序，并将 Unicode 字符/警告收进“查看 > 检查器”；增加 Delete 菜单动作、“选择 > 全选”层级和新建/打开分隔，同时保留按语法模式持久化缩进、编码兼容性扫描、跨平台纵排显示、`.cottheme` / 受限 `.cotsyntax`、文件夹搜索/预览、最近文稿、设置导入导出和打印设置等工作流。Find All 与多选所有查找匹配项依上游菜单分成两个操作；Highlight All/Remove Highlights 现有独立持久高亮实现。容量限制、菜单/文件系统交互及行为仍不同于 CotEditor 原生脚本环境、NSDocument、系统 Open Recent、Finder 预览或 AppKit 打印/页面设置。CotEdit 的保存、分屏与自动换行由本项目命令实现；本轮把 macOS 行移动、日元符号与反斜线默认键位映射到 storyboard；Windows/Linux 对反斜线使用 CotEdit 平台替代键。实际键盘与系统原生菜单仍待目标平台实测，不能据此视为原生等价。

快捷键编辑面板参考了 CotEditor 的 [4.1.1](https://coteditor.com/releasenotes/4.1.1.en) 与 [4.5.0](https://coteditor.com/releasenotes/4.5.0.en) 发布说明：支持不含 Command 的组合、报告键位冲突，并支持单个功能键。CotEdit 在 Linux Electron UI smoke 中实测了重复键位拒绝、用户组合保存、菜单动作分派和恢复默认；为避免普通输入被快捷键意外吞掉，不允许无修饰字母/标点键，因此仍不同于完整 CotEditor 键位编辑器。macOS AppKit 原生呈现、Windows/Linux 菜单样式及辅助技术行为未作逐平台等价声明。

CotEditor 7.1.1 的[正式发行说明](https://coteditor.com/releasenotes/7.1.1.en)提到支持“单次按键产生多个字符”的快捷键。CotEdit 除已有多字符输出外，现在也接受单个非 ASCII 可打印 `event.key`（如 `ß`）作为自定义键：匹配采用浏览器报告的逻辑字符而非物理 `code`，并由 renderer 分派，不注册为 Electron 原生 accelerator。单测覆盖归一化、匹配、偏好过滤与菜单标签；实际键盘布局事件，以及 macOS/Windows 原生菜单行为仍未实机核验。

0.5.7 另补齐 Text > Indentation 的空格/制表符转换，以及 Surround Selection With 的单/双引号、圆括号、花括号和方括号动作；包围命令仅在存在非空选区时启用，且未宣称与 CotEditor 完全相同的选择方向/语言上下文行为。

0.5.8 另补 Text > 文本转换中的 Unicode 首字母大写、URL 组件编码/解码，以及 NFC/NFD/NFKC/NFKD 规范化。新操作限定于非空选区；URL 解码遇到非法百分号序列时提示并保持原文不变。这里使用 JavaScript `String.normalize` 与 URI 组件 API，并非 CotEditor 内部 Foundation 实现的逐字节兼容承诺。

0.5.9 修复 `.cotsyntax` 字面结束符忽略大小写时 Unicode 扩展小写导致的原文索引错位；新增负向 POSIX `xdigit` 的安全 ASCII 语义支持，并让草稿恢复跳过损坏条目后再选取最多 20 份。macOS `open-file`、首次启动文件参数和 Electron `second-instance` 路径可进入现有编辑窗口，且只在 renderer 完成加载后派发。安装配置现为 macOS 注册 CotEditor 文本/源码文稿扩展，Linux 桌面入口声明标准文本 MIME 类型；Windows NSIS 自定义钩子将同一组 90 个扩展添加到当前用户的 `OpenWithProgids`，不更改每个扩展的默认程序；卸载仅在注册命令仍指向当前安装路径时清理。打印 HTML 已为纵排偏好保留纵向 flow，现有单元测试只验证生成标记/CSS，并未替代真实打印对话框验收。

本轮继续优化纵排编辑：行号改用文档行号属性，分屏文稿状态同步保留横/纵两个滚动偏移；基于 Chromium 原生竖排 caret 命中实现可见列鼠标定位、拖选、双击选词和三击选行；竖排方向键改为按字素移动及左右跨列。同时让选词/包围符菜单仅在文稿存在时启用、选中行合并仅在有选区时启用，修复 ICU `\\R` 忽略 VT/FF，并调整 File 核心命令顺序。查找触发器现在暴露/同步 `aria-expanded` 与控制关系，Escape 可从查找面板控件关闭；标签溢出菜单支持 Home/End，切换后焦点回到活动标签。

## 0.5.11 快捷键冲突与编辑器焦点

CotEditor 当前 storyboard 将 `⌘L` 同时标给“转到行”和“自定义包围选区”。CotEdit 现让两项菜单均显示 `⌘L`（Windows/Linux 为 `Ctrl+L`），但关闭两项 Electron 加速键重复注册：编辑器有焦点且主选区非空时打开自定义包围对话框；否则打开“转到行”。Electron/CDP 烟测实际发送 Ctrl+L，分别验证两条路径及 Escape 关闭；快捷键目录和单测将该冲突作为唯一允许的重复组合显式标注。

浏览器预览的快捷键目标判断不再把 CodeMirror 的 `.cm-content[contenteditable=true]` 当成普通表单控件，以恢复编辑区中的快捷键处理。0.5.11 历史结果为 `npm test` **160/160**、`npm run test:ui` **1/1**；仍需 macOS 原生菜单实机确认 `registerAccelerator: false` 下快捷键显示方式与 VoiceOver 行为。

## 0.5.12 纵排长文远端定位

旧版遇到视口外目标时，CodeMirror 将逻辑文档 y 偏移误映射为数百万像素的屏幕垂直偏移；Linux Electron/Xvfb 的 900 行复现中，目标行虽挂载，插入点却在视口外。现于纵排选区更新后复位这类虚拟 y 偏移，并在真实 Electron 测试中覆盖“转到行 900”、Markdown 大纲远端标题跳转、从首行搜索 `line-900`；三条路径均断言目标光标/选区进入视口。另以打印 HTML 生成器和 Electron `webContents.printToPDF` 对 900 行纵排文稿按 A4 实际导出，得到 27 页；PDF 文本抽取确认 1–900 行均存在。此结果验证 Linux Chromium 生成 PDF 的长文完整性，不等于实际系统打印对话框、打印驱动、macOS/Windows 分页体验或所有页面设置已验证；整篇文稿的连续横向滚动仍未实现。

## 0.5.13 纵排连续列滚动与语法规则覆盖

纵排编辑器为每行建立稳定的横向文档列，并按 CodeMirror 行块位置映射虚拟视口；滚动到文档中部会挂载对应列，不移动原插入点。真实 Electron/Xvfb 的 900 行回归验证转到第 900 行、Markdown 大纲跳转、搜索 `line-900`，以及滚到约第 450 行且目标列可见、插入点仍保留在第 900 行。滚动条保留横向操作，隐藏虚拟 y 轴滚动条；这不是 Cocoa `NSTextView` 原生布局的逐项复刻。

语法规则扫描覆盖本机 70 个上游 `.cotsyntax` 包，共 12,550 条高亮规则，12,536 条进入活动集；14 条继续拒绝：2 条 PowerShell 有界 `?+`、9 条复杂反向引用、1 条消费换行的 Markdown 跨行规则、1 条嵌套量词风险及 1 条歧义重复分支。常见单码点确定性原子上的无界 `*+`/`++` 现转换为 greedy repeat 加终端保护断言；其余有界/复合 possessive 量词不冒险降级。5 条大纲失败中，1 条使用尚不支持的 `\T`，另 4 条超出当前安全/复杂表达式边界。该扫描不是所有上游语法包版本的永久覆盖保证。

## 0.5.14 ICU 可选 possessive 量词兼容

仅对简单单原子及由一个简单原子构成的非捕获组支持 ICU `?+`，通过有序分支确保匹配器只在量词起点不匹配原子时选择空分支；可变宽原子 `\R?+`、其他复合原子和有界/复合 possessive 形式继续拒绝。该安全子集使 PowerShell `.cotsyntax` 中两条数字规则进入活动集。重新扫描本机 70 个上游语法包（12,550 条高亮规则、9,709 个补全词）后，12,538 条高亮规则启用，12 条明确停用：8 条复杂反向引用、2 条可能跨行的 Markdown 规则、1 条高风险嵌套量词和 1 条歧义重复分支；5 条大纲规则仍未编译。此次测试为 `npm test` **164/164**、Electron UI smoke **1/1**。扫描结果只代表当前本机上游 checkout，不保证未来语法包版本。

## 0.5.10 菜单与桌面 UI 增量

依据本机 CotEditor `Main.storyboard` 的 Text > Transformations，新增普通全角/半角及 Roman 全角/半角四项，并继续采用非空选区启用策略。普通转换实现可打印 ASCII/空格与 Unicode 半角片假名、浊音组合的双向映射；Roman 版本只转换字母与数字。这是可预测的兼容子集，不宣称等同 Foundation/ICU 对所有全宽兼容字符的转换结果。

“Surround Selection With”增加“自定义…”弹窗：独立 begin/end 字段、空 begin 校验、空 end 回退为 begin，并本地记忆最近使用值；原有多选包围逻辑负责编辑选区。CotEditor storyboard 为该菜单项指定 `⌘L`，但同一应用中“Go to Line”也使用 `⌘L`；CotEdit 保持“转到行”的既有注册，将自定义项保留为菜单操作而不增加歧义快捷键。菜单层级和动作依据 [CotEditor Main.storyboard](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Storyboards/Base.lproj/Main.storyboard)、[EditorTextView+Transformation.swift](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView%2BTransformation.swift) 与 [EditorTextView+SurroundSelection.swift](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView%2BSurroundSelection.swift) 核对。

编辑区现将活动文稿 tab 显式关联为 `tabpanel`。新增 Electron/CDP 自动化烟测，在真实 renderer 内执行自定义包围编辑，并验证查找关闭后焦点返回、标签左右键与溢出菜单 Home/End/Escape 行为；此测试使用当前 Linux/Xvfb 桌面会话，不替代 VoiceOver/NVDA、真实系统菜单或 Windows/macOS 实机验收。

## 当前验证边界

当前稳定对照采用 CotEditor [7.1.1 正式版](https://github.com/coteditor/CotEditor/releases/tag/7.1.1)；本机可读的上游 `main` checkout 是 7.2.0-alpha 开发快照，不作为稳定基线。最新定向行尾/多重替换测试 **39/39 通过**，完整 `npm test` **500/500 通过**，本轮两个 JavaScript 文件 `node --check` **2/2** 通过。本轮只做源码、测试与文档，未构建、未运行 Electron UI smoke 或打包；正式版本仍为 **0.5.16**，本修正尚未发行。正式 0.5.16 AppImage 与 DEB SHA-256 清单校验通过；本轮没有写入 `dist/` 或 `release/`。此前记录的 70 个上游语法包扫描为 12,533/12,550 条高亮规则可用、103/107 条大纲可用；本轮未重新扫描。Linux Node 自动化结果不证明 macOS/Windows 原生菜单、Foundation 文本搜索、打印或辅助技术行为等价；本轮没有运行 UI 烟测。

0.5.9 的历史 Linux/X11 结果仍见下文。0.5.16 发布快照源码历史验证：`npm test` **173/173 通过**；`npm run test:ui` **1/1 通过**。DEB 解包后的 Electron 应用及 AppImage 的 `APPIMAGE_EXTRACT_AND_RUN=1` 解压运行模式均通过 CDP UI smoke **1/1**；AppImage smoke 以 `COTEDIT_CDP_TIMEOUT_MS=20000`、`COTEDIT_UI_TIMEOUT_MS=120000` 扩展诊断时限复跑通过，默认 smoke 超时仍为 8/60 秒。Linux x64 AppImage 约 122 MiB，amd64 DEB 约 96 MiB；DEB 元数据与打包 `app.asar` 均为 0.5.16。SHA-256 清单见 `release/CotEdit-0.5.16-SHA256SUMS`，源码 ZIP 为 `/workspace/CotEdit-0.5.16-source.zip`。按用户授权，为释放临时空间移除了 0.1.0–0.5.0 五个旧版 AppImage；0.5.15 包及其他历史产物保留。AppImage 默认 FUSE 启动因当前用户无 `/dev/fuse` 读取权限未验证；DEB 实机安装、Windows/macOS 原生构建和签名、真实系统打印及 VoiceOver/NVDA 尚未实测；bundle 约 1.39 MB，仍有 Rollup 分块体积提示。

本次追加：原子覆盖保存保留已有 POSIX rwx 权限位，新建文稿继续默认私有；替换采用临时文件原子重命名，因此 ACL、扩展属性和文件所有权不承诺保留。启动时清理最近文稿中的失效路径。两个真实 Electron 窗口的集成烟测确认偏好同步（第一窗口写入深色外观/字号 23，第二窗口随即更新）；`.cottheme` 自定义主题跨窗口更新代码路径已加入，但未单独做运行时验证。Find 菜单新增“跳转到选区”，仅在有非空选区时启用；Find All 与 Select All Find Matches 已分离。新增基于可见范围的真实 CodeMirror 匹配装饰，并补齐 Highlight All/Remove Highlights 与 macOS/跨平台快捷键；匹配器复用 `SearchQuery.getCursor`，正则、可见范围、选中匹配及零宽结果均有自动化覆盖。

0.5.12 修正的远端搜索选区不可见与本轮纵排连续列滚动现均有 900 行 Electron UI 回归覆盖。仍需更多超长/极长单行、不同字体/缩放和 Windows/macOS 原生打印驱动实机验证；Linux Chromium PDF 只能证明该打印路径的长文完整性，不等于所有打印路径一致。Cocoa 原生菜单、文本系统与辅助技术行为也不能仅凭 Linux/Xvfb 测试宣称等价。

NSIS 自定义安装/卸载宏已用 NSIS 3.09 做语法编译检查。`npm run package:windows` 在 Wine 下成功生成 Windows x64 安装器 `release/CotEdit-0.5.9-win-x64.exe`（112,825,111 bytes，NSIS PE32 GUI）及 blockmap（118,555 bytes）；包内 `CotEdit.exe` 为 x86-64 PE32+，安装向导可打开且默认选择“仅为我安装”。Windows 包与 Linux 包内 renderer 均包含同一最新 bundle `index-DyR1zbFx.js`。最小 NSIS harness 已验证 Open With 宏写入当前用户 `.txt` 的 `OpenWithProgids`、注册支持扩展名，并保留 `.txt` 默认处理程序。不过完整安装/卸载未能在 Wine 下完成：`/currentuser /S` 返回状态码 2，交互式安装停在应用运行状态预检，清理本轮临时测试实例后仍未复制安装文件；因此真实 Windows 注册表、安装和卸载行为仍需在 Windows 实机验证。Windows/macOS 代码签名、macOS LaunchServices 实机注册、真实打印对话框及 VoiceOver/NVDA 行为尚未实测；不能声称平台体验与 CotEditor 完全一致。

上游格式核对依据：本机 CotEditor checkout 的 `CotEditor/Resources/Themes/Classic.cottheme` 使用顶层样式对象（例如 `text.color`、`background.color`、`keywords.color`）；`CotEditor/Resources/Syntaxes/AWK.cotsyntax/Info.json` 以 `fileMap.extensions` 声明扩展名，`Edit.json` 描述注释、缩进和分隔符，`Regex/Highlights.json` 与 `Regex/Outlines.json` 保存规则，`Completion.json` 提供补全词。CotEdit 已实现语法包安全读取和上述功能子集，但不是 CotEditor 的 ICU/Swift 解析器；颜色和语法规则仍为兼容子集。这些结构可在 [CotEditor themes](https://github.com/coteditor/CotEditor/tree/main/CotEditor/Resources/Themes) 与 [CotEditor syntaxes](https://github.com/coteditor/CotEditor/tree/main/CotEditor/Resources/Syntaxes) 上游资源目录核对。


## 本轮追加的官方行为核实

- [CotEditor 5.0.0 发布说明](https://coteditor.com/releasenotes/5.0.0.en)确认“Select Enclosing Symbols”位于 Edit > Select；官方维护者在[问题 #866](https://github.com/coteditor/CotEditor/issues/866)进一步说明，该命令选择最近一对匹配符号之间的内容。CotEdit 0.5.2 已为常见括号/引号增加子集实现；快捷键未由已打开的官方来源确认，因此不臆造默认键位。
- 文件夹导航事实还参照 [5.0.1 发布说明](https://coteditor.com/releasenotes/5.0.1.en)、[7.1.0 发布说明](https://coteditor.com/releasenotes/7.1.0.en) 和 [官方 Releases](https://github.com/coteditor/CotEditor/releases)：CotEditor 5.0 起支持侧栏文件夹浏览，7.1.0 加入文件夹文稿历史前进/后退及多文件搜索；官方发行页当时显示 7.1.1。
- [CotEditor 主菜单 storyboard](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Storyboards/Base.lproj/Main.storyboard) 当前 View > Inspector 子菜单包含 Document Inspector、Outline 和 Warnings；[官网功能页](https://coteditor.com/)说明警告检查器会列出无法转换到目标编码的字符。CotEdit 0.5.9 对齐入口名称/层级并扫描严格编码往返，但未复刻 Cocoa 原生 Inspector 的完整内容与驻留交互。
## 0.5.16 行操作与按模式排序

“文本 > 行”现在依 CotEditor 的菜单顺序提供 Sort、Sort by Pattern、Reverse、Shuffle、Delete Duplicates 对应动作；CotEditor 当前 [Main.storyboard](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Storyboards/Base.lproj/Main.storyboard) 对这五项都没有静态 `keyEquivalent`，所以 CotEdit 没有为它们虚构快捷键。无选区时对全文操作，有选区时扩展到被选中的完整行；反转、排序、随机排列和删除重复项均通过同一转换器执行。

按模式排序包含整行、按 1 起算的分隔符列、受限 ICU 正则及捕获组键。排序选项与上游的忽略大小写、语言规则、数值排序、首行固定和降序对应，并有当前行样例与实时键值预览。高风险/不支持的表达式会禁用提交；CSV 列按字面分隔符拆分并裁去两侧空白，不解析双引号包裹字段，与 CotEditor 的 [PatternSortView](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Document%20Window/Accessory%20Views/PatternSortView.swift) 及 [CSVSortPattern](https://github.com/coteditor/CotEditor/blob/main/Packages/EditorCore/Sources/LineSort/CSVSortPattern.swift) 实现相近；正则引擎仍是项目已记录的 ICU 兼容子集。

转换器随行携带现有行尾样式，保留末尾换行状态；当无行尾的末行移动到需要行间分隔的位置时，使用文稿默认行尾。混合行尾、终止换行、首行固定、数字排序、选区菜单状态和模式排序表单均有自动化回归覆盖；当前 Linux Electron smoke 实际验证危险正则拒绝、正则捕获组排序及 CSV 列排序。本轮不声称 Cocoa 文稿模型或 macOS 原生菜单/辅助技术已实机等价验证。

## 0.5.16 发布后的源码增量（未重新打包）

本轮依据 [CotEditor 当前 Main.storyboard](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Storyboards/Base.lproj/Main.storyboard) 复核 View 菜单：Inspector > Document Inspector 项没有静态 `keyEquivalent`，且 storyboard 中没有对应的检查器工具栏按钮。因此撤销了 CotEdit 先前试加的 `⌘I` 和额外工具栏入口；菜单动作仍保留。Jump to Selection 为 `⌘J`，Join Lines 为 `⇧⌘J`，Sidebar 的 File Browser / Folder Find 为 `⌃⌘1/2`。兼容表和测试已按这些静态默认值更正，不再把“Ctrl+I 未触发”误判为缺陷。

新增 **防止编辑**：按文稿锁定 CodeMirror 内容编辑与程序化文稿变更，阻止撤销/重做、替换及其他文本修改菜单，同时保留保存、打印、查找和选择等只读操作。锁定状态随未保存的恢复草稿记录。新增 **格式 > 书写方向** 菜单：水平/垂直方向继续使用 CotEdit 的全局纵排偏好，LTR/RTL 则在活动文稿的 CodeMirror 可编辑区设置 `dir`，不转换或改写原文字符；LTR 是新文稿默认值。依据 CotEditor [issue #759](https://github.com/coteditor/CotEditor/issues/759)，方向选项作用于整份纯文本文稿，而非只格式化选区。LTR/RTL 的变化不写入纯文本：恢复草稿包含方向元数据；已保存文稿的方向本机按路径保存（最多 500 条）并在重开同一路径时恢复，但随文件移动的可移植性未实现。分屏快捷键焦点判定现优先使用编辑器实际 `hasFocus`，防止镜像视图更新覆盖焦点缓存。

**CotEditor Page Guide 上游核实（2026-10-09 当前 `main`）：** [`DefaultSettings.swift`](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Application/Defaults/DefaultSettings.swift) 的默认值为 `showPageGuide: false`、`pageGuideColumn: 80`；[`WindowSettingsView.swift`](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Settings%20Window/Panes/WindowSettingsView.swift) 提供显示开关和 1–999 列数控件，关闭时禁用列数输入；[主菜单 storyboard](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Storyboards/Base.lproj/Main.storyboard) 中 Show Page Guide 没有静态快捷键。官方 [issue #1649](https://github.com/coteditor/CotEditor/issues/1649) 将按指定列自动换行作为另一项功能需求讨论，因此页导引标尺与自动换行不能混为一谈。纵排目前是 CotEdit 的应用级设置，和 CotEditor 对单份文稿的显示语义是否完全一致未实机确认；公开源码/菜单证据不等同于 macOS Cocoa 原生菜单或 Windows 行为验证。

CotEdit 现已补齐 Page Guide：显示开关默认关闭，列数默认 80、范围 1–999，关闭时禁用列数输入；“显示页导引”加入 View 菜单且无快捷键。标线依编辑器字体测量列宽，支持 RTL、横/纵排和分屏两个编辑视图，随文本更新、滚动、设置和窗口尺寸变化重绘；颜色跟随编辑器文字主题并响应系统高对比度偏好。真实 Electron UI smoke 已验证默认值、开关/列数持久化、横排定位、纵排形态和关闭状态。此实现为 CodeMirror/CSS overlay 近似，不代表 Cocoa 绘制或所有平台原生菜单行为完全等价。

继续对照 View 菜单后新增“显示标签栏”“显示工具栏”和“垂直堆叠编辑器”动作；前两项可无文稿切换，设置在本机偏好中保存，第三项仅在分屏时启用且会真实调整主/副编辑区上下布局。设置面板也提供同一组选项，切换时菜单复选标记、DOM 可见状态和重开设置读值保持一致。新增的 Text > 注释子菜单提供切换注释、行注释、块注释和取消注释，调用 CodeMirror 当前语言的 `commentTokens`，不额外虚构快捷键；这复用语法分隔符但不声称与 CotEditor 的 Foundation 文本范围及所有多选行为逐项相同。

本轮 Linux Electron 源码回归为 `npm test` **227/227 通过**；最终 `npm run test:ui` **1/1 通过**，并执行 Vite 生产构建。真实 Electron smoke 覆盖 Page Guide 默认值、列数/开关持久化、横排定位、纵排呈现、标签栏/工具栏切换与还原、垂直分屏几何和关闭状态；单测覆盖注释 token 转换及菜单 IPC 路由。Vite 仍提示约 **1.41 MB** 的 JS chunk 超过 500 kB。CotEdit 的文稿检查器仍以菜单打开对话框呈现，与 CotEditor 的 Cocoa 检查器驻留/布局不完全等价。此轮未重新打包：正式版本仍为 **0.5.16**，release 中既有 AppImage、DEB、Windows 包与校验清单，以及 `/workspace/CotEdit-0.5.16-source.zip` 均保持原样；没有删除其他历史产物。X11 上实际按键回归不替代 macOS Cocoa 原生菜单、Windows 实机、辅助技术或打印驱动测试。


本轮继续核对 Text > 文本转换：无选区时通过活动 CodeMirror 语言的 `wordAt` 词边界处理光标词，有选区时严格保留原范围并维持反向选区方向；没有可识别单词时不改动文稿。转换类菜单不再因缺少选区而全部变灰，“合并行”仍保留选区要求。Format > 文本编码新增 UTF-8 BOM 复选项，仅在 UTF-8 文稿启用；勾选状态随活动文稿更新，并通过现有编码/BOM 脏状态、恢复草稿和无损字节写入路径保存。UTF-8 与 UTF-16 BOM 解码/编码往返已由 codec 单测覆盖。

另外核实 Text > 文本补全在原生菜单注册 `Alt+Escape`，并经快捷键注册表连接到 CodeMirror 补全；RTL 书写方向、Page Guide、标签栏/工具栏切换和垂直分屏均已在当前工作树存在。此轮只修缺失行为和补覆盖，不改源码声明的应用版本 **0.5.16**，不重建安装包或源码归档；历史发行物未触碰。上述 UI 与菜单行为为 Electron/CodeMirror 实现，不等于 Cocoa 原生 1:1。


后续补齐的行为：设置面板可选新文稿默认 LTR/RTL；活动文稿变更方向时，本机使用最多 500 条的路径映射保存偏好，打开同一路径恢复方向，Save As 后将方向记录到新路径。它不写入纯文本，重命名/移动路径后无法随文件迁移，和 CotEditor 的文稿方向持久化模型不等价。打开含混合行尾文稿时，CotEdit 以非阻断 toast 告知并保留状态栏检查按钮；这提升了打开时可发现性，但不声称等同于 CotEditor 的原生提示对话框。

打印方面：桌面端在存在非空选区时提供“打印整个文稿 / 仅打印选中内容 / 取消”范围选择，选定内容仍进入 Electron 的系统打印对话框；浏览器预览模式继续使用浏览器打印，尚无选区范围选择。该自定义范围提示不是 Cocoa 打印面板的原生 Selection 控件。

## 当前未发行源码的 CotEditor 差异更新（2026-10-09）

Unicode 规范化菜单已按 CotEditor 当前 `standardForms` 次序排列（NFD、NFC、NFKD、NFKC、NFKC Case-Fold）。新增的 NFKC Case-Fold 由 Unicode 17.0.0 `DerivedNormalizationProps.txt` 的 `NFKC_CF` 数据驱动（10,583 个非恒等码点映射），涵盖兼容折叠、完整大小写折叠与默认忽略码点删除，最后按 NFC 组合。映射生成脚本位于 [`scripts/generate-nfkc-casefold.mjs`](../scripts/generate-nfkc-casefold.mjs)，数据及上游来源见 [Unicode 17.0.0 DerivedNormalizationProps](https://www.unicode.org/Public/17.0.0/ucd/DerivedNormalizationProps.txt) 与 [UAX #15](https://www.unicode.org/reports/tr15/tr15-57.html)。

CotEdit 工作树已加入 **Modified NFD / Modified NFC** 文本转换：上游 Modified NFD 用 `CFStringGetFileSystemRepresentation` 取得 HFS+ 历史形式，Modified NFC 按 `Full_Composition_Exclusion` 分段规范合成；CotEdit 不调用 macOS 文件系统 API，而使用生成的 Unicode 3.2 规范分解映射、HFS+ 不分解范围及 Unicode Full Composition Exclusion 数据做跨平台复现。HFS+ 形式有固定历史规则，不能以普通 `.normalize('NFD'/'NFC')` 代替；Node 测试不能证明与 Foundation/macOS 实机逐字节一致。高级字符计数器现也提供这两项形式，并在标准形式组之外单独归入 HFS+ 修改型组；仅在非字素簇计数时显示，偏好经现有设置与设置文件导入/导出持久化。算法沿用上述跨平台受限复现，不把上游调用 CoreFoundation 的机制说成已逐字节等价。参考 [Apple TN1150](https://developer.apple.com/library/archive/technotes/tn/tn1150.html)、[CotEditor 7.1.1 规范化实现](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/StringUtils/String%2BNormalization.swift)及 [Unicode 17.0.0 Full Composition Exclusion 数据](https://www.unicode.org/Public/17.0.0/ucd/DerivedNormalizationProps.txt)。

打印方向现从活动文稿传入独立打印 HTML；RTL 时以 `dir="rtl"` 和 RTL 网格流将打印行号放在右侧，且对 RTL 数字列左对齐。它有 CSS/HTML 回归覆盖，原生打印驱动和真实纸张排版仍未在本轮验证。`.cottheme` 的三个系统角色已用 CSS `Highlight`、`CanvasText`、`AccentColor` 表达，并由浅/深色 `color-scheme` 动态解析；这是可运行平台上的语义映射，而不是 Cocoa 原生色值 1:1。

上一轮验证：`npm test` **233/233**、`npm run test:ui` **1/1**，其中 UI smoke 内部执行 Vite production build 并实测系统色关键字和浅/深色方案；当时主 JS chunk 为 1.51 MB（gzip 526 KB），超过 500 kB 警告阈值。该段为历史记录。

## 本轮对照补齐（仍属未发行源码）

核对 [CotEditor 默认设置](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Application/Defaults/DefaultSettings.swift) 确认自动换行默认开启、当前行背景高亮默认关闭、选中文字实例高亮默认开启；CotEdit 对应新安装默认值已对齐，已有设置中明确保存的偏好原样保留。纵排时停用水平换行扩展但保留偏好，切回横排恢复。新增“高亮当前行背景”设置，使用单独 CodeMirror compartment 即时装载/移除 `highlightActiveLine()`；CotEdit 的 `minimalSetup` 本身不含该扩展。新增选中文字匹配高亮，设置开启时使用 `highlightSelectionMatches()`，只扫描可见范围，CodeMirror 默认上限为 100 个匹配且对长度超过 200 UTF-16 单元的选区不处理；CotEditor 默认设置另有 0.5 秒延迟，CodeMirror 此 API 无对应参数，因此响应时机与全篇/超长选区行为仍不等价。`Alt+Escape` 补全源现在额外从当前文稿提供唯一 Unicode 词候选，按需迭代 CodeMirror 文本行、最多 250 条，不在每次击键时扫描整篇文稿；官方按语法设置的标准/文稿/语法词来源见 `ModeOptions.swift` 和 `EditorTextView.swift`，本地新增项只对应文稿词，不冒充 AppKit 标准补全或语法偏好系统。仅打印选区且显示行号时，打印模板接收选区原始起始行号，续用原文稿编号；HTML/CSS 仍不同于 CotEditor 的 `PrintTextView` 原生绘制与系统打印选区面板。以上行为尚未重新打包，不能据此宣称平台 UI/打印 1:1。

本轮验证：`npm test` **242/242**、`npm run test:ui` **1/1**，production build 成功；JS chunk 1,511.39 kB（gzip 527.14 kB）仍超过 Vite 500 kB 警告阈值。测试覆盖新增默认换行、纵排不启用水平换行、当前行背景及选中文字匹配开关、文稿词来源、选区原始行号和既有桌面交互。正式版本仍为 **0.5.16**；未重打安装包或重建 `/workspace/CotEdit-0.5.16-source.zip`，既有历史发布文件未作清理。


## 本轮桌面交互与辅助功能回归（2026-10-09）

继续对照本机 CotEditor `main` checkout 的 storyboard 与 `EditorTextViewController.showSelectionInfo` 时，发现此前审计漏掉了 Text > “显示字符”（`⌥⌘I`）。该动作只在恰好选中一个 Unicode 字素时启用，并在选区旁弹出字符信息；CotEdit 现加入同样的启用条件与选区锚定浮层，复用安全的码点/UTF 编码信息。上游还显示 Unicode 名称、区块和类别，这些信息尚未完整移植；Windows/Linux 的 `Ctrl+Alt+I` 是平台替代映射，不是上游默认保证。本轮新增浮层只做了静态与单测验证，未运行 Electron UI smoke，不能宣称桌面外观/焦点行为已实测等价。上游 storyboard 仅能证明静态菜单/键位；它不证明各操作系统原生行为等价。另修正查找焦点边界：查找面板打开时，即使替换或点击编辑区使焦点离开查找控件，Escape 也会关闭查找面板；若原生模态 `<dialog>` 仍在上层，则 Escape 先交给该对话框，不会同时关闭其下方查找面板。此前 Electron UI smoke 覆盖了这两条查找路径，但未覆盖本轮新增的字符菜单。

同一烟测现在读取 Chromium 辅助功能树并断言所有已暴露交互控件均有可访问名称，覆盖主窗口、设置浮层、查找面板、自定义包围对话框和快捷键对话框；这是自动化结构核验，不等同于 macOS VoiceOver、Windows NVDA 或其他实际读屏器认证。最终核验：`npm test` **242/242**，`npm run test:ui` **1/1 连续通过两次**，Vite production build 成功；JS chunk 1,511.40 kB（gzip 527.14 kB）仍超过 Vite 500 kB 提示阈值。正式版本仍是 **0.5.16**，本轮未重打包、未重建源码 ZIP，未删除或改写任何发布物与其他历史产物。

## 本轮语法菜单对照（2026-10-09）

CotEditor [7.1.0 发布说明](https://coteditor.com/releasenotes/7.1.0.en)、[格式设置源码](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Settings%20Window/Panes/FormatSettingsView.swift)与[默认设置](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Application/Defaults/DefaultSettings.swift)确认上游有 Customize Syntax Menu 工作流，`hiddenSyntaxes` 默认空。CotEdit 在原生“格式 > 语法”与设置浮层提供同一入口，可筛选并隐藏内置或导入的语法；“显示全部”立即清空待应用隐藏项，“取消”放弃草稿，“应用”写入本地偏好。语法状态栏选择器同步过滤；如果当前文稿正使用已隐藏语法，则显示标注“当前文稿；已隐藏”的禁用项，避免活动语法状态无标签。隐藏/选中状态按 ID 安全归一化并有限额保护，Electron 主菜单对子菜单项应用可见性，而不破坏当前文稿的选中标记。

真实 Electron/UI 烟测覆盖了辅助树名称、隐藏并持久化、取消回滚及显示全部恢复；纯函数单测覆盖内置和导入语法的菜单可见/启用/选中状态。该项对齐的是菜单工作流而非 Cocoa `NSMenu`/SwiftUI 控件；隐藏语法功能也未在 macOS、Windows 的原生辅助技术环境实测。映射冲突报告及本轮复测见下节。此前该检查仍未实现的记录至此更新。正式版本保持 **0.5.16**；未重打包/重建安装包或源码 ZIP，也未清理、替换其他发布物。

## 本轮映射冲突报告与自动语法优先级（2026-10-09）

依据 CotEditor 当前 [`SyntaxManager.swift`](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Setting%20Managers/SyntaxManager.swift)、[`SyntaxMappingTable.swift`](https://github.com/coteditor/CotEditor/blob/main/Packages/Syntax/Sources/SyntaxFormat/SyntaxMappingTable.swift) 和 [`SyntaxMappingConflictView.swift`](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Settings%20Window/Other%20Views/SyntaxMappingConflictView.swift)，上游冲突集合按重复的文件扩展名、文件名和解释器键分类；语法设置按“用户设置优先于内置设置”并以 localized-standard 名称排序，冲突报告把第一项显示为自动采用的语法。官方本地化讨论也明确说明会自动使用首项，并建议通过编辑语法定义解决冲突：[issue #1519](https://github.com/coteditor/CotEditor/issues/1519)。

CotEdit 已新增“格式 > 语法 > 显示文件映射冲突…”及设置面板入口；没有重复规则时按钮/菜单禁用，出现冲突时按扩展名、文件名、shebang 解释器分表列出规则、首选语法和其余语法。文件名、扩展名、`#!/usr/bin/env …` 自动检测与诊断共用一个映射优先级；用户导入的 `.cotsyntax` 映射现在先于 CotEdit 内置映射，解决此前“内置 `.js` 抢先、导入的自定义 JavaScript 语法无效”的差异。首次打开、重置语法、另存为后的映射重算和恢复旧格式草稿的默认语言回退都传入正文，以便应用解释器或 XML 声明映射。优先项用 JS `Intl.Collator` 近似 localized-standard 排序；它不能保证与 Cocoa `localizedStandard` 在所有系统区域设置下逐字节相同。

边界仍需注明：诊断范围是 CotEdit 当前 72 个内置语言映射和导入的自定义 `.cotsyntax` 映射，并非上游完整 `SyntaxMap.json`/全部语法文件；自动检测不复刻所有 `UTType` 文件类型规则。导入器当前把文件名映射规范为大小写不敏感，和上游保留原文件名键值的行为不完全相同；CotEdit 也没有完整内置语法定义编辑器，解决自定义冲突需修改/重新导入语法文件。菜单/对话框仍为 Electron/HTML 实现，不等同 Cocoa 原生设置窗口。

验证：新增纯函数覆盖三类重复映射、优先顺序、格式异常和实际自动识别；Electron/CDP UI 烟测注入隔离测试语法包，实测默认禁用及三类冲突表、主/重复语法文本和关闭流程。最近语法 UI 回归结果见下一节。正式版本仍为 **0.5.16**，未重新生成安装包/源码 ZIP，未触碰或删除其他历史发布物；macOS/Windows 原生菜单与辅助技术仍须对应平台验收。

## 最近使用语法菜单（2026-10-09）

CotEditor 当前 [`DocumentWindowController.buildSyntaxPopUpButton`](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Document%20Window/DocumentWindowController.swift) 在工具栏语法弹出菜单中将最近语法置于完整清单之前并反向显示；[`SyntaxManager.noteRecentSetting`](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Setting%20Managers/SyntaxManager.swift) 会先移除重复项再追加，并按 [`DefaultSettings.swift`](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Application/Defaults/DefaultSettings.swift) 默认值保留最多 6 项。上游 [`Document.validateUserInterfaceItem`](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Document/Document.swift) 还确认隐藏语法仍保留在最近组，而从完整清单隐藏；这是工具栏选择工作流，不是额外默认快捷键。

CotEdit 状态栏语法选择器现以原生 `<optgroup>` 分出“最近使用”和“所有语法”：自动识别创建文稿及手动切换时，非纯文本模式会更新 MRU 顺序并写入既有本机偏好；显式“以纯文本打开”会跳过中间的自动语法记录。最近最多 6 项、最新优先，全量列表仍在下方可用。最近项被隐藏时仍从最近组可选，隐藏且不在最近组的当前模式继续以禁用项显示。设置沿用已有跨窗口 storage 监听，但本轮 UI smoke 只在单窗口实测，**没有独立声称最近列表的多窗口同步实测**。Electron/Xvfb smoke 验证了从 Python 切至 Markdown 的 MRU 次序、重复切换去重、完整清单可选，以及隐藏的 Markdown 留在最近组、退出全量组；自动识别进入 MRU 的路径另由 renderer 源码契约测试覆盖，本轮 UI smoke 没有打开外部文件单独实测该路径。偏好归一化单测覆盖格式过滤与六项上限。该阶段 `npm test` **251/251 通过**，`npm run test:ui` **1/1 通过**，Vite production build 成功；当时 JS chunk 1,518.34 kB（gzip 529.38 kB）仍触发 500 kB 提示。本轮仅更新工作源码与文档，应用版本仍为 **0.5.16**；未重打包、未重建源码 ZIP，发布包 SHA-256 校验通过，未删除或改写任何历史发布物。Cocoa 工具栏弹出菜单、macOS/Windows 辅助技术和原生菜单行为仍需对应平台实机验收。

## 上游文件映射别名（2026-10-09）

以 [CotEditor 官方 `SyntaxMap.json`](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Resources/SyntaxMap.json) 为来源，对 CotEdit 已有语法模式补齐可直接复用的扩展名、确切文件名和 shebang 解释器：包括 C/C++ 与 Fortran 的常见变体后缀，Java/JavaScript/TypeScript 别名，`jsonl` 与 `Package.resolved`，Dockerfile，`.editorconfig`、Git INI 配置文件，Shell 配置点文件，以及 Python、Shell、D、Dart、Haskell、Julia、Kotlin、Lua、PHP、Perl、R、Ruby、Rust、Scala、Scheme、Swift、Tcl、Protocol Buffers、C# 等上游解释器名。已有导入语法映射仍优先于这些内置映射。这里补齐的是“自动映射到现有模式”，不是引入完整上游语法定义或声称 tokenization 等价。

SVG 因没有 CotEdit 专用 SVG 模式而映射到现有 XML 解析器；`.gitconfig`/`.gitmodules` 复用通用 INI/Properties 解析器；Shell 的 C-shell/Korn-shell shebang 也仅选择通用 Shell 模式。扩展名 `.m` 仍只可映射到已存在的 Objective-C 模式，CotEdit 没有 MATLAB 模式；AWK、Ada、Apache、AppleScript、Assembly、BibTeX、DOT、独立 Git/Makefile/LaTeX/Metal 等也未以不相干解析器冒充实现。上游剩余 `UTType`/平台判定逻辑以及这些未支持语法仍是差异，不在本次映射别名范围内。

排序方面，CotEditor 的 [`SyntaxManager`](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Setting%20Managers/SyntaxManager.swift) 将内置与用户语法合并后用 Foundation `.localizedStandard` 排序。CotEdit 现在以 `Intl.Collator` 的当前系统 locale、数值排序和基础字母灵敏度，对内置语法及导入语法名称统一排序；导入语法仍显示 `CotEditor ·` 前缀，但排序使用其真实名称。Electron/Xvfb UI smoke 会用浏览器同一排序器断言完整列表顺序。Foundation 与 V8/ICU 对标点、等价字符及本地化规则可能有差别，因此这比固定数组次序更接近上游，仍不能宣称在所有系统语言下逐项完全一致。

验证：新增自动识别单测覆盖后缀、大小写不敏感文件名及 `env -S`/解释器识别；自动识别写入 MRU 的 renderer 路由另有源码契约测试。Electron/Xvfb smoke 验证最近语法选择工作流，并在实际渲染的语法清单上确认自然排序。`npm test` 最终 **254/254 通过**，`npm run test:ui` **1/1 通过**，Vite 构建成功（JS chunk 1,519.80 kB、gzip 529.87 kB）。正式版本仍为 **0.5.16**；发布 AppImage 与 DEB 的既有 SHA-256 清单均校验通过，本轮不重打包、不重建源码 ZIP，也不删除/改写历史发布物。Foundation 与 ICU 的 localized sort 细节、macOS/Windows 原生菜单、快捷键及辅助技术仍须对应平台实机验收。


## CotEditor“以富文本复制”上游核对（2026-10-09）

当前 CotEditor [Main.storyboard](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Storyboards/Base.lproj/Main.storyboard) 的 Edit 菜单含 Copy as Rich Text，键位静态值为大写 `C`（Command+Shift+C）；菜单动作 `copyWithStyle:` 插在 Copy 后，并仅在存在非空选区时启用。官方 [`EditorTextView.swift`](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView.swift) 注释及实现进一步确认：复制内容按各选区生成 attributed string，以编辑器 typing attributes 为基础，叠加布局管理器临时语法前景色，并声明 RTF 剪贴板类型；多选区纯文本以当前文稿行尾连接。此核对证明应补齐的工作流是**真正写入富文本剪贴板格式**，而非仅新增菜单文字。实现时仍需记录 Electron/CodeMirror 与 NSPasteboard、TextKit 属性/多选区元数据之间的差异。

### CotEdit 的实现与差异

CotEdit 已补入“编辑 > 以富文本复制”，默认键位为 `⇧⌘C`（Windows/Linux 为 `Ctrl+Shift+C`），仅在任一非空选区存在时启用。它从 CodeMirror 文稿选区取出纯文本，以当前编辑字体/字号和可见 token 的前景色构造 `text/rtf`、`text/html`，并附带 `text/plain` 回退；多选区按文稿当前 EOL 偏好拼接。Electron 主进程只接受应用窗口发来的调用，并限制 200 万 UTF-16 码元、字体和颜色格式后写入剪贴板。

这并非 TextKit attributed string 的逐项复制：CodeMirror 虚拟滚动范围之外的语法 token 可能只以基础前景色输出；原生 typing attributes、排版/连字设置、背景绘制属性及 macOS `multipleTextSelection` 元数据未复制。上游菜单使用 `copyWithStyle:`，而 storyboard 中名为 **Select Line** 的项目调用 `selectParagraph:` 并使用 `⇧⌘A`；这是 CotEditor 既有“选择行”菜单的内部动作名称，不是另一个缺失的“选择段落”菜单，CotEdit 保持现有“选择行”命令，不重复添加。

### 本轮验证与交付状态

富文本复制及其菜单/快捷键覆盖后，`npm test` **269/269 通过**，`npm run test:ui` **1/1 通过**，Vite production build 成功；候选 `app.asar` 另以 Electron UI smoke **1/1 通过**。Linux x64 便携包 tar.gz 与源码 ZIP 的归档完整性通过，SHA-256 见 [`/workspace/CotEdit-0.5.16-unreleased-2026-10-09-SHA256SUMS`](/workspace/CotEdit-0.5.16-unreleased-2026-10-09-SHA256SUMS)。Linux x64 AppImage 与 DEB 候选已改用独立临时盘构建，文件名标注 `unreleased-2026-10-09` 并单独存放在 `/workspace`；两种包内的 `app.asar` 均通过 Electron UI smoke，DEB 元数据为 `0.5.16/amd64`。DEB 未安装到系统，AppImage 的 FUSE 直接启动未核验。正式 0.5.16 AppImage、DEB 和原校验清单未改动且哈希通过；Windows/macOS 原生包及辅助技术实机验收仍未覆盖。


## 桌面恢复草稿的保留与清理边界（2026-10-09，0.5.16 未发行工作树）

桌面版把未保存文稿的文本和恢复所需元数据写入当前系统用户的 Electron `userData/recovery-drafts-v1.json.gz`。文件 gzip 压缩并通过临时文件原子替换；记录不包含原文稿路径。POSIX 上恢复文件以 `0600` 权限创建；若需新建目录，会请求 `0700`，但不会更改已存在的 userData 目录权限；Windows 继承系统配置目录的访问控制。**恢复库本身未加密**，不应把它描述成加密保险箱。

每窗口最多保存 20 份，整个恢复库最多 100 份；压缩文件上限 64 MiB、解压数据上限 128 MiB、单份文本上限 12,000,000 个 UTF-16 代码单元。容量超限时写入失败并保留已有记录，不自动淘汰旧草稿。草稿**不按时间自动过期**：编辑后会防抖更新快照；成功保存或明确放弃/关闭时，随该窗口下一份快照移除；“稍后处理”只关闭管理器、不删除数据。恢复管理器允许恢复所选/全部、删除所选以及二次确认清空；仍被窗口编辑的记录不可删除或纳入清空，窗口关闭、renderer 崩溃或重新加载后释放对应占用。

旧版 `cotedit.session.v1.*` localStorage 会话仅在恢复库导入完成并重新读取验证后删除；导入或读取失败时保留旧键，损坏的恢复库也不会被自动覆盖。UI smoke 验证恢复库 IPC 导入、恢复到新标签、占用保护、删除、确认清空和管理器访问性；恢复库存储/迁移幂等、保留损坏文件、上限以及窗口所有权释放另有单元测试。**本轮没有通过自动化实测整页 renderer reload**：Electron 的原生 `beforeunload` 确认会阻断测试驱动的 reload，因此该主进程生命周期边界不标记为真实 UI smoke 已验证。macOS/Windows 原生环境与辅助技术仍需对应系统实机检查。

本轮验证记录：`npm test` **284/284**、`npm run test:ui` **1/1**（Vite production build + Electron/Xvfb smoke）。正式版本仍为 **0.5.16**；本轮只更新工作源码/说明，未改写正式发布包，也未更新此前生成的 `unreleased-2026-10-09` 候选归档。


## 多选区编辑与文本转换对齐（2026-10-09，0.5.16 工作源码）

依据 CotEditor [7.1.1 `EditorTextView+Transformation.swift`](https://raw.githubusercontent.com/coteditor/CotEditor/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView%2BTransformation.swift)，上游转换命令会将全部 `selectedRanges` 交给 `transformSelections(in:with:)`，并将一组替换合并为一次编辑。复核 CotEdit 时发现 renderer 文稿状态没有启用 CodeMirror `allowMultipleSelections`，而旧的行编辑测试单独开启该扩展；因此测试中的多选区命令并不代表实际 renderer 已保留这些范围。

CotEdit 现为每份文稿状态启用 CodeMirror 多选区；文本转换通过单个 `changeByRange` 事务处理所有非空选区，保留各选区方向，并让后续范围按变长 Unicode 替换正确映射。仅有多个插入点时会分别转换其所在词，同一词的重复目标只执行一次；存在文本选区时，次级空光标会随编辑映射保留。“合并行”也依据任一非空范围启用并转换所有选区；其他仍按主选区定义的菜单状态未隐式放宽。

针对性测试覆盖真实 renderer 的多选区扩展声明、多个分离/反向选区、`ß` 大小写扩展后的范围映射、次级光标、重复词目标、“合并行”选区要求及单次 Undo/Redo。`npm test` **292/292 通过**，聚焦测试 **22/22 通过**。本轮未运行 `npm run test:ui`，因为该命令会先构建；当前根分区空间紧张，本轮未构建、打包或触碰正式包/历史产物。真实 Electron 键鼠交互与多选区辅助技术呈现仍待有足够空间时做 UI smoke，并且不据此宣称 macOS/Windows 原生行为 1:1。正式版本仍为 **0.5.16**。


## CotEditor 7.1.1 文件预览外部打开工作流（未发行源码增量）

CotEditor [7.1.1 官方发布说明](https://coteditor.com/releasenotes/7.1.1.en)记载改进文件预览视图中的 “Open with External Editor” 按钮。CotEdit 文件预览原有“打开”“以纯文本打开”“在新窗口打开”，本轮新增可见标签“默认应用”（完整名称及悬停提示为“使用系统默认应用打开”）。桌面主进程每次都会根据该窗口当前选择的根目录重新解析请求路径，只允许根目录内的普通文件，并拒绝路径越界、逃逸符号链接和目录；随后调用操作系统默认文件关联打开。系统启动失败会返回错误并显示提示，预览仍保留。

这是对外部打开工作流的跨平台近似，不是 CotEditor 的原生外部编辑器选择器或 Cocoa 行为复刻：CotEdit 使用系统当前默认应用（若默认仍是 CotEdit，系统可能重新交给 CotEdit），不提供选择具体编辑器的对话框；macOS/Windows/Linux 文件关联行为尚未逐平台实测。根目录/普通文件校验、外部启动错误及文件句柄读取边界有单元测试，菜单/IPC/renderer 路由有静态覆盖。正式版本仍为 **0.5.16**；本轮只改工作源码、测试和兼容文档，未构建 UI、未重打包、未重建源码 ZIP，也未删除或改写任何发布物。

## 2026-10-09 后续菜单与文本兼容性修正

大小写菜单改用 `toLocaleUpperCase` / `toLocaleLowerCase`，对应 CotEditor 的 `localizedUppercase` / `localizedLowercase`；回归覆盖土耳其语点/无点 I、`ß` 扩展映射与希腊语词尾 sigma。JavaScript runtime 默认 locale 与 Foundation 的本地化协商仍未在 macOS、Windows 和 Linux 上逐项比对，不因此宣称结果完全相同。

原生菜单 ID 与动态状态映射新增静态集合对账，未映射项目必须显式标为独立同步或有意常驻。对账过程中修复了 NFKC Case-Fold 未纳入 `canEdit` 状态的问题；现在无文稿或文稿只读时会禁用，与其他文本修改菜单一致。“在文件夹中查找”则明确保持无需活动文稿即可使用。

本轮 `npm test` **300/300 通过**，所有本轮修改的 JavaScript 文件语法检查通过。根分区剩余空间约 **145 MiB**，因此没有运行 UI smoke、production build 或打包；本轮源码回归不视为已完成桌面 UI 实测。静态审查另注意到标签栏 `tablist` 中还包含独立关闭按钮；未在缺少 UI smoke 资源时擅自改动标签 DOM 与键盘焦点结构，仍需后续以真实 Electron 可访问性树/辅助技术复验。正式版本仍为 **0.5.16**；早先 `unreleased-2026-10-09` 候选包早于最新文件夹打开和本轮修正，不能代表当前源码；正式包和其他历史发布物未改写或删除。

## 2026-10-09 标签栏关闭控件无障碍修正

依据 [WAI-ARIA APG Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) 与 [WAI-ARIA 1.2 `tablist` 角色](https://www.w3.org/TR/wai-aria-1.2/#tablist)，标签列表现在只包含文稿标签；单一的命名关闭按钮移至 `tablist` 之后，因此 Tab 可按预期离开复合标签组进入下一个控件。关闭按钮仍会随指针悬停或键盘焦点定位到对应文稿标签，活动文稿默认显示；背景标签悬停关闭、`⌘/Ctrl+W` 关闭菜单快捷键以及未保存更改确认流程不变。

新增静态回归检查覆盖 DOM 结构、关闭按钮名称、事件路由与悬停定位；本轮 `npm test` **301/301 通过**，`src/main.js` 与新增测试文件的 `node --check` 均通过。由于根分区可用空间仍仅约 **144 MiB**，未运行 Electron UI smoke、生产构建、辅助技术树检查或打包；该轮结果不视为真实桌面端实测。源码版本保持 **0.5.16**，没有改动发布物或删除任何历史文件。


## 2026-10-09 Unicode 字符详情与高级字符计数（0.5.16 工作源码）

字符检查器现对选区浮层及固定字符检查器分别显示 Unicode 17.0.0 字符名称、区块、General_Category（类别代码与简体中文说明）、码点、十进制值、UTF-16 单元和 UTF-8 字节；复合字素逐 Unicode 标量列示，控制/格式字符用可读名称占位。字符表从官方 UCD 的 `UnicodeData.txt`、`NameAliases.txt`、`Blocks.txt` 生成并延迟载入，SHA-256 与生成器在 `docs/unicode-character-data.md` 记录；Unicode License v3 全文随应用资源声明。

Text > 高级字符计数… 与状态栏入口现可启动计数器；选项支持字素簇、Unicode 标量、UTF-16 单元及字节，NFD/NFC/NFKD/NFKC/NFKC_Casefold、忽略换行、忽略制表符/Zs 空白、合并连续空白，以及 CotEdit 支持的 UTF-8、UTF-16 LE/BE、Shift_JIS、GBK、Big5、Windows-1252、ISO-8859-1 八种字节编码。任一非空选区时对每个选区独立计数并求和；无非空选区时统计全文。处理顺序和组合范围由单测锁定，字节计数通过受限的 Electron IPC 进行无损编码；不可表示文本和超过 1,200 万 UTF-16 单元的请求会明确返回错误，不静默替换。

该功能对齐可验证的工作流和菜单/快捷键，不是原生 UI 的 1:1 复刻：计数选项为 HTML 对话框、计数结果为应用内浮层；此段记录高级字符计数尚未提供 HFS+ 修改型形式时的早期状态；当前工作树已按 CotEditor 7.1.1 将标准/修改型形式分组补齐，具体边界见上方 2026-10-12 增量。Linux Electron smoke 检查了可访问性树、单字素显示字符快捷键、名称/区块/类别、设置保存、实时全文/选区刷新及 UTF-8 字节计数；macOS/Windows 的屏幕阅读器、AppKit 菜单/窗口锚定和系统辅助技术仍需目标机器验证。

验证：`npm test` **319/319 通过**；`npm run build` 成功（Vite 对大于 500 kB 的压缩前资源块给出提示，Unicode 数据另作延迟加载 chunk）；`node --test test/electron-ui-smoke.cjs` **1/1 通过**。`release/CotEdit-0.5.16-SHA256SUMS` 中正式 AppImage 与 `.deb` 均校验通过；正式版本仍为 **0.5.16**，未重打包或删除/改写 `release/` 历史产物。尚未完成全功能菜单、全部偏好、原生平台交互及辅助技术的逐项等价验证，因此不标记为“与 CotEditor 完全一致”。


### 工作区构建输出保留说明（2026-10-09）

本轮 `npm run build` 按 Vite 默认行为清空并重建了 `/workspace/cotedit/dist/`。构建前本地存在 `dist/assets/index-CSldnDei.css`（46,465 bytes）、`dist/assets/index-DGhkFCD2.js`（1,534,789 bytes）及 `dist/index.html`（32,783 bytes）；这三份旧生成文件已被当前 smoke/build 输出覆盖。工作区与临时目录中未找到精确副本；正式包内 `app.asar` 的静态资源哈希和内容更旧，未用不同构建冒充恢复。当前 `dist/` 保留本轮已验证的新构建。此变更未触及 `release/`，0.5.16 校验和仍通过。后续若要重建，应先将现有 `dist/` 复制到日期命名的历史目录，再运行会清理输出目录的构建命令。


## Edit > 按 Unicode 码点插入…（0.5.16 未发行工作源码，2026-10-09）

对照 CotEditor `main` 的 `Main.storyboard` 与 `UnicodeInputView.swift`，补入原先缺少的 Edit 菜单命令，并实现 `inputBackSlash`/`inputYenMark` 对应的反斜线和日元符号字面插入。CotEdit 现在接受裸十六进制、`U+`、`0x` 与 `\\u` 前缀表示；预览有效字符，并拒绝格式错误、代理项及大于 U+10FFFF 的值。确认后以一个 CodeMirror 事务替换每个当前活动选区；无文稿或启用“防止编辑”时菜单禁用，弹窗关闭后焦点回到编辑器。Unicode 码点命令在上游 storyboard 中没有默认键位，CotEdit 不为其臆造快捷键；反斜线/日元符号菜单动作已可用，但其依键盘布局的上游快捷键本轮尚未跨平台映射。

此项复刻的是 Unicode 标量插入工作流，不是 SwiftUI 原生输入面板：本轮尚未移植 CotEditor 的最近 10 个码点历史、macOS 系统 Unicode 输入服务或“从 iPhone/iPad 插入”菜单。其它仍未实现或未完成原生验证的菜单、偏好、系统拼写/语法服务、自动替换/语音、辅助技术和打印行为不因本次变更而视为对齐。

验证：完整 `npm test` **326/326 通过**；受影响 JavaScript `node --check` 通过；HTML 静态解析确认 268 个 ID 唯一且新增对话框控件齐全。未运行 Electron UI smoke、Vite build 或打包：该对话框尚未在本轮真实桌面屏幕回归，且 Vite 会清理没有安全备份的 `dist/`，根分区余量约 128 MiB。正式发行版本仍为 **0.5.16**；本轮只修改源码、测试和说明，未更改或删除任何发布物。

### 后续菜单差异清单（静态对照，尚未完成）

对照上游 storyboard，本地菜单仍缺少或未核实的入口包括：拼写/语法与替换服务、语音、从 iPhone/iPad 插入、反斜线/日元符号基于键盘布局的原生快捷键映射、Navigation Bar、代码颜色编辑、片段文件拖放、部分字体/抗锯齿及若干原生 Window 菜单操作。Find > “多重替换…”现已接通；但定义文件拖放导入、独立“高亮全部”和 Unicode 等价匹配仍有功能差异。命名命令片段管理、片段专属快捷键与 Insert Snippet 菜单已在未发行工作源码中实现。CotEdit 已实现 Find > 选择上一个/下一个大纲项及本项目快捷键；此次官方资料审计未能从可读取源码确认 CotEditor 对应动作的确切默认键位，因此不把本地键位称为已核实的上游默认值。Quick Actions、独立 Tab Width/每语法自定义缩进宽度、字体连字 CSS 控制及命令片段也已实现；这些是 Electron/HTML 工作流，不代表 Cocoa 原生菜单或设置面板等价。若依赖 macOS Cocoa、系统服务或专用设备协同，不在跨平台实现中伪造原生等价；其余可移植项继续逐个核对需求、权限和回归边界。该清单是基于上游静态菜单树的初步差异，不代表所有菜单、偏好或平台交互已穷尽。

### Format > Font > 连字菜单（2026-10-12）

CotEditor 7.1.1 的[稳定版主菜单 storyboard](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Storyboards/Base.lproj/Main.storyboard)在 Format > Font 中提供无静态快捷键的 Ligatures 复选项。CotEdit 现加入“使用字体连字”菜单项，直接读写既有 `settings.ligatures` 偏好；勾选态从 renderer 同步到原生菜单，切换仍复用设置持久化与 `applySettings()`，因此与设置面板、编辑器 CSS 及打印 CSS 共用同一开关，默认勾选。本次没有新增快捷键，也没有模拟 CotEditor 的字体面板、字体类型或操作系统抗锯齿控制。菜单路由、默认/开关状态及无快捷键由 Node 测试覆盖；本轮未运行 Electron UI smoke，未验证 macOS/Windows 原生菜单显示。


## SSH 远程编辑（RMate）

工作树新增桌面版 RMate 集成，默认关闭，监听端口默认 `52698`，允许用户设置 `1–65535` 端口。Electron 主进程只绑定 IPv4 loopback `127.0.0.1`，单个文稿最大 `100 MiB`；可通过 SSH 反向转发让远端 `rmate -p <port> <file>` 连接。服务未添加 RMate 协议之外的认证：SSH 负责远程通道的认证/加密，同一台本机上能访问该 loopback 端口的进程也能提交文稿，因此应只在需要时启用。

打开远程文稿时，CotEdit 显示远程路径和文件名，按 RMate `file-type` 选择语法、按 `selection` 定位行，并保留解码结果、编码、BOM 及混合换行元数据；连接有效时“保存”把编码后的内容经原会话回传。连接断开后文稿仍留在编辑器，可继续修改，保存会弹出本机另存对话框；远程路径可复制，但“在文件管理器中显示”只对本机文稿启用。RMate 客户端没有提供远端磁盘写入确认回执，因此界面只表示本机 socket 已接受发送，不声称远程主机已将文件持久化。

官方参考为 CotEditor 开发分支的 [RMateServer.swift](https://github.com/coteditor/CotEditor/blob/main/Packages/EditorCore/Sources/RMate/RMateServer.swift)、[RMateParser.swift](https://github.com/coteditor/CotEditor/blob/main/Packages/EditorCore/Sources/RMate/RMateParser.swift)、[RemoteEditingController.swift](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Models/Remote%20Editing/RemoteEditingController.swift)、[IntegrationSettingsView.swift](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Settings%20Window/Panes/IntegrationSettingsView.swift)与[远程编辑帮助](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/howto_edit_remote.html)。Linux/Electron 真实 smoke 已覆盖设置启停、loopback TCP 握手、远程打开、Python file-type、第二行定位、保存回传及断连状态；macOS/Windows 原生菜单、目标 SSH 配置和网络安全策略未实机核验，不能据此宣称所有平台与 CotEditor 1:1 一致。


## 2026-10-10 Quick Actions 与独立 Tab Width / Mode 缩进宽度（未发行源码）

### Quick Actions

CotEditor [4.7.0 发布说明](https://coteditor.com/releasenotes/4.7.0.en)与官方 [`Main.storyboard`](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Storyboards/Base.lproj/Main.storyboard)确认 View 菜单有 Quick Actions，默认 Command-K；搜索栏用于快速查找并执行菜单命令。CotEdit 在 View 菜单加入“快速操作…”，macOS 使用 `⌘K`，Windows/Linux 使用 `Ctrl+K`；列表从当前 Electron 原生菜单生成，查询可匹配命令、菜单路径、ID 和快捷键，执行时复用菜单回调。对话框支持搜索、方向键、Enter、Escape 与焦点返回，并由真实 Chromium 辅助功能树验证名称。

这是 HTML 对话框加 Electron 菜单的相似工作流，不是 CotEditor 的 Cocoa 命令栏，也不证明 macOS Command 键、各发行版菜单焦点或 VoiceOver/NVDA 逐项一致；未为宽度子菜单新增快捷键。

### Tab Width 与按语法缩进

CotEditor [7.1.0 发布说明](https://coteditor.com/releasenotes/7.1.0.en)新增按 Mode 自定义缩进 style 和 width。官方 [`ModeSettingsView.swift`](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Settings%20Window/Panes/ModeSettingsView.swift)显示 Spaces/Tabs 选项及 1–99 空格 Stepper；[`DefaultSettings.swift`](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Application/Defaults/DefaultSettings.swift)默认 `tabWidth=4`、`autoExpandTab=false`、没有 Mode 覆盖；[`Main.storyboard`](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Storyboards/Base.lproj/Main.storyboard)的 Format 菜单列出 Tab Width 2、4、8 和 Custom。

CotEdit 现在将两种语义独立保存：Format > “制表符宽度”提供 2/4/8/自定义 1–99 列，默认 4；“当前语法的缩进宽度”可按语法选择 Tab 或 1–99 个空格。新安装/无已存值时默认 Tab 缩进；应用不会把已有用户明确存下的缩进值自动改写成 Tab。CodeMirror 的 `indentUnit` 读取当前语法缩进，`EditorState.tabSize`、Tab 字符显示、缩进参考线及打印 CSS `tab-size` 读取全局 Tab Width；设置文件导入/导出包含 `tabWidth`。自定义宽度用 HTML 数字输入控件校验整数 1–99，不等于上游 AppKit Stepper、完整 Mode 偏好窗或 Cocoa 菜单实现。

真实 Electron/Xvfb 烟测通过 Quick Actions 打开两个自定义菜单动作，验证越界 100 被拒绝、Tab Width 6 持久化并更新编辑器、当前语法 5 空格独立保存、关闭后焦点返回，且实际按 Tab 在第二行插入五个空格；字体连字 smoke 验证设置可访问名称、持久化及 `font-variant-ligatures` 计算样式；命令片段 smoke 覆盖按语法筛选、原生菜单搜索、选区替换、光标标记、快捷键冲突拒绝、绑定显示及键盘触发；本轮新增多重替换的菜单搜索、两条有序规则、偏好保存及一次撤销。设置默认、边界、模式宽度、片段展开/快捷键规范化、多重替换与设置文件 round-trip、打印 Tab Width 与连字 CSS 由单测覆盖。本轮 `npm test` **378/378 通过**，Electron/Xvfb `test/electron-ui-smoke.cjs` **3/3 通过**；production build 成功输出到 `/tmp/cotedit-build-multiple-replace-20261010`，Vite 仍提示主 JS chunk 超过 500 kB。正式版仍为 **0.5.16**；本轮没有重新打包，`dist/` 哈希与构建前一致，也未删除/改写历史发布物。未在 macOS/Windows 原生菜单、AppKit Stepper、系统字体抗锯齿或实际读屏器上验证；不声称与 CotEditor 1:1。


### 字体连字与抗锯齿边界

CotEditor 官方 [issue #1670](https://github.com/coteditor/CotEditor/issues/1670) 确认 Settings > Appearance 提供 “Ligatures” 开关；维护者指出它在 TextKit 1 下对部分字体（包括 JetBrains Mono、Fira Code）可能失效，因为这是 Apple 框架问题。该讨论未核实当前 7.x 的默认值，所以 CotEdit 将自己的新设置默认设为开启，只为保留既有渲染，不声称默认值与上游相同。

CotEdit 设置面板的“使用字体连字”会保存到本机偏好；关闭后，对主/分屏 CodeMirror 文本及打印 HTML 应用 `font-variant-ligatures: none`，重新开启恢复 `normal`。按 [MDN CSS 参考](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-variant-ligatures)，`none` 会禁用所有连字及 contextual forms，该 CSS 功能已广泛可用；实际字形仍可能受字体和 Chromium 平台构建影响。操作系统字体抗锯齿/栅格化不提供跨平台可控的 CSS 等价开关，因此本项目不创建误导性“抗锯齿”选项；macOS/Windows 原生字体表现尚未实机验证。


## 2026-10-10 命令片段（未发行源码）

CotEditor 官方帮助 [Insert a Snippet](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/howto_insert_snippet.html) 与上游 [`Snippet.swift`](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Models/Snippet/Snippet.swift)、[`Tokenizer.swift`](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Models/Snippet/Tokenizer.swift)、[`EditorTextView+Snippet.swift`](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView%2BSnippet.swift) 确认了命令片段的 Text 菜单插入工作流，以及 `<<<SELECTION>>>` 和 `<<<CURSOR>>>` 模板令牌。

CotEdit 在 Text > “插入片段”中按当前语法动态生成原生菜单子项；偏好设置提供名称/内容编辑、全局或单语法范围、每条片段的可选快捷键、排序和删除。快捷键录入时与内置命令及其他片段做冲突检查，键位显示在菜单项中，renderer 在编辑器获得焦点时执行片段，避免 Electron 菜单加速键重复派发。模板将每个 `<<<SELECTION>>>` 替换为触发时的选区；选区文本按原样插入，不再二次解释其中的令牌。每个 `<<<CURSOR>>>` 会创建一个光标位置；未写光标令牌时光标落在插入内容末尾。换行会带入插入点当前行的前导 Tab/空格。多选区在一个 CodeMirror 事务中替换并保留撤销能力。菜单数据按 Electron 窗口单独缓存，切换窗口时恢复对应语法的片段列表；设置文件导入后会重新同步菜单。

片段偏好由受限归一化器控制：最多 100 条，单个模板 UTF-8 最多 12 KiB，整体最多 40 KiB；名称、ID、语法范围和快捷键字段亦有界。Linux/Electron 真实 UI 烟测通过 HTML 管理器创建 JavaScript 专属片段，确认它不出现在纯文本菜单、切换到 JavaScript 后出现在 Insert Snippet 菜单搜索中；拒绝与快速操作冲突的组合、保存独有组合并在菜单项显示，然后用快捷键插入模板。选中 `abc` 时插入 `<abc>` 并将 `z` 落在 `<<<CURSOR>>>` 指定的新行。单测覆盖模板展开、多个光标标记、选区令牌不递归、缩进继承、快捷键归一化与设置文件 round-trip。

这不是 Cocoa 片段偏好窗或完整 Snippets 工作流：目前未实现从上游片段窗格拖放文件到编辑器；HTML 表单、菜单焦点和辅助技术尚未在 macOS/Windows 原生桌面环境核验。该实现覆盖命名命令片段及可选快捷键的可移植工作流，不代表与 CotEditor 1:1。


## 2026-10-10 Multiple Replace（多重替换，未发行源码）

CotEditor 官方 [7.0.2 发布说明](https://coteditor.com/releasenotes/7.0.2.en)记录了“Replace All 与 Multiple Replace 对 Unicode 等价字符串”的修复（例 U+00B7/U+0387）；[7.1.0 发布说明](https://coteditor.com/releasenotes/7.1.0.en)明确支持把多个 replacement definitions 拖放到其列表导入。上游 [`NSTextView+MultipleReplace.swift`](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Text%20Finder/Multiple%20Replace/Models/NSTextView%2BMultipleReplace.swift) 的 `replaceAll(_:inSelection:)` 接受选区范围并最终以一次替换动作提交文稿；[`MultipleReplaceView.swift`](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Text%20Finder/Multiple%20Replace/Views/MultipleReplaceView.swift) 展示定义切换、规则编辑/重排、Highlight All 和 Batch Replace All 工作流，规则包含启用状态、查找、替换、大小写与正则选项。

CotEdit 在 Find 菜单和查找面板提供“多重替换…”，不臆造上游未核实的默认快捷键。HTML 管理器可新建、切换、排序和删除定义；逐条规则可启用/禁用、编辑查找与替换文本、调整顺序、指定正则和忽略大小写，并选择仅处理当前 CodeMirror 选区。规则按顺序应用，整组结果以单次 CodeMirror 事务写回，可一次撤销；定义与选区范围偏好进入设置文件 round-trip。受限存储上限为 50 个定义、每定义 100 条规则、每个查找/替换字段 4096 UTF-8 字节、全部定义合计 48 KiB；正则沿用应用内受限 ICU→JavaScript 翻译器。

Linux/Electron 的真实 Xvfb UI 回归经 Quick Actions 搜索并打开管理器，创建 `old→new`、`new→done` 两条规则，确认 `old old` 得到 `done done`、四次规则命中持久化，并在关闭管理器后用一次 Undo 恢复原文。新增混合行尾回归以多处带换行替换验证各独立编辑块不覆盖中间未命中段，插入行尾回退到文稿默认，并以一次 Undo/Redo 恢复完整文稿和分隔符状态；另以 1,000 个分离命中检查多轮规则的变更映射。独立单测覆盖规则顺序、禁用/大小写、编号与命名捕获、选区边界、变更块重建、混合行尾历史、正则错误与归一化边界。完整 `npm test` **406/406 通过**；完整 Electron/Xvfb smoke **3/3 通过**。最终源码 production build 在临时副本生成，未覆盖项目 `dist/`。

仍与上游有明确差异：CotEdit 已实现定义文件拖放导入及独立“高亮”操作，但匹配集合按原文计算；7.0.2 所述 Unicode 等价匹配没有复制，组合/兼容等价字符串可能不同；选区范围是 CotEdit 独立偏好，而非已核实的共享 Find 状态；规则描述字段尚不能在管理器中编辑，JavaScript 正则/大小写也不等于 Foundation/NSTextChecking 语义。多重替换现在向 CodeMirror 发送各个分离的编辑块，而不是把首末命中之间整段当作一次替换；这样中间未命中的混合行尾会保留，新增换行仍采用文稿回退行尾，整个批次仍是一条可撤销/重做的历史事务。该回归与 CotEditor 7.1.1 的“Replace All 不应更改命中范围之外的混合行尾”修复方向一致，但不表示复刻其 Cocoa 文稿内核。当前 smoke 只在 Linux/Xvfb 验证，不代表 macOS/Windows 原生菜单、Cocoa 表格、VoiceOver/NVDA 或系统字体/文本行为一致。正式版仍为 **0.5.16**；本轮未覆盖 `dist/`、未重新打包、未删除或改写历史产物，不声称 1:1。


## 0.5.16 发布后的源码增量：Tab Width 全范围缩进互转（未发行）

`Text > Indentation > Convert Tabs to Spaces / Convert Spaces to Tabs` 会依编辑器当前全局 Tab Width 计算制表位；设置范围为 1–99，但工具函数此前把计算宽度错误限制在 16。现已与设置范围对齐为 1–99，不改动文件格式、设置迁移或持久化行为。测试覆盖 99 列 Tab 展开为 198 个空格、按 99 列制表位把空格压回 Tab，以及超过上限时的 99 列钳制；另验证 renderer 仍把 CodeMirror 的 `state.tabSize` 传入转换器。

本轮完整 `npm test` **407/407 通过**，缩进与菜单路由针对性测试 **57/57 通过**。前一轮 UI smoke **3/3** 与临时目录 production build 是在此修复之前完成；本轮不重跑 UI smoke/build，因为系统可用空间约 659 MB，而 UI 脚本会先重建 `dist/`。本轮没有运行构建、没有修改 `dist/`、release 或源码归档；正式版本仍为 **0.5.16**，既有正式 Linux 包状态未变。Linux/Xvfb 结果不能代替 macOS/Windows 原生菜单、布局、字体与辅助技术验证。


## 0.5.16 发布后的源码增量：Unicode 码点输入历史（未发行）

CotEditor 官方 [4.2.0 发布说明](https://coteditor.com/releasenotes/4.2.0.en)明确记载为 Unicode 码点输入加入历史；本次稳定对照边界采用官方归档列出的 [CotEditor 7.1.1](https://coteditor.com/archives)（2026-10-03 发布）及其[发布说明](https://coteditor.com/releasenotes/7.1.1.en)。7.1.1 发布说明没有单独描述此历史 UI，因此本实现只对应上游有文档依据的历史工作流，不声称复刻其原生控件；未把 7.2 alpha 行为用作基线。

CotEdit 未发行工作源码在“按 Unicode 码点插入…”对话框保留最近 10 个有效 Unicode 标量码点，最新在前且去重。仅在成功插入后记入；历史按钮只把 `U+…` 回填到输入框并显示预览，仍需用户明确选择“插入”，不会因点击历史按钮立即修改文稿。偏好只保存码点整数，不保存输入正文；码点历史进入应用本机偏好，也随设置文件导出。它仍是 HTML 对话框，不等同 macOS 原生 Unicode 输入面板。

验证：码点、设置及设置文件定向单测 **33/33 通过**；完整 `npm test` **409/409 通过**；`node --check src/main.js` 与 `node --check lib/settings.js` 通过。系统可用空间约 **658 MB**，本轮未运行 Electron UI smoke、生产构建或打包；因此新按钮布局和键盘/读屏器交互尚未作 UI 实机回归。没有运行会重建 `dist/` 的构建，未修改 `dist/`、`release/`、正式包或源码归档；正式发布版本仍为 **0.5.16**。测试是在 Linux 单元测试环境运行，不能替代 macOS/Windows 原生行为验证。

## 2026-10-10 `.cotrpl` 正则替换文本转义（未发行）

CotEditor 7.1.1 的 [`MultipleReplace.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/MultipleReplace.swift) 将 `settings.unescapesReplacementString` 仅用于正则规则；其 `TextFind.swift` 在正则模板展开前调用 `unescapedTemplate`，[`String+Escaping.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/StringUtils/String%2BEscaping.swift) 明确支持 `\\0`、`\\t`、`\\n`、`\\r`、`\\"`、`\\'` 和 `\\\\`，不支持 Unicode 标量转义。CotEdit 现可导入、编辑并持久化此布尔选项；打开后仅在正则规则中、且在当前 `$` 捕获组模板展开前解码一次，因此双反斜线可得到字面反斜线。文字规则不解码。为了不静默改变已有 CotEdit 定义，缺省/新建定义仍关闭；从 CotEditor 导入的显式 `true` 会保留。

此实现验证了上面列出的简单转义及“反斜线加 `n`”的单次解码结果；不表示 JavaScript 捕获组模板、Foundation/NSTextChecking 或正则选项与 CotEditor 完全相同。在该轮记录时，Unicode 标量转义、`textualOptions` 和 `regexOptions` 尚不支持，并在导入提示中报告；其后已先后增加 `textualOptions.caseInsensitive` 与 `regexOptions.caseInsensitive` 位的支持（见对应未发行增量）；该轮的新复选框尚未进行 Electron UI smoke 或目标系统平台验收。

验证：定向替换/导入/设置回归 **27/27 通过**，完整 `npm test` **419/419 通过**，变更 JavaScript 文件语法检查通过。正式包版本仍为 **0.5.16**；对测试前后 `dist/` 和 `release/` 共 120 个文件进行 SHA-256 比对，未见变化。剩余空间约 **655 MiB**，本轮未运行 Electron UI smoke、构建或打包；因此复选框实际布局与交互尚未 UI 验收。这里的 CotEditor 稳定对照为 **7.1.1**，不采用 7.2 alpha；Linux 单元测试不代替 Electron/Xvfb 烟测，更不能代替 macOS/Windows 原生菜单、文本系统、读屏器或打印实机验证。


## 2026-10-10 `.cotrpl` 中性查找选项掩码（未发行）

CotEditor 7.1.1 的[官方 Codable 模型](https://raw.githubusercontent.com/coteditor/CotEditor/7.1.1/Packages/EditorCore/Sources/TextFind/MultipleReplace%2BCodable.swift)将 `textualOptions` 解码为 `String.CompareOptions` 的原始值、将 `regexOptions` 解码为 `NSRegularExpression.Options` 的原始值，并总是编码这两个字段。当时 CotEdit 把数值 `0` 识别为空选项掩码：只在导入提示中视为中性，不改变匹配行为；在该轮范围内，任一非零掩码及任何未知设置均不应用并继续报告。后续已分别支持 `textualOptions.caseInsensitive` 与 `regexOptions.caseInsensitive` 的位值 `1`；其余非零位仍未实现，详见最新增量。此改动不实现 Foundation 比较选项、ICU 正则选项或它们与 JavaScript 的语义映射；CotEditor 导出的非零选项仍可能产生行为差异。

定向导入/替换/设置测试 **50/50 通过**，完整 Node 测试 **420/420 通过**，变更 JavaScript 文件语法检查通过。变更仍属于未发行源码，正式版本保持 **0.5.16**；本轮未重建 `dist/`、未修改 `release/`，未运行构建或 UI smoke。自动化 Node 测试运行于 Linux，不能替代 macOS/Windows 原生行为验收。


## 2026-10-10 无效多重替换规则跳过（未发行）

CotEditor 7.1.1 的[官方多重替换帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/howto_multiple_replace.html)说明无效规则在执行替换时会被跳过；[稳定版源码](https://raw.githubusercontent.com/coteditor/CotEditor/7.1.1/Packages/EditorCore/Sources/TextFind/MultipleReplace.swift)也在查找与替换循环中对每条规则单独尝试编译，失败即继续下一条。此前 CotEdit 对导入的无效正则直接抛错，使整组替换和高亮中断。现在会跳过无法转换或编译的单条规则，并继续处理其他有效规则；不把被跳过规则算作匹配。导入/执行回归、Replace All 及高亮回归均通过；导入器定向测试 **9/9 通过**，完整 Node 测试 **422/422 通过**，修改过的 JavaScript 文件语法检查通过。正式版本保持 **0.5.16**，此次更改仍未发行；未构建、未运行 UI smoke，未改动 `dist/` 或 release 包。自动化测试运行于 Linux，macOS 与 Windows 原生行为仍未验证。


## 2026-10-10 `.cotrpl` 文字规则忽略大小写选项（未发行）

CotEditor 7.1.1 的 [多重替换实现](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/MultipleReplace.swift)会把定义级 `textualOptions` 与单条文字规则的 `ignoresCase` 合并；正则规则使用独立的 `regexOptions`。其 [Codable 模型](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/MultipleReplace%2BCodable.swift)将这些选项保存为原始整数掩码；Apple 将 `String.CompareOptions.caseInsensitive` 定义为不区分大小写的查找选项（[Foundation 文档](https://developer.apple.com/documentation/foundation/nsstring/compareoptions/caseinsensitive)）。CotEdit 现在从 `.cotrpl` 的 `textualOptions` 映射 `caseInsensitive` 位（整数 `1`）到定义级“文字规则忽略大小写”复选框，并在文字替换与高亮时生效；它与每条规则的忽略大小写选项取并集，不影响正则规则。在该次增量时，其他 `textualOptions` 位及 `regexOptions` 尚会提示但不应用；正则 `caseInsensitive` 位的后续支持见下节。JavaScript `RegExp` 的大小写匹配只是跨平台近似，不保证等同 Foundation。负数、小数、非数字或超出安全整数范围的掩码会拒绝导入。

本轮聚焦替换/导入/设置测试 **34/34 通过**，完整 `npm test` **426/426 通过**；三个变更 JavaScript 文件的 `node --check` 通过。正式版本仍为 **0.5.16**，更改属于未发行工作源码；构建、UI smoke、打包均未运行，`dist/` 与 release 产物未修改，且正式 Linux 包与校验清单的前后 SHA-256 一致。可用空间约 **640 MiB**，因此未触发可能重建 `dist/` 的步骤。设置与隐私/数据保留行为未变。自动化测试运行于 Linux Node 环境；Electron 复选框真实布局/交互、macOS/Windows 原生菜单、Foundation 逐字符语义与辅助技术行为仍未验证。


## 2026-10-10 `.cotrpl` 正则规则忽略大小写选项（未发行）

CotEditor 7.1.1 的[多重替换源码](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/MultipleReplace.swift)将定义级 `regexOptions` 与正则规则的 `ignoresCase` 合并；[官方 Codable 模型](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/MultipleReplace%2BCodable.swift)将此设置保存为 `NSRegularExpression.Options` 原始掩码。CotEdit 现将 `regexOptions.caseInsensitive` 位值 `1` 映射为定义级“正则规则忽略大小写”，覆盖替换与独立高亮路径，可在管理器中查看、编辑并持久化；它只对正则规则生效，不改变文字规则或单条规则的 `ignoresCase`。若掩码同时含其他位，会应用已支持的大小写位并继续提示其余位未采用。实现使用 JavaScript `RegExp` `i` 标记，只是兼容近似，不保证与 Foundation/ICU 的 Unicode 折叠、边界或逐字节行为等价。非法负数、小数、非数字或超出安全整数范围的掩码会拒绝导入。

定向多重替换、导入及设置测试 **38/38 通过**，完整 `npm test` **430/430 通过**，六个变更 JavaScript 文件的 `node --check` 通过。正式版本仍为 **0.5.16**，本次内容仅在未发行源码中；未运行构建、Electron UI smoke 或打包，`dist/` 与 `release/` 未由本轮任务改写。可用空间约 **639 MiB**，所以继续避免生成构建输出；Linux Node 测试不能替代 Electron 界面 smoke，也不能证明 macOS/Windows 原生菜单、输入法、读屏器或 Foundation 实机语义。

## 2026-10-10 `.cotrpl` 正则点号匹配行分隔符选项（未发行）

CotEditor 7.1.1 的 [MultipleReplace.swift](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/MultipleReplace.swift) 将定义级 `regexOptions` 与每条正则规则的 `ignoresCase` 合并；[官方 Codable 模型](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/MultipleReplace%2BCodable.swift)将选项保存为 `NSRegularExpression.Options` 原始整数掩码。Foundation 的 `dotMatchesLineSeparators` 定义为让 `.` 匹配包括行分隔符在内的任意字符；Swift Foundation `NSRegularExpression.Options` 源码将其编码为 `1 << 3`，即位值 **8**（[Apple API](https://developer.apple.com/documentation/foundation/nsregularexpression/options-swift.struct/dotmatcheslineseparators)、[选项原始值定义](https://raw.githubusercontent.com/swiftlang/swift-corelibs-foundation/main/Sources/Foundation/NSRegularExpression.swift)）。

CotEdit 将 `regexOptions` 位 8 映射到定义级“正则中的点号匹配换行符”选项，并用于批量替换和独立高亮；该值可编辑、设置持久化并随 `.cotrpl` 导入。实现将其映射到 JavaScript `RegExp` 的 Unicode `s` 标记。此映射语义接近，但不构成对 Foundation/ICU 在全部表达式、Unicode 或行边界行为上的等价承诺。位 1 `caseInsensitive` 与位 8 可以组合；若掩码还含其它位，已支持位仍生效，同时继续提示未应用的位。在该阶段，其它选项仍明确不支持，包括 `anchorsMatchLines`（位 16）；负数、小数、非数字及超出安全整数范围的掩码仍拒绝导入。

定向多重替换、导入及设置回归 **41/41 通过**，完整 `npm test` **433/433 通过**，六个变更 JavaScript 文件 `node --check` 通过。正式版本仍为 **0.5.16**，此功能仅在未发行工作树。由于可用空间约 **639 MiB**，未运行构建、Electron UI smoke 或打包；0.5.16 正式版 Linux 包 SHA-256 清单验证通过，本轮没有构建写入 `dist/` 或 `release/`。HTML 复选框布局及交互未作 UI 验收；Node 测试运行于 Linux，不能替代 macOS/Windows 原生菜单、Foundation/ICU 实机语义或辅助技术验证。

## 2026-10-10 `.cotrpl` 正则锚点逐行匹配选项（未发行）

CotEditor 7.1.1 的 [官方 Codable 模型](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/MultipleReplace%2BCodable.swift)将定义级 `regexOptions` 编码为 `NSRegularExpression.Options` 原始掩码；Foundation 源码将 `anchorsMatchLines` 编码为 `1 << 4`，即位值 **16**（[Swift Foundation 实现](https://raw.githubusercontent.com/swiftlang/swift-corelibs-foundation/main/Sources/Foundation/NSRegularExpression.swift)）；[Apple API](https://developer.apple.com/documentation/foundation/nsregularexpression/options-swift.struct/anchorsmatchlines)说明该选项允许 `^` 和 `$` 匹配行首与行尾。

CotEdit 将位 16 导入为定义级选项，在管理器中可查看/编辑并随设置持久化；它仅作用于正则规则，并同时影响批量替换与独立高亮。实现近似映射到 JavaScript `RegExp` 的 `m` 标记。该近似识别 LF、CR、U+2028、U+2029；VT、FF、NEL 不会被 JS `m` 当作行边界，且 CRLF 上零宽锚点可能出现不同边界行为，因此不宣称与 Foundation/ICU 等价。位 16 可与已支持位 1 `caseInsensitive`、位 8 `dotMatchesLineSeparators` 组合；额外未知或未支持位仍会提示且不会应用。

本增量定向多重替换/导入/设置回归 **44/44 通过**，完整 `npm test` **436/436 通过**，6 个变更 JavaScript 文件 `node --check` 通过。正式版本仍为 **0.5.16**，此功能仅在未发行工作树；0.5.16 Linux 包 SHA-256 校验通过，未运行构建、Electron UI smoke 或打包，`dist/` 与 `release/` 未由本轮改写。可用空间约 **638 MiB**，管理器复选框未作真实 UI 验收；Linux 自动化测试不能证明 macOS/Windows 原生行为或 Foundation 实机语义。

## 2026-10-10 `.cotrpl` 正则元字符按字面匹配选项（未发行）

CotEditor 7.1.1 的 [官方 Codable 模型](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/MultipleReplace%2BCodable.swift)将定义级 `regexOptions` 保存为 `NSRegularExpression.Options` 原始掩码；[Foundation 源码](https://raw.githubusercontent.com/swiftlang/swift-corelibs-foundation/main/Sources/Foundation/NSRegularExpression.swift)定义 `ignoreMetacharacters` 为 `1 << 2`（位值 **4**），[Apple API](https://developer.apple.com/documentation/foundation/nsregularexpression/options-swift.struct/ignoremetacharacters)说明整个 pattern 应作为字面字符串处理。CotEditor 7.1.1 的[多重替换实现](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/MultipleReplace.swift)会将定义级正则选项与单条规则的 `ignoresCase` 合并后传入正则模式。

CotEdit 现在将 `.cotrpl` 的位 4 导入为定义级“正则模式按字面文本匹配”选项；该值可在多重替换管理器查看/编辑，随设置持久化，并同时作用于批量替换与独立高亮。启用时跳过 ICU→JavaScript 正则转换并对整个查找字符串做字面转义；正则规则自身的忽略大小写与替换模板处理保持不变，普通文字规则不受影响。位 4 可与位 1 大小写选项组合；未知/未支持伴随位仍会提示且不应用。字面模式本身使用 JavaScript 字符串与 `RegExp` 匹配实现，不宣称 Foundation/ICU 的大小写折叠、索引或原生界面逐项等价。

定向多重替换、导入及设置测试 **47/47 通过**，完整 `npm test` **439/439 通过**；`lib/multiple-replace.js`、`lib/multiple-replace-import.js` 与 `src/main.js` 的 `node --check` 通过，HTML/事件路径有静态回归覆盖。正式版本仍为 **0.5.16**，本功能仅属未发行源码；未运行构建、Electron UI smoke 或打包，`dist/` 与 `release/` 未由本轮改写。管理器新复选框未作真实 UI 验收，Node/Linux 自动化不能替代 macOS/Windows 实机与 Foundation/ICU 语义验证；隐私、权限和文稿数据保留边界未变。


## 2026-10-10 `.cotrpl` 文字规则 literal 选项（位 2，未发行）

CotEditor 7.1.1 的[官方 Codable 模型](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/MultipleReplace%2BCodable.swift)将 `textualOptions` 序列化为 `String.CompareOptions` 原始整数掩码；Apple 将 [`String.CompareOptions.literal`](https://developer.apple.com/documentation/foundation/nsstring/compareoptions/literal)定义为逐字符精确等价。CotEdit 的非正则替换规则一直先转义查找文本，再交由 JavaScript 正则引擎匹配，因此显式 `.cotrpl` 位 2 已由既有字面匹配行为满足；导入器现将该位识别为已支持，不再对它提示“选项未应用”，没有新增冗余复选框或持久化字段。回归以预组字符 `é` 与分解序列 `e + ◌́` 验证逐序列精确匹配。此项仅说明显式 literal 位与 CotEdit 当前文字匹配路径相符，不声明 Foundation 在未设置该位时的默认比较、大小写折叠或全部 Unicode 搜索语义等价。

定向多重替换与导入回归 **49/49 通过**，完整 `npm test` **444/444 通过**；两个变更实现文件 `lib/multiple-replace.js`、`lib/multiple-replace-import.js` 的 `node --check` 通过。正式版本仍为 **0.5.16**，本次仅属未发行工作源码；未运行构建、Electron UI smoke 或打包。`dist/` 与 `release/` 共 120 个文件按相对路径与内容计算的任务前后聚合 SHA-256 均为 `a9eb8226fa20c630a5513daf1ca60c8f2efaa43f3e3f2568cfe0de26f4c048b5`，未发生变化。测试运行于 Linux Node，未验证 CotEditor 原生 macOS/Foundation 行为、CotEdit macOS/Windows UI 或目标平台辅助技术；全程未改动草稿/隐私保留设置。检查时可用空间约 **637 MiB**；一次测试前后磁盘读数短暂从 637 MiB 降至约 10 MiB 后自行恢复，未清理或删除任何文件。

## 2026-10-10 `.cotrpl` 正则 useUnixLineSeparators（位 32，未发行）

CotEditor **7.1.1 稳定版**的[官方 Codable 模型](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/MultipleReplace%2BCodable.swift)将 `regexOptions` 保存为 `NSRegularExpression.Options` 原始整数掩码；Swift Foundation 源码把 `useUnixLineSeparators` 定义为 `1 << 5`（位值 **32**），Apple 文档说明它“仅将 `\n` 视为行分隔符”。本轮依此稳定基线实施，不以 7.2 alpha 作为发布依据。

CotEdit 现可从 `.cotrpl` 导入位 32，在多重替换管理器查看/编辑并随定义持久化；该设置对正则规则的批量替换和独立高亮共用。受限映射包括：无 dotAll 时将未转义且位于字符类外的 `.` 转为非 LF 字符集；只有与位 16 `anchorsMatchLines` 组合时，`^`/`$` 才只按 LF 建立逐行边界；位 2 注释模式中的 `#` 注释仅延续至 LF。位 8 dotAll 优先匹配包括 LF 在内的任意字符；字面正则、转义点号和字符类内的点不改写，显式 `\R` 转换也不受位 32 控制。截至本段记录的 2026-10-10，位 64 尚未支持；本页末尾 2026-10-12 的未发行增量已部分实现该选项，限制见对应小节。以上是 JavaScript RegExp 上的有限兼容，不是 Foundation/ICU 的完整等价实现。

Apple 官方证据：[useUnixLineSeparators API](https://developer.apple.com/documentation/foundation/nsregularexpression/options-swift.struct/useunixlineseparators)、[Foundation 原始位值](https://raw.githubusercontent.com/swiftlang/swift-corelibs-foundation/main/Sources/Foundation/NSRegularExpression.swift)、[CotEditor 7.1.1 多重替换 Codable 模型](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/MultipleReplace%2BCodable.swift)。新增导入/执行/锚点/注释/点号和设置持久化回归后，完整 `npm test` **447/447 通过**；`lib/multiple-replace.js`、`lib/multiple-replace-import.js`、`src/main.js` 的 `node --check` 通过。正式版本仍为 **0.5.16**；正式包 SHA-256 清单验证通过，`dist/`、`release/` 120 个文件的前后聚合 SHA-256 均为 `b68917e4523a6e69ad1ba0e37448b3a483e580c5b68c2f5d704e6e5e658b011f`。因可用空间约 636 MiB，未运行 UI smoke、build 或打包；Node 自动化运行于 Linux，未验证 Electron 真实 UI、macOS/Windows 原生菜单/语义、Foundation 实机一致性或辅助技术行为。用户设置的保留、隐私和文稿数据处理策略未变。


## 2026-10-10 CotEditor 7.1.1 “Trim Trailing Whitespace” 回归补齐（未发行源码）

CotEditor **7.1.1 稳定版**的[主菜单 storyboard](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Storyboards/Base.lproj/Main.storyboard#L915-L919)在 Text 菜单列出 `Trim Trailing Whitespace`，连接到 `trimTrailingWhitespace:`，该菜单项没有静态快捷键。CotEdit 已有对应的菜单与 IPC 动作；本轮仅将原先内联的全行 `[ \t]` 行尾清理范围计算抽到 `lib/text-tools.js`，没有改变命令语义，便于直接回归验证。

新增的 CodeMirror 测试覆盖每行行末 ASCII 空格/制表符清理、保留 NBSP、终止换行与混合 CRLF/CR/PS 元数据，以及一次撤销/重做；菜单覆盖测试核验路由并确认没有臆造默认快捷键。这些行尾清理测试本身不验证完整不可见字符类别/选区语义；分类显示的当前工作树覆盖见本页顶部 **2026-10-12 增量（不可见字符分类显示）**，仍不等于 macOS 原生菜单或 Cocoa 文本布局实测。（截至本段记录的 2026-10-10，`.cotrpl` 位 64 尚未应用；本页末尾 2026-10-12 的未发行增量已部分实现，限制见对应小节。）

本轮定向测试 `node --test test/text-tools.test.js test/menu-coverage.test.js` **61/61 通过**；完整 `npm test` **449/449 通过**；四个变更 JavaScript 文件的 `node --check` 通过。应用声明版本保持 **0.5.16**，此项仍是未发行源码；正式 0.5.16 AppImage 与 DEB 清单校验均为 `OK`，`dist/` 与 `release/` 120 个文件的聚合 SHA-256 仍为 `b68917e4523a6e69ad1ba0e37448b3a483e580c5b68c2f5d704e6e5e658b011f`。未运行 UI smoke、构建或打包；没有改动发布物、用户文稿或隐私/保留设置。磁盘剩余约 **635 MiB**。Linux 自动化结果不证明 Electron 真实 UI、macOS/Windows 原生菜单、文本系统或辅助技术等价。


位 64 语义来源：[Apple useUnicodeWordBoundaries API](https://developer.apple.com/documentation/foundation/nsregularexpression/options-swift.struct/useunicodewordboundaries)、[ICU UREGEX_UWORD 说明](https://unicode-org.github.io/icu/userguide/strings/regexp.html)与 [Foundation 位值定义（`1 << 6`）](https://github.com/swiftlang/swift-corelibs-foundation/blob/main/Sources/Foundation/NSRegularExpression.swift)。


## 2026-10-11 CotEditor 7.1.1 引号替换与直引号转换（未发行源码）

CotEditor **7.1.1 稳定版** storyboard 将 **Edit > Substitutions > Straighten Quotes** 连接到 `straightenQuotesInSelection:`，且该项没有静态快捷键；上游 `EditorTextView+Transformation.swift` 说明转换既处理现有选区，也在选区为空时处理光标所在单词。其 [`String+Transform.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/StringUtils/String%2BTransform.swift) 明确将 U+2018–U+201B（`‘’‚‛`）替换为 ASCII 单引号，将 U+201C–U+201F（`“”„‟`）替换为 ASCII 双引号。

CotEdit 现于 **编辑 > 替换** 提供“替换直引号为弯引号”和“弯引号转为直引号”两个可移植入口，均复用 CodeMirror 文本转换事务。前者只在每行内将未转义、成对的 ASCII 单/双引号转为英文 `‘…’` / `“…”`；词内撇号、未配对引号、转义引号及跨行配对不转换。该规则是确定性子集：CotEditor 的 `replaceQuotesInSelection:` 走 AppKit 智能引号替换，Apple 文档说明单双引号样式由 macOS 键盘文本输入偏好决定；CotEdit 不读取此偏好，不能声称样式或上下文判断等价。转直引号仍按上游精确 U+2018–U+201F 映射。两项都支持当前实现的选区/多选区及光标处单词工作流，可整体撤销/重做，无默认快捷键；CodeMirror 选词、Cocoa 菜单与系统文本替换行为尚未逐项实机验证。

证据：[CotEditor 7.1.1 主菜单 storyboard](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Storyboards/Base.lproj/Main.storyboard)、[`EditorTextView+Transformation.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView%2BTransformation.swift)、[`String+Transform.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/StringUtils/String%2BTransform.swift)、[Apple 智能引号与系统样式说明](https://support.apple.com/en-al/guide/mac-help/mh35735/mac)。本轮引号函数、CodeMirror 多选区撤销/重做及菜单路由定向测试 **76/76 通过**；完整 `npm test` **454/454 通过**；8 个变更 JavaScript 文件 `node --check` 通过。正式版本仍为 **0.5.16**，本轮改动仅是未发行源码；`dist/` 与 `release/` 顶层共 46 个文件的聚合 SHA-256 与修改前一致：`0c8f4fb1109f31c53b224e636240ad90e9b12b5e8c9159b79965425ea87489c6`。未运行 UI smoke、生产构建或安装包打包。测试在 Linux Node 环境运行，不能证明实际 Electron 菜单界面、macOS/Windows 原生菜单与系统引号样式、Cocoa 选词行为或读屏器等价；文稿隐私、权限和数据保留策略未更改。


## 2026-10-11 URL 解码失败回退（未发行源码）

CotEditor **7.1.1 稳定版**的 [`EditorTextView+Transformation.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView%2BTransformation.swift) 对 URL 解码使用 `removingPercentEncoding ?? substring`：无法解码时返回原字符串，而不是报错。CotEdit 现对 `decodeURIComponent` 失败作同样的整段原文回退，包括格式错误的百分号序列、无效 UTF-8 和“前段可解码、后段错误”输入；菜单不再提示失败。有效 URL 输入仍由 JavaScript `decodeURIComponent` 解码，此项只对齐失败回退，不表示 Foundation 与 JavaScript 的完整 URL 编解码语义等价。

验证：定向 `node --test test/text-tools.test.js test/menu-coverage.test.js` **64/64 通过**；完整 `npm test` **454/454 通过**；`lib/text-tools.js` 与 `src/main.js` 的 `node --check` 通过。正式版本仍为 **0.5.16**，本次仅改动未发行源码；没有运行生产构建、UI smoke 或安装包打包，也没有更改隐私或数据保留设置。Node 测试运行于 Linux，不能证明真实 Electron UI 或 macOS/Windows 原生行为。


## 2026-10-11 行排序保留重音敏感性（未发行源码）

CotEditor **7.1.1 稳定版**的 [`SortOptions.compareOptions`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/LineSort/SortOptions.swift) 仅组合 Foundation `.caseInsensitive` 与 `.numeric`，未启用 `.diacriticInsensitive`。CotEdit 先前在 `Intl.Collator` 的忽略大小写模式使用 `sensitivity: "base"`，会把大小写和重音都折叠，超出了上游行为；现改为 `sensitivity: "accent"`，忽略大小写但保留重音差别，显式区分大小写时仍使用 `"variant"`，并保留原有数字排序。回归样例以 `eclair`、`éclair`、`Eclair` 验证前两项重音不同而大小写等价。

证据：[CotEditor 7.1.1 SortOptions.swift](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/LineSort/SortOptions.swift)、[CotEditor 7.1.1 SortPattern.swift](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/LineSort/SortPattern.swift)。定向 `node --test test/text-tools.test.js test/menu-coverage.test.js` **64/64 通过**；完整 `npm test` **454/454 通过**；`lib/text-tools.js` 与 `test/text-tools.test.js` 的 `node --check` 通过。正式版本仍为 **0.5.16**，本次修改仅属未发行源码；`dist/` 与 `release/` 聚合 SHA-256 前后均为 `b68917e4523a6e69ad1ba0e37448b3a483e580c5b68c2f5d704e6e5e658b011f`。未运行生产构建、UI smoke 或安装包打包；没有更改隐私或数据保留设置。Node 测试在 Linux 运行，不证明 Foundation 与 ICU/Intl 的完整本地化排序等价，也不验证 Electron 菜单及 macOS、Windows 的原生行为。


## Replace All 与混合行尾（未发行源码）

CotEditor 7.1.1 的官方 [issue #2172](https://github.com/coteditor/CotEditor/issues/2172) 及 [修复提交 9609cb8](https://github.com/coteditor/CotEditor/commit/9609cb83ea5da51e7f138c596377ab2365d7b114) 记录了混合行尾文稿中正则“全部替换”改变未命中分隔符的问题。CotEdit 现于普通查找替换与多重替换提交前，将替换文本中的 CRLF、CR、LF、NEL、LS、PS 统一为 CodeMirror 内部 LF；已存在的行尾继续由文稿行尾元数据追踪，新增行采用文稿的插入回退样式。新增测试覆盖六类分隔符、混合原始行尾、保存序列化以及撤销/重做。此修正是 CotEdit 独立实现，不代表 Foundation/Cocoa 行尾语义或 macOS/Windows 实机行为等价；尚未运行 UI smoke、构建或打包。

## 2026-10-11 多行查找输入的换行符归一化（未发行源码）

CotEditor 7.1.1 的 [`TextFind.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/TextFind.swift) 将查找词作为原始 `findString` 用于文稿搜索；CotEditor 2.2.0 官方修复记录也明确提到，查找面板曾修正无法搜索含 CR 或 CR/LF 的查找词问题。CotEdit 的 CodeMirror 文稿内部统一使用 LF，因此将外部粘贴来的 CRLF、CR、NEL、LS 或 PS 查找词原样传给 `SearchQuery` 会漏掉匹配；纯 Node 回归已复现该差异。

CotEdit 现在只在构造查找查询时把查找词中实际存在的六种行分隔符映射到内部 LF，字面与正则查找共用该归一化；输入框显示内容不改写，正则中的字面反斜线转义（如 `\r`、`\n`）保持不变，文稿的混合行尾元数据与保存序列化也不受影响。这是适配 CodeMirror 存储模型的跨平台实现，不代表与 CotEditor/Foundation 的全部查找语义等价。

验证：`test/search-tools.test.js` **7/7 通过**，新增回归覆盖 LF、CRLF、CR、NEL、LS、PS 的字面及正则多行查询，并核验真实 renderer 调用归一化路径；完整 `npm test` **456/456 通过**；`src/main.js`、`lib/search-tools.js`、`test/search-tools.test.js` 的 `node --check` 通过。正式版本仍为 **0.5.16**，本次改动仅为未发行源码；正式 AppImage/DEB SHA-256 清单通过。未运行构建、UI smoke 或打包，未写入 `dist/` 或 `release/`。Linux Node 测试不证明 macOS/Windows 原生文本系统或菜单行为等价。

## 2026-10-11 新建多重替换定义的正则行锚点默认值（未发行源码）

CotEditor 7.1.1 稳定版 [`MultipleReplace.Settings.init`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/MultipleReplace.swift) 的默认 `regexOptions` 包含 `.anchorsMatchLines`。CotEdit 此前在管理器新建定义的两条草稿创建路径中都显式关闭此选项，因此 `^`/`$` 只按整个字符串边界匹配，与 CotEditor 新定义默认行为不同。

现在两条**新建草稿**路径共享默认选项并默认开启按行锚点。此变更不修改已保存定义，不对旧数据做迁移；导入 `.cotrpl` 明确 `regexOptions: 0` 时仍保持关闭，CotEdit 的 `unescapesReplacementString` 新建默认值也继续保持关闭。实际正则仍由 JavaScript RegExp 实现，换行识别边界、CRLF 行间零宽匹配及 Foundation/ICU 行为不承诺等价；默认选项的变动只影响新建定义中的正则规则。

测试覆盖新默认在逐行 `^...$` 匹配中的效果、显式关闭后仍不按行匹配、定义归一化保留关闭语义、导入零掩码保持关闭，以及 renderer 两条新建草稿路径使用共享默认。未做 Electron UI smoke；checkbox 的实际桌面视觉状态和 macOS/Windows 原生行为未验证。版本号仍为 **0.5.16**，改动仅在未发行源码；未构建、未打包、不改写 `dist/` 与 `release/`。Linux Node 测试不证明 Cocoa/Foundation 实机等价。

## 2026-10-11 多重替换文字规则的 Unicode 规范等价匹配（未发行源码）

CotEditor 7.0.2 的[正式版修复说明](https://coteditor.com/releasenotes/7.0.2.en)记录了 Replace All 与 Multiple Replace 对 Unicode 规范等价字符串漏匹配的问题，并以 U+00B7 `·` 与 U+0387 `·` 为例。CotEdit 现在仅在多重替换的默认文字规则，以及启用 `regexOptions.ignoreMetacharacters` 的按字面正则规则中，对查找串与文稿作 Unicode NFD 规范化；替换与独立高亮共用搜索结果，并将命中映射回 CodeMirror 原始 UTF-16 区间。使用 `Intl.Segmenter` 限制命中起止于扩展字素簇边界，因此搜索 `e` 不会只替换 `é` 或 `e + 组合重音` 的一部分。

显式 `.cotrpl` `textualOptions.literal`（Foundation 位值 2）仍要求逐字符精确比较；该选项现保留在定义及设置文件中，并在管理器中可编辑。既有定义不迁移，`textualLiteral` 缺省/false 时采用新的规范等价默认。实际正则与普通 Find/Replace 面板不在本轮范围。此实现是基于 JavaScript NFD 和字素边界的受限适配，不保证 Foundation/ICU 全部规范排序、比较或搜索范围语义等价。依据：[CotEditor 7.0.2 release notes](https://coteditor.com/releasenotes/7.0.2.en)、[Apple `NSString.CompareOptions.literal`](https://developer.apple.com/documentation/foundation/nsstring/compareoptions/literal)。

验证：替换/导入/设置定向测试 **83/83 通过**，完整 `npm test` **461/461 通过**；7 个变更 JavaScript 文件 `node --check` 通过。版本仍为 **0.5.16**，本轮源码未发行；未构建、未运行 UI smoke 或打包。正式 AppImage/DEB 清单及 `dist/`/`release/` 树摘要核验结果记录在本轮状态中。Linux Node 测试不能证明真实 Electron 控件渲染或 macOS/Windows 原生 Foundation 行为。


## 2026-10-11 文件夹搜索文字模式的 Unicode 规范等价匹配（未发行源码）

CotEditor 7.1.1 的 `FolderFinder.find` 将非正则查询构造成 `TextFind.Mode.textual`；上游 `TextFind` 以 `NSString.range(of:options:range:)` 完成文字查找。Apple 文档说明 NSString 搜索默认按 Unicode 规范等价比较，且返回命中范围长度可能与查询字符串不同；`.literal` 选项才表示逐字符精确比较。CotEdit 文件夹搜索现在只对非正则文字查询与用于扫描的文本副本执行 NFD 规范化，继续应用原有大小写选项；命中行号取自扫描副本，预览仍从原文生成。真正的正则查询和普通编辑器查找均未改变。此处只实现 NFD 规范等价近似，不等同完整 Foundation 搜索语义。

依据：[CotEditor 7.1.1 FolderFinder](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Sidebar/Folder%20Find/FolderFinder.swift)、[CotEditor 7.1.1 TextFind](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/TextFind.swift)、[Apple NSString `range(of:options:range:)`](https://developer.apple.com/documentation/foundation/nsstring/range(of:options:range:)) 与 [literal 比较选项](https://developer.apple.com/documentation/foundation/nsstring/compareoptions/literal)。

验证：文件夹搜索定向测试 **6/6 通过**，完整 `npm test` **462/462 通过**，本轮两个变更 JavaScript 文件 `node --check` 通过。版本仍为 **0.5.16**，本轮仅修改未发行源码/测试/文档；未构建、未运行 UI smoke 或打包。正式 AppImage 与 DEB SHA-256 校验通过，`dist/` 与 `release/` 文件树摘要未变化。Linux Node 测试不证明 Electron UI 或 macOS/Windows Foundation 原生行为等价。


## 2026-10-11 混合行尾的跨行多重替换映射（未发行源码）

CotEditor 7.1.1 的[正式发布说明](https://coteditor.com/releasenotes/7.1.1.en)记录了混合行尾文稿中的 Redo 与 Replace All 行尾修复。对照 CotEdit 时发现一个同类但不声称与上游原缺陷完全相同的边界：跨行正则替换会删除原行尾，而 `mapPos()` 可能把被删除行尾的样式映射到替换字符串新插入的换行。`mapLineEndings()` 现仅从 CodeMirror `ChangeSet.iterGaps()` 的未变更文本段继承原样式；替换字符串新增的换行继续使用文稿回退格式。新增回归用例覆盖跨行 Replace All 与 Undo/Redo，确认被删除的 PS/NEL/LS 不会渗入替换文本的 LF。

验证：该回归在修复前失败、修复后通过；完整 `npm test` **463/463 通过**，两个变更 JavaScript 文件 `node --check` **2/2 通过**；另以 20,000 组确定性随机 CodeMirror 变更集对照未变更区间参考映射，全部一致。版本仍为 **0.5.16**，本轮改动仅属未发行源码；未运行构建、Electron UI smoke 或平台安装包打包，`dist/` 与 `release/` 未触碰。Linux Node 测试和变更集模拟不证明 macOS/Windows 原生行为或与 Cocoa 文稿模型等价。


## 2026-10-11 `.cotrpl` 全词匹配的 ICU 默认边界（未发行源码）

CotEditor **7.1.1** 的 [`TextFind.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/TextFind.swift) 为文字模式的 `fullWord` 建立 `^\\b.+\\b$` 检查器，并以 `.withTransparentBounds` 在实际命中范围两侧检查。ICU 正则说明将默认 `\\b` 定义为 word/non-word 类别切换；其 `\\w` 默认字符集合为 Alphabetic、Mark、Decimal_Number、Connector_Punctuation、U+200C 与 U+200D。UAX #29 `useUnicodeWordBoundaries` 是另一种 opt-in 边界模式，不应与默认模式混为一谈，见 [ICU 正则参考](https://unicode-org.github.io/icu/userguide/strings/regexp.html)。

CotEdit 原先仅要求匹配范围外的左右字符都不是 Unicode 字母/标记/数字/下划线，因而会把某些标点独立命中视为整词、把 `Pc` 连接标点与 join controls 当作非词字符，并把所有 Unicode 数字类别一概算作词字符。现改为分别检查命中起点与终点是否发生 ICU 默认词类切换，并按上述类别定义词字符；`matchesFullWord` 仍只作用于文字规则，正则规则及 `useUnicodeWordBoundaries` 位 64 未扩展。比如默认模式下 `can` 在 `can't` 中仍可因 apostrophe 是非词字符而命中；这不是 UAX #29 模式。该实现是依据官方类别定义的 JavaScript 跨平台适配，未声称等同 Foundation/ICU 引擎的全部细节。

回归覆盖命中范围两端的标点、Alphabetic 罗马数字、非十进制数字、Connector_Punctuation、U+200C/U+200D、apostrophe 默认边界、替换与高亮共享命中范围。`node --test test/multiple-replace.test.js` **37/37 通过**；完整 `npm test` **464/464 通过**；变更的 `lib/multiple-replace.js` 与 `test/multiple-replace.test.js` 通过 `node --check` **2/2**。正式版本仍为 **0.5.16**，本轮仅改未发行源码/测试/文档；AppImage 与 DEB 的 0.5.16 SHA-256 清单均为 `OK`。未构建、未运行 UI smoke 或打包，`dist/` 与 `release/` 未触碰。测试运行于 Linux Node，不证明 macOS/Windows 原生界面、Foundation/ICU 实机结果或辅助技术等价；文稿隐私、权限及数据保留策略未更改。

## 2026-10-11 `.cotrpl` 多行锚点的 ICU 行终止符（未发行源码）

CotEditor **7.1.1** 将 `.cotrpl` 的 `regexOptions` 解码为 `NSRegularExpression.Options` 原始位掩码；Foundation 将 `anchorsMatchLines` 定义为允许 `^`/`$` 匹配行首/行尾，并说明未启用 `useUnixLineSeparators` 时采用标准行分隔符。ICU 正则参考列出 LF、VT、FF、CR、NEL、LS、PS 及 CRLF 序列作为行终止符。CotEdit 原先的按行锚点仅识别 LF、CR、LS、PS，因此会漏掉 VT、FF、NEL 分隔的行。

现将 VT、FF、NEL 纳入 `regexOptions.anchorsMatchLines` 的默认行边界；CRLF 中仍抑制 CR 与 LF 之间的额外零宽边界。组合 `regexOptions.useUnixLineSeparators` 时继续只认 LF。此改动只扩展锚点边界，不扩展 `.` 对所有 ICU 行终止符的完整语义，也不声明 JavaScript RegExp 与 Foundation/ICU 完全等价。

依据：[CotEditor 7.1.1 MultipleReplace+Codable.swift](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/MultipleReplace%2BCodable.swift)、[Apple `anchorsMatchLines` 与 `useUnixLineSeparators`](https://developer.apple.com/documentation/foundation/nsregularexpression/options-swift.struct/anchorsmatchlines)、[ICU 正则行终止符说明](https://unicode-org.github.io/icu/userguide/strings/regexp.html)。

验证：多重替换与导入定向测试 **60/60 通过**；完整 `npm test` **464/464 通过**；`lib/multiple-replace.js` 与 `test/multiple-replace.test.js` 的 `node --check` **2/2 通过**。回归对 LF、CR、CRLF、VT、FF、NEL、LS、PS 覆盖替换命中与高亮范围，并验证 Unix 模式对非 LF 分隔符不匹配、CRLF 中间无锚点。正式版本仍为 **0.5.16**，改动仅属未发行源码/测试/文档；未构建、未运行 UI smoke 或打包，`dist/` 与 `release/` 未触碰。Linux Node 测试不证明 macOS/Windows 原生 Foundation 行为或辅助技术等价；文稿隐私与数据保留策略未更改。

## 2026-10-11 `.cotrpl` 正则点号的标准行终止符（未发行源码）

CotEditor **7.1.1** 将 `.cotrpl` 的 `regexOptions` 解码为 Foundation `NSRegularExpression.Options`；Apple 将 `dotMatchesLineSeparators` 描述为允许 `.` 匹配包括行分隔符在内的任意字符。ICU 正则参考明确说明：默认 `.` 不匹配 LF、VT、FF、CR、NEL、LS、PS；CRLF 序列作为一个行终止符。JavaScript 默认正则点号不排除 VT、FF、NEL，因此例如 `A.B` 会错误跨越这些分隔符。

CotEdit 现只在多重替换的正则路径中，把**未转义且位于字符类外**的 `.` 编译成显式排除集：标准模式排除上述七类分隔符；启用 `useUnixLineSeparators` 时只排除 LF；启用 `dotMatchesLineSeparators` 时保留 JavaScript dotAll。转义的 `\.` 和字符类 `[.]` 不改写。该适配同时供替换和独立高亮使用；不扩展普通查找面板或语法高亮正则，也不是完整 ICU 转换。dotAll 仍由 JavaScript `s` 实现，因此 CRLF 是否按单个点号原子匹配、Foundation/ICU 的全部词法与匹配行为均未保证等价。

依据：[CotEditor 7.1.1 `MultipleReplace+Codable.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/MultipleReplace%2BCodable.swift)、[Apple `dotMatchesLineSeparators`](https://developer.apple.com/documentation/foundation/nsregularexpression/options-swift.struct/dotmatcheslineseparators)、[Apple `useUnixLineSeparators`](https://developer.apple.com/documentation/foundation/nsregularexpression/options-swift.struct/useunixlineseparators) 与 [ICU 正则参考](https://unicode-org.github.io/icu/userguide/strings/regexp.html)。

验证：多重替换与 `.cotrpl` 导入定向测试 **61/61 通过**，全量 `npm test` **465/465 通过**；`lib/multiple-replace.js` 与 `test/multiple-replace.test.js` 的 `node --check` **2/2 通过**。回归覆盖八种行分隔输入、dotAll 开关、转义点号、字符类点号及 Unix 模式的非 LF 行分隔符。正式版本仍为 **0.5.16**，本轮仅更新未发行源码/测试/文档；未构建、未运行 UI smoke 或打包，`dist/` 与 `release/` 未改写。Linux Node 测试不证明 macOS/Windows 原生 Foundation 或菜单行为等价；文稿隐私、权限与数据保留设置未更改。


## 2026-10-11 文件预览的“其他应用打开”（未发行源码）

CotEditor 7.1.1 稳定版的 [`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift) 在文件预览提供 **Open with External Editor** 菜单：列出系统为该文稿注册的应用、将默认编辑器置顶，并提供 **Other…** 选择应用；其 7.1.1 发布说明及 [`Improve OpenWithExternalEditorMenu` 提交](https://github.com/coteditor/CotEditor/commit/c2ed1307ae6c0c3b68edfd69e3078e96111d2993)还记录了同名应用通过版本号消歧。

CotEdit 现在保留原有“默认应用”按钮，另加“其他应用…”按钮，从原生文件选择对话框选择程序并将预览文稿作为独立参数启动；应用路径不保存、不写入设置。主进程在弹出应用选择器前以及实际启动前都重新验证目标文件仍是所选根目录内的普通文件。macOS 仅接受 `.app` bundle 并通过系统 `open -a` 启动；Windows 限定 `.exe`；Linux 限定可执行普通文件。此为各平台可测试的受限应用选择入口，**未枚举各系统的已注册/默认应用列表，也未复刻 CotEditor 图标、排序、版本标签、Quick Look 或 SwiftUI 原生菜单**。

新增 Node 单测验证根目录复核、应用类型限制、应用路径/文稿路径分离、无 shell 参数启动及 macOS/Windows 启动分派；静态测试核验 HTML、preload 与主进程路由。Linux 测试只能验证数据与参数逻辑，不证明 macOS/Windows/Linux 目标桌面环境中的原生应用选择器或进程启动结果。正式版本仍为 **0.5.16**，本项仅属未发行源码；未运行构建、UI smoke 或打包，未更改 `dist/`、`release/`、文稿隐私或保留策略。


## 2026-10-11 macOS 外部应用选择器起始目录（未发行源码）

CotEditor 7.1.1 的 [`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift) 将 **Other…** 文件选择器的默认目录设为 `.applicationDirectory`。CotEdit 现在在 macOS 把 Electron 原生选择器的 `defaultPath` 设为 `/Applications`，并保持 `.app` 包可作为被选项目；Windows/Linux 不强设路径，沿用系统默认位置。此项只改善选择器的起始目录，不枚举已注册应用、不持久化选择，也不改变文稿根目录校验或启动参数。

依据：[CotEditor 7.1.1 外部编辑器选择器源码](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift) 与 [Electron `dialog.showOpenDialog` 文档](https://www.electronjs.org/docs/latest/api/dialog)（`defaultPath`、macOS `treatPackageAsDirectory`）。新增 Node 单测锁定 macOS 与非 macOS 选项，并检查 IPC 路由使用该 helper；Linux 单测不验证 macOS 原生面板实际导航行为，仍需目标系统实测。正式版本保持 **0.5.16**，此改动为未发行源码；未构建、未打包、未运行 UI smoke，`dist/` 与 `release/` 未改写，文件访问与文稿隐私/保留策略未变。

## 2026-10-12 外部应用选择器类型过滤（未发行源码）

CotEditor 7.1.1 的 [`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift) 为 **Other…** 文件导入器指定 `allowedContentTypes: [.application]`，选择器阶段只面向应用程序。CotEdit 的 Electron 原生选择器此前只允许选文件，非应用文件会在选择后才被拒绝；现在 macOS 添加 `.app` 扩展过滤，Windows 添加 `.exe` 过滤，Linux 保持无扩展过滤（其可执行应用没有统一扩展名）。macOS 仍以 `treatPackageAsDirectory: false` 允许选中应用包，原有主进程 `.app`/`.exe`/可执行文件校验、根目录文稿复核和无 shell 启动路径保持为最终约束。Electron 扩展名过滤只是 UTI 应用类型过滤的受限近似，不能保证所有注册应用都被列出或完全复现 Cocoa 面板行为。

依据：[CotEditor 7.1.1 外部编辑器选择器源码](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift)及 [Electron `dialog.showOpenDialog` 文档](https://www.electronjs.org/docs/latest/api/dialog)（`filters`、`treatPackageAsDirectory`）。Node 单测锁定 macOS `.app`、Windows `.exe` 和 Linux 无过滤选项，并核验主进程继续将 helper 选项传给原生选择器；Linux 测试不验证各系统文件对话框实际过滤效果，仍需 macOS/Windows/Linux 桌面实测。正式版本仍为 **0.5.16**，本项属于未发行源码/测试/文档；未构建、未打包、未运行 UI smoke，`dist/` 与 `release/` 未改写，文稿隐私及数据保留策略未变。


## 2026-10-11 快捷键 Unicode 标量边界回归（未发行测试）

CotEditor **7.1.1 稳定版**发布说明记载支持“单次按键可产生多个字符”的快捷键；CotEdit 将多字符及非 ASCII 键交由 renderer 派发，主进程 IPC 净化器只接受注册表中的命令 ID、NFC/小写化后的可打印键值以及有效修饰键。此次仅扩充 Node 回归：以 8/9 个补充平面 emoji 明确验证长度按 Unicode 标量而非 UTF-16 码元计数，并锁定拒绝不换行空格、双向格式控制符及 NUL；运行时代码与快捷键行为未改。

依据：[CotEditor 7.1.1 官方发布说明](https://coteditor.com/releasenotes/7.1.1.en)（稳定版，2026-10-03）。定向快捷键 Node 测试 **29/29**、完整 `npm test` **476/476**，`node --check` **2/2**。Node 测试只验证本机 IPC 输入净化逻辑，不验证 macOS/Windows 原生菜单、键盘布局、输入法或实体键盘行为。正式版本仍为 **0.5.16**，此增量未发行；未构建、未运行 UI smoke 或打包，`dist/` 与 `release/` 未改写，文稿隐私及数据保留策略未更改。

## 2026-10-11 多字符快捷键保留大小写（未发行源码）
CotEditor 7.1.1 的[正式发布说明](https://coteditor.com/releasenotes/7.1.1.en)新增单次按键可输出多个字符的快捷键支持；对应[上游提交 `897e55f`](https://github.com/coteditor/CotEditor/commit/897e55f1103c6c14e906bbbca536e6e715af04b4)明确多字符键串保留原始大小写与修饰键，而单字符键仍做大小写规范化。CotEdit 先前虽接受多字符输入，但快捷键录制、主进程 IPC 净化、事件匹配及冲突签名都无条件小写化，可能把 `SS` 与 `ss` 折叠为同一绑定。

现改为对键串做 NFC 规范化，多字符序列在 renderer、快捷键冲突签名与主进程 IPC 中保留大小写；单字符 ASCII/Unicode 键、功能键和命名键继续使用既有规范形式。原有最多 8 个 Unicode 标量、可打印字符、有效命令 ID 与修饰键校验保持不变；既存且已小写化的设置值无法还原录入时丢失的大小写。该阶段的菜单和设置标签仍会大写多字符键串，导致实际大小写不同的绑定显示相同；此显示问题已由同日后续源码修正解决，详见下节。

新增回归覆盖大小写序列捕获/匹配、大小写不同不冲突、同大小写冲突、NFC 组合字符，以及 IPC 大小写保留和单字符兼容。依据：[CotEditor 7.1.1 发布说明](https://coteditor.com/releasenotes/7.1.1.en)与[上游实现提交](https://github.com/coteditor/CotEditor/commit/897e55f1103c6c14e906bbbca536e6e715af04b4)。本地 Linux Node 测试只验证 JavaScript/IPC 逻辑，不证明 macOS 原生菜单或其他目标平台键盘布局、输入法、实体按键行为等价；仍未声称 1:1 原生兼容。正式版本保持 **0.5.16**，本项为未发行源码；未构建、未运行 UI smoke 或打包，`dist/` 与 `release/` 未改写，文稿隐私与数据保留策略未更改。

补充实现链路：设置读入/保存继续调用共享的 `normalizeShortcutKey()`，因此大小写保留贯穿配置持久化。验证：快捷键定向测试 **29/29 通过**，完整 `npm test` **476/476 通过**，本轮变更的 JavaScript 源码与测试 `node --check` **6/6 通过**。

## 2026-10-11 多字符快捷键标签大小写可辨（未发行源码）

本段记录当时的中间实现：设置面板的共享 `formatShortcut()` 与 Electron 菜单的 `formatCustomShortcutLabel()` 曾对多字符键串显示 NFC 后保留的原始大小写，因此 `SS` 与 `ss` 在设置行和自定义菜单标签中可区分。后续逐项核对 CotEditor 7.1.1 的 `Shortcut.keyEquivalentSymbol` 与 `ShortcutFormatterTests` 后，现有显示规则已由下文 2026-10-12 增量取代；快捷键捕获、大小写敏感匹配/冲突与存储语义始终不变。

新增纯 Node 回归覆盖 macOS/非 macOS 的大小写标签、大小写不同不冲突/相同则冲突、设置偏好解析及设置文件导入/导出往返。快捷键/菜单/设置定向测试 **48/48**、完整 `npm test` **479/479**，本轮涉及的 JavaScript 源码与测试 `node --check` **6/6**。Linux Node 测试不验证实体键盘事件、输入法或各平台原生菜单呈现，不宣称 1:1/native parity。正式版本仍为 **0.5.16**；未构建、未运行 UI smoke、未打包；按排除既有 `.tmp` 辅助文件的正式文件集合计，`dist/` 4 个、`release/` 115 个，共 119 个文件保持原样，组合文件指纹仍为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。文稿隐私及数据保留策略未改变。

## 2026-10-11 首字母大写的标点词界修正（未发行源码）

CotEditor 7.1.1 的 [`capitalizeWord(_:)`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView%2BTransformation.swift) 调用 Foundation `localizedCapitalized`。[Apple 文档](https://developer.apple.com/documentation/foundation/nsstring/localizedcapitalized)将词描述为空格、制表符或行终止符分隔的字符序列，并说明常见分词标点有时并不构成边界。CotEdit 原实现按连续字母/组合标记/数字序列分词，因此会把撇号、连字符和下划线当词界；现改为按 Unicode `White_Space` 分隔、对每段首个 Unicode 标量应用 locale-aware uppercase、其余部分应用 locale-aware lowercase。新增回归覆盖 contractions、hyphenated/underscored tokens、标点前缀、重音字符及 TAB/CRLF/NEL/LS 分隔，并更新原有中日韩混排预期。

这是基于 Apple 文档的跨平台近似，不是 Foundation 的逐字符复刻：JavaScript 默认 locale 协商、Unicode 空白集合、特定语言大小写与 grapheme/word segmentation 仍可能不同。定向 `text-tools` **24/24**，完整 `npm test` **480/480**，变更的两个 JavaScript 文件 `node --check` **2/2**。测试仅在 Linux Node 运行；未运行构建、UI smoke 或打包，未触及 `dist/`、`release/`。正式版仍为 **0.5.16**；文稿隐私及数据保留策略不变。


## 2026-10-11 首字母大写的上下文映射补充（未发行源码）

在前述 Unicode 空白分词修正基础上，现先对每个非空白片段整体执行 `toLocaleLowerCase(locale)`，再对所得首个 Unicode 标量执行 `toLocaleUpperCase(locale)`。这保留上下文相关的小写映射，例如 `ΟΣ` → `Ος`，同时不改变 `can't`、`mother-in-law`、`FOO_BAR` 的既定词内标点行为。仅辅助函数接受可选显式 locale；菜单调用使用 JS 运行时默认 locale。定向 `text-tools` **25/25**、完整 Node 测试 **481/481**，两个变更 JavaScript 文件语法检查 **2/2**。Node 测试不能验证 Foundation 的 `localizedCapitalized`、目标系统 locale 协商或原生 UI 行为；本增量仍是跨平台近似，未构建、未运行 UI smoke 或打包，正式版本仍为 **0.5.16**。

## 2026-10-11 `.cotrpl` ICU 命名捕获替换模板（未发行源码）

CotEditor 7.1.1 的 [`TextFind.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/TextFind.swift) 以 `NSRegularExpression.replacementString(for:in:offset:template:)` 展开正则替换模板；[ICU 官方模板语法](https://unicode-org.github.io/icu/userguide/strings/regexp.html)将 `${name}` 定义为命名捕获引用。CotEdit 现支持 `${name}`；已定义但本次未匹配的可选命名组展开为空；此前已接受的 `$<name>` 保留兼容。未知命名引用仍按原样保留。此项只补模板引用形式，不扩展正则引擎，不代表完整 Foundation/ICU 替换模板语义等价。

定向多重替换/导入测试 **62/62**，完整 `npm test` **484/484**，变更的 JavaScript 源码与测试 `node --check` **3/3**。测试仅在 Linux Node 运行；macOS Foundation 实机结果及 Electron/macOS/Windows/Linux UI 行为未验证。正式版本仍为 **0.5.16**；本项是未发行源码/测试/文档，不构建、不打包、不运行 UI smoke；`dist/` 与 `release/` 逐文件哈希核验未改变，文稿隐私与数据保留策略不变。


## 2026-10-11 Unicode 字符信息的代理对内偏移修正（未发行源码）

CodeMirror 文档位置按 UTF-16 代码单元计数（[CodeMirror 文档](https://codemirror.net/docs/ref/)）；JavaScript `String.prototype.codePointAt()` 若索引指向有效代理对的低代理，会按规范只返回该代理项值（[MDN 说明](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/codePointAt)）。因此 `characterInfo("A😀B", 2)` 原先会把低代理误报为 U+DE00，并将孤立代理经 `TextEncoder` 替代编码后错误计为 3 个 UTF-8 字节。现仅在给定 UTF-16 偏移恰好落于有效高/低代理对之间时回退到该标量起点；该位置返回完整字符、真实码点及 UTF-16/UTF-8 长度，代理对之后的偏移保持不变。此修正处理字符信息辅助函数的输入边界，不宣称正常鼠标/键盘光标一定能落在代理对内部，也不声称 Cocoa 原生 UI 等价。

定向 `text-tools` **25/25 通过**，完整 `npm test` **484/484 通过**，变更的 JavaScript 源码与测试 `node --check` **2/2 通过**。验证仅在 Linux Node；未构建、未运行 UI smoke、未打包。正式版本仍为 **0.5.16**，本项属未发行源码；`dist/` 与 `release/` 的 **120** 个文件前后组合 SHA-256 指纹均为 `effd3020781958400de4e3615d4c5766be6f457c907c65fa908cca7050939dee`。文稿隐私与数据保留策略未改。


## 2026-10-11 字符信息选区的区域指示符配对修正（未发行源码）

CotEditor 7.1.1 的字符信息命令先要求 `selectsSingleCharacter`，并从选中文本取得完整字符；CotEdit 为避免扫描整篇文稿，只用选区左右各 16 个 UTF-16 单元进行字素验证。Unicode UAX #29 的 GB12/GB13 要求连续区域指示符按前序数量奇偶配对，因此局部窗口若从一串旗帜符号中间开始，会重置配对相位；例如十个连续区域指示符中，单独选中第十个并不是一个独立字素，但局部切片此前可能误判为可检查。现仅对此种被切开的连续区域指示符运行做奇偶校正；通常文本继续使用原有有界局部路径。依据 [CotEditor 7.1.1 选区检查命令源码](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/EditorTextViewController.swift) 与 [Unicode UAX #29 GB12/GB13](https://www.unicode.org/reports/tr29/)。

新增纯函数回归覆盖原误判、完整旗帜字素仍可接受，并验证仅在窗口切入连续区域指示符段时启用校正分支。定向 `character-selection` **6/6**，完整 `npm test` **486/486**，变更的 JavaScript 源码与测试 `node --check` **3/3**。验证仅在 Linux Node；未运行构建、UI smoke 或打包，不能证明 CodeMirror 实际光标位置、macOS Foundation/AppKit 或原生 UI 行为。正式版本仍为 **0.5.16**，本增量仅属未发行源码、测试与文档；`dist/` 与 `release/` **120** 个文件逐项哈希保持不变。文稿隐私与数据保留策略未改变。


## 字符信息选区的有界上下文

字符信息选区验证使用有限上下文，以避免普通文稿每次都扫描全文；UAX #29 GB11 的 `Extended_Pictographic Extend* ZWJ × Extended_Pictographic` 允许任意长的 `Extend*`。若左右 16 个 UTF-16 单元的窗口起点落在一个实际 GB11 前缀内部，CotEdit 现在仅对该情形回退到全文字素验证，防止 ZWJ 后的末尾 pictograph 被误判为独立字符；其余文本仍走局部快路径。此 JS `Intl.Segmenter` 逻辑及 Unicode 属性版本受 Electron/V8 影响，不证明 CodeMirror 实际 caret 或 macOS Foundation/AppKit 行为等价。CotEditor 7.1.1 的 [Character Inspector 实现](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Accessory%20Views/CharacterInspectorView.swift)以 `Character` 呈现字符并为多 scalar 字素提供逐 scalar 详情；规则依据 [Unicode UAX #29 GB11](https://www.unicode.org/reports/tr29/)。


## 2026-10-11 字符信息选区的 Indic GB9c 边界修正（未发行源码）

字符信息选区沿用左右各 16 个 UTF-16 单元的局部上下文。Unicode 17.0 UAX #29 GB9c 规定：`InCB=Consonant [InCB=Extend InCB=Linker]* InCB=Linker [InCB=Extend InCB=Linker]* × InCB=Consonant`；其中 Extend/Linker 序列可超过局部窗口。窗口若截掉前置辅音，局部分段可能将末尾 Indic 辅音误判为独立字素。现仅当选区起点是 InCB Consonant、其前方存在有效 Linker/Extend 链且前置辅音确实落在窗口之外时，才对原文全文做字素校验；普通长组合符、无 Linker 序列、非 InCB 辅音结尾及未截断上下文继续走有界路径。由于 ECMAScript 正则属性转义不支持 `Indic_Conjunct_Break` 枚举值，`lib/unicode-incb.js` 使用 Unicode 17.0.0 `DerivedCoreProperties.txt` 的 Consonant、Extend、Linker 范围；它只为边界识别提供数据，不改变字符信息面板显示的字符元数据。依据 [UAX #29 Revision 47（Unicode 17.0）GB9c](https://www.unicode.org/reports/tr29/tr29-47.html)、[官方派生属性表](https://www.unicode.org/Public/17.0.0/ucd/DerivedCoreProperties.txt)及 [CotEditor 7.1.1 Character Inspector](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Accessory%20Views/CharacterInspectorView.swift)。

定向 `character-selection` 测试 **11/11**，完整 `npm test` **491/491**，本轮 3 个 JavaScript 源码/测试文件 `node --check` **3/3**。正式版本仍为 **0.5.16**；这是未发行源码，不构建、不打包、不运行 UI smoke。`dist/` 与 `release/` 共 **120** 个文件的前后逐文件哈希清单完全一致，清单摘要为 `b68917e4523a6e69ad1ba0e37448b3a483e580c5b68c2f5d704e6e5e658b011f`；正式 AppImage/DEB 校验清单通过。测试运行于 Linux Node 24.19/ICU 78.3，只验证纯 JavaScript 规则；不证明 CodeMirror 实际 caret、macOS Foundation/AppKit、Windows/macOS 原生 UI、菜单或辅助技术行为等价。文稿隐私及数据保留策略未改变。


## 2026-10-11 普通文字查找/替换的规范等价范围（未发行源码）

CotEditor 7.1.1 的 `TextFind` 文字模式通过 `NSString.range(of:options:range:)` 查找；Apple 文档说明 NSString 默认比较 Unicode 规范等价的码点序列，且匹配范围长度可能与查找串不同。CotEditor 7.0.2 发布说明也记录过 Replace All 与 Multiple Replace 漏掉规范等价字符串的问题，并以 U+00B7 `·` / U+0387 `·` 为例。CotEdit 的 CodeMirror 6.7.2 `SearchCursor` 默认使用 NFKD，范围更宽，会把仅兼容分解的字符（例如 `①` 与 `1`）当成可匹配。现由共用查询构造器对普通文字查找再校验原文命中串及查询串的 NFD 规范形式；所以计数、导航、自定义高亮、单次替换和全部替换沿用同一组命中区间。正则查找/替换完全不加该校验。

此改动只收紧普通文字模式中过宽的 NFKD 命中，并保留规范等价命中；大小写不敏感分支沿用 CodeMirror 的逐码点小写策略。它是跨平台 JS 适配，不承诺对 Foundation 的全部比较/大小写/范围边界行为逐项等价。依据：[CotEditor 7.1.1 `TextFind.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/TextFind.swift)、[CotEditor 7.0.2 发布说明](https://coteditor.com/releasenotes/7.0.2.en)、[Apple NSString `range(of:options:range:)`](https://developer.apple.com/documentation/foundation/nsstring/range(of:options:range:))、[Apple `NSString.CompareOptions.literal`](https://developer.apple.com/documentation/foundation/nsstring/compareoptions/literal) 与 [CodeMirror 6 `SearchCursor`](https://codemirror.net/6/docs/ref/#search.SearchCursor)。

验证：定向搜索/高亮测试 **15/15**，完整 `npm test` **494/494**，4 个变更 JavaScript 源码/测试文件 `node --check` **4/4**。正式版本仍为 **0.5.16**，本轮仅为未发行源码。未构建、未打包、未运行 UI smoke；`dist/` 与 `release/` 合计 **120** 个文件树摘要仍为 `b68917e4523a6e69ad1ba0e37448b3a483e580c5b68c2f5d704e6e5e658b011f`，未改动。测试运行于 Linux Node 24.19 / ICU 78.3；不能证明 CodeMirror 在 Electron renderer 的实际 UI 体验、macOS Foundation/AppKit、Windows/macOS 原生 UI、菜单或辅助技术行为等价。文稿隐私及数据保留策略未改变。


## 2026-10-11 普通 Replace All 的混合行尾回归（未发行源码）

[CotEditor 7.1.1 正式发布说明](https://coteditor.com/releasenotes/7.1.1.en)明确修复：混合行尾文稿的 Redo 不应改变原行尾，Replace All 不应改变匹配文本之外的行尾。CotEdit 已由 `documentLineEndingExtensions` 将 EOL 元数据纳入 CodeMirror history；本轮把普通查找面板的命中到替换编辑块转换集中为 `createSearchReplacementChanges`，renderer 的 Replace All 复用该 helper，新增换行仍统一为内部 LF。回归测试通过共享 `createSearchQuery` 与 `collectSearchMatches` 生成两个普通文字命中，替换文本还包含 CRLF/LS；断言匹配之外的 CRLF、CR、PS、NEL 精确保留，插入换行采用回退 LF，且 Undo/Redo 恢复对应状态字段。

这是纯 Node/CodeMirror state 级回归，验证 helper、事务与行尾历史扩展的组合；不等同于 Electron renderer 的真实 UI 操作，也不证明 macOS Foundation/AppKit、Windows/macOS 原生编辑行为或 1:1 平台一致。定向搜索/高亮/替换 **54/54**，完整 `npm test` **495/495**，本轮 3 个 JavaScript 源码/测试文件 `node --check` **3/3**。正式版本仍为 **0.5.16**；本增量为未发行源码、测试与文档。未构建、未打包、未运行 UI smoke；`dist/`、`release/` 未改写；文稿隐私及数据保留策略未变。

## 2026-10-11 普通单次替换的混合行尾回归（未发行源码）
CotEditor 7.1.1 [正式发布说明](https://coteditor.com/releasenotes/7.1.1.en)分别记录混合行尾文稿的 Redo 与 Replace All 修复。CotEdit 普通 Replace 现也调用与 Replace All 共用的 `createSearchReplacementChanges`，保持替换内容内部行尾为 LF，并从归一后的插入文本计算光标位置。直接 CodeMirror state 测试覆盖选择第二处命中、替换内容含 CRLF、替换外 CRLF/CR/PS/NEL 元数据保持、保存序列化结果及 Undo/Redo；该测试不驱动真实 Electron renderer，因此只证明共享编辑块与历史扩展的状态组合。
定向 `search-tools` **11/11**，完整 Node 测试 **496/496**，两个变更 JavaScript 文件 `node --check` **2/2**。正式版本为 **0.5.16**，该增量尚未发行；未构建、未运行 UI smoke、未打包，`dist/` 和 `release/` 发布文件逐项校验未变。Node 测试仅在 Linux Node 24.19 / ICU 78.3 运行，不证明 macOS Foundation/AppKit、Windows/macOS 原生文本系统、菜单或辅助技术行为等价；文稿隐私及数据保留策略未改变。


## 2026-10-11 字符信息中的 Unicode Age（未发行源码）

CotEditor 7.1.1 的 [Character Inspector](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Accessory%20Views/CharacterInspectorView.swift) 在 scalar 的 `properties.age` 存在时显示 `Unicode major.minor` 版本。CotEdit 的 Unicode 17.0 数据生成器现加入官方 [`DerivedAge.txt`](https://www.unicode.org/Public/17.0.0/ucd/DerivedAge.txt)，排序、验证非重叠并合并相邻同版本范围，生成 1,788 个压缩区间，同时记录 UCD 源文件 SHA-256；字符元数据 API 增加 `age`，字符信息面板仅在有值时显示“Unicode 版本：Unicode x.y”。它表示该码位首次分配的版本，不是当前 Unicode 版本。Unicode UCD 规定未列出的 Age 默认值为 Unassigned；需要注意，Unicode 非字符虽一般类别为 `Cn`，也可能具有 Age，例如 U+10FFFF 的 Age 为 2.0，因此测试单独覆盖此例。

纯 Node 测试覆盖 U+0041（1.1）、U+1F600（6.1）、U+1FAEA（17.0）、真正未分配的 U+0378（无 Age），以及 U+10FFFF（`Cn`、Age 2.0）。定向 Unicode 字符信息/字符计数 **9/9**，完整 `npm test` **497/497**，3 个变更 JavaScript 文件语法检查 **3/3**，Python 生成器语法检查通过；正式 0.5.16 AppImage/DEB SHA-256 校验通过。正式版本仍为 **0.5.16**，本项仅为未发行源码、测试及文档；未构建、未打包或运行 UI smoke，`dist/` 与 `release/` 未触及。Linux Node 测试不验证 macOS/Windows 原生 Inspector、菜单、辅助技术或平台 UI 行为，不宣称 1:1/native parity；文稿隐私与数据保留策略未改变。


## 2026-10-11 合并输入撤销组中的混合行尾恢复（未发行源码）

CotEditor [7.1.1 正式发布说明](https://coteditor.com/releasenotes/7.1.1.en)记录了混合行尾文稿中 Redo 与 Replace All 的行尾修复；官方[发布档案](https://coteditor.com/archives)标明 7.1.1 于 2026-10-03 发布。CotEdit 既有用例覆盖 Replace All 的行尾保留，但未覆盖 CodeMirror 把相邻 `input.type` 事务合成一个 Undo 组的情况。本轮纯 Node 复现发现：插入换行后紧接着输入字符，Undo 可恢复原文本，却遗留额外 LF 元数据，导致后续保存可能改变分隔符。

修复 `documentLineEndingExtensions` 的行尾与回退行尾状态字段：对同一事务中的多个反转效果从末尾向前检查，使合并 Undo 组采用组开始前的状态。新增 `test/document-line-ending-history.test.js`，确认两次相邻输入归为同一 Undo 组，并逐项验证原文、混合 EOL 元数据及序列化分隔符在单次 Undo/Redo 后准确往返。该测试只验证 CodeMirror state/history 扩展，不等同真实 Electron UI 冒烟，也不证明 Cocoa/Foundation 或各平台原生文本行为等价。

定向行尾/多重替换 **39/39**，完整 `npm test` **500/500**，本轮两个 JavaScript 文件 `node --check` **2/2**。正式版本仍为 **0.5.16**，本修复为未发行源码、测试和文档；未构建、未打包、未运行 UI smoke。`dist/` 与 `release/` 共 **120** 个文件，树摘要仍为 `b68917e4523a6e69ad1ba0e37448b3a483e580c5b68c2f5d704e6e5e658b011f`，未改动。测试运行于 Linux Node **24.19.0**；没有 macOS/Windows 原生 UI 验证，不宣称 1:1/native 等价；文稿隐私和数据保留策略未改变。


## 未发行源码：混合行尾历史与文稿模型同步

CotEditor 7.1.1 正式发布说明记载了混合行尾文稿中 Redo 与 Replace All 的修复；CotEdit 当前源码继续补上与该稳定基线相关的一处本地状态同步缺口：当 Undo/Redo 事务只改变 CodeMirror 的行尾元数据而正文不变时，renderer 也同步更新文稿模型里的行尾列表和默认行尾，避免后续保存使用过期值。恢复到已保存版本时，正文、保存的行尾列表和默认行尾通过同一事务提交；即使正文完全相同，状态字段与后续新插入行所用的回退行尾也会恢复。

Node 回归覆盖纯元数据 Undo/Redo、最终序列化分隔符、相同行文的恢复事务及恢复后的新行插入。此实现仅为 CotEdit 的 CodeMirror/Electron 状态同步，不表示与 Cocoa 文稿模型等价；正式版本仍为 0.5.16，当前工作源码尚未发布。Linux Node 测试不验证 macOS/Windows 原生菜单、输入法或文本系统行为。

## 未发行源码：行尾元数据的语义变化判定

继续收紧上述行尾同步路径：CodeMirror 的 `StateField` 在接收 `setDocumentLineEndings` 效果时会创建新数组；仅比较数组引用会把值完全相同的行尾列表误报为变化，renderer 随之执行本不需要的编码警告、状态栏/侧栏刷新及会话持久化。同步器现逐项比较 EOL 类型；仅在列表元素或默认 EOL 实际变化时更新文稿模型并触发该更新分支。

回归直接组合 `documentLineEndingExtensions` 与 `synchronizeDocumentLineEndingMetadata`，确认相同行尾值的新数组不构成变化，同时保留前述元数据 Undo/Redo 的变化检测。此为 CotEdit 内部状态更新去重；CotEditor 7.1.1 发布说明仅为混合行尾 Undo/Redo 修复提供背景，不把此优化归因于上游或宣称平台等价。正式版本仍为 **0.5.16**；该改动仅在未发行源码/测试/文档。验证使用 Linux Node/CodeMirror state，不是 renderer UI smoke，也不证明 macOS/Windows 原生行为；未构建、未打包，`dist/` 与 `release/` 保持不变。


## 2026-10-12 多行正则 Replace All 的混合行尾边界回归（未发行源码）

CotEditor 7.1.1 [正式发行说明](https://coteditor.com/releasenotes/7.1.1.en)明确记录：混合行尾文稿中的 Replace All 不应改动匹配文本之外的行尾。既有 CotEdit 回归覆盖普通文字 Replace All 及跨行多重替换，但普通查找面板的**多行正则** Replace All 尚无针对跨越多个已保存分隔符的专门用例。本轮补测普通正则命中 `start\nmiddle\nend` 并替换为含 CRLF 的 `left\r\nright`：匹配内部已移除的 CR/PS 不残留，匹配外 CRLF 与 NEL 保持原样，替换中新行规范为内部 LF/文稿回退样式；再逐步验证 CodeMirror 行尾历史与文稿模型同步在 Undo/Redo 后可准确序列化回原/新分隔符。

该场景现有生产代码已按预期工作，因此本轮只新增回归测试与本文记录，不改动生产源码。对照仍是 CotEditor **7.1.1 稳定版**；7.2 alpha 仅为开发参考，不作为此结论的依据。定向 `search-tools` **12/12**，完整串行 `npm test` **506/506**，变更测试文件 `node --check` **1/1**。正式版本仍为 **0.5.16**，本项是未发行测试/文档增量；未构建、未打包、未运行 UI smoke，未写入 `dist/` 或 `release/`，未删除文件或清缓存，文稿隐私/保留策略未改。验证为 Linux Node **24.19.0** 与 CodeMirror state 测试；不证明 Electron UI 实际交互、macOS/Windows 原生编辑/菜单/无障碍行为或 1:1 等价。


## 未发行源码：查找工具栏按钮的可访问名称

查找工具栏按钮现使用显式名称“查找与替换”，并将放大镜字符标记为装饰性内容，避免图符混入辅助技术名称；可见标签仍为“查找”，标题快捷键提示和 `aria-controls` / `aria-expanded` 状态不变。此处仅对照 [W3C WAI-ARIA Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) 的按钮命名要求，不是 CotEditor 原生辅助技术行为的等价声明。定向静态 Node 回归只能核验源码标记；未运行 Electron UI smoke、真实读屏器或 macOS/Windows 辅助技术验证。正式版本仍为 **0.5.16**，改动属于未发行源码/测试/文档；不构建、不打包，不改写 `dist/` 或 `release/`。

## 2026-10-12 混合行尾行重排事务的 Undo/Redo 回归（未发行测试）

CotEditor 7.1.1 [正式发布说明](https://coteditor.com/releasenotes/7.1.1.en)记录混合行尾文稿的 Redo 修复。此前 CotEdit 测试分别覆盖自动映射行尾的常规编辑、纯行尾元数据历史和 Replace/Replace All，但没有直接覆盖 `transformActiveLineBlock` 实际采用的“正文变化同时显式提交 `setDocumentLineEndings`”路径。现新增纯 CodeMirror state 回归：反转 `CRLF`/`PS` 混合三行，验证操作后的 `NEL` 回退分隔符、Undo/Redo 精确序列化，以及重做后新增行继续采用 NEL。现有生产代码通过该场景，本轮仅新增测试和记录。

定向 `document-line-ending-history` 测试 **5/5**，完整串行 `npm test` **508/508**，新增测试文件 `node --check` 通过。正式发行仍为 **0.5.16**，本项是未发行测试/文档增量；不构建、不打包、不运行 UI smoke。验证仅为 Linux Node 与 CodeMirror state，不证明 Electron renderer 的实际交互、macOS/Windows Cocoa/AppKit 原生文本行为或 1:1 等价；未修改 `dist/`、`release/`，文稿隐私和数据保留策略不变。


## 2026-10-12 普通上下移行命令的混合行尾 Undo/Redo 回归（未发行测试）

CotEditor 7.1.1 [正式发布说明](https://coteditor.com/releasenotes/7.1.1.en)记录了混合行尾文稿中 Redo 改变行尾的修复。CotEdit 已有行移动测试验证正文、光标、多选区及普通 Undo/Redo，但未将 CodeMirror `moveLineUp` / `moveLineDown` 命令与文稿的混合行尾 StateField、序列化及元数据历史组合起来验证。本轮新增纯状态回归：以 `CRLF`/`PS` 原文和 `NEL` 插入回退格式分别执行上下移行，确认受影响边界的新分隔符采用 `NEL`，未受影响的 `PS` 保持不变；Undo 恢复 `CRLF`/`PS` 原始字节表示，Redo 再现相同的 `NEL`/`PS` 结果。

这里记录的是 CotEdit 当前 CodeMirror 命令路径与回退行尾策略，不表示被移动行会携带其原始分隔符，也不把这一具体规则归因于 CotEditor 7.1.1（其发布说明未规定该细节）。定向 `editor-commands` 与 `document-line-ending-history` **10/10**，完整串行 Node 测试 **509/509**，变更测试文件 `node --check` **1/1**。正式版本仍为 **0.5.16**；本轮仅新增未发行测试/文档，未修改生产源码；未构建、未打包、未运行 UI smoke。`dist/` 与 `release/` 指纹核验未变（`b68917e4523a6e69ad1ba0e37448b3a483e580c5b68c2f5d704e6e5e658b011f`）。验证仅为 Linux Node 24.19.0 与 CodeMirror state，不证明 renderer UI、macOS/Windows Cocoa/AppKit 文本系统、菜单或辅助技术行为等价；文稿隐私及数据保留策略未变。


## 2026-10-12 输入法合成态快捷键保护（未发行源码）

CotEditor 7.1.1 稳定版发布说明加入“单次按键可产生多个字符”的快捷键支持；CotEdit 保留该非组合态 `KeyboardEvent.key` 多字符匹配路径，同时补上输入法编辑器（IME）组合态隔离：`isShortcutCompositionEvent()` 在 `KeyboardEvent.isComposing === true` 或兼容旧 Chromium 的 `keyCode === 229` 时返回真，`shortcutKeyFromEvent()` 不生成快捷键键值，renderer 全局 `keydown` 则在录入捕获、Escape 面板处理和命令分派之前直接退出，让浏览器/输入法继续处理该事件。它是为了不将候选文字组合误作命令的 CotEdit 跨平台键盘事件保护；本轮不据此宣称与 CotEditor 的 Cocoa `NSTextView`/菜单行为等价。

证据：[CotEditor 7.1.1 正式发布说明](https://coteditor.com/releasenotes/7.1.1.en)（多字符按键支持）和 [MDN `KeyboardEvent.isComposing`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing)（组合事件发生于 `compositionstart` 后、`compositionend` 前）。回归覆盖 `isComposing`、旧式 229 标记、快捷键归一化/匹配/分派，以及 renderer handler 的前置 guard；完整串行 Node 测试 **510/510 通过**，定向快捷键测试 **31/31 通过**，`node --check` **3/3 通过**。正式版本仍为 **0.5.16**；本项仅为未发行源码/测试/文档，未构建、未运行 UI smoke 或打包。Node 与源码静态测试不验证实际输入法、Electron 运行时、物理键盘布局或 macOS/Windows 原生行为。


## 2026-10-12 `.cotrpl` dotAll 的 CRLF 原子匹配（未发行源码）

ICU 正则参考对 `UREGEX_DOTALL` 明确说明：CRLF 对在输入中按单个行终止符处理，并可由一个 `.` 匹配；标准行终止符还包括 LF、VT、FF、CR、NEL、LS 与 PS。CotEditor 7.1.1 将 `.cotrpl` 的 `regexOptions` 原始位掩码解码为 `NSRegularExpression.Options`，因此该语义影响其多重替换正则。CotEdit 原先把该选项直接映射到 JavaScript `s` 标志，JavaScript 将 CR 与 LF 当作两个输入字符；结果 `A.B` 无法在 `A\r\nB` 上命中，且 `A..B` 会把同一 CRLF 分隔符拆成两次点号匹配。

现仅在多重替换正则、启用 `dotMatchesLineSeparators` 且未启用 `useUnixLineSeparators` 时，将未转义、位于字符类外的 `.` 编译为 `(?:\\r\\n|(?<!\\r)(?!\\r\\n)[\\s\\S])`：第一分支将 CRLF 作为一个原子，第二分支阻止另一个点号从 CRLF 内部消费半段，同时仍匹配其他单个 Unicode 标量。启用 Unix 行分隔模式时保持现有行为，因为该模式只把 LF 视为行分隔符，CR 与 LF 是两个字符。转义点号与字符类内容不改写；替换及独立高亮共享同一编译路径。本修正不扩展普通查找面板或语法高亮，也不宣称其他 ICU/Foundation 与 JavaScript 正则语义完全一致。

依据：[ICU DOTALL 与 CRLF 说明](https://unicode-org.github.io/icu/userguide/strings/regexp.html)、[CotEditor 7.1.1 `MultipleReplace+Codable.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/MultipleReplace%2BCodable.swift) 与 [Apple `dotMatchesLineSeparators`](https://developer.apple.com/documentation/foundation/nsregularexpression/options-swift.struct/dotmatcheslineseparators)。回归覆盖标准单字符行终止符、CRLF 单点/双点差异、Unix 模式下 CRLF 两字符行为、补充平面 Unicode 标量、转义/字符类点号及替换/高亮一致性。新增回归在修复前失败、修复后通过；定向多重替换测试 **39/39**，完整串行 `node --test --test-concurrency=1 test/*.test.js` **511/511**，`lib/multiple-replace.js` 与 `test/multiple-replace.test.js` `node --check` **2/2**。正式版本保持 **0.5.16**；改动仅属未发行源码/测试/文档，未构建、未打包、未运行 Electron UI smoke，`dist/` 与 `release/` 未改写（120 个文件聚合 SHA-256 为 `b68917e4523a6e69ad1ba0e37448b3a483e580c5b68c2f5d704e6e5e658b011f`）。Linux Node 测试不验证 macOS Foundation/ICU 实机、Electron 原生菜单与 UI 或 Windows/macOS 行为；未触及恢复、隐私、权限或数据保留策略。


### `regexOptions.useUnicodeWordBoundaries`（Foundation 位 64，未发行增量）

CotEditor 7.1.1 的 `NSRegularExpression.Options` 将该选项定义为采用 Unicode TR#29 词边界；CotEditor 将 `regexOptions` 原始位掩码写入/读取替换定义。CotEdit 现在识别位 64，在多重替换管理器中显示/保存该开关，并让正则替换与独立高亮共用边界校验。启用时，模式中的 `\b`/`\B`（不在字符类或 `\Q…\E` 引用中）先标注为零宽捕获，再用 `Intl.Segmenter('und', { granularity: 'word' })` 返回的 `isWordLike` 词段边缘校验；额外标注会映射回原始捕获编号，数字反向引用与 `$1` 替换示例均有回归覆盖。

**限制：**这是浏览器/Node 宿主 ICU/Unicode 数据版本上的可测近似，不是 macOS Foundation/ICU 的原生实现或完全等价承诺。JavaScript RegExp 会先选定一个匹配分支，代码随后才校验边界；若该分支边界不成立，不保证回退尝试同起点的其他备选分支。范围替换的分段上下文仍受现有选区边界设计约束。详见 [Unicode UAX #29 默认词边界规则](https://www.unicode.org/reports/tr29/)、[Foundation 选项原始位值](https://github.com/swiftlang/swift-corelibs-foundation/blob/main/Sources/Foundation/NSRegularExpression.swift)及 [CotEditor 7.1.1 `.cotrpl` 编码模型](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/MultipleReplace%2BCodable.swift)。Linux Node 回归不能代替 macOS 原生对照。


## 2026-10-12 所选文字匹配高亮延迟（未发行源码）
CotEditor 7.1.1 的 `EditorTextView.swift` 对选区变化取消前一次高亮任务、清除旧的临时匹配标记，再按偏好延迟后重算；`DefaultSettings.swift` 默认启用此功能并设为 **0.5 秒**，`EditSettingsView.swift` 提供 **0–10 秒、0.25 秒步进**的延迟控件，关闭高亮时禁用该控件。参考：[CotEditor `EditorTextView.swift`](https://raw.githubusercontent.com/coteditor/CotEditor/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView.swift)、[默认设置](https://raw.githubusercontent.com/coteditor/CotEditor/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift)、[编辑设置界面](https://raw.githubusercontent.com/coteditor/CotEditor/7.1.1/CotEditor/Sources/Settings%20Window/Panes/EditSettingsView.swift)。

本项目安装的 CodeMirror `@codemirror/search` 高亮选项没有延迟字段，其插件会在选区或文稿变化时立即扫描。因此 CotEdit 将原来的即时扩展替换为可取消的尾沿延迟插件：选区/正文变化立即清除旧标记并取消重排计时；延迟到期后仅为当前可见范围重算；延迟设为 0 时即时重算。设置默认 **0.5 秒**，支持 **0–10 秒、0.25 秒步进**，关闭高亮时数值输入禁用；数值写入本机设置并经现有设置文件导入/导出流程保留。

**行为边界：**仍只处理一个非空选区；选中文字超过 200 个 UTF-16 单元时不高亮；最多保留 100 个可见匹配，超限时关闭该轮匹配标记。搜索使用 CodeMirror `SearchCursor`，其大小写、归一化及查找语义沿用当前依赖，不承诺与 CotEditor/Foundation 的文本匹配、绘制时机或辅助技术行为完全相同。延迟/匹配辅助函数、选区重叠排除、视口限制、匹配上限、重排与取消、偏好边界和设置文件往返均由 Node 回归覆盖；本轮定向测试 **55/55**，完整串行 `node --test --test-concurrency=1 test/*.test.js` **522/522**，修改的 JavaScript `node --check` **8/8**。正式版仍为 **0.5.16**；未构建、未打包、未运行 Electron UI smoke。Linux Node/静态测试不证明 macOS/Windows 原生 UI 行为。恢复、隐私、权限和数据保留策略未改变。


## 2026-10-12 半角 Hangul 宽度转换（未发行源码）

CotEditor 7.1.1 的文本转换调用 Foundation `.fullwidthToHalfwidth`，并通过可逆方向处理半角/全角；Apple 文档将其定义为全角 CJK 到半角形式的转换。CotEdit 普通宽度转换现增加 Unicode 半角 Hangul 区间 U+FFA0–U+FFDC：对每个码点单独执行 NFKC，按 Unicode 映射将已定义的半角 Hangul 字母转为规范 Hangul Jamo；逆向表仅将这些对应的规范 Jamo 转回半角字形。保留未映射码点、预组 Hangul 音节与兼容 Jamo，不对整段文字套用宽泛 NFKC；相邻 Jamo 不主动组合成音节。

验证依据 [CotEditor 7.1.1 转换源码](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView%2BTransformation.swift)、[Apple Foundation `fullwidthToHalfwidth`](https://developer.apple.com/documentation/foundation/stringtransform/fullwidthtohalfwidth) 和 [ICU General Transforms](https://unicode-org.github.io/icu/userguide/transforms/general/)。本机 ICU 74.2 `uconv` 对照：U+FFA0–U+FFDC 半角区间 **61/61** 单码点转换相同；U+1100–U+11FF **256/256** 反向单码点比较相同。JavaScript Node 回归穷举该半角区间并验证每个有映射码点可逆；这不等于在 macOS 上直接调用/验证 Foundation，也不覆盖 ICU 所有宽度转换规则、组合输入法、原生 UI 或辅助技术行为。


## 2026-10-12 孤立组合浊音/半浊音符的宽度转换（未发行源码）

CotEditor 7.1.1 的 `exchangeHalfwidth(_:)` / `exchangeFullwidth(_:)` 对选区调用 Foundation `.fullwidthToHalfwidth` 的正向/反向变换；[Apple 文档](https://developer.apple.com/documentation/foundation/stringtransform/fullwidthtohalfwidth)称其可逆，并说明等价于 CFString Fullwidth-Halfwidth 转换。CotEdit 先前只处理与可映射片假名配对的组合浊音标记，因此单独出现的 U+3099/U+309A 会原样保留。现新增受限回退映射：仅当标记没有随片假名组合路径一起消费时，将 U+3099 → U+FF9E、U+309A → U+FF9F；反向沿用半角标记的既有 NFKC 映射。平假名等未映射基字符保留，后随标记独立转换；已映射片假名（如 `カ` + U+3099）继续整体变为 `ｶﾞ`。没有对整段执行通用 NFKC，也没有更改预组 Hangul 音节、兼容 Jamo 或其他宽度字符行为。

CotEditor 稳定版实现依据：[7.1.1 `EditorTextView+Transformation.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView%2BTransformation.swift)；宽度转换对照参考 [ICU General Transforms](https://unicode-org.github.io/icu/userguide/transforms/general/)。本机 ICU 74.2 `uconv` 对独立 U+3099/U+309A 正向和反向均为 **2/2**，并核对了片假名组合与平假名基符的上下文输出；新增回归在实现前复现失败、实现后通过。定向 `text-tools` **27/27**，完整串行 `node --test --test-concurrency=1 test/*.test.js` **524/524**，变更 JS 文件 `node --check` **2/2**。

正式版仍为 **0.5.16**；本轮仅改未发行源码、测试和文档，未构建、未打包、未运行 UI smoke。`dist/` 与 `release/` 共 120 个文件的聚合 SHA-256 前后均为 `b68917e4523a6e69ad1ba0e37448b3a483e580c5b68c2f5d704e6e5e658b011f`。Linux Node/ICU 74.2 结果不等于 macOS Foundation 实机调用，也不验证原生 UI、菜单、辅助技术或 Windows/macOS 行为 1:1 等价；未改变恢复、隐私、权限或数据保留边界。


## 2026-10-12 Edit > Substitutions 的 Replace Dashes（未发行源码）

CotEditor 7.1.1 稳定版 [Main.storyboard](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Storyboards/Base.lproj/Main.storyboard) 在 Edit > Substitutions 中声明 `Replace Dashes`，调用 `replaceDashesInSelection:`，未声明默认快捷键。Apple 的 [`NSTextView.isAutomaticDashSubstitutionEnabled`](https://developer.apple.com/documentation/appkit/nstextview/isautomaticdashsubstitutionenabled) 文档将自动破折号转换描述为把两个 ASCII 连字符 `--` 转为 em dash `—`。Apple 页面说明的是自动替换属性，并未完整规定 CotEditor 菜单 selector 的所有边界；因此本次实现只采用该明确映射作为跨平台近似，不把它描述成 AppKit selector 的逐项复刻。

CotEdit 在 Edit > 替换新增“将双连字符替换为长破折号”。该命令要求文稿可编辑且至少有一个非空选区；所有非空选区都经现有 CodeMirror 多选区事务一次提交、一次撤销。每个文本选区以从左到右、非重叠的 ASCII `--` 对替换为 `—`（例如 `---` → `—-`、`-----` → `——-`）；单个 `-`、其他 Unicode 横线、未选中文字不变。它没有默认快捷键，也不在输入过程中自动转换。此范围避免猜测 AppKit 对所有长连字符序列、光标词和用户系统替换偏好的处理。

定向 `text-tools`、`text-transform-range`、`menu-coverage` 测试合计 **87/87**；完整串行 `node --test --test-concurrency=1 test/*.test.js` **526/526**；5 个变更运行时 JavaScript 文件 `node --check` **5/5**。正式版仍为 **0.5.16**；本轮仅修改未发行源码、测试与文档，未构建、未打包、未运行 UI smoke。`dist/` 与 `release/` 共 **120** 个文件，聚合 SHA-256 仍为 `b68917e4523a6e69ad1ba0e37448b3a483e580c5b68c2f5d704e6e5e658b011f`。Linux Node 回归不证明 macOS AppKit `replaceDashesInSelection:` 实机结果、Electron 原生菜单或平台 UI/辅助技术 1:1 等价；未改变恢复、隐私、权限或数据保留边界。


## 2026-10-12 Edit > Substitutions 的 Replace Text（未发行源码）

CotEditor 7.1.1 稳定版 [Main.storyboard](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Storyboards/Base.lproj/Main.storyboard) 在 Substitutions 菜单声明 `Replace Text` 与 `replaceTextInSelection:` action；Apple 的[文本替换用户指南](https://support.apple.com/en-us/guide/mac-help/mh35735/mac)说明 macOS 文本替换可在系统设置中管理，并从选中文字的 Substitutions 菜单手动应用。CotEdit 不能宣称读取或复刻 macOS 系统词典，因此新增隔离的**应用本机替换词**及设置管理器，作为范围明确的兼容近似，不与系统替换词同步，也不在输入过程中自动改写。

启用规则为区分大小写的字面触发词，不执行正则或级联替换；在每个非空选区内由左至右扫描，当前位置优先使用最长匹配触发词，只修改选中文字，全部选区合并为一个 CodeMirror 事务和一次 Undo。无匹配时不创建编辑。菜单仅在文稿可编辑、有选区且至少有一条启用规则时可用；管理器允许本机新增、编辑、启停及删除规则，设置可随应用设置文件导入/导出。规则仅纳入已有本机设置存储边界；未改变文稿恢复、隐私、权限或数据保留策略。

依据限于 CotEditor 7.1.1 菜单定义与 Apple 对系统替换设置/选区手动应用的说明；触发词匹配细节是 CotEdit 为本机替换词新定的确定性行为，并非声称复刻 AppKit 或 CotEditor 的系统词典实现。核心替换事务 **5/5**、菜单路由覆盖 **45/45**，完整串行 `node --test --test-concurrency=1 test/*.test.js` **534/534**；本轮 11 个 JavaScript 源码/测试文件 `node --check` **11/11**，`index.html` 静态检查为 395 个唯一 ID、标签与 ARIA 引用无缺失。正式版仍为 **0.5.16**；改动只属未发行源码/测试/文档，未构建、未打包、未运行 UI smoke，亦未写入 `dist/` 或 `release/`。验证为 Linux Node/CodeMirror state 和静态 HTML 检查，不证明 Electron UI 实际呈现、macOS 系统替换词、原生菜单/辅助技术或跨平台行为 1:1 等价。


## 2026-10-12 Find：Ignore Diacritic Marks（未发行源码）

CotEditor 7.1.1 稳定版在 [DefaultSettings.swift](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift) 将 `findTextIgnoresDiacriticMarks` 与 `findTextIgnoresWidth` 分别默认设为 `false`；[TextFind.swift](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/TextFind.swift) 将文字查找配置为 `String.CompareOptions`，正则查找则使用独立的 `NSRegularExpression.Options`。Apple Foundation 的 [`diacriticInsensitive`](https://developer.apple.com/documentation/foundation/nsstring/compareoptions/diacriticinsensitive) 明确以 `ö` 与 `o` 相等为例，并将 `widthInsensitive` 列作另一种选项。这些是对照依据；没有据此推断所有 Unicode 折叠细节或 AppKit 实机行为。

CotEdit 查找栏新增“忽略变音符号”按钮（`é`），默认关闭并纳入现有应用设置、本机多窗口同步及设置文件导入/导出。该选项只作用于普通文字查找/替换；选中正则模式时按钮禁用，正则表达式语义不变。它可与大小写、整词条件组合，不新增快捷键，也不改写未被用户执行替换的文稿。

实现将普通文字查询与文稿临时转为 NFD、移除 Unicode `Diacritic` 属性字符后匹配，并通过原文偏移映射让计数、高亮、导航和替换使用同一真实区间；覆盖预组合/分解形式及词中重音（例如 `naive` 找到 `naïve`），Replace 不会把组合重音遗留在替换文本外。此算法不是 Foundation 字符串比较的全量复刻：不启用宽度折叠/兼容分解，非分解型字母及不同脚本的定制排序行为未证明等同于 CotEditor。关闭选项时仍保持区分重音的普通文字查找；也未验证 macOS 原生 UI、辅助技术或 Foundation 实机结果。

定向查找与设置测试 **47/47**（含搜索区间、UTF-16 偏移、Replace、整词/大小写、正则隔离及设置导入/导出）；完整串行 `node --test --test-concurrency=1 test/*.test.js` **539/539**；6 个变更 JavaScript 文件 `node --check` **6/6**。`index.html` 静态检查为 **396 个唯一 ID**、**79 项标签/ARIA 引用全部解析**、标签栈平衡。正式版仍为 **0.5.16**；只改源码、测试与文档，未构建、未打包、未运行 UI smoke，也未写入 `dist/` 或 `release/`。Linux Node/CodeMirror 与静态检查不能证明 Electron 桌面 UI、Apple Foundation 或跨平台 1:1 等价；未改变文稿恢复、隐私、权限或数据保留边界。


## 2026-10-12 快捷键：安全接纳 Emoji ZWJ 键值（未发行源码）

CotEditor 7.1.1 [正式发布说明](https://coteditor.com/releasenotes/7.1.1.en)新增“单次按键可产生多个字符”的快捷键支持；其[上游实现提交](https://github.com/coteditor/CotEditor/commit/897e55f1103c6c14e906bbbca536e6e715af04b4)将 key equivalent 改为字符串，并允许非空多字符键值。CotEdit 原先为限制格式控制字符而一概拒绝 Unicode General_Category `C`，因此也拦截含 U+200D ZERO WIDTH JOINER 的有效 emoji 字符串（例如 `👩🏽‍💻`、`🏳️‍🌈`），使这类 `KeyboardEvent.key` 无法录入、匹配或保存。

现仅在 U+200D 两侧可验证为 `Extended_Pictographic` 序列时接受它；校验向前略过 `Grapheme_Extend` 和 `Emoji_Modifier`（包括肤色修饰符），以支持合法 emoji 组合。空白、孤立/非 emoji ZWJ、双向控制及其余格式/控制字符仍拒绝；原有最多 8 个 Unicode 标量、必须有修饰键、允许命令注册表范围及多字符大小写保留规则不变。renderer 录入/显示/匹配/冲突检查与主进程快捷键 IPC 使用相同边界，没有新增默认快捷键。

依据仅限 CotEditor 7.1.1 发布说明与上述上游快捷键提交；本轮没有运行真实键盘、Electron UI、macOS 菜单或其他平台原生输入测试，不据此声称平台 1:1 等价。快捷键定向测试 **21/21**，完整串行 Node 测试 **541/541**，4 个 JavaScript 源码/测试文件 `node --check` **4/4**。正式版本仍为 **0.5.16**；本项仅为未发行源码、测试和文档。未构建、未打包、未运行 UI smoke；`dist/` 与 `release/` 共 **120** 个文件的聚合 SHA-256 与本轮前一致：`b68917e4523a6e69ad1ba0e37448b3a483e580c5b68c2f5d704e6e5e658b011f`。未删除文件、未清缓存，文稿恢复、隐私及数据保留边界未改变。


## 2026-10-12 Edit：Insert Backslash 默认快捷键（未发行源码）
CotEditor 7.1.1 稳定版 [Main.storyboard](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Storyboards/Base.lproj/Main.storyboard) 的 Edit 菜单将 `Insert Backslash` 定义为 `keyEquivalent="¥"`（action `inputBackSlash:`）；Apple 的[NSMenuItem 键盘等价项说明](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/MenuList/Articles/SettingMenuKeyEquiv.html)指出默认 modifier mask 包含 Command，因此据此读取为 `⌘¥`；上游静态定义是本轮对照依据。CotEdit 现在在快捷键列表及 Edit 菜单登记“插入反斜线”，macOS 显示/匹配 `⌘¥`，并由 renderer 对 Unicode 字符键分派，避免把 `¥` 注册为 Electron 原生 accelerator。快捷键与原菜单动作共用活动编辑器的选区插入路径，未获得编辑器焦点时不从全局键盘事件触发。

Windows/Linux 没有从该 macOS storyboard 推导同键位；CotEdit 选择不冲突的 `Ctrl+Alt+Y` 作为自身平台替代，不将它描述为 CotEditor 默认键。回归检查覆盖快捷键注册表、macOS/Linux 合成事件解析、格式化、冲突检测、菜单标签及 renderer 菜单/快捷键动作连接；完整串行 `node --test --test-concurrency=1 test/*.test.js` **544/544**，6 个变更 JavaScript 源码/测试文件 `node --check` **6/6**。正式版仍为 **0.5.16**。

本轮未运行构建、打包或 UI smoke。Node 合成键盘事件与静态路由测试不能验证实际 macOS 日文/其他键盘布局产生的 `KeyboardEvent.key`、AppKit 菜单修饰键默认行为、Electron 原生菜单渲染/输入，亦不能验证 Windows/Linux 真机按键行为；因此不宣称物理键盘或桌面 UI 1:1 等价。`dist/` 与 `release/` 共 120 个文件摘要保持 `b68917e4523a6e69ad1ba0e37448b3a483e580c5b68c2f5d704e6e5e658b011f`。未删除文件、未清缓存，文稿恢复、隐私、权限与数据保留边界未改变。


## 2026-10-12 JSON 派生文件：GeoJSON 自动识别（未发行源码）

CotEditor 7.1.0 [官方发行说明](https://coteditor.com/releasenotes/7.1.0.en)明确写明：文件类型属于 JSON 的文稿（例如 GeoJSON）会自动应用 JSON 语法；7.1.1 稳定版发行说明仍指向 7.1.0 为前一发行版。[RFC 7946 §12](https://www.rfc-editor.org/rfc/rfc7946.html#section-12)进一步列出 `.geojson` 扩展名、`application/geo+json` 媒体类型，并声明 macOS UTI `public.geojson` conforms to `public.json`；Apple 的 [UTType.geoJSON](https://developer.apple.com/documentation/uniformtypeidentifiers/uttype-swift.struct/geojson) 文档确认系统标识符为 `public.geojson`。这些依据说明这不是通过文件内容猜测语法，而是系统文件类型继承关系带来的 JSON 语法选择。

CotEdit 现把大小写不敏感的 `.geojson` 后缀映射到现有 JSON/CodeMirror 模式，并维持用户导入语法映射高于内置项的优先级。桌面文件类型清单也增加 `geojson`：macOS 声明可打开扩展名，Linux 声明标准 `application/geo+json` MIME 类型，Windows 继续通过现有当前用户级 Open With 注册宏暴露文件类型，不设置或覆盖系统默认处理程序。跨平台实现按扩展名近似上游 UTType 关系；不会识别无扩展名但另有文件类型元数据的文件，也不等于在 Windows/Linux 实现 Apple UTI。

验证：新增 `.geojson` 普通/大写扩展名及用户映射覆盖回归；macOS 扩展名、Linux MIME 与 Windows 安装宏一致性覆盖。定向测试 **12/12**；完整串行 `node --test --test-concurrency=1 test/*.test.js` **545/545**；变更 JavaScript 文件 `node --check` **3/3**；`package.json` JSON 解析通过。首轮全测时，独立临时目录安全测试曾因瞬时 `ENOSPC` 未写成 1 MiB 样本（其余 **544/544** 通过）；该测试单独重试 **1/1**，随后整套重跑 **545/545** 全通过。正式版仍为 **0.5.16**，只改未发行源码、测试及说明；未构建、未打包、未运行 Electron UI smoke，亦未删除文件或清理缓存。`dist/` 与 `release/` 的 **120** 个文件逐项 SHA-256 与本轮前相同，聚合清单摘要为 `b68917e4523a6e69ad1ba0e37448b3a483e580c5b68c2f5d704e6e5e658b011f`。因此文件关联声明尚未在真实 macOS/Windows/Linux 安装包和原生菜单中验证；CodeMirror 仅复用 JSON 模式，也不表示提供 GeoJSON 几何校验或地图预览。未改变文稿恢复、隐私、权限或数据保留边界。


## 2026-10-12 Format > Font > Font Type（未发行源码）

CotEditor 7.1.1 稳定版 [Main.storyboard](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Storyboards/Base.lproj/Main.storyboard) 在 Format > Font 下定义 Font Type 子菜单，含 Standard（`makeFontStandard:`）与 Monospaced（`makeFontMonospaced:`）两个命令；storyboard 未给这两项声明快捷键。此前 CotEdit 该菜单只有字号控制和 Ligatures，编辑器一直使用等宽字体族，因此缺少此项可见的菜单功能。

CotEdit 现新增“字体类型 > 标准／等宽”单选菜单。选择写入已有本机偏好、设置文件导入/导出；沿用既有 storage/applySettings 通道更新多窗口菜单标记与编辑器外观。默认保持 `monospaced`，不改变旧用户现有字体呈现。标准模式使用 CotEdit 当前 UI 的无衬线字体回退栈（DM Sans、Noto Sans SC 与平台系统字体），等宽模式使用原有编辑器字体栈；打印模板也采用同一模式。此为跨平台确定性近似：它不弹出 macOS 字体面板、不提供任意字体选择，且将类型作为应用范围的持久偏好；不声称复刻 CotEditor/AppKit 对字体面板、具体字体解析或逐文稿字体状态的行为。没有增加默认快捷键。

验证：字体类型归一化、设置文件往返、主菜单/IPC/renderer 与 checked 状态、两种打印样式均有回归；定向测试 **127/127**，完整串行 `npm test` **551/551**；11 个变更 JavaScript 文件 `node --check` **11/11**；CSS 花括号及字体族变量/选择器静态检查通过。正式版本仍为 **0.5.16**，仅为未发行源码、测试与说明。未构建、未打包、未运行 Electron UI smoke；macOS/Windows/Linux 原生菜单/字体显示尚未实测。`dist/` 与 `release/` 共 **120** 个文件本轮前后摘要一致：`25b72633568088334507c4eb060d3dba362036d83af43b46587c49d63d099dff`。未删除文件、未清缓存，文稿恢复、隐私、权限与数据保留边界未改变。


## 2026-10-12 Format > Tab Width：Use Spaces for Indentation（未发行源码）

CotEditor 7.1.1 稳定版 [Main.storyboard](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Storyboards/Base.lproj/Main.storyboard) 在 Format > Font/Tab Width 菜单组中定义 “Use Spaces for Indentation” 并调用 `toggleAutoTabExpand:`；该菜单项没有静态快捷键。[`DefaultSettings.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift) 将 `autoExpandTab` 默认设为 `false`。[`EditorTextView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView.swift) 显示启用时 Tab 通过 `softTabs(for:tabWidth:)` 插入软空格，退格则通过 `rangeForSoftTabDeletion` 删除软空格到前一制表位。这些固定 7.1.1 标签源码是此项的上游证据；CotEditor 维护者关于 macOS `Option+Tab` 由 Cocoa `insertTabIgnoringFieldEditor(_:)` 插入实际制表符的说明见 [issue #1754](https://github.com/coteditor/CotEditor/issues/1754)。

CotEdit 新增默认关闭的全局 `autoExpandTab` 偏好，并将复选项放入 Format > Tab Width 子菜单。开启时，Tab 按 CodeMirror `countColumn` 与当前 Tab Width 算出下个逻辑制表位所需空格；多光标/选区一次事务插入，Backspace 在前方存在软空格时删除到前一逻辑制表位；未命中条件则交还现有默认退格处理。设置沿用本机偏好、跨窗口 storage 同步和既有设置文件导入/导出；未增加快捷键。关闭时旧 Tab 插入方式原样保留。CotEdit 的既有逐语法缩进宽度仍独立存在，因此“软 Tab”统一以全局 Tab Width 计列，不声称完全复刻 CotEditor 的文本视图实现。此跨平台实现也不模拟 macOS 专属 Option+Tab、不声明 Cocoa 字体/菜单或原生键盘行为等价。

验证：软 Tab/退格、设置归一化与 round-trip、菜单状态/路由的定向 Node 测试 **128/128 通过**；完整串行 `node --test --test-concurrency=1 test/*.test.js` **563/563 通过**；12 个变更 JavaScript 源码/测试文件 `node --check` **12/12 通过**。正式版仍为 **0.5.16**。按逐文件 SHA-256 与相对路径计算的 `dist/`、`release/` 120 个文件聚合摘要，本轮前后均为 `effd3020781958400de4e3615d4c5766be6f457c907c65fa908cca7050939dee`。依用户选择未运行 build/package/UI smoke；因此没有验证实际 Electron 菜单绘制、键盘事件优先级、macOS Option+Tab、原生字体/文本系统或 Windows/macOS 实机表现。只修改源码、测试与兼容性/README 说明；未删除文件、未清缓存，未改变文稿恢复、隐私、权限及数据保留边界。


## 2026-10-12 文件浏览器：按文件名筛选（未发行源码）

CotEditor 6.1.0 [官方发布说明](https://coteditor.com/releasenotes/6.1.0.en)明确新增文件浏览器按文件名过滤；6.1.1 [发布说明](https://coteditor.com/releasenotes/6.1.1.en)要求执行 Add File/Folder 命令时重置过滤，6.1.2 [发布说明](https://coteditor.com/releasenotes/6.1.2.en)改进为筛选时保持文件浏览器选中项。该能力延续至本项目对照的 CotEditor 7.1.1 稳定版。

CotEdit 现为文件夹侧栏增加独立“筛选文件名…”输入，按当前目录中的文件与子文件夹名称做 NFC 规范化、大小写不敏感的字面子串筛选；不与递归内容查找混用，也不增加快捷键或菜单命令。筛选由现有主进程目录列表接口执行，仍验证所选根目录与路径边界、跳过符号链接；最多扫描 10,000 项、显示 500 项，输入最多 256 个 Unicode 字符。筛选不改变当前预览文稿路径；当选中项重新出现在结果中时恢复其 `aria-current` 状态。更换根目录会清空文件名与内容查找条件。CotEdit 没有等价的 Add File/Folder 浏览器命令，因此不声称实现了 CotEditor 6.1.1 针对该命令的复位动作；原生 AppKit 列表选择与辅助技术行为也未实机验证。

回归覆盖规范等价文件名、大小写不敏感匹配、查找初始 500 项之外的名称、筛选结果上限、超长/非字符串输入拒绝、IPC/UI 接线和可访问标签；不据 Node 与静态检查宣称桌面 UI 逐项等价。

## 2026-10-12 快捷键帮助中的 Escape 按键名称（未发行源码）

CotEditor 7.1.1 上游提交 [“Improve key descriptions in UI”](https://github.com/coteditor/CotEditor/commit/6caaf1a1ebb98852222cd6b5c7d3b7ca3e39a733) 将多点编辑帮助中的 `Esc` 改为 `Escape`，并在同一批帮助文案中把 Return/Enter 明确写作按键。CotEdit 本轮只对照并采用 Escape 这一项：快捷键格式化器现在在 macOS/Windows/Linux 的快捷键列表中显示完整 `Escape`；快速操作对话框、菜单命令提示，以及片段与快捷键录入时的取消提示也统一使用“Escape”。

这只是按键**名称显示**调整：快捷键注册表、默认组合（包括 `Alt+Escape`）、Electron accelerator、键盘事件捕获/匹配及 Escape 关闭行为均未改变；未由此推断 CotEditor 的所有原生菜单外观都使用同一文本标签。

验证：快捷键/菜单定向测试 **41/41**，完整串行 `node --test --test-concurrency=1 test/*.test.js` **568/568**；4 个变更 JavaScript 文件 `node --check` **4/4**；CSS PostCSS 解析通过，HTML **397** 个 ID 唯一。正式版仍为 **0.5.16**；仅更改源码、测试与文档，未构建、未打包、未运行 UI smoke。`dist/` 与 `release/` 本轮前后逐文件聚合 SHA-256 均为 `b68917e4523a6e69ad1ba0e37448b3a483e580c5b68c2f5d704e6e5e658b011f`。Linux Node/静态检查不验证实际 Electron UI、macOS/Windows 原生菜单渲染或辅助技术结果。

## 2026-10-12 多光标模式的 Escape 收束（未发行源码）

CotEditor 7.1.1 上游 [“Improve key descriptions in UI” 提交](https://github.com/coteditor/CotEditor/commit/6caaf1a1ebb98852222cd6b5c7d3b7ca3e39a733) 不只将帮助里的 `Esc` 改为 `Escape`，也提供了精确行为说明：在多光标编辑期间按 Escape，会丢弃除最上方插入点外的其他插入点。CotEdit 上轮已对齐按键名称；源码核对发现当前 renderer 的全局 Escape 只关闭部分面板，没有执行该光标收束。

现在仅当无修饰 Escape 来源于当前聚焦的编辑器、没有打开的 dialog、事件尚未被编辑器 keymap 处理，且 CodeMirror selection 至少包含两个**全部为空的插入点**时，才调用 `collapseMultipleInsertionPoints` 收束到 CodeMirror 排序后的第一处（文档顺序最前）插入点，并阻止浏览器默认动作。IME 合成在该处理之前退出；Alt+Escape 文本补全、Ctrl/Command/Shift+Escape、非空选区、多光标与选区混合、单光标，以及对话框中的 Escape 均不触发此路径。菜单注册、快捷键绑定与面板 Escape 行为没有另行变更。

这是对上游帮助行为的跨平台输入近似：实现保留 CodeMirror 文档顺序首项，而没有声称与 CotEditor/AppKit 在垂直排版、布局、原生按键优先级或辅助技术方面逐项相同。新增 `lib/multi-cursor.js` 状态辅助函数与 `test/multi-cursor.test.js`，覆盖保留首项、主光标不在首项、无选区文本改动、非空范围/单光标不变，以及编辑器焦点、事件已处理、dialog、IME 和修饰键边界。

定向测试 **3/3**，完整串行 `node --test --test-concurrency=1 test/*.test.js` **571/571**，变更 JavaScript 源码/测试 `node --check` **3/3**。正式版仍为 **0.5.16**；本轮仅修改未发行源码、测试及文档，未构建、未打包、未运行 UI smoke。`dist/` 与 `release/` 共 **120** 个文件按相对路径与文件内容计算的聚合 SHA-256，本轮前后均为 `af519ebf087d4c5a0a7ebd2e7f7d637bc24ae6692802844cebaff167c202f1e5`。Node/CodeMirror 回归不验证真实 Electron DOM 焦点/事件顺序、macOS/Windows 原生键盘、菜单显示或读屏器行为；未改变文稿恢复、隐私、权限及数据保留边界。


## 2026-10-12 文件夹浏览器 Add / New File / New Folder（未发行源码）

CotEditor 7.1.1 的 [FileBrowserViewController.swift](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Sidebar/File%20Browser/FileBrowserViewController.swift) 在文件浏览器底部放置加号菜单，项目为 New File 与 New Folder（菜单项没有默认 key equivalent）；动作先清除文件名筛选，再创建、插入并选中新节点，设置行内名称编辑。[简体中文字符串目录](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Localizables/Document%20Window/Document.xcstrings)将两项译为“新建文件”和“新建文件夹”。[DirectoryDocument.swift](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document/DirectoryDocument.swift) 创建空文件时，取用户默认语法映射的首个扩展名、为重名路径追加唯一编号，使用不覆盖写入；新文件夹使用本地化默认名并追加唯一编号。

CotEdit 在筛选框旁的文件夹浏览器 footer 添加具名的加号按钮与 `role=menu` 菜单。项目仅有桌面桥接能力且已打开文件夹时启用；键盘支持 Escape、上下方向键、Home/End，菜单外指针操作关闭。触发后，renderer 只发送当前浏览目录与 `file`/`directory` 类型；Electron 主进程从当前窗口的已选根目录取得授权并读取 `app.getLocale()`，复核路径是真实、位于根目录内的文件夹，再通过排他文件创建或 `mkdir` 新建 locale 对应的默认文件名（文件扩展名仍固定 `.txt`）或文件夹名。例如 `zh-CN` 为 `未命名.txt` / `未命名文件夹`，`zh-TW` 为 `未命名.txt` / `未命名檔案夾`，`en-US` 为 `Untitled.txt` / `untitled folder`；其余按 CotEditor 7.1.1 的官方字符串表映射，未覆盖语言回退到英文源字符串。重名时按基名追加序号，覆盖文件、目录或符号链接的情形均改用下一个唯一编号，不覆写既有对象。新文件按应用新文件权限使用 `0600` 创建；新文件夹采用 `0755`（受系统 umask 约束）。创建成功会清除文件名筛选及独立文件内容搜索，刷新并聚焦新项；新文件进入现有只读预览。

**不等价项：**CotEdit 尚无 CotEditor 默认语法设置可供新建动作复用，因此仍固定 `.txt`，不按默认语法选择扩展名；虽按 CotEditor 官方字符串表本地化默认基名，locale 解析采用 Electron `app.getLocale()` 与本项目的有限映射，未覆盖语言回退英文，且应用其余 UI 并未因此变成多语言。没有复刻 `NSFileCoordinator`、原生行内重命名与 select-for-edit、文件浏览器右键同类菜单，以及 macOS 原生 UI/辅助技术。该行为覆盖“在选定目录中新建并不覆盖已有内容”，不宣称桌面 UI/UX 完全相同；未新增上游不存在的快捷键，也未新增删除或重命名能力。名称映射来源：[CotEditor 7.1.1 DirectoryDocument.swift](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document/DirectoryDocument.swift) 与 [Application/Localizable.xcstrings](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Localizables/Application/Localizable.xcstrings)。

验证：`test/directory-mutations.test.js` 覆盖英文默认值、简/繁体 locale、区域标签别名、回退、唯一编号、保留既有内容、嵌套目录和越界/符号链接拒绝；菜单覆盖测试确认主进程 locale 接线。定向目录/菜单测试 **54/54**；完整串行 `node --test --test-concurrency=1 test/*.test.js` **578/578**；本轮 4 个变更 JavaScript 源码/测试文件 `node --check` **4/4**。正式版仍为 **0.5.16**，只更改未发行源码、测试和文档；未构建、未打包、未运行 Electron UI smoke，`dist/` 与 `release/` 维持现有 **120** 个文件。Node 测试不验证 Electron 真机 locale 选择、真实菜单/弹层、焦点时序、macOS 文件协调、键盘/读屏器行为或跨平台 UI 等价；恢复、隐私、权限及数据保留边界未改变。


## 2026-10-12 多字符快捷键上限与片段菜单路径统一（未发行源码）

CotEditor 7.1.1 发布说明加入“单次按键可产生多个字符”的快捷键支持；上游 [`Shortcut.swift` 实现提交](https://github.com/coteditor/CotEditor/commit/897e55f1103c6c14e906bbbca536e6e715af04b4)把 key equivalent 表示为字符串，并在有效性判断中要求其非空。CotEdit 原本在 renderer 与命令 IPC 中限制为 8 个 Unicode 标量；另有主进程片段菜单路由独立按 JavaScript UTF-16 `length <= 8` 校验并全小写化。这既拒绝较长但可打印的单次键输出，也使片段菜单路径与设置里的多字符大小写保留不一致。

现把 renderer 共享键值规范化、设置/片段配置、主进程快捷键 IPC，以及片段菜单 IPC 统一为最多 **16 个 Unicode 标量**；主进程片段菜单直接复用已登记命令的同一净化 helper，不再保留独立 UTF-16/小写逻辑。16 个补充平面 emoji（32 个 UTF-16 码元）可通过，17 个拒绝；多字符序列仍保留大小写与 NFC 规范化，既有可打印字符、修饰键、命令 ID 及格式控制字符限制继续有效。16 是 CotEdit 的有界输入安全上限，上游没有这个长度上限；不宣称任意长 key equivalent 1:1 兼容。

回归覆盖 16/17 标量边界、renderer 捕获/匹配/设置持久化、主进程 IPC 净化、片段配置大小写保留和静态菜单 IPC 路由。定向快捷键/设置/片段/菜单测试 **63/63**，完整串行 `node --test --test-concurrency=1 test/*.test.js` **580/580**，7 个变更 JavaScript 源码/测试 `node --check` **7/7**。正式版本仍为 **0.5.16**；本轮只更新未发行源码、测试与文档，未构建、未打包、未运行 UI smoke。`dist/` 与 `release/` 不含临时 `.manus-*` 文件的 **119** 个文件组合 SHA-256 前后均为 `54ee6bbd69b23393e9fe697fc2829f30b1e604461d2ae3ae322ef663a48eb6c9`。Linux Node/静态测试不验证实体键盘、输入法、Electron 原生菜单或 macOS/Windows 桌面行为；文稿恢复、隐私、权限及数据保留边界未改变。


## 2026-10-12 文件预览外部编辑器分体菜单（未发行源码）

CotEditor 7.1.1 的 [`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift) 使用 `Menu("Open with External Editor")`：主动作调用系统打开文稿；展开菜单时先列出系统为该文稿注册的默认编辑器与其他编辑器，最后提供 `Other…`。官方 [7.1.1 发行说明](https://coteditor.com/releasenotes/7.1.1.en)也将外部编辑器预览按钮列为改进项。

CotEdit 文件预览现在采用同一类**分体控件**：点击“外部编辑器”主按钮仍通过原有 IPC 用系统默认应用打开；箭头菜单提供“默认应用”和“其他应用…”，后者继续调用既有原生应用选择器。菜单可用 Escape 关闭、上下方向键循环、Home/End 跳至首尾；点击菜单外收起，Escape 将焦点还给菜单按钮。预览读取期间、错误状态或无当前预览时相关动作保持禁用。没有为这些动作增加快捷键。

**仍不等价：**CotEdit 未枚举 Launch Services/系统注册应用，因此菜单不列出各个编辑器，不展示图标、默认应用排序、重名应用版本标签，也不复刻 SwiftUI `Menu(primaryAction:)` 和 AppKit/VoiceOver 原生交互；菜单只有“默认应用／其他应用…”两项。为选择“其他应用”而打开文件选择器、系统启动流程及路径参数均未改写；主进程仍对当前窗口的已选目录内普通文件重新核验，并沿用现有平台应用类型校验和无 shell 启动实现。本轮不放宽文稿访问范围、隐私或数据保留策略。

验证：外部打开、菜单覆盖与无障碍定向测试 **75/75**；完整串行 `node --test --test-concurrency=1 test/*.test.js` **580/580**；本轮变更 JavaScript `node --check` **3/3**，CSS PostCSS 解析通过，HTML **406** 个 ID 无重复。正式版本仍为 **0.5.16**，改动仅在未发行源码、测试与文档；未构建、未打包、未运行 Electron UI smoke。`dist/` 与 `release/` 不含临时 `.manus-*` 文件共 **119** 个文件，本轮前后以相同清单/摘要方法计算的 SHA-256 均为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。Node/静态检查不验证实际桌面菜单绘制、原生键盘/焦点/读屏行为或 macOS/Windows 行为等价。

## 本轮兼容性增量：混合行尾 Replace All

CotEditor 7.1.1 发布说明记录了修复“混合行尾文稿中 Replace All 改变匹配文本以外行尾”的问题；官方 [issue #2172](https://github.com/coteditor/CotEditor/issues/2172) 进一步给出正则替换 `\n\t<string>` 时某个未匹配 CR 被改成 LF 的报告，并明确期望保留原换行。[7.1.1 发布说明](https://coteditor.com/releasenotes/7.1.1.en)

CotEdit 将 `mapLineEndings()` 改为按 CodeMirror `ChangeSet` 间隙流式生成行尾元数据：仅未变更间隙内仍存在的 LF 继承对应源分隔符；被替换范围内的旧分隔符不再传递；替换正文新插入的 LF 使用文稿回退行尾。本轮回归按官方问题模式一次移除三个 `\n\t<string>` 前缀，验证剩余 CRLF、CR、PS 逐项保留，并验证其他源分隔符集合、序列化及 Undo/Redo。需要说明：旧版 CotEdit 已有基于变更间隙的映射，本轮不声称已在 CotEdit 中重现同一 Cocoa 缺陷；本次变更将保留规则显式流式化并补上官方问题形态的集成覆盖。

定向行尾/搜索测试 **21/21**；完整串行 `node --test --test-concurrency=1 test/*.test.js` **581/581**；变更 JavaScript `node --check` **2/2**。正式版本仍为 **0.5.16**，仅更新未发行源码、测试及文档；未构建、未打包、未运行 Electron UI smoke。`dist/` 与 `release/`（不含临时 `.manus-*` 文件）共 **119** 个文件，本轮前后以相同清单与摘要方法计算的 SHA-256 均为 `48b70018fe25011cf39f257334fb18c41c5926af225d87c22fe0cf70a752c76`。Node/CodeMirror 测试不验证 CotEditor 的 Cocoa 实机行为或 CotEdit 在 macOS/Windows 的原生平台等价。


## 2026-10-12 文件浏览器对 UNIX 可执行文件的文本保护（未发行源码）

CotEditor 7.0.8 发布说明新增“防止文件浏览器将 UNIX 可执行文件作为纯文本打开”，并沿用于 7.1.1 稳定版。[上游提交 `8810ac6`](https://github.com/coteditor/CotEditor/commit/8810ac6e9fcff1247b5bcb93f6d7cca26b53b730) 为 `File.Kind` 增加 executable 类型（依据 `UTType.unixExecutable`）；7.1.1 的 [`DirectoryDocument.shouldOpen(url:ofType:)`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document/DirectoryDocument.swift) 对该类型返回 `false`，让默认路径使用 `PreviewDocument` 而非文本 `Document`。同一稳定版源码以 `asPlainText || shouldOpen(...)` 建立显式覆盖，因此用户主动选择“以纯文本打开”仍可继续；参照：[7.0.8 发布说明](https://coteditor.com/releasenotes/7.0.8.en)、[7.1.1 正式发行页](https://github.com/coteditor/CotEditor/releases/tag/7.1.1)。

CotEdit 以跨平台近似识别：仅 macOS/Linux 将任一 POSIX 执行位（owner/group/other `x`）或文件开头的常见 ELF/Mach-O/FAT Mach-O 四字节签名视为 UNIX 可执行文件；Windows 不应用该检测。预览沿用原有最大 512 KiB 读取预算，并仅在该预览缓冲区内检查签名；默认打开/新窗口 IPC 的主进程复核最多读 4 字节。文件浏览器返回“UNIX 可执行文件／不作默认纯文本预览”提示；默认“打开”和“在新窗口打开”禁用，用户主动点击“以纯文本打开”仍绕过类型拦截但继续受根目录/普通文件校验。若文件保留执行位但无读权限，仍不尝试解码正文。系统默认应用与“其他应用”入口仍可用，外部打开不会由 CotEdit 自行执行文件。普通文稿打开对话框及内容搜索范围未改变。

**等价边界：**CotEdit 以说明文字替代 CotEditor 的 `PreviewDocument`。Apple `UTType.unixExecutable` 是系统类型标识，符合 `UTType.data` 与 `UTType.executable`；CotEdit 仅识别所列常见签名，不查询 UTI，也不覆盖所有可执行格式、脚本、Windows PE、别名或其他系统类型；不提供 CotEditor 的文件类型图标，也没有把此状态加到列表行。此行为未在 macOS/Cocoa 文件浏览器或 Electron 原生窗口中做 UI 验收，不构成桌面 UI 1:1 声明。Apple 类型说明：[UTType.unixExecutable](https://developer.apple.com/documentation/uniformtypeidentifiers/uttype-swift.struct/unixexecutable)。

验证：本轮目录搜索/预览、外部打开与菜单定向测试 **64/64**；完整串行 `node --test --test-concurrency=1 test/*.test.js` **586/586**；本轮变更的两个 JavaScript 文件 `node --check` **2/2**。正式版本仍为 **0.5.16**，本项仅属未发行源码/测试/文档；未构建、未打包、未运行 UI smoke。`dist/` 与 `release/`（排除临时 `.manus-*` 文件）共 **119** 个文件，需以本轮复核的同清单摘要记录为准。Linux Node 测试不验证 Apple UTI、原生菜单/焦点或 macOS/Windows 实机行为；文稿恢复、隐私、访问授权与数据保留边界未改变。


## 2026-10-12 混合行尾映射的逐换行符扫描优化（未发行源码）

CotEditor 7.1.1 [正式发布说明](https://coteditor.com/releasenotes/7.1.1.en)记录了窄窗口中语法工具栏导致持续高 CPU 的修复；那是 CotEditor 自身的另一问题，本轮不声称其与 CotEdit 行尾处理有相同根因。对本地代码检查发现，`mapLineEndings()` 每次文稿事务会在 JavaScript 层逐 UTF-16 单元遍历旧文稿和新文稿，虽然只需按 LF 计数或分配分隔符。现改用 `String.indexOf('\n')` 跳到换行位置：被变更移除的 LF 只用于推进原元数据游标，未变更间隙的 LF 继续继承旧分隔符，插入区的新 LF 仍使用文稿回退类型；不改变行尾归属规则或序列化格式。

新增 24 组约 12,000 个代码单元的 Unicode 文稿（混合 BMP/补充平面字符、LF 与四处稀疏编辑）回归，并与原逐字符算法参考结果逐项比较。定向 `text-tools` 测试 **29/29**；完整串行 `node --test --test-concurrency=1 test/*.test.js` **585/585**；变更 `lib/text-tools.js` 与 `test/text-tools.test.js` 的 `node --check` **2/2**。另在相同 Node 运行时和机器上，对 11,000,000 UTF-16 单元、440,000 个 LF 文稿执行文首零宽插入并重复 5 次；映射结果行尾数均核验一致，中位耗时由基线 **89.55 ms** 降至 **38.33 ms**（约 **57.19%**）。这是合成微基准，真实 Electron 交互、长文稿多窗口时序和各平台 UI 性能未测，也不代表原生 CotEditor 的性能对等。

正式版本仍为 **0.5.16**；本项仅修改未发行源码、测试和文档，未构建、未打包、未运行 UI smoke。`dist/` 与 `release/`（排除临时 `.manus-*` 文件）**119** 个文件前后摘要均为 `bef0e3f93413b7658f9b5a6631df36210a555a528562aa11e1871a08be361354`；未更改文稿恢复、隐私、权限或数据保留边界。

产物摘要补记：本轮开始与结束均按相对路径排序，并将每个路径字节数、路径字节、文件内容字节数、文件内容（长度均用 8 字节大端编码）纳入 SHA-256；`dist/` 与 `release/` 排除临时 `.manus-*` 文件后均为 **119** 个文件，起止摘要均为 `bef0e3f93413b7658f9b5a6631df36210a555a528562aa11e1871a08be361354`。此为本轮实际复核方法；历史记录的 `48b70018…` 未能按此算法复现，本轮没有写入发布目录，不能将不同摘要值归因于本轮源代码改动。


## 2026-10-12 文件夹预览的二进制 Property List 默认打开保护（未发行源码）

CotEditor 7.1.1 的 [`DirectoryDocument.shouldOpen(url:ofType:)`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document/DirectoryDocument.swift) 对系统判定为 Property List 的文件读取其头部，并在内容以 `bplist` 开头时不按默认纯文本文稿打开；同一打开路径仍允许用户明确选择纯文本。CotEdit 不访问 Apple UTI，现于所选目录中的文件预览识别相同的六字节魔数：不向文本解码器传递二进制正文，展示“二进制 Property List”提示，并禁用默认“打开”/“在新窗口打开”。主进程默认编辑打开及新窗口共用 `resolveEditableFileInRoot()`，复核最多读取 6 字节；原有 512 KiB 预览正文上限、根目录/真实路径/普通文件校验均保持不变。

显式“以纯文本打开”继续走原有根目录校验路径；只有这一主动操作会把 `allowBinaryText: true` 传给 `readDocument()`/`decodeBuffer()`，绕过通用 NUL 比例检测并按检测到的编码解释字节。界面明确提醒：保存可能改写原始二进制内容。所选文件夹浏览路径中的默认“打开”/新窗口和纯文本预览保护保持生效；普通文件选择器及最近文稿等其他打开入口不变，继续使用既有通用解码策略。系统默认应用与“其他应用”入口保持开放。XML plist、普通文本及其他非 `bplist` 文件维持原行为。此处按内容签名识别，不按扩展名或 Apple `UTType.propertyList` 分类，因此是有限跨平台近似；“二进制 Property List”说明视图不是 CotEditor 的 `PreviewDocument`/Quick Look，也未验证原生文件面板或平台辅助技术行为。依据：[CotEditor 7.1.1 稳定版源码](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document/DirectoryDocument.swift)。

回归覆盖魔数起始/偏移与过短头、二进制正文不解码、默认编辑打开拒绝（含 Windows 模拟路径）、显式纯文本路径仍可校验并继续、XML plist 正常预览，以及预览 UI 对默认/新窗口按钮与外部/显式纯文本按钮的处理。目录预览/编码/打开/外部应用/菜单定向测试 **74/74**，完整串行 `node --test --test-concurrency=1 test/*.test.js` **587/587**；本轮变更的 7 个 JavaScript 源码/测试文件 `node --check` **7/7**，CSS PostCSS 解析通过，HTML **406** 个 ID 唯一。正式版本仍为 **0.5.16**；只改未发行源码、测试与文档，未构建、未打包、未运行 UI smoke。`dist/` 与 `release/`（排除 `.manus-*` 临时文件）改动前后均为 **119** 个文件；组合 SHA-256 起止均为 `bef0e3f93413b7658f9b5a6631df36210a555a528562aa11e1871a08be361354`。Linux Node 测试不验证 macOS UTI/Quick Look、Electron 原生 UI 或目标平台原生行为；未改变文稿恢复、隐私、权限和数据保留边界。

## 2026-10-12 CotEditor 语法包拖放导入（未发行源码）
CotEditor 7.1.0 官方[发布说明](https://coteditor.com/releasenotes/7.1.0.en)记载可将 CotEditor Syntax 文件拖放到语法列表导入。CotEdit 的“自定义语法菜单”语法列表现可接收 1–20 个 `.cotsyntax` 文件夹：preload 只从用户拖入的文件对象取得本机路径，主进程再验证绝对路径、`.cotsyntax` 扩展名，并复用既有语法加载器的普通目录/文件和符号链接检查、每个 JSON 文件 1 MiB / 整包 3 MiB 读取上限。多包逐一解析后才返回；renderer 对整批规范化并检查容量，然后以一次 localStorage 写入提交。相同语法 ID 以新包替换并移至顺序末尾；若结果会超过现有 20 个自定义语法上限，整批拒绝且保留当前列表。拖放导入不改变活动文稿语法；已有“导入 CotEditor 语法…”目录选择菜单路径与其既有行为保持不变。此处接受文件夹拖放，不能据静态/Node 测试断言 Finder、Windows Explorer 或 Linux 桌面环境的原生 DataTransfer 路径行为完全一致；没有新增快捷键。

回归覆盖多包按序加载、重复路径去重、无效/相对/非 `.cotsyntax`/超量路径拒绝、已有 ID 替换排序、容量溢出原子拒绝、菜单提示与 preload/主进程/renderer 接线。定向测试 **17/17**，完整串行 `node --test --test-concurrency=1 test/*.test.js` **593/593**；变更 JavaScript `node --check` **8/8**，CSS PostCSS 解析通过，HTML **407** 个 ID 唯一。正式版本仍为 **0.5.16**；只改未发行源码、测试和文档，未构建、未打包、未运行 UI smoke。`dist/` 与 `release/` 排除 `.manus-*` 临时文件后 119 个文件，改动前后聚合 SHA-256 均为 `c12cce7950b62b947a6462d16b6370b0396409f662804662a5b7a3edf8e00464`。验证在 Linux Node 24.19 上完成，不证明 Electron 原生文件夹拖放、macOS/Windows 文件路径提取、菜单呈现或辅助技术等价；未改变文稿恢复、隐私、权限或数据保留边界。


## 快捷键多字符长度限制更新（2026-10-12）

本页“已按上游源码核对的快捷键”中“最多 16 个 Unicode 标量”的文字记录的是先前实现，**已由本节取代**。依据 CotEditor 7.1.1 对非空多字符 key equivalent 的实现，CotEdit 现接受单个安全可打印键值最多 16,384 个 Unicode 标量，并将所有命令快捷键覆盖值的键字符串总量限制在同样的 16,384 个标量内；renderer 捕获/匹配、设置规范化和主进程快捷键 IPC 一致执行该预算。预算按 Unicode 标量计数；对最大 UTF-8 宽度标量，键值文本上界为 64 KiB。超出剩余总预算的后续设置项会被跳过，先前有效项保留。片段快捷键共享单键上限，片段库另受既有 40 KiB 总字节上限约束；片段菜单 IPC 仍经主进程登记命令的快捷键净化器校验。空白、控制/格式字符、异常 ZWJ、未知命令 ID 和无修饰的可打印键仍拒绝。上游允许任意非空字符串，CotEdit 保留明确的本地资源上限，故仍不宣称对任意长度输入完全 1:1。

本次定向快捷键/设置/IPC/片段/菜单测试 **67/67**、完整串行 `node --test --test-concurrency=1 test/*.test.js` **596/596**、4 个变更 JavaScript 文件 `node --check` **4/4**。正式版本仍为 **0.5.16**；本轮未构建、未打包、未运行 UI smoke。`dist/`、`release/` 未触碰；实际键盘布局、输入法、Electron 原生菜单及 macOS/Windows 行为仍需相应平台实机验证。


## 2026-10-12 大型管理窗口可调整尺寸（未发行源码）

CotEditor 7.1.0 官方[发布说明](https://coteditor.com/releasenotes/7.1.0.en)将“Make some settings dialogs resizable”列为改进；CotEditor 7.1.1 [正式发布说明](https://coteditor.com/releasenotes/7.1.1.en)链接回 7.1.0。上游没有在发布说明中列出具体哪些窗口，因此本项不声称窗口逐一对应。CotEdit 现为**片段管理器、文本替换词管理器、文件拖放规则设置**三个内容较多的窗口开放双向缩放；窗口初始宽度保持各自现有值，初始高度为 `min(86vh, 780px)`。最小宽度/高度分别是视口边缘条件允许时 620/520 CSS px，最大宽度/高度距视口边缘至少留 20 px。标题保持固定，内部列表与编辑区占用剩余高度，既有窄布局断点继续生效。尺寸仅在当前对话框打开期间由 CSS 布局管理，不写入偏好、恢复草稿或文稿；菜单、快捷键、文件/文稿访问和数据保留边界不变。

验证：新增长窗口布局静态回归 **3/3**；相关对话框/文件拖放设置/片段/文本替换定向 Node 测试 **20/20**；完整串行 `node --test --test-concurrency=1 test/*.test.js` **599/599**。`src/style.css` 经 PostCSS 解析通过，HTML **407** 个 ID 均唯一，新增测试 `node --check` **1/1**。正式版本仍为 **0.5.16**；仅修改源码、测试和本说明，未构建、未打包、未启动 UI smoke。`dist/`（4 个文件）前后聚合 SHA-256 均为 `6f8f2e6f73c24c5342295c8bdac5ed82e55137f6d334a4a267c411500228a6c8`；`release/`（115 个文件）前后均为 `5307091c904be4f75be3d833eb744b4160168e80896b6230a341ecd6c0d477f6`，计数和摘要均排除 `.manus-*` 临时文件。Node/CSS 静态测试不验证 Electron/Chromium 原生缩放把手、各平台鼠标/触控交互、辅助技术或布局实机表现，也不构成与 CotEditor UI 1:1 的结论。


## 2026-10-12 CotEditor 7.1.1 多字符快捷键标签大写显示（未发行源码）

CotEditor 7.1.1 的[快捷键实现提交 `897e55f`](https://github.com/coteditor/CotEditor/commit/897e55f1103c6c14e906bbbca536e6e715af04b4)将 `Shortcut.keyEquivalentSymbol` 改为：若按键不是已知的单字符专用符号，就对**整个 key equivalent 字符串**执行大写显示；同一提交的 `ShortcutFormatterTests` 明确说明展示不可逆，并列出 `ß`、`ss`、`SS` 等测试键值。CotEdit 此前在设置/Quick Actions 共用的 `formatShortcut()` 和 Electron 菜单的 `formatCustomShortcutLabel()` 中保留键串大小写，因此 `ss` 会显示为 `ss`、单字符 `ß` 显示为 `ß`，与 CotEditor 7.1.1 的 UI 格式不一致。

现仅调整两处展示格式器：非命名按键标签对完整字符串调用 JavaScript `toUpperCase()`。因此 `SS`、`ss` 与 `ß` 可分别保持不同内部绑定，但标签均显示 `SS`；`aB` 显示 `AB`。键值捕获、NFC 规范化、设置读写、大小写敏感匹配与冲突签名都未修改，`SS` 和 `ss` 仍是不同快捷键。按上游格式，显示本身会有意丢失大小写区别；CotEdit 的设置界面通过录制按键而非从显示标签反向解析，不会因该标签变换覆盖或改写原绑定。

本轮显式串行运行 `test/shortcuts.test.js`、`test/shortcut-menu.test.js`、`test/coteditor-menu-parity.test.js` **50/50**；四个变更 JavaScript 源码/测试文件 `node --check` **4/4**。未运行完整测试套件，也未对 `dist/` / `release/` 做摘要比较。正式版本仍是 **0.5.16**；本项仅为未发行源码、测试和文档，未构建、未打包、未启动 Electron 或运行 UI smoke。验证为 Linux Node/纯格式函数与源码测试，不验证 Electron 实际菜单绘制、实体键盘/输入法、macOS Foundation 的全部 Unicode 大小写映射或其他平台原生呈现；不据此宣称 1:1/native parity。文稿恢复、隐私、权限和数据保留边界未改变。


## 2026-10-12 按模式排序样例键范围高亮（未发行源码）

CotEditor 7.1.1 的 [`PatternSortView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Accessory%20Views/PatternSortView.swift) 在校验排序模式后调用 `sortPattern.range(for:)`，将样例行对应范围设置为 accent 色背景；稳定版 [`CSVSortPattern.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/LineSort/CSVSortPattern.swift) 为 1 起算的分隔列提供范围，[`RegularExpressionSortPattern.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/LineSort/RegularExpressionSortPattern.swift) 为整条正则命中或指定捕获组提供范围。CotEdit 之前只显示“排序键：…”文本，没有在样例行上标出该范围。

当前按模式排序预览会高亮整行、分隔列去空白后的实际范围，或正则完整命中/所选捕获组范围。捕获位置用编译后 JavaScript `RegExp` 的 `d` indices 获取，范围采用 JavaScript UTF-16 偏移；整行模式、列缺失、仅空白列、空字段及未参与的可选捕获都分别处理。高亮以 `textContent`、文本节点与 `<mark>` 创建，不将样例或模式解释为 HTML。无效表达式和无范围结果清除高亮；原有排序键提取与排序操作不变。

这是只作用于对话框样例显示的有界 UI 对齐：未改变菜单、快捷键、设置格式、搜索/排序语义或任何持久化、恢复、隐私和数据保留行为。CSS `--accent-soft` 是本应用主题色近似，不等同 SwiftUI 的 accent opacity；JavaScript ICU→RegExp 转换及 whitespace trimming 也不表示 Foundation/ICU 原生语义完全一致。

验证：新增范围测试和相关菜单/无障碍回归 **55/55**；完整串行 `node --test --test-concurrency=1 test/*.test.js` **603/603**；`src/main.js`、`lib/pattern-sort-preview.js` 与新增测试 `node --check` **3/3**；CSS PostCSS 解析通过，HTML **408** 个 ID 唯一。正式版仍为 **0.5.16**；仅修改源码、测试与文档，未构建、未打包、未运行 UI smoke；`dist/` 与 `release/` 未由本轮写入。Linux Node/静态测试不验证实际 Electron/Chromium 视觉对比、缩放与截断效果、平台原生菜单或读屏器呈现，不据此宣称 1:1/native parity。


## 2026-10-12 文件夹预览的有限图像像素尺寸（未发行源码）

CotEditor 7.1.1 稳定版 [`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift) 在文件预览中使用 Quick Look，并在 `ImageAttributesView` 列出图像 Dimensions、Image DPI、Color space 与 Color profile。CotEdit 的文件夹侧栏原先只提供文本/类型提示，没有图像属性。本轮补入其中一个可在跨平台、无图像解码的前提下可靠限制实现的子集：识别到有限格式头部及有效正整数宽高时，在预览元信息行显示“图像 · 宽 × 高 像素”。

`parseImageDimensions()` 从拖放规则原有的 `electron/file-drop.cjs` 提取到共享 `electron/image-dimensions.cjs`；原 File Drop 行为由既有 PNG、GIF、JPEG、BMP、WebP 与经典 TIFF 回归继续锁定。目录预览复用已通过根目录、真实路径、普通文件和句柄校验的现有读取流程，只检查预览缓冲区的前 **512 KiB**（既有 `MAX_PREVIEW_BYTES` 限额及增长检查不变），不额外读文件，不将图片缓冲区或正文文本传给 renderer。识别成功则返回只有数值的 `imageDimensions`，不调用文本解码器；UI 通过 `textContent` 显示尺寸，禁用默认“打开”及“在新窗口打开”，仍保留显式“以纯文本打开”和系统默认/其他外部应用路径。普通文本、可执行文件和二进制 plist 的既有路径不变。

**等价边界：**这不是 Quick Look 或图片查看器，不绘制缩略图、不提供 DPI/色彩空间/色彩配置文件，也不完整校验图像文件；只在尺寸可从当前有限头部读取时给出 metadata。支持的尺寸头为 PNG、GIF、JPEG、BMP、WebP 与经典 TIFF；BigTIFF、HEIC、SVG、依赖超过 512 KiB 文件头的 JPEG 元数据及其它格式没有承诺支持。与 CotEditor 使用系统 `UTType` 和 ImageIO/Quick Look 的图像分类、解码及布局行为不同，不能视为原生视觉或平台辅助技术 1:1。上游证据：[CotEditor 7.1.1 `FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift)。

验证：目录预览/File Drop/菜单/无障碍定向测试 **95/95**；完整串行 `node --test --test-concurrency=1 test/*.test.js` **604/604**；本轮 6 个 JavaScript 源码/测试文件 `node --check` **6/6**；CSS PostCSS 解析通过；HTML **408** 个 ID 全部唯一。正式版本仍为 **0.5.16**；仅更改未发行源码、测试和文档，未构建、未打包、未运行 Electron UI smoke。`dist/` **4** 个文件 SHA-256 聚合为 `6f8f2e6f73c24c5342295c8bdac5ed82e55137f6d334a4a267c411500228a6c8`，`release/` **115** 个文件 SHA-256 聚合为 `5307091c904be4f75be3d833eb744b4160168e80896b6230a341ecd6c0d477f6`；本轮起止一致。Node/静态检查不验证 Electron/Chromium 实际显示、原生文件预览、菜单、读屏器或 macOS/Windows 行为；未改变文稿恢复、隐私、权限或数据保留边界。

## 2026-10-12 文件夹预览中的有限图像 DPI 元数据（未发行源码）

CotEditor 7.1.1 的 `FilePreviewView.swift` 在 Quick Look 下除 Dimensions 外还显示 Image DPI、Color space 与 Color profile；`ImageAttributes.swift` 明确其 DPI 只按 X 轴计算：`72 × pixelsWide / size.width`。本轮继续补齐其中一个可从现有受限头部读取、无需解码的属性：PNG `pHYs`（单位明确为像素/米）、JPEG JFIF 水平密度（英寸或厘米）、BMP 水平像素/米，以及经典 TIFF 的 `XResolution` + `ResolutionUnit`。统一换算并显示为“像素/英寸（水平 DPI）”，小数最多一位；缺少物理单位、单位未知、数值为零或元数据不完整时不推测 DPI，只保留像素尺寸。

DPI 解析复用目录预览已经读取的 `visibleBuffer`，仍受既有 512 KiB 上限约束；只返回数值 `imageDpi`，不返回图片字节、不调用图像解码器，也不改动文件拖放输入、权限校验、文稿恢复、隐私或数据保留规则。WebP/GIF/BigTIFF DPI、DPI Y 轴、色彩空间/配置文件、缩略图和 Quick Look 均未实现；PNG CRC 等完整文件有效性也不在此窄解析器范围内。像素尺寸仍仅支持先前列出的 PNG、GIF、JPEG、BMP、WebP 与经典 TIFF。

上游证据：[CotEditor 7.1.1 `FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift)（Quick Look 与图像属性字段）、[`PreviewDocument.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document/PreviewDocument.swift)（`NSImageRep` 属性提取）、[`ImageAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/File%20Content%20Attributes/ImageAttributes.swift)（X 轴 DPI 公式）。

验证：DPI 解析器 5 项、目录预览集成 1 项与菜单源码断言定向组合 **55/55**；串行完整 Node 套件在排除一个既有用例后 **608/608** 通过。该唯一排除用例为 `bounded handle reads stop at the search limit plus one byte after a file grows`；它在未排除运行时于临时文件 `write` 报 `ENOSPC`，不是本轮实现断言失败；未清理缓存或删除任何文件。6 个变更 JS 源码/测试文件 `node --check` **6/6**，CSS PostCSS 解析通过，HTML **408** 个 ID 全唯一。正式版本仍为 **0.5.16**；未构建、未打包、未运行 Electron UI smoke。`dist/` 4 文件和 `release/` 115 文件的聚合 SHA-256 均与本轮前一致。上述 Node 与静态检查不验证 Electron/Chromium 实际布局、Quick Look、原生菜单、读屏器或 macOS/Windows DPI/色彩空间表现。


## 2026-10-12 JPEG EXIF 水平 DPI 预览（未发行源码）

CotEditor 7.1.1 的 `PreviewDocument.swift` 以 `NSImageRep(contentsOf:)` 获取图像表示；`ImageAttributes.swift` 以 `72 × pixelsWide / size.width` 计算 X 轴 DPI。CotEdit 现在除 JFIF 外，也能从 JPEG APP1 中以 `Exif\0\0` 开头的经典 TIFF 元数据读取 `XResolution`（tag 282）和 `ResolutionUnit`（tag 296）：单位 2 按英寸、单位 3 按厘米换算；缺少/未知单位、无效或零分母 rational、错误签名及不完整头部均不推测。有效 JFIF 的物理密度优先；缺失、单位未知或零值时才回退到有效 EXIF DPI。

解析只检查目录预览已读取的 `visibleBuffer`，仍受 512 KiB 上限约束；EXIF TIFF 的 IFD 与 rational 偏移限定在当前 APP1 段内，未解码图像、未扩大文件读取、未向 renderer 传输图像字节，renderer 仍只接收数值 DPI。此为窄格式解析，不等同 ImageIO/Quick Look；不解析 EXIF 的其它图像标签、BigTIFF 或 WebP/GIF DPI，也不提供 Y 轴 DPI、色彩空间/配置文件和缩略图。

上游依据：[CotEditor 7.1.1 `PreviewDocument.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document/PreviewDocument.swift)（通过 `NSImageRep` 读取图像属性）与 [`ImageAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/File%20Content%20Attributes/ImageAttributes.swift)（水平 DPI 公式）。

验证：解析器/目录预览/菜单定向测试 **67/67**；最终串行完整 Node 测试 **612/612**（包含此前一次因 `ENOSPC` 未通过的目录文件增长用例，本轮复跑通过）；3 个变更 JavaScript 文件 `node --check` **3/3**。本轮未构建、未打包、未运行 Electron UI smoke；`dist/`、`release/` 未触碰；未删除文件或清理缓存。当前根文件系统仍为 **99%** 使用、可用约 **843 MiB**，因此仍不宜执行构建/打包；本轮未遇到空间导致的测试失败。Linux Node 测试不证明 Electron/Chromium 原生预览、macOS/Windows 图像解码与 UI 1:1 等价；未改变文稿恢复、权限、隐私或数据保留边界。


## 2026-10-12 WebP EXIF 水平 DPI（未发行源码）

CotEditor 7.1.1 的 [`PreviewDocument.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document/PreviewDocument.swift) 对系统识别的类型尝试 `NSImageRep(contentsOf:)`，随后由 [`ImageAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/File%20Content%20Attributes/ImageAttributes.swift) 从图像表示读取属性，并以 `72 × pixelsWide / size.width` 计算水平 DPI。上游没有在这段源码中单独列举 WebP EXIF 承诺；因此本增量只对齐“可取得图像表示时读取水平 DPI”的属性工作流，不据此宣称 WebP 在所有 CotEditor/macOS 环境中的原生 Quick Look 行为相同。

CotEdit 现会在已经读取的预览缓冲区中扫描 WebP `RIFF/WEBP` 顶层 chunk，遵守 RIFF little-endian chunk 长度、声明的 RIFF 末界及奇数字节的零 padding；遇到 `EXIF` chunk 时，仅将该 chunk payload 传给已有经典 TIFF `XResolution`/`ResolutionUnit` 解析器，可识别原始 TIFF payload 与可选 `Exif\0\0` 前缀。有效单位 2（英寸）及单位 3（厘米）产生水平 DPI；缺少物理单位、未知单位、零分母、损坏或截断 chunk、非零/缺失 padding、越过 RIFF 或 EXIF chunk 的 TIFF 偏移均不推测。解析器不读取文件尾部或增加既有 512 KiB 预览读取限额；如果 EXIF chunk 不完整地落在已读前缀内，则没有 DPI。Google 的 [WebP 容器规范](https://developers.google.com/speed/webp/docs/riff_container)与 [RFC 9649 §2.3/§2.7.1.5](https://www.rfc-editor.org/rfc/rfc9649.html)定义 RIFF chunk/padding 和可选 `EXIF` chunk；它们用于限定本实现的字节边界，不意味着完整 WebP 解码或有效性校验。

此项收窄上一节“WebP DPI 未实现”的边界：现支持可在预览前缀内完整取得的 WebP EXIF XResolution；GIF、BigTIFF、无 EXIF 的 WebP、其他 DPI 来源、Y 轴 DPI、色彩空间/配置文件、缩略图与 Quick Look 仍未覆盖。集成测试确认目录预览仍只向 renderer 返回数值 DPI，不返回图像字节/文本，不绕过根目录访问、句柄读取或文件大小边界。

验证：图像解析与目录预览定向测试 **20/20**；完整串行 `node --test --test-concurrency=1 test/*.test.js` **614/614**；`electron/image-dimensions.cjs`、`test/image-dimensions.test.js` 与 `test/directory-search.test.js` 的 `node --check` **3/3**。正式版本仍为 **0.5.16**；仅修改未发行源码、测试和兼容性文档，未构建、未打包、未运行 UI smoke。`dist/` 与 `release/` 的 119 个文件聚合摘要仍需与本轮开始值对照后记录；根文件系统仍处于 99% 使用，因此不执行构建或打包。Linux Node 测试不证明 Electron/Chromium 原生预览、ImageIO/Quick Look 或 macOS/Windows UI 行为等价；未改变文稿恢复、访问权限、隐私或数据保留边界。


补充核对：本轮开始与结束时 `dist/`、`release/` 共 **119** 个非临时文件的聚合 SHA-256 均为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`，未改写发布目录。结束时根文件系统仍为 **99%** 使用、可用 **843 MiB**；未删除文件、清理缓存或构建产物。

## 2026-10-12 文件夹图像预览中的 PNG 显式 sRGB 色彩空间（未发行源码）
CotEditor 7.1.1 的 [`ImageAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/File%20Content%20Attributes/ImageAttributes.swift)从 `NSBitmapImageRep.colorSpace` 获取色彩空间；[`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift)在图像预览信息区展示 Color space 与 Color profile。本轮仅补一个可验证子集：CotEdit 文件夹预览在 PNG 头部明确声明 sRGB 时显示“色彩空间 sRGB”。[PNG 第三版规范 §11.3.2.5](https://www.w3.org/TR/png-3/#11sRGB)规定 `sRGB` chunk 表示样本符合 sRGB 色彩空间，带一个 0–3 的渲染意图字节，并要求位于 PLTE/IDAT 之前；CotEdit 校验 chunk 长度、渲染意图及该 chunk 的 CRC，并只在扫描到 IDAT 边界后报告。若发现 iCCP 或 cICP、出现重复/损坏/截断标记、顺序不合规或当前受限前缀内未到 IDAT，则不显示；不会由 gAMA/cHRM 推测命名色彩空间。
解析复用文件夹预览已读取的 `visibleBuffer`，仍不超过 512 KiB；主进程只向 renderer 返回固定白名单标量 `imageColorSpace: 'sRGB'`，不解压 ICC、不解码/传送图像字节，也不改变文件夹根路径校验、权限、恢复、隐私或保留边界。其它 PNG 色彩信号、JPEG/TIFF/WebP/GIF 色彩空间、ICC 配置文件名称、Quick Look/ImageIO 色彩管理与完整 PNG CRC/格式验证仍不覆盖。此项只对齐“明确可识别的 PNG sRGB 色彩空间”信息，不等同 CotEditor 的 `NSColorSpace`/ImageIO 分类、配置文件信息或 macOS 原生预览，也不证明 Electron/Chromium、macOS 或 Windows 的屏幕显示行为一致。
验证：完整串行 `node --test --test-concurrency=1 test/*.test.js` **616/616 通过**；6 个变更 JavaScript 源码/测试文件 `node --check` **6/6 通过**。测试覆盖四种合法渲染意图、sRGB CRC、iCCP/cICP 冲突、PLTE/IDAT 顺序、重复/畸形/截断标记、目录预览 scalar-only 边界与既有 512 KiB 限额。正式版本仍为 **0.5.16**；仅改未发行源码、测试和本兼容文档，未构建、未打包、未运行 Electron UI smoke。`dist/` 与 `release/` 共 119 个文件的聚合摘要起止一致；根文件系统仍为 99% 使用、可用约 842 MiB，未清理缓存或删除文件。Linux Node/静态检查不验证真实桌面布局、原生菜单、读屏器、Quick Look/ImageIO 或目标平台图像色彩渲染。
本轮结束复核：`dist/` 4 个文件、`release/` 115 个文件，共 119 个非临时文件；按相对路径与各文件 SHA-256 汇总的聚合值为 `f6d770369d464f01883ef32f3530e60ebd8042ef117f0aafcd01d73d92380853`，与本轮开始计算值完全相同。


## 2026-10-12 文件夹预览的有限 RIFF/WAVE PCM 时长（未发行源码）

CotEditor 7.1.1 的 [`AudioAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/File%20Content%20Attributes/AudioAttributes.swift)通过 `AVAsset.load(.duration)` 获取时长；[`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift)在音频预览中显示 Duration，并按时长选择分/秒或时/分/秒格式。CotEdit 本轮增加一个静态、跨平台的受限子集：仅对 RIFF/WAVE 中经典整数 PCM 的数据区长度计算时长。依据 [Microsoft RIFF 规范](https://learn.microsoft.com/en-us/windows/win32/xaudio2/resource-interchange-file-format--riff-)核验容器/块边界，并按 [McGill WAVE 格式说明](https://www.mmsp.ece.mcgill.ca/Documents/AudioFormats/WAVE/WAVE.html)核对采样率、平均字节率和块对齐字段。

`isWaveContainer()`按 12 字节 `RIFF`/`WAVE` 标记分类；即使编码不支持或头部不完整，也不把这类容器的音频载荷送入默认文本解码路径。`parseWavePcmDuration()`只接受 format tag `WAVE_FORMAT_PCM`（1）、16 字节 `fmt ` 或带零扩展长度的 18 字节 `fmt `、8/16/24/32 位样本，以及互相一致的通道数、采样率、`nBlockAlign` 和 `nAvgBytesPerSec`。必须先出现唯一的格式块，数据块须为 RIFF 最后一个块、位于声明容器及真实文件大小范围内，且数据长度为完整采样帧的整数倍。时长为数据字节数除以平均字节率；仅回传 `audio` 标记和数值秒数，不读取或传递音频载荷。UI 四舍五入至整秒，1 小时以下显示 `分:秒`，否则显示 `时:分:秒`；这不是 Swift `Duration` 的本地化格式逐项等价。

CotEdit 将已识别 WAVE 标为音频、显示时长或“时长未知”，并禁用默认纯文本打开与在新窗口打开；用户仍可明确选择“以纯文本打开”或外部应用。压缩编码、IEEE float、`WAVE_FORMAT_EXTENSIBLE`、RF64/BW64、多数据块、数据块后附加元数据、非上述采样宽度、非 PCM WAV 和其他音频容器均不计算时长；此功能不播放音频，也不是 AVFoundation、Quick Look 或系统媒体分类的替代。签名分类并非完整文件格式验证，不能据此宣称与 CotEditor 支持格式或原生 UI 等价。

验证：图像/WAVE 解析、目录预览与菜单/UI 静态定向测试 **75/75**；最终完整串行 `node --test --test-concurrency=1 test/*.test.js` **620/620**；6 个变更 JavaScript 文件 `node --check` **6/6**。正式版本仍为 **0.5.16**；未构建、未打包、未运行 Electron UI smoke，未改 `dist/` 或 `release/`。本轮开始与结束聚合值均为 120 个文件（含一个预先存在、未触碰的零字节 `release/.manus-025928e41425c65d464f4c2c9bc81307.tmp`）：`944fa76a8d1fa244dab54ce8e8230c1ed66b3508fb4b1656f4d30d5ba710370a`；排除该临时标记后 119 个文件的值为 `48b70018fe25011cf39f257334fb18c41c5926af225d87c22fe0cf70a752c76b`。与上一轮记录的聚合值 `f6d770369d464f01883ef32f3530e60ebd8042ef117f0aafcd01d73d92380853` 不同；差异在本轮改动前已观测到，且当前副本无可用 Git 元数据，故原因未能定位，本轮只记录本次起止一致性、不据此断言历史文件差异原因。结束时根文件系统可用约 **840 MiB**、使用率 **99%**；未清理缓存或删除文件。Node/静态测试不验证 Electron/Chromium 实际排版、读屏器、macOS/Windows 原生预览或其他平台行为。


## 2026-10-12 多字符快捷键标签保真（未发行源码）

CotEditor 7.1.1 的[官方发布说明](https://coteditor.com/releasenotes/7.1.1.en)新增“支持单次按键产生多个字符的快捷键”。CotEdit 此前已经能捕获并匹配这类 `KeyboardEvent.key` 输出，但标签格式化对整个字符串直接执行 JavaScript `toUpperCase()`；如单键输出 `ß` 会被显示成 `SS`，使菜单、快捷键设置和片段快捷键状态文字把一个按键错误显示成两个字符。本轮同时修正编辑器 UI 与 Electron 原生菜单标签：逐 Unicode 标量应用大写，只在映射结果仍恰为一个标量时采用大写；若大写会扩展为多个标量（如 `ß`→`SS`、`ﬃ`→`FFI`），则保留捕获字符。ASCII 多字符键仍显示为大写（例如 `ss`→`SS`），按键捕获、持久化、冲突判断和事件匹配语义未改变。该处理只修正标签保真，不声称与 AppKit 的原生快捷键标签或各操作系统键盘布局完全等价。

验证：快捷键绑定、菜单标签、平台对齐与设置捕获定向测试 **39/39**；完整串行 `node --test --test-concurrency=1 test/*.test.js` **620/620**；4 个变更 JavaScript 源码/测试文件 `node --check` **4/4**。正式版本仍为 **0.5.16**；仅修改未发行源码、测试和兼容性文档，未构建、未打包、未运行 Electron UI smoke。`dist/` 与 `release/` 的 119 个非临时文件改动前后聚合 SHA-256 均为 `236728ec2efc1986ed386d3aec46100d8e0f7b4c6eca7cf5d48d98b126fa3461`。结束时根文件系统可用约 **838 MiB**、使用率 **99%**；未清理缓存或删除文件。Node 测试不验证各平台实际键盘布局、Electron 原生菜单绘制、读屏器或真实桌面交互。


## 2026-10-12 文件夹 JPEG 预览中的 EXIF sRGB 声明（未发行源码）

CotEditor 7.1.1 的 [`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift) 会在图像信息区显示 `Color space` 与 `Color profile`，[`ImageAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/File%20Content%20Attributes/ImageAttributes.swift) 从图像表示读取色彩空间。本轮在已支持 PNG 显式 `sRGB` 的基础上，为 CotEdit 再补一个 JPEG EXIF 的严格子集：[CIPA EXIF 2.3](https://www.cipa.jp/std/documents/e/DC-008-2012_E.pdf) 定义 `ColorSpace`（tag 40961 / `0xA001`）为 `SHORT`、count 1，其中值 1 表示 sRGB、`0xFFFF` 表示 Uncalibrated；Adobe 的 [EXIF namespace](https://developer.adobe.com/xmp/docs/xmp-namespaces/exif/) 对该标签和值作相同说明。

解析仅扫描 JPEG 的 SOS 前头部；APP1 必须含 `Exif\0\0`，TIFF IFD0 的 `ExifIFDPointer` 必须为唯一的 LONG/count=1，指向范围内 EXIF IFD；该 IFD 中 `ColorSpace` 必须为唯一 SHORT/count=1 且值为 1，才回传 `imageColorSpace: 'sRGB'`。未校准、保留值、缺标签、坏字节序/类型/计数、越界/截断 IFD、相互矛盾的多段 EXIF，或 JPEG APP2 出现 `ICC_PROFILE\0` 标记时均返回未知，不猜测其配置文件或色彩空间。APP2 ICC 标记只用于抑制可能冲突的 EXIF 标签，不校验或合并 ICC 分片。

该字段复用文件夹预览既有的最多 512 KiB `visibleBuffer`，不扩大读取预算、不解码/解压图像或 ICC，不向 renderer 传送图像字节；renderer 已有固定 `sRGB` 显示分支。没有改变文件根目录校验、权限、草稿恢复、隐私或数据保留边界。此项不是 CotEditor `NSColorSpace`/ImageIO 的通用分类，不提取 ICC profile 名称，不覆盖 JPEG 中 profile ICC chunks 与 EXIF 标签的一致性确认、其他 JPEG 色彩标记或 TIFF/WebP/GIF 色彩空间，也不提供色彩管理、Quick Look 或原生预览布局；不能据此声称跨平台视觉效果等价。

验证：图像解析、目录预览与菜单静态路由定向测试 **77/77**；完整串行 `node --test --test-concurrency=1 test/*.test.js` **623/623**；3 个变更 JavaScript 文件 `node --check` **3/3**。正式版本仍为 **0.5.16**；只修改未发行源码、测试与文档，未构建、未打包、未运行 UI smoke。`dist/` 与 `release/` 共 119 个非临时文件，结束时聚合 SHA-256 为 `48b70018fe25011cf39f257334fb18c41c5926af225d87c22fe0cf70a752c76b`；本轮未对发布目录写入。结束时根文件系统可用约 **837 MiB**、使用率 **99%**；未清理缓存或删除文件。Node/静态测试不验证 Electron/Chromium/Quick Look/ImageIO 实际色彩渲染、原生菜单、屏幕阅读器或 macOS/Windows 桌面行为。


## 2026-10-12 文件夹预览的有限 AIFF PCM 时长（未发行源码）

CotEditor 7.1.1 的 [`PreviewDocument.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document/PreviewDocument.swift) 对 `.audio` 类型通过 `AVURLAsset` 读取音频属性；[`AudioAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/File%20Content%20Attributes/AudioAttributes.swift) 从 AVAsset 加载 duration，[`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift) 显示 Duration。上游这些源码核实了“音频预览显示时长”的工作流，但没有在此处枚举 AIFF/codec 支持清单，因此本增量不声称 CotEditor 对所有 AIFF 文件均可取得时长。

本段记录 AIFC 时长支持加入前的状态，后由文末“有限 AIFF-C PCM 时长”条目更新。CotEdit 以 `FORM`/`AIFF` 标记将经典 AIFF 送入音频预览路径；当时 `FORM`/`AIFC` 也被分类为音频以避免默认文本解码，但时长保持未知。`parseAiffPcmDuration()` 当时仅处理经典 AIFF：要求 FORM 声明末界不超过文件实际大小、唯一 `COMM` 块恰为 18 字节、通道数为正、样本位数为 1–32，且 80 位扩展精度 sample rate 为有效正值（实现上限 1 MHz）；时长以 `numSampleFrames / sampleRate` 计算。正帧数必须有唯一 `SSND`；其块大小必须为零，偏移字段须在 chunk 边界内，扣除 offset 后的数据长度必须与 `sampleFrames × channels × ceil(sampleBits/8)` 精确相符。零帧可无 SSND。可跳过当前 512 KiB 前缀内完整的可选块；如果块头不在受限前缀内、FORM/块大小溢出、关键块重复/截断、SSND extent 不符或 AIFF-C/压缩头不受支持，则不猜测时长。

该解析只复用文件夹预览已经读取的 `visibleBuffer` 与文件句柄 `stat.size`，没有增加 512 KiB 读取预算、不解码音频样本、不将音频字节或文本传给 renderer，只返回有限 `audioKind` 标记与秒数标量。WAVE 与 AIFF 共享既有音频 UI 时长呈现；默认“打开”及“在新窗口打开”仍禁用，明确“以纯文本打开”和外部应用路径保持现状，没有新增菜单项或快捷键。CotEdit 将时长四舍五入至整秒显示，不能据此声称与 Swift `Duration` 本地化格式等价；AIFF-C、其它音频容器、播放能力、AVFoundation/Quick Look、系统类型识别及各平台原生预览仍未覆盖。

格式依据：[AIFF 1.3 规范](https://www.mmsp.ece.mcgill.ca/Documents/AudioFormats/AIFF/Docs/AIFF-1.3.pdf)关于 FORM、COMM、SSND、sample frame、sample size、sampleRate 与 SSND offset/blockSize 定义。CotEdit 仅实现上述严格可验证子集；规范允许 chunk 任意排序，但实现只在能够于既有预览前缀内验证全部所需块边界时计算时长。

验证：AIFF/WAVE 与图像解析测试 **18/18**，目录预览集成测试 **14/14**，菜单/路由静态测试 **49/49**；完整串行 `node --test --test-concurrency=1 test/*.test.js` **626/626**；6 个变更 JavaScript 文件 `node --check` **6/6**。正式版本仍为 **0.5.16**；仅修改未发行源码、测试和文档，未构建、未打包、未运行 Electron UI smoke。目标平台原生预览与真实视觉/辅助技术行为未验证。

补充复核：`dist/` 与 `release/` 共 **119** 个非临时文件，按相对路径与文件 SHA-256 汇总的本轮开始及结束值均为 `a023cb3a4fbcb06f3f0af9de0a54bf29a0a8bd96fc9590178ddb5d50d17f44c9`，发布目录未改写。结束时根文件系统可用约 **837 MiB**、使用率 **99%**；未构建、未打包、未运行 UI smoke，未清理缓存或删除文件。


## 2026-10-12 WAVE PCM 数据块后的 RIFF 信息块（未发行源码）

CotEditor 7.1.1 的 [`PreviewDocument.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document/PreviewDocument.swift) 对音频预览使用 `AVURLAsset`，[`AudioAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/File%20Content%20Attributes/AudioAttributes.swift) 通过 `AVAsset.load(.duration)` 取时长。上游源码没有列出所有支持的音频编码，因此这里只对照“可呈现音频时长”的工作流，不推断 AVFoundation 对每个 WAV 变体的支持。

此前 `parseWavePcmDuration()` 要求 `data` 是 RIFF 最后一个块；本轮移除这一条件。依据 [Microsoft RIFF 说明](https://learn.microsoft.com/en-us/windows/win32/xaudio2/resource-interchange-file-format--riff-)中“RIFF 内部块可按任意顺序出现”及块大小/字对齐规则，以及 [McGill WAVE 格式说明](https://www.mmsp.ece.mcgill.ca/Documents/AudioFormats/WAVE/WAVE.html)关于 PCM 数据前后常见信息块的说明，时长现在由先前唯一、有效的经典 PCM `fmt ` 与 `data` 字段计算，即使 `data` 后还有 LIST/INFO 等块也可返回时长。仍要求整数 PCM、受支持位深、字段一致、数据长度按 `nBlockAlign` 整帧对齐，且数据块声明范围不越过 RIFF 或真实文件边界。完整位于既有 512 KiB 预览前缀中的可见后置块会继续校验大小/对齐，并拒绝可见重复 `fmt `/`data`；若数据区或尾部超出该前缀，则不扩读、不解析尾块，只依据已验证数据块长度与容器/文件边界计算时长。因此，超出前缀的尾部 chunk 结构及潜在重复数据块不能完整验证，不能据此声称完整 RIFF 校验。

目录预览集成回归使用大于 512 KiB 的 PCM `data`，后接 LIST/INFO 元数据；确认时长按 PCM 数据块长度计算，音频内容仍不解码、不传 renderer，预览读取预算、文件夹根目录校验、权限、恢复/隐私/数据保留边界均不变。预览说明现明确指出超出前缀的尾部结构未完整验证；无新增菜单项或快捷键。其它编码、WAVE_FORMAT_EXTENSIBLE、RF64/BW64、媒体播放、AVFoundation/Quick Look 与目标平台原生预览仍不支持或未验证；正式版本仍为 **0.5.16**。

验证：解析/目录预览/菜单静态定向测试 **81/81**；完整串行 `node --test --test-concurrency=1 test/*.test.js` **626/626**；5 个变更 JavaScript 源码/测试文件 `node --check` **5/5**。仅改未发行源码、测试与文档；未构建、未打包、未运行 Electron UI smoke。`dist/` 与 `release/` 共 **119** 个非临时文件，本轮开始聚合 SHA-256 为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`；结束复核值见下项。结束时未清理缓存或删除文件，根文件系统使用率约 **99%**。Node/静态测试不验证 Electron/Chromium 的真实布局、原生菜单或各平台媒体预览行为。

补充复核：`dist/` 与 `release/` 共 **119** 个非临时文件，本轮开始及结束的相对路径/内容聚合 SHA-256 均为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`；发布目录未写入。结束时根文件系统可用约 **821 MiB**、使用率 **99%**；未清理缓存或删除文件。


## 2026-10-12 文件夹预览的有限 AIFF-C PCM 时长（未发行源码）

CotEditor 7.1.1 稳定版的 [`PreviewDocument.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document/PreviewDocument.swift) 对被系统识别为 `.audio` 的文稿经 `AVURLAsset` 异步读取音频属性；[`AudioAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/File%20Content%20Attributes/AudioAttributes.swift) 加载 duration，[`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift) 显示 Duration。上游验证了音频预览时长工作流，但没有在上述源码中声明 AIFF-C 的逐 codec 支持清单；此项不据此推断 CotEditor/AVFoundation 对任意 AIFC 文件都支持时长。

依据 [AIFF-C 9/26/91 规范](https://www.mmsp.ece.mcgill.ca/Documents/AudioFormats/AIFF/Docs/AIFF-C.9.26.91.pdf)，AIFC 必须有且仅有一个 `FVER`，版本标记须为 `0xA2805140`；`COMM` 扩展字段包括 compressionType 与 Pascal compressionName，名称字符串按规范补齐到偶数字节；时长以 `numSampleFrames / sampleRate` 表示。McGill 的 [AIFF/AIFF-C 格式说明](https://www.mmsp.ece.mcgill.ca/Documents/AudioFormats/AIFF/AIFF.html)将 `NONE` 定义为未压缩 PCM，将 `sowt` 定义为字节序交换的 PCM。本轮把这两个可由 sample frame 数直接确定长度的 codec 纳入 `parseAiffPcmDuration()`：要求唯一、边界有效的版本与 `COMM` 块；正确的 COMM 固定字段、压缩类型、Pascal 名称长度/补零、通道数、1–32 位样本和有限正的 80 位扩展精度采样率；正帧数还必须有唯一 `SSND`，其 `blockSize` 为零、offset 在块内，且扣除 offset 后的 PCM 字节数精确等于 `sampleFrames × channels × ceil(sampleBits/8)`。只有零帧时允许省略 `SSND`。显示的时长仍由已有通用音频元信息 UI 以时/分秒形式呈现。

AIFC 解析只用目录预览现有最多 **512 KiB** 的 `visibleBuffer` 与已打开文件的 `stat.size` 验证容器/数据范围，不扩充读取、不解码或传送音频字节；只回传原已有的 `audioKind` 与数值 `audioDurationSeconds`。窗口/菜单/快捷键、根目录访问校验、恢复、权限、隐私和数据保留均未改变。其它压缩 codec（包括 `ulaw`/`alaw`、`fl32`/`fl64`）、未知版本、损坏/重复关键块、非零 `blockSize` 或样本区长度矛盾时仍不猜测时长；需从已读前缀之外发现关键块的文件保持未知。本实现不是 AVFoundation、Quick Look、音频解码或播放的替代，不证明 CotEditor 对应 codec 的系统支持，也不验证实际 Electron/Chromium 或 macOS/Windows/Linux 原生媒体预览 UI 等价。

验证：音频/图像解析、目录预览和菜单静态定向测试 **82/82**；完整串行 `node --test --test-concurrency=1 test/*.test.js` **627/627**；本轮 5 个 JavaScript 源码/测试文件 `node --check` **5/5**。正式版本仍为 **0.5.16**，本项为未发行源码、测试与文档；遵照当前范围未构建、未打包、未运行 UI smoke。`dist/` 与 `release/` 共 119 个非临时文件的前后聚合摘要见本段补充复核；根文件系统剩余空间较低，本轮没有清理缓存或删除文件。


## ISO BMFF 电影文件夹预览（0.5.16 后，未发行）

CotEditor 7.1.1 的 [`PreviewDocument.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document/PreviewDocument.swift) 对 movie 类型异步加载 `AVURLAsset.movieAttributes`；[`MovieAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/File%20Content%20Attributes/MovieAttributes.swift) 取第一个 video track 的 `naturalSize.applying(preferredTransform)` 绝对尺寸，以及 asset duration；[`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift) 将 Dimensions/Duration 与 Quick Look 预览一起呈现。Apple 的 [`mvhd`](https://developer.apple.com/documentation/quicktime-file-format/movie_header_atom) 与 [`tkhd`](https://developer.apple.com/documentation/quicktime-file-format/track_header_atom) 资料说明 movie time scale/duration、track 固定点尺寸及矩阵字段；[W3C ISO BMFF byte-stream note](https://www.w3.org/2013/12/byte-stream-format-registry/isobmff-byte-stream-format.html) 说明 `ftyp`/`moov` 初始化段关系（该页面自述为内部说明，不是规范性标准）。

本轮新增 `electron/iso-bmff.cjs` 受限头部解析器，并接入文件夹预览 renderer：

- 仅从以 `ftyp` 开始、声明边界不越过实际文件长度的容器识别 ISO BMFF；要报告电影属性，必须在既有最多 **512 KiB** 预览前缀中完整找到唯一 `moov`，并识别到 `hdlr=vide`。不会依扩展名猜测。多条视频轨道时使用首条，和 CotEditor 源码选择 `.first` 一致。
- 读取唯一有效 `mvhd` 版本 0/1 的 movie 时长，以及 `tkhd` 版本 0/1 的固定点轨道尺寸；应用轨道矩阵的线性旋转/缩放项以计算显示方向尺寸。接受 32 位及扩展长度 atom。扫描/子结构 atom 计数上限 **4096**；越界、矛盾、重复或不完整结构，以及不安全的 64 位数值不会产生猜测属性。
- `moov` 在前缀外（包括常见尾部 `moov` 文件）、没有已识别视频轨道、时长/尺寸字段不完整时不猜测；时长直接采用 `mvhd` 的 duration/timescale，界面四舍五入到秒。当前未解释 edit list (`elst`)、fragmented movie (`moof`)、aperture/pixel-aspect-ratio 等结构，不覆盖 AVFoundation 支持的所有容器/codec，也不支持仅有音轨的 MP4/M4A。完整 `ftyp` 但没有可确认视频轨道时只显示通用“媒体容器/属性未知”，不冒称影片。
- 视频/音频样本不解码、不播放或传给 renderer，只返回尺寸/时长标量。已识别 ISO BMFF 容器默认禁用文件夹预览“打开”和“在新窗口打开”；主进程 `resolveEditableFileInRoot` 也复核最多 **24 字节**签名，避免文件夹双击/常规 folder-scoped IPC 默认把容器载入文本。用户主动选择“以纯文本打开”仍走现有根目录范围校验和 binary-text override；系统默认/其他外部应用入口仍可用。无新增菜单项或快捷键，也未改变文稿恢复、隐私、目录授权或数据保留行为。
- UI 在既有预览信息行呈现尺寸/时长；没有实现 CotEditor 的 Quick Look 画面、分组 Dimensions/Duration 面板、AVFoundation codec/metadata 行为或原生辅助技术表现。因此不据此声称桌面 UI/UX、菜单、快捷键或跨平台逐项等价。

验证：新增解析、目录预览/默认打开和菜单接线 Node 回归；完整串行 `node --test --test-concurrency=1 test/*.test.js` **633/633**，7 个变更 JavaScript 文件 `node --check` **7/7**。正式版仍为 **0.5.16**；只更改未发行源码、测试和文档，未构建、未打包、未运行 UI smoke，未写入 `dist/` 或 `release/`。Node/静态测试不能验证原生 Electron UI、Quick Look、AVFoundation、平台媒体解码器或实际菜单交互。


## 2026-10-12 PNG 文件夹预览的显式 sRGB CICP 信号（未发行源码）

CotEditor 7.1.1 的 [`ImageAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/File%20Content%20Attributes/ImageAttributes.swift) 从 `NSBitmapImageRep.colorSpace` 取得图像色彩空间，[`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift)显示其本地化名称；这些源码说明上游的属性工作流，但没有逐项承诺所有 PNG 色彩 chunk 在每个系统 ImageIO 版本中的结果。CotEdit 原先只识别 PNG `sRGB` chunk。本轮按 [PNG 第三版规范](https://www.w3.org/TR/png-3/)增加明确 CICP 标记的受限识别：仅当四字节元组为 `[1, 13, 0, 1]` 时返回 `sRGB`，其中 ITU-T [H.273 (07/24)](https://www.itu.int/rec/T-REC-H.273-202407-I/en)将 primaries 1 关联 BT.709/IEC 61966-2-1，transfer 13 在 matrix coefficients 0 时定义 IEC 61966-2-1 sRGB；PNG cICP 要求 RGB matrix 为 0，最后一字节 1 表示 full range。

解析复用现有 `parseImageColorSpace()` 与目录预览已读取的最多 **512 KiB** `visibleBuffer`，不增加文件读取预算、不解码图像，也只向 renderer 返回已有固定白名单标量 `imageColorSpace: 'sRGB'`。cICP 必须在 `PLTE`/`IDAT` 前，长度恰为 4、CRC 正确、无重复，matrix 与 range 字段有效；PNG 规范规定 cICP 的颜色信号优先级高于 iCCP、sRGB 及 gAMA/cHRM，所以发现未知但结构有效的 cICP 时不回退到较低优先级 `sRGB` chunk 猜测。此解析器仍保守地不在检测到 `iCCP` 时命名色彩空间；不认识 Display-P3、HDR/PQ/HLG、窄范围 RGB 或其它 cICP tuples，不代表 PNG 完整性验证、色彩转换或实际屏幕色彩渲染，也不证明 CotEditor 7.1.1 在所有 macOS 版本均采用同一 CICP 解码结果。无菜单项、快捷键、文件夹权限、文稿恢复、隐私或数据保留变化。

验证：图像解析与目录预览定向测试 **36/36**；串行完整 `node --test --test-concurrency=1 test/*.test.js` **634/634**；本轮 3 个 JavaScript 源码/测试文件 `node --check` **3/3**。首次全量测试在根文件系统临时目录遇到既有 File Drop 夹具写入 `ENOSPC`，其余 **633/634** 通过；改将 `TMPDIR` 指向 `/dev/shm` 后同一完整套件 **634/634** 通过，未清理或删除文件。正式版仍为 **0.5.16**；只修改未发行源码、测试及文档，未构建、未打包、未运行 Electron UI smoke，未改写 `dist/` 或 `release/`。Linux Node/static tests 不能验证实际 Electron 桌面 UI、AppKit/ImageIO/Quick Look、读屏器或 macOS/Windows 原生行为，不声称 1:1/native parity。


## 2026-10-12 TIFF 文件夹预览的显式 EXIF sRGB（未发行源码）

CotEditor 7.1.1 的 [`ImageAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/File%20Content%20Attributes/ImageAttributes.swift) 从 `NSBitmapImageRep.colorSpace` 取得图像色彩空间，[`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift) 显示色彩空间及配置文件属性。这些源码证明上游的属性工作流，不证明各平台解码器会对同一 TIFF 元数据产生完全相同的色彩管理结果。依据 [CIPA EXIF 2.3](https://www.cipa.jp/std/documents/e/DC-008-2012_E.pdf)，Exif IFD 的 `ColorSpace`（40961）必须为 `SHORT/count=1`；值 `1` 表示 sRGB，`0xFFFF` 表示 Uncalibrated，其他值保留。美国国会图书馆的 [TIFF tag 索引](https://www.loc.gov/preservation/digital/formats/content/tiff_tags.shtml)将 TIFF tag `34675` 记为 ICC profile data（InterColorProfile）。

CotEdit 现对已经被受限尺寸解析器识别为图像的经典 TIFF，沿用该文件头中的 IFD0/Exif IFD 解析 EXIF `ColorSpace`；只有结构完整、字段类型和数量有效且值恰为 `1` 时返回固定白名单标量 `imageColorSpace: 'sRGB'`。若 IFD0 或 Exif IFD 存在 tag `34675`，或标记为 Uncalibrated、保留值、重复/畸形/越界 IFD，则不猜色彩空间。解析复用文件夹预览既有最多 **512 KiB** 的 `visibleBuffer`，不增加读取预算、不解码图像、不读取/传递 ICC profile 字节。目录预览只向 renderer 返回该标量，不增加菜单项或快捷键；文件夹权限、文稿恢复、隐私和数据保留均未改变。

定向图像解析与目录预览测试 **38/38**，完整串行 `node --test --test-concurrency=1 test/*.test.js` **636/636**，3 个变更 JavaScript 文件 `node --check` **3/3**。`dist/` 与 `release/` 共 **119** 个非临时文件的聚合 SHA-256 在验证前后均为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。正式版仍为 **0.5.16**；只修改未发行源码、测试与文档，未构建、未打包、未运行 Electron UI smoke，也未清理缓存或删除文件。此项不展示 ICC 配置文件名/模型，不实现其他色彩空间识别，不等同 CotEditor 的 AppKit/ImageIO/Quick Look、原生 UI 或读屏器行为；Linux Node 测试不证明各平台解码器行为或 1:1 parity。


## 2026-10-12 TIFF 文件夹预览中的通用 RGB 色彩模型（未发行源码）

CotEditor 7.1.1 的 [`ImageAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/File%20Content%20Attributes/ImageAttributes.swift) 从 `NSBitmapImageRep.colorSpace` 读取图像色彩空间模型，[`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift)在预览信息区分别展示 Color space 与 Color profile。[TIFF 6.0 规范 §8.6](https://op.europa.eu/documents/3938058/5896514/TIFF-v6/9340926d-6a7a-63c9-5fd7-21c435dcdfeb)定义 IFD0 `PhotometricInterpretation`（tag 262）为 `SHORT/N=1`，值 2 表示 RGB 模型；美国国会图书馆的 [TIFF tag 索引](https://www.loc.gov/preservation/digital/formats/content/tiff_tags.shtml)也将此字段描述为图像数据的色彩空间，并将 tag 34675 记录为 ICC profile 数据。

CotEdit 现在对已有尺寸解析器识别出的经典 TIFF，在 IFD0 仅于 tag 262 唯一且为 `SHORT/count=1/value=2`、没有 IFD0/Exif IFD ICC-profile tag 时，报告固定字符串标量 `RGB`；界面区分显示为“色彩模型 RGB”，不是“色彩空间 sRGB”或配置文件名称。若 EXIF `ColorSpace` 明确为 sRGB 且 TIFF RGB 模型相符，继续报告更具体的 `sRGB`；EXIF 未校准/保留值、与 photometric 值矛盾、tag 类型/计数错误、重复 photometric、畸形 IFD 或 ICC tag 均不降级猜测。调色板、Separated/CMYK、YCbCr、CIELab 等其它 `PhotometricInterpretation` 暂不映射。读取仍限制在文件夹预览已有的最多 **512 KiB** 缓冲区，不解码图像、不读/传递 ICC 数据，只向 renderer 返回受限标量；未增加菜单项或快捷键，也未改变根目录权限、恢复、隐私及数据保留边界。

验证：图像解析、目录预览集成及菜单静态定向测试 **89/89**；完整串行 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **638/638**；5 个变更 JavaScript 文件 `node --check` **5/5**。`dist/` 与 `release/` 共 **119** 个非临时文件逐项 SHA-256 清单前后完全一致。正式版仍为 **0.5.16**；仅修改工作源码、测试与说明，未构建、未打包、未运行 Electron UI smoke，未改写发布目录或清理缓存。Node/静态测试不能验证 Electron/Chromium 实际显示、AppKit/ImageIO/Quick Look 的色彩模型/配置文件或 macOS/Windows 原生辅助技术行为；此处只实现受限 TIFF RGB 模型标签，不宣称 1:1 parity。


## 2026-10-12 TIFF 文件夹预览中的通用 Gray 色彩模型（未发行源码）

CotEditor 7.1.1 的 [`ImageAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/File%20Content%20Attributes/ImageAttributes.swift) 从 `NSBitmapImageRep.colorSpace` 取得模型；[`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift)展示 `colorSpaceModel.localizedName` 与配置文件名称。本次对齐的是“预览信息展示已知色彩模型”这一有限工作流，并非对上游 macOS 解码映射作等价推断。[TIFF 6.0 §8.6](https://op.europa.eu/documents/3938058/5896514/TIFF-v6/9340926d-6a7a-63c9-5fd7-21c435dcdfeb)定义 IFD0 `PhotometricInterpretation`（tag 262）为 `SHORT/N=1`；值 0（WhiteIsZero）和 1（BlackIsZero）均用于 bilevel 与 grayscale 图像，且仅指定黑白端点解释，不命名配置文件。

CotEdit 对已由现有头部检查识别为图像的经典 TIFF，仅当 IFD0 中 tag 262 唯一、类型/计数正确、值恰为 0 或 1，且 IFD0/Exif IFD 没有 ICC profile tag 时，回传固定 `imageColorSpace: 'Gray'` 标量，并在预览信息中显示“色彩模型 Gray”。这两个值都映射为同一通用模型，不区分反相、灰度与二值深度，也不称为 sRGB 或 ICC profile。重复/畸形字段、越界或截断 IFD、ICC profile、EXIF `ColorSpace` 未校准/保留值，或 EXIF sRGB 与灰度 PhotometricInterpretation 矛盾时保持未知；palette、RGB、CMYK/Separated、YCbCr、CIELab 与其他值不由本次逻辑映射。与此前 TIFF `RGB` 标量同样，不推断 profile。

读取复用文件夹预览现有最多 **512 KiB** 的已读前缀，不扩大读取、不解码图像、不读取或传递 ICC/图像字节；renderer 仅接收受限字符串，普通菜单及快捷键无变化，根目录权限、文稿恢复、隐私和数据保留策略均不变。上游源码只证明属性获取/展示接口；Linux Node 测试不验证 AppKit/ImageIO 对具体 TIFF 的解码和本地化名称，也不证明 macOS/Windows/Electron 实际呈现或辅助技术等价。

验证：图像解析、目录预览集成与菜单静态定向测试 **90/90**；完整串行 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **639/639**；5 个变更 JavaScript 文件 `node --check` **5/5**。本轮前后 `dist/` 与 `release/` 共 **119** 个非临时文件的聚合 SHA-256 均为 `54ee6bbd69b23393e9fe697fc2829f30b1e604461d2ae3ae322ef663a48eb6c9`。正式版本仍为 **0.5.16**；只修改未发行源码、测试与文档，未构建、未打包、未运行 Electron UI smoke，未改写发布目录或清理缓存。


## 2026-10-12 PNG 文件夹预览中的通用 Gray/RGB 色彩模型（未发行源码）

CotEditor 7.1.1 的 [`ImageAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/File%20Content%20Attributes/ImageAttributes.swift) 从 `NSBitmapImageRep.colorSpace` 获取模型；[`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift) 展示色彩模型的本地化名称及 Color profile。此源码确认属性工作流，不保证任一格式在不同 ImageIO/macOS 版本中的具体解码标签。[PNG 规范 §6.1 与 IHDR 表](https://www.w3.org/TR/png-3/)将 color type 0/4 定义为 grayscale（含 alpha），2/6 定义为 truecolor RGB（含 alpha），3 定义为 indexed-color，并规定对应位深；type 3 必须有 PLTE，调色板条目数不得超过位深可表示范围。

本轮在现有 `parseImageColorSpace()` 中增加仅由 PNG 结构头得出的通用模型：color type 0/4 返回 `Gray`，2/3/6 返回 `RGB`。先校验首个 IHDR 长度/CRC、非零尺寸、color type 与合法位深组合、压缩/滤波/交错字段；type 3 只有在 IDAT 前找到唯一且 CRC 有效的 PLTE、调色板大小和索引位深相符时才标记 RGB；type 0/4 含 PLTE、重复/畸形调色板或畸形/截断 chunk 不产生标签。模型只在扫描到 IDAT 后返回，避免把仅含头部的短前缀当成完整的元数据序列。

已有明确且有效的 PNG `sRGB` 或当前支持的全范围 sRGB CICP 信号仍返回较具体的 `sRGB`。`iCCP` 存在、cICP 未知/无效/矛盾、或 PNG 结构不完整时保持未知，不解压 ICC，不从模型猜测配置文件名；单有 `gAMA`/`cHRM` 不命名具体 profile，仍只反映样本通道模型。解析复用文件夹预览既有最多 **512 KiB** 的已读缓冲区，只向 renderer 传递固定 `Gray`/`RGB`/`sRGB` 白名单字符串，不解码、不传图像字节；不增加菜单项/快捷键，不改变打开路径、根目录授权、文稿恢复、隐私或数据保留策略。

验证：`test/image-dimensions.test.js`、`test/directory-search.test.js` 与 `test/menu-coverage.test.js` 定向串行测试 **91/91**；完整串行 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **640/640**；3 个变更 JavaScript 文件 `node --check` **3/3**。`dist/` 与 `release/` 共 **119** 个非临时文件的聚合 SHA-256 前后均为 `4a8c5fcd39def0271cf9073d39365937aef07082334b3f62ce20c6005442b724`。正式版仍为 **0.5.16**；仅修改未发行源码、测试与说明，未构建、未打包、未运行 Electron UI smoke，未写入发布目录。Node/静态测试不验证 AppKit/ImageIO、Quick Look、Electron/Chromium 实际布局、原生菜单或读屏器结果；此项是保守的头部模型标签，不宣称跨平台 1:1 等价。


## 2026-10-12 PNG 文件夹预览中的明确 Display P3 标记（未发行源码）

CotEditor 7.1.1 的 [`ImageAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/File%20Content%20Attributes/ImageAttributes.swift) 读取 `NSBitmapImageRep.colorSpace`，其 [`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift) 分别展示色彩空间和配置文件；这证明图像信息工作流，不等于跨版本/格式的 ImageIO 色彩解释保证。PNG 第三版规范 §11.3.2.6 Example 4 明确给出全范围 Display P3 的 cICP 字节 `0C 0D 00 01`，即 primaries 12、transfer 13、identity matrix 0、full-range 1；ICC 的 [Display P3 注册资料](https://registry.color.org/rgb-registry/displayp3)将其列为 Apple 负责的 Display P3 编码，并定义 D65 白点与 sRGB 传递函数。

CotEdit 此前把该已知 P3 组合保守地当作未知。现仅当 PNG cICP 结构/CRC 已通过既有验证、RGB identity matrix 与 full-range 字段有效，且 tuple 恰为上述四值时，报告白名单标量 `Display P3`；renderer 将其显示为“色彩空间 Display P3”，不会误标成通用“色彩模型 RGB”。继续只扫描已读的最多 **512 KiB** 前缀，不扩读、不解码、不读取或传送图像/ICC 字节；未知 primaries/transfer、窄范围、其他矩阵、iCCP 或不完整结构仍不命名色彩空间。PNG cICP 优先于更低优先级 `sRGB` chunk，已增加冲突回归。无菜单、快捷键、访问授权、恢复、隐私或数据保留变化。

依据：[PNG Third Edition §4.3 与 §11.3.2.6 Example 4](https://www.w3.org/TR/png-3/)、[ICC Display P3 Registry](https://registry.color.org/rgb-registry/displayp3) 与 CotEditor 7.1.1 上述图像属性/预览源码。Linux Node 回归仅验证有限头部解析、目录预览的标量边界和静态标签接线，不验证 AppKit/ImageIO 的设备本地色彩空间映射、实际 Electron 布局、Quick Look、读屏器或 macOS/Windows 原生 UI，也不宣称 1:1 parity。正式版本仍为 **0.5.16**；本轮为未发行源码、测试与文档，未构建、未打包、未运行 UI smoke，且不写入 `dist/`/`release/`。


本轮验证补记：定向 `image-dimensions`、`directory-search` 与 `menu-coverage` 串行测试 **92/92**；完整串行 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **641/641**；5 个变更 JavaScript 源码/测试文件 `node --check` **5/5**。`dist/` 与 `release/` 共 119 个非临时文件逐项 SHA-256 聚合值在改动前及验证后均为 `54ee6bbd69b23393e9fe697fc2829f30b1e604461d2ae3ae322ef663a48eb6c9`。正式版本仍为 **0.5.16**，本轮未构建、未打包、未运行 UI smoke。


## 2026-10-12 GIF 文件夹预览中的有限 RGB 色彩模型（未发行源码）

CotEditor 7.1.1 的 [`ImageAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/File%20Content%20Attributes/ImageAttributes.swift) 从 `NSImageRep.pixelSize`、`dotsPerInch` 和 `NSBitmapImageRep.colorSpace` 组成图像属性；[`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift) 展示 Dimensions、Image DPI、Color space 与 Color profile。该源码证明上游属性工作流，但没有逐项保证 GIF 在所有 macOS/ImageIO 版本里的具体色彩空间映射。[GIF89a 规范 §18–20](https://giflib.sourceforge.net/gifstandard/GIF89a.html)规定逻辑屏幕可含全局颜色表，图像帧可含局部颜色表；两者的颜色表都是 red/green/blue 三字节三元组。

CotEdit 现为 GIF87a/89a 的受限首帧解析器：仅当逻辑屏幕尺寸非零、已声明的全局调色板完整且背景索引在范围内、首个图像帧落在逻辑屏幕内、活动的全局或局部 RGB 调色板完整，并在图像数据的 LZW 最小码长和 sub-block 边界/终止符均可见时，返回 renderer 白名单中的固定 `imageColorSpace: 'RGB'` 标量；首帧前的扩展只按有界 data-sub-block 外壳跳过，局部调色板可在没有全局调色板时使用。不会检查或解压 LZW 位流，不扫描后续动画帧，也不声称辨认调色板实际使用颜色或 ICC/profile 名称。缺表、越界帧、非法/截断表、损坏的可见块边界与不完整数据保持未知。

解析复用目录预览现有最多 **512 KiB** `visibleBuffer`；图像仍不按文本解码，主进程只传回像素尺寸和固定模型字符串，不向 renderer 传送 GIF/调色板字节。renderer 已将 `RGB` 作为通用“色彩模型”显示，因此不改 HTML/CSS、菜单或快捷键；文件夹权限、文稿恢复、隐私和数据保留策略均未变化。这是规范头部范围内的受限模型标签，不等同 CotEditor/AppKit/ImageIO 解码，不验证实际 Electron 布局、原生辅助技术或 macOS/Windows/Linux 逐项 UI 行为，不宣称全量 1:1 parity。

依据：[CotEditor 7.1.1 `ImageAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/File%20Content%20Attributes/ImageAttributes.swift)、[`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift) 与 [GIF89a 规范](https://giflib.sourceforge.net/gifstandard/GIF89a.html)。验证：`test/image-dimensions.test.js`、`test/directory-search.test.js` 与 `test/menu-coverage.test.js` 定向串行测试 **94/94**；完整串行 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **643/643**；3 个变更 JavaScript 文件 `node --check` **3/3**。`dist/` 与 `release/` 共 **119** 个非临时文件改动前后聚合 SHA-256 均为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。正式版本仍为 **0.5.16**；仅修改未发行源码、测试与说明，未构建、未打包、未运行 Electron UI smoke，未写入 `dist/` 或 `release/`。


## 2026-10-12 CotEditor 7.1.1 图像颜色属性分列（未发行源码）

CotEditor 7.1.1 的 [`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift) 在 `ImageAttributesView` 中分别显示 `Color space` 与 `Color profile`；[`ImageAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/File%20Content%20Attributes/ImageAttributes.swift) 分别取 `NSColorSpace.colorSpaceModel.localizedName` 和 `NSColorSpace.localizedName`。此前 CotEdit 将已知命名色彩空间（sRGB、Display P3）或通用模型（RGB、Gray）压在一个字段与标签中，无法同时表达模型及命名值。

本轮增加 `parseImageColorAttributes()`，只把现有受限解析器已经确认的值拆成 `{ model, profile }`：已识别 sRGB/Display P3 映射为 `RGB` 模型加相应命名值；已验证通用 RGB/Gray 仅返回模型。目录预览继续提供兼容字段 `imageColorSpace`，并增加仅含白名单字符串或 `null` 的 `imageColorModel`、`imageColorProfile`；renderer 分别显示“色彩模型”和“色彩配置文件”。对未解析 ICC、畸形、未知或矛盾数据继续返回未知，不尝试解释 ICC 字节。该标签近似上游的双属性工作流，但命名值来自有限格式声明，不等于 ImageIO 的实际 profile 名称；renderer 仍是现有单行摘要，不等于 CotEditor 的原生 grouped form 布局。读取上限仍为 **512 KiB**，不解码或传递图像字节；菜单、快捷键、文稿恢复、隐私及数据保留策略未变。

依据：[CotEditor 7.1.1 `FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift) 与 [`ImageAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/File%20Content%20Attributes/ImageAttributes.swift)。定向 `image-dimensions`、`directory-search`、`menu-coverage` 串行测试 **95/95**；完整串行 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **644/644**；6 个变更 JavaScript 文件 `node --check` **6/6**。`dist/` 与 `release/` 共 119 个非临时文件聚合 SHA-256 改动前后均为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。正式版本仍为 **0.5.16**；仅修改未发行源码、测试和文档，未构建、未打包、未运行 Electron UI smoke，未写入 `dist/` 或 `release/`。Linux Node 测试不验证 AppKit/ImageIO 映射、真实 Electron 布局、原生菜单或辅助技术行为，不声称全量 1:1 parity。


## 2026-10-12 JPEG/JFIF 单分量灰度模型预览（未发行源码）

CotEditor 7.1.1 的 [`ImageAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/File%20Content%20Attributes/ImageAttributes.swift) 从 `NSBitmapImageRep.colorSpace` 取得图像色彩模型，[`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift) 分列显示 Color space 与 Color profile。[JFIF 1.02 规范](https://www.w3.org/Graphics/JPEG/jfif3.pdf)规定 JFIF APP0 紧随 SOI；帧分量数为 1 或 3，三分量标准色空间为 YCbCr，单分量则为 Y。

CotEdit 现在只在 JFIF APP0 完整且位于规范位置、版本为 1.0–1.2、JFIF 缩略图长度一致，并且已读 SOF 为 8-bit、尺寸非零、恰有组件标识符 1 的单分量帧（1×1 采样、量化表索引有效）时报告通用 `Gray` 色彩模型。没有读取或解码压缩像素，不从这一信息推断 profile；显式识别的 EXIF sRGB 仍按原逻辑优先。三分量 JFIF 规范表示 YCbCr，CotEdit 不把它猜作 RGB；非 JFIF、三/四分量、未知 profile、无效/截断头部均不由本新增分支推断。既有文件夹预览最多读取 **512 KiB**，IPC 仍只回传尺寸和白名单标量，图像字节不传给 renderer。菜单、快捷键、文件访问授权、恢复、隐私与数据保留策略未变。

验证：`test/image-dimensions.test.js` + `test/directory-search.test.js` 定向串行 **48/48**；完整 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **646/646**；本轮 3 个 JavaScript 源码/测试文件 `node --check` **3/3**。正式版本仍为 **0.5.16**；仅更新未发行源码、测试和文档，未构建、打包、运行 Electron UI smoke，未写入 `dist/` 或 `release/`。`dist/` 与 `release/` 共 **119** 个非临时文件，本轮前后聚合 SHA-256 均为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。Node 测试不验证 AppKit/ImageIO 对 JPEG 的实际颜色空间映射、Electron 桌面布局、原生菜单或辅助技术行为；这是受限格式元数据近似，不代表跨平台 1:1 parity。


## 2026-10-12 文件夹预览属性的分组标签—值布局（未发行源码）

CotEditor 7.1.1 [`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift) 将图像、音频等属性放在预览区域的独立标签—值行中（例如 Dimensions、Image DPI、Color space、Color profile），而 CotEdit 先前把文件大小、尺寸、色彩与时长拼进同一摘要行。本轮为 CotEdit 文件夹预览加入语义化 `<dl>/<dt>/<dd>` 属性组，样式采用紧凑双列、可滚动布局；标签和值通过 DOM `textContent` 写入，不将文件名、编码或元数据插入 HTML 字符串。

已有信息保持原边界并改为逐项呈现：常规文本显示大小/编码/截断状态；图像显示大小、尺寸、水平 DPI、白名单色彩模型和配置文件；音频及已识别影片显示类型、有效时长及可用尺寸；UNIX 可执行文件和二进制 Property List 显示类型与默认非纯文本预览提示。无效尺寸/时长及未知色彩标签不会生成推测值；只有既有文件夹预览返回的有限标量进入列表，不增加文件读取量、不传输媒体字节。加载/错误提示保留在 `role=status` 区域。无新增菜单或快捷键，也不改变根目录校验、权限、恢复、隐私与数据保留行为。

定向属性/菜单 Node 测试 **55/55**；完整串行 Node 测试 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **652/652**；变更 JavaScript `node --check` **4/4**，PostCSS 样式解析通过。正式版仍为 **0.5.16**；未构建、未打包、未运行 UI smoke。`dist/` 与 `release/` 的 **119** 个非临时文件聚合 SHA-256 前后均为 `c2c04751f78b8c214f5e96925962bbfb8181e40a79fd34749b2bbd77e0949f64`。Node 与静态 CSS/HTML 测试不验证实际 Electron 排版、平台字体换行、键盘操作或 VoiceOver/其他辅助技术；不据此宣称 macOS/Windows 原生 UI 1:1 等价。


## 2026-10-12 文件夹文本预览的通用类型行（未发行源码）

CotEditor 7.1.1 的 [`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift) 在文件信息 `Form` 中总是呈现 `Kind`，并以系统 `UTType.localizedDescription` 取得类型名称。CotEdit 的普通文本预览此前只显示大小、编码和截断状态，没有类型行。

本轮仅为普通解码预览增加“类型：文本”，且要求结果中存在非空 `encoding` 字符串；该字段来自已有 `decodeBuffer()` 成功返回路径。不会按扩展名或内容签名推断具体 MIME/UTType 名称，也不改变其他已识别图像、音频、影片、可执行文件或二进制 plist 的类型行。未知/无编码状态不显示该行。该项只补上通用标签—值信息，仍不实现 CotEditor 的 UTType 本地化、Quick Look 内容预览或原生分组表单。

无新增菜单/快捷键，不增加文件读取或 renderer 数据面，不改变根目录校验、权限、恢复、隐私和数据保留。Linux Node 静态/模块测试只能验证行构造和现有安全数据路径，不证明 Electron 实际排版、系统类型数据库或平台辅助技术等价。正式版本仍为 **0.5.16**；仅修改未发行源码、测试与文档。


验证：`test/folder-preview-attributes.test.js`、`test/menu-coverage.test.js` 与 `test/directory-search.test.js` 定向串行 **80/80**；完整串行 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **653/653**；变更 JavaScript `node --check` **2/2**。`dist/` 与 `release/` 共 **119** 个非临时文件，任务前后聚合 SHA-256 均为 `2d3a24cc19f8482a2466d3e6ad5d1ad7cc1ac67da1a46f0b0433945d3e4ac017`。正式版本仍为 **0.5.16**；未构建、未打包、未运行 Electron UI smoke，未写入 `dist/` 或 `release/`。Node 测试验证的是通用标签行构造和静态兼容边界，不代表原生 macOS UI、Quick Look、UTType 本地化或辅助技术行为等价。


## 2026-10-12 多选区 Toggle Comment 共同缩进（未发行源码）

CotEditor 7.1.1 的 [`String+Commenting.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextEditing/String%2BCommenting.swift) 中，注释例程接受 `selectedRanges` 数组；`.afterIndent(tabWidth:)` 将各范围覆盖的行合并后，以非空行的最小视觉缩进计算分隔符位置。空格计 1 列，Tab 以给定宽度计列；目标列落在 Tab 内时保留 Tab 完整，不在其内部切分。

CotEdit 的 `Toggle Comment` 现不再让多个选区退回 CodeMirror 默认分组算法：先合并所有选区覆盖的唯一行，按当前 Tab Width 计算共同最小视觉列，再通过一个 CodeMirror 事务应用变更并映射回全部选区。混合缩进、空白行、多选区范围以及 Tab 边界均有回归；空白行不会拉低其他选中行的共同缩进，Tab 仍是不可拆分字符。键盘快捷键、原生菜单和可自定义快捷键仍共用这一命令路由；未新增偏好或快捷键。

定向 `editor-commands` 与 `coteditor-menu-parity` 串行 Node 测试 **28/28**；完整 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **657/657**；变更 JavaScript `node --check` **2/2**。正式版本仍为 **0.5.16**；仅修改未发行源码、测试和说明，未构建、未打包、未运行 Electron UI smoke，未写入 `dist/` 或 `release/`。

该改动对齐上游已核实的多范围处理与共同视觉缩进定位，不表示已复制 CotEditor 的全部 Toggle/Comment Out/Uncomment 判断、块注释上下文、Cocoa 文稿模型或原生菜单/无障碍行为；Linux Node 测试不验证真实 macOS/Windows UI 或键盘行为。


## 2026-10-12 Toggle Comment 的动态菜单标题（未发行源码）

CotEditor 7.1.1 的 [`EditorTextView+Commenting.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView%2BCommenting.swift) 在校验 Text 菜单时，会依 `canUncomment(partly: false)` 将 Toggle Comment 项标题切为 `Uncomment` 或 `Comment Out`；其 `String+Commenting.swift` 对选中范围检查注释分隔符。CotEdit 此前始终把原生菜单项显示为“切换注释”。

现由 renderer 复用 Toggle 行注释命令的唯一目标行收集与语法 `commentTokens`，只在所有可操作目标行均已有行注释时上报 `toggleCommentUncommentable`；空行不改变非空行的分支判定，单独空行仍显示注释动作。Electron 主进程将此状态净化为布尔值，菜单在“注释掉”与“取消注释”间更新；正文或选区变化时同步。现有 ⌘/ / Ctrl+/、操作命令、注释分隔符、编辑事务及 Undo/Redo 未改变。

该轮当时只覆盖 CotEdit 的 **Toggle 行注释**标签近似；无行注释语法回退随后在本页后续条目中补充。它未改动独立的 Comment Out/Uncomment 菜单项；当时的 Node 回归覆盖全注释、多选区、空白行、混合注释态、只读状态及 renderer→主进程菜单状态路由；未运行 Electron UI、原生菜单或实体键盘验证，不声称平台 UI/UX 1:1 等价。正式版本仍为 **0.5.16**；本项只修改未发行源码、测试和文档，未构建/打包、未写入 `dist/` 或 `release/`，文稿恢复、隐私与数据保留行为未变。


验证：定向 `editor-commands`、`menu-state` 与 `coteditor-menu-parity` 串行 Node 测试 **51/51**；完整串行 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **660/660**；7 个变更 JavaScript 源码/测试文件 `node --check` **7/7**。`dist/` 与 `release/` 的 **119** 个非临时文件，按相对路径/文件名与逐文件 SHA-256 聚合后的同一命令摘要本轮操作前后均为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`；正式版本仍为 **0.5.16**。只修改未发行源码、测试和文档；未构建、未打包、未运行 UI smoke，未删除文件或清理缓存。


## 2026-10-12 Toggle Comment 在无行注释语法中的块注释回退（未发行源码）

CotEditor 7.1.1 的 [`EditorTextView+Commenting.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView%2BCommenting.swift) 表明，Toggle Comment 在当前选区不能完整取消注释时调用 `commentOut(types: .both, at: ...)`；[`String+Commenting.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextEditing/String%2BCommenting.swift) 明确规定 `.both` 优先使用首个行/inline 分隔符，若不存在则使用首个块分隔符。此为本轮针对“没有行注释符、但有块注释符”的单项差异依据。

CotEdit 的 `toggleCommentAtVisualIndent` 在选中目标行都提供行注释符时，继续使用已有共同视觉缩进算法；若没有任何目标行提供行注释符，则改调 CodeMirror 的 `toggleBlockCommentByLine`，复用语法提供的块分隔符。若两类分隔符都没有，命令不变更文稿。快捷键、原生菜单及可自定义快捷键仍共用该路由。菜单的“注释掉/取消注释”状态在此无行注释分支，通过对隔离的 EditorState 预演块命令，并检查事务净长度变化来判断是否会移除分隔符；预演不会提交或改变实际文稿。

新增 Node 回归覆盖仅块注释语言的连续和不连续选区初次包裹、动态菜单可取消状态、再次切换取消、撤销/重做，以及无任一注释分隔符时的无操作；既有行注释快捷键与多选区行为继续走原有实现。

范围仍然有限：这是 CodeMirror 块注释实现，不等于 CotEditor 的 Foundation 文本范围算法；CotEditor 的 `canUncomment(partly: false)` 先检查块分隔符，即使语言同时有行与块分隔符也可能走块取消分支，CotEdit 本轮没有扩展该情形的完整检测。显式 Comment Out/Uncomment 命令、嵌套块注释与所有部分注释规则未在本轮对齐；未运行 Electron 原生菜单、实体键盘或 macOS UI smoke，也不声称原生桌面 UI/UX 1:1 等价。文稿恢复、隐私与数据保留行为未变。

验证：定向 `editor-commands`、`menu-state` 与 `coteditor-menu-parity` 串行 Node 测试 **52/52**；完整串行 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **661/661**；4 个变更 JavaScript 文件 `node --check` **4/4**。`dist/` 与 `release/` 的 **119** 个非临时文件聚合 SHA-256 与操作前相同，均为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`；正式版本仍为 **0.5.16**。只修改未发行源码、测试和文档；未构建、未打包、未运行 UI smoke，未写入 `dist/` 或 `release/`，未删除文件或清理缓存。


## 2026-10-12 Toggle Comment：双注释语法中的完整块注释优先（未发行源码）

CotEditor 7.1.1 的 [`EditorTextView+Commenting.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView%2BCommenting.swift) 将 Toggle Comment 定义为：`canUncomment(partly: false)` 为真时执行 `uncomment()`，否则按 `.both` 类型注释；[`String+Commenting.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextEditing/String%2BCommenting.swift) 先检查块分隔符，再检查行分隔符。若有任何块分隔符候选，完整可取消状态还要求每个目标范围都能匹配成一对块分隔符；部分匹配不会退回到行注释的取消判断。

CotEdit 现仅在当前语法同时提供行、块分隔符时，为每个选区隔离预演 CodeMirror `blockUncomment`：所有选区都能移除块分隔符时，Toggle Comment 实际执行块取消；若只有部分选区匹配，则菜单仍显示注释动作，命令也沿原 inline comment-out 分支处理全部选区，不会只悄悄拆掉匹配的一部分；完全没有块匹配时继续使用既有行注释判断。预演在独立 `EditorState` 上运行，不派发到文稿。原有键盘、原生菜单消息与可自定义快捷键继续共用 `toggleCommentAtVisualIndent`，没有新增菜单项或默认快捷键。

Node 回归覆盖：同时定义两类分隔符时，包含行注释文本的完整块包裹优先移除外层块；Undo/Redo 往返；多选区只有一个范围被块包裹时，菜单不报告可完整取消且命令改为对所有范围注释。既有无行注释语法的块回退和行注释路径也由原测试继续覆盖。

范围限制：CodeMirror `commentTokens` 在此只暴露首个块分隔符对，`blockUncomment` 的边界匹配不是 CotEditor 的 Foundation 字符串范围算法；多个块注释变体、空光标/部分选中文字边界及所有混合语法情况仍不保证一致。本段记录当时尚未实现 `isNestable` 平衡判断的状态；其后续受限补充见下方“嵌套块注释平衡校验”。本轮未运行 Electron 原生菜单、实体键盘或 macOS/Windows UI smoke，静态路由与 Linux Node 回归不证明桌面 UI/UX 1:1 等价；文稿恢复、隐私、权限与数据保留边界未改变。

验证：`editor-commands`、`menu-state` 与 `coteditor-menu-parity` 定向串行测试 **53/53**；完整串行 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **662/662**；变更 JavaScript `node --check` **2/2**。正式版仍为 **0.5.16**；仅修改未发行源码、测试和文档。未构建、未打包、未运行 Electron UI smoke，未写入 `dist/` 或 `release/`。`dist/` 与 `release/` 共 **119** 个非临时文件，本轮前后聚合 SHA-256 均为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。


## 2026-10-12 独立 Comment Out 菜单命令（未发行源码）

CotEditor 7.1.1 的 [`EditorTextView+Commenting.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView%2BCommenting.swift) 将显式 `commentOut(_:)` 定义为 `commentOut(types: .both, at: .selection)`，与 Toggle Comment 和 Uncomment 分开；[`String+Commenting.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextEditing/String%2BCommenting.swift) 对 `.both` 先选首个 inline delimiter，无此类分隔符时回退到首个 block delimiter。本轮以此为界限清晰的差异，不改变既有 Toggle Comment 路由或快捷键。

CotEdit 在现有“注释”菜单新增无默认快捷键的“注释所选内容”。renderer 先调用 CodeMirror `lineComment`，若当前语法没有可用行注释命令则调用 `blockComment`；若两者均不可用或编辑器只读，则不提交更改。native-menu ID、preload 固定 IPC 白名单、renderer command map 与主进程菜单状态都已连通，菜单仅对打开且可编辑的文稿启用。原有 Toggle Comment、行注释、块注释和取消注释动作保持不变。

Node 回归覆盖 JavaScript 同时提供两类分隔符时的行注释优先、仅块注释语法的回退、无注释分隔符时不改文稿，以及行/块路径的 Undo/Redo；菜单状态覆盖无文稿、可编辑与 Prevent Editing，静态菜单测试覆盖 native menu—preload—renderer 路由。定向 `editor-commands`、`menu-state`、`menu-coverage` 与 `coteditor-menu-parity` 串行 **105/105**；项目 Node 范围 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **665/665**；8 个变更 JavaScript 文件 `node --check` **8/8**。正式版本仍为 **0.5.16**，仅修改未发行源码、测试和文档。

边界：CodeMirror 只提供当前语法暴露的首个行/块注释 token；该 action 没有复制 CotEditor/Foundation 对多个分隔符变体、嵌套注释及原生选区/文稿模型的全部处理。没有为该菜单项新增默认或可配置快捷键；Node 和静态路由测试不验证 Electron 原生菜单渲染、实体键盘或 macOS 辅助技术，不构成桌面 UI/UX 全量 1:1 声明。验证时曾误用裸 `node --test`，意外自动发现并启动独立 `test/electron-ui-smoke.cjs`；该 smoke 在 Quick Actions/文件拖放阶段因目标菜单节点为 `null` 失败，之后未重跑。此偏差已在 README 记录；预期项目范围内的串行 Node 套件全数通过。未构建、未打包，`dist/` 与 `release/` 未写入：119 个非临时文件摘要仍为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。未删除文件或清理缓存，文稿恢复、隐私和数据保留行为未改变。


## 2026-10-12 显式 Uncomment 对空光标的块注释处理（未发行源码）

CotEditor 7.1.1 [`String+Commenting.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextEditing/String%2BCommenting.swift) 的 `uncomment(delimiters:appendsSpacer:in:)` 在块注释检测阶段会将空选区替换为光标所在行的内容范围，并按块分隔符列表优先检测；只有未找到可移除块注释时才检查行注释。CodeMirror `blockUncomment` 对空光标直接调用则不处理该行块包裹。

CotEdit 现仅在所有选择均为空光标时，把各光标所在行内容合并去重，使用临时 EditorState 预演 CodeMirror `blockUncomment`。如果有块分隔符被移除，就在原始文稿上提交同一编辑集，并将原光标位置映射过变更；若没有块匹配，仍先尝试既有 CodeMirror 块取消，再回退行注释取消。多个光标落在同一行时，探测范围只构造一次；菜单仍走现有 `menu:uncomment` 路由，没有新增菜单、快捷键或持久化设置。

Node 回归覆盖空光标处的单行块包裹、跨行多光标、同一行重复目标折叠、光标映射、Undo/Redo，以及空光标对行注释的现有回退。`editor-commands`、`menu-state`、`menu-coverage`、`coteditor-menu-parity` 显式串行定向测试 **107/107**；项目范围 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **667/667**；4 个变更 JavaScript 文件 `node --check` **4/4**。正式版仍为 **0.5.16**，本增量未发行；只修改源码、测试和文档，未构建、打包或运行 UI smoke。`dist/` 与 `release/` 的 **119** 个非临时文件聚合 SHA-256 仍为 `48b70018fe25011cf39f257334fb18c41c5926af225d87c22fe0cf70a752c76b`。

边界：实现只扩展“全部选区均为空光标”的情况；混合空/非空选区沿用原路由，只有 CodeMirror 当前暴露的首个块分隔符可用于探测。多行块包裹、嵌套/多变体注释、原生菜单渲染、实体键盘、macOS/Windows 辅助技术与完整桌面 UI/UX 1:1 行为未由这些 Linux Node 测试证明。未改文稿恢复、权限、隐私或数据保留行为。


## 2026-10-12 显式 Uncomment：混合空/非空选区的块注释检测（未发行源码）

CotEditor 7.1.1 [`String+Commenting.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextEditing/String%2BCommenting.swift) 的 `uncomment(delimiters:appendsSpacer:in:)` 对每个空选区用光标所在行内容范围替代，对非空选区保留原范围，去重后先检查块注释分隔符，再检查行注释分隔符。此前 CotEdit 只在全部选区为空时扩展块注释探测，混合空/非空选择无法让空光标所在行参与该优先检测。

CotEdit 现只要选择集中含空光标，就为每个空光标生成所在行的内容范围，保留非空范围并合并完全重复的目标；在临时 CodeMirror `EditorState` 上预演 `blockUncomment`。若事务移除了分隔符，则在原文稿单次提交这些更改，并映射原始选择；若没有块注释命中，仍执行原有块取消及行注释取消路径。没有增加菜单、快捷键、偏好或持久化数据。

回归覆盖跨行混合选择中两个匹配块包裹与一个未匹配文本范围、原选择映射、Undo/Redo，以及没有块包裹时混合空/非空选区回退到行注释。显式定向 `editor-commands`、`menu-state`、`menu-coverage`、`coteditor-menu-parity` 测试 **109/109**；项目显式 Node 范围 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **669/669**；变更 JavaScript `node --check` **2/2**。正式版本仍为 **0.5.16**，本增量未发行；只修改未发行源码、测试和文档。

边界：实现仍使用 CodeMirror 当前语法暴露的首个块注释 token 和 `blockUncomment` 匹配规则，不复制 CotEditor/Foundation 对多个分隔符变体、嵌套注释、复杂重叠目标及全部文本范围的语义。Node 测试不证明 Electron 原生菜单、实体键盘、macOS/Windows 桌面布局或辅助技术 1:1 等价。未构建、未打包、未运行 UI smoke；`dist/` 与 `release/` 的 **119** 个非临时文件按相对路径与逐文件 SHA-256 汇总仍为 `54ee6bbd69b23393e9fe697fc2829f30b1e604461d2ae3ae322ef663a48eb6c9`（改动前后相同）。文稿恢复、权限、隐私与数据保留行为未改变。

## 2026-10-12 显式 Uncomment：尝试有序的多个块注释变体（未发行源码）

CotEditor 7.1.1 [`String+Commenting.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextEditing/String%2BCommenting.swift) 在 `uncomment` 与 `canUncomment` 中按 `blockDelimiters` 的声明顺序逐对尝试；官方 `CommentDelimiters` 将块注释建模为数组。CotEdit 导入的自定义语法本就保留多个 `comments.blocks`，但先前只将首对写入 CodeMirror 的 `commentTokens`，显式取消注释因此无法识别后续对。

现有 CodeMirror `commentTokens.block` 仍只保留首对，以免改变其他既有命令的插入语义；自定义语法另在 `coteditCommentTokens.blocks` 暴露全部有效分隔符对及顺序。显式 Uncomment 先维持已有首对命令路径，若未命中，再对后续分隔符对依序构造隔离的 language-data 状态并预演 `blockUncomment`；含空光标时，预演选择仍先将光标扩展到所在行内容，并保留原有选择映射与行注释回退。第一个产生编辑的分隔符对即提交；一次操作不混合拆除不同块注释变体。

回归验证覆盖：完整有序元数据与首对兼容；空光标行、非空选择和未匹配选择混合时后续变体命中；声明顺序决定部分命中只拆除哪一组；选择数及 Undo/Redo。此范围只扩展自定义语法上的显式 Uncomment，不改变 Comment Out 插入策略、Toggle Comment 变体检测、内置 CodeMirror 语言的数据来源或嵌套平衡算法。结构化节点语言、不同语法作用域相互交叠以及 CotEditor Foundation 字符串范围的全部语义仍未验证。

验证：定向 `editor-commands`、`cot-syntax-mode`、`menu-state`、`menu-coverage` 与 `coteditor-menu-parity` 串行 Node 测试 **128/128**；完整显式 Node 范围 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **671/671**；4 个变更 JavaScript 源码/测试文件 `node --check` **4/4**。正式版本仍为 **0.5.16**，只修改未发行源码、测试与文档；未构建、未打包、未运行 UI smoke。`dist/` 与 `release/` 的 **119** 个非临时文件前后聚合 SHA-256 均为 `48b70018fe25011cf39f257334fb18c41c5926af225d87c22fe0cf70a752c76b`。Linux Node 测试不证明原生菜单、实体键盘或 macOS/Windows UI/UX 1:1 等价；未改文稿恢复、权限、隐私和数据保留行为。


## 2026-10-12 Toggle Comment：尝试有序的多个块注释变体（未发行源码）

CotEditor 7.1.1 的 [`String+Commenting.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextEditing/String%2BCommenting.swift) 按块分隔符声明顺序执行 `canUncomment(partly: false)`；首个有任一命中的变体决定完整性检查，所有目标范围均可取消时 Toggle 才进入 `uncomment()`。[`EditorTextView+Commenting.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView%2BCommenting.swift) 确认其余情况按 `.both` 执行注释。此前 CotEdit 的 Toggle 状态预演与实际取消只使用 CodeMirror 的首个 `commentTokens.block`，即使已导入的自定义语法声明了后续块注释变体，也无法识别它们。

现在 Toggle 的隔离预演按 `coteditCommentTokens.blocks` 声明顺序检查所有变体；第一个对至少一个选区产生变化的变体即决定状态。只有该变体能覆盖所有选区时才报告“取消注释”，执行时也使用同一分隔符对；若只部分命中，不会跳到后续变体或只取消部分范围，而是让全部范围进入原有注释分支。菜单动态标题继续复用相同状态辅助函数。此范围仅修正自定义语法中同时提供行与块注释时的 Toggle 取消路径；注释插入仍用 CodeMirror 首选分隔符，空光标 Toggle、仅块语法回退、嵌套块平衡及结构化语法作用域不在本次扩展范围。

回归覆盖首个可用变体命中且包含嵌套的后续变体、菜单可取消状态、同一变体对多选区部分命中的统一注释分支，以及 Undo/Redo。验证：定向 `editor-commands`、`menu-state`、`menu-coverage`、`coteditor-menu-parity` 与 `cot-syntax-mode` 显式串行测试 **130/130**；完整显式 Node 测试集 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **673/673**；变更 JavaScript `node --check` **2/2**。正式版本仍为 **0.5.16**；只修改未发行源码、测试与文档，不构建、打包或运行 UI smoke。`dist/` 4 个文件摘要为 `10b69b5f8fefe4a60f5671228fa745f053a81c7428a40ffa805e23f7710424b0`，`release/` 115 个文件摘要为 `0074a45a6745e150ccc71a511177c13654f46df6be8c88a2c0424c81e3dcffa4`，与修改前相同。Linux Node 测试不证明原生菜单、实体键盘或 macOS/Windows UI/UX 1:1 等价；未改变文稿恢复、权限、隐私或数据保留边界。


## 2026-10-12 Toggle Comment：空光标所在行的块注释检测（未发行源码）

CotEditor 7.1.1 的 [`String+Commenting.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextEditing/String%2BCommenting.swift) 在 `canUncomment(partly: false)` 中先把选择范围映射为行内容范围；实际 `uncomment` 也会把空选区扩展到光标所在行，再按块分隔符顺序检查。因此在同时定义行、块注释的语法中，块注释包裹行内的空光标可触发 Toggle Comment 取消分支。此前 CotEdit 的块注释预演直接使用零宽光标范围，不能识别这种包裹，菜单预测与执行都可能停留在注释分支。

CotEdit 现为 Toggle 的块取消预演将空光标映射到所在行内容，并合并重复目标；若首个命中变体覆盖所有目标，菜单状态与实际取消共用该预演范围，最终仍把原始光标映射过编辑。若只有部分目标命中，则维持原行为：不局部拆除块注释，全部目标进入注释分支。非空选择的既有处理、块变体声明顺序及插入分隔符策略不变；本项不扩展仅块注释语法回退、嵌套平衡或结构化语法作用域。

回归覆盖多个空光标、同一行重复目标折叠、菜单可取消状态、块注释完全命中与部分命中的分支，以及编辑后的光标保留和 Undo/Redo。依据 [CotEditor 7.1.1 `canUncomment` / `uncomment` 源码](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextEditing/String%2BCommenting.swift) 与 [编辑器 Toggle 路由](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView%2BCommenting.swift)。这只是所述选择范围行为的跨平台近似，不声明 Foundation、Cocoa 原生菜单或 macOS/Windows UI/UX 1:1 等价；Node 测试不验证实体键盘或原生辅助技术。正式版仍为 **0.5.16**；仅修改未发行源码、测试与文档，不构建、打包或运行 UI smoke，也不更改恢复、隐私或数据保留行为。


验证：定向 `editor-commands`、`menu-state`、`menu-coverage`、`coteditor-menu-parity` 显式串行 Node 测试 **114/114**；完整显式范围 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **675/675**；变更 JavaScript `node --check` **2/2**。正式版本仍为 **0.5.16**，只改未发行源码、测试与文档；未构建、未打包、未运行 UI smoke。`dist/` 4 个文件、`release/` 115 个文件的逐文件 SHA-256 清单改动前后逐项相同，清单摘要为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。


## 2026-10-12 嵌套块注释平衡校验（未发行源码）

CotEditor 7.1.1 [`String+Commenting.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextEditing/String%2BCommenting.swift) 在 `rangesOfBlockDelimiters` 命中候选包装后，若其 `BlockCommentDelimiter.isNestable` 为真且 begin/end 不同，会扫描外层分隔符之间的内部文本：任何未配对结束符使候选无效，结束时仍有未闭合开始符也使候选无效。CotEditor 的 `uncomment` 与 `canUncomment` 共用该判断。CotEdit 的 `.cotsyntax` 导入层此前已经保留 `isNestable`，但语言数据构造时丢弃了此标记，注释命令便会把最末端的内层结束符误当作所选外层结束符。

现将该标记透传到首个 CodeMirror 块注释 token 和完整有序的 `coteditCommentTokens.blocks`。对明确标为 `isNestable` 的自定义语法块候选，取消注释预演逐选区取得将被删去的开/闭分隔符，再按 CotEditor 的原始出现顺序规则校验内部嵌套计数；只有平衡的候选才提交。显式“取消注释”与同时定义行/块分隔符的 Toggle Comment 共用安全预演。无标记分隔符维持原行为；相同 begin/end 也按 CotEditor 的规则跳过 nestable 平衡扫描。Toggle 的仅块注释回退仍沿用 CodeMirror `toggleBlockCommentByLine`，本轮不把验证扩展到该路径。

回归覆盖：导入与语言数据均保留 `isNestable`；平衡外层/内层组合可只移除所选外层包装；未闭合内层开始符的 Toggle 菜单预测保持“注释”分支且不会误删内层结束符；显式取消注释对不平衡候选不产生编辑，并仍可移除平衡候选。依据 [CotEditor 7.1.1 `String+Commenting.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextEditing/String%2BCommenting.swift) 的 `rangesOfBlockDelimiters` / `isValidNestableBlock` 实现与[编辑器 Toggle 路由](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView%2BCommenting.swift)。定向 `editor-commands`、`cot-syntax-mode` 与 `cot-syntax` 显式串行 Node 测试 **50/50**；完整显式范围 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **678/678**；变更 JavaScript `node --check` **5/5**。正式版本仍为 **0.5.16**；仅修改未发行源码、测试和文档，未构建、打包或运行 UI smoke。此近似只计数声明的块分隔符，不解析字符串、转义上下文、语言语法树或 Foundation 字符范围语义；仅块注释 Toggle 回退、原生菜单、实体键盘和 macOS/Windows UI/UX 仍未验证。文稿恢复、权限、隐私与数据保留行为未改变。


## 2026-10-12 自定义语法的多组行注释符（未发行源码）

CotEditor 7.1.1 [`String+Commenting.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextEditing/String%2BCommenting.swift) 的 `CommentDelimiters` 暴露有序 `inlineDelimiters`；显式 `uncomment` 在块候选未命中后按顺序尝试每个行分隔符，`canUncomment(partly: false)` 也按声明顺序判断，第一个有匹配的候选决定完整/部分状态。插入注释仍只选择第一个行分隔符。此前 CotEdit `.cotsyntax` 仅把首个 `comments.inline` 映射到 CodeMirror `commentTokens.line`，后续候选不参与取消检测。

CotEdit 现在还将有序候选写入私有 `coteditCommentTokens.inlines`，保留 `commentTokens.line` 的首选值以兼容现有 CodeMirror 命令。Toggle Comment 的状态预演和编辑按候选顺序检查：首个出现命中的候选决定是否所有目标行均可取消；部分命中时仍走原注释分支，不跳到后续候选。显式“取消注释”保留块候选优先级，先尝试 CodeMirror 首选行分隔符，仅在未命中时隔离预演其余候选。行注释插入、独立“行注释”命令、快捷键和 IPC 路由均未改变；Toggle 的键盘、菜单与自定义快捷键继续共享既有命令，菜单标题仍由同一状态辅助函数驱动。

回归覆盖：有序候选透传；仅由后续行分隔符包裹时的 Toggle 菜单预测、取消及 Undo/Redo；显式空光标取消后续候选及 Undo/Redo；多选区中首个候选部分命中优先、统一注释及 Undo/Redo。CotEditor 上游依据为 [7.1.1 `String+Commenting.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextEditing/String%2BCommenting.swift)。定向 `editor-commands`、`cot-syntax-mode`、`menu-state`、`menu-coverage`、`coteditor-menu-parity` 显式串行 Node 测试 **137/137**；完整显式项目范围 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **680/680**；本轮 4 个 JavaScript 源码/测试文件 `node --check` **4/4**。正式版本仍为 **0.5.16**；只修改未发行源码、测试和文档，未构建、打包或运行 UI smoke；`dist/` 与 `release/` 119 个非临时文件摘要与本轮修改前一致。此为 `.cotsyntax` 列表的受限跨平台近似，不解析字符串/转义或结构化语言作用域，不证明 Foundation/Cocoa 原生菜单、实体键盘及 macOS/Windows UI/UX 1:1 等价。文稿恢复、权限、隐私及数据保留边界未改变。


## 2026-10-12 双击选择成对符号内文（未发行源码）

CotEditor 7.1.1 [`EditorTextView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView.swift) 覆盖 TextKit 的 `.selectByWord` 选区解析：双击位置位于配对引号或符号内时，优先返回匹配对之间的内文范围；原生实现还会依据语法作用域识别自定义引号规则。CotEdit 先前完全采用 CodeMirror `groupAt` 的双击选词行为，因此引号或括号内双击只选单词，而不是配对内文。

现接入 CodeMirror 双击事件，仅在未按修饰键的主键双击、且光标位于可识别的平衡内建引号/括号内时，选中最内层配对内文；普通文本、未配对符号、其他鼠标键及 Shift/Option/Ctrl/Command 双击仍由既有行为处理。尖括号 `<>` 也加入现有成对符号查找，贴合 CotEditor 默认 `SymbolPair.braces + [.ltgt]`；竖排文本继续由项目现有坐标转换处理。此为源码级跨平台近似，不导入 CotEditor 自定义语法引号配置，也不声明 AppKit 双击选区、辅助技术或拖动/原生鼠标行为逐项一致。

回归覆盖最内层引号/括号和尖括号内文、普通/不平衡文本回退、修饰键与非法坐标，以及 helper 已接入 renderer 双击 handler。上游依据为 CotEditor 7.1.1 [`EditorTextView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView.swift)。Node 测试只验证选区算法与源码路由，未运行 Electron UI smoke；本轮不构建或打包，正式版本仍为 **0.5.16**，也未改动恢复、隐私或数据保留行为。


## 2026-10-12 自定义语法引号分隔符的双击选择（未发行源码）

CotEditor 7.1.1 [`EditorTextView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView.swift) 会依据当前 syntax-highlighted token 处理双击，并用语法的 quote delimiters 构造配对规则；[`QuotePairRule.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/StringUtils/Pair/QuotePairRule.swift) 将每端恰为一个 `Character` 的分隔符与 `escapeCharacter`、`prefixes` 一起匹配，前缀不符的规则不参与。官方 [Python `Edit.json`](https://raw.githubusercontent.com/coteditor/CotEditor/7.1.1/CotEditor/Resources/Syntaxes/Python.cotsyntax/Edit.json) 明确包含普通/原始字符串的转义设置、前缀变体及三引号分隔符。CotEdit 此前的 `.cotsyntax` 导入虽保留分隔符与转义字符，却丢弃 `prefixes`，且双击选区只查看内建引号/括号。

现将导入字符串/字符分隔符的前缀列表在有界去重、按长度排序后保留；自定义语法模式把端点与转义字符各为一个 Unicode 标量的规则作为 CodeMirror language data 暴露。双击仅在 CodeMirror 当前 syntax tree 的 `string`/`character` Token 上、且光标位置处于该 Token 的开头或结尾引号分隔符时应用规则，选中完整 Token（包含分隔符）；闭合范围来自当前语法解析结果，故语法已识别的转义关闭符留在 Token 内。只含前缀限制且前缀不匹配时，不回退到无条件的内建引号配对。字符串内容区域的既有双击选择路径、普通文本、未匹配分隔符和修饰键路径不作扩大。

回归覆盖非内建 `«…»` 分隔符、转义关闭符、单字符与自定义前缀匹配、标准双引号前缀不匹配时禁止通用规则绕过，以及字符串内容点击回退；模式测试覆盖字符串/字符规则合并和多字符端点排除。证据为上述 CotEditor 7.1.1 源码及 Python 语法包。定向 `cot-syntax`、`cot-syntax-mode`、`double-click-selection` 显式串行 Node 测试 **36/36**；完整显式项目范围 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **689/689**；6 个变更 JavaScript 源码/测试文件 `node --check` **6/6**。正式版本仍为 **0.5.16**；只修改未发行源码、测试与文档，未构建、打包或运行 UI smoke；`dist/` 与 `release/` 共 119 个非临时文件摘要在改动前后相同，聚合 SHA-256 为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。

差异范围仅覆盖端点各一个 Unicode 标量的自定义引号；多字符端点（包括官方三引号字符串）与一个 Swift `Character` 中由多个 Unicode 标量组成的字素未接入此选区处理。Escape 语义依赖 CotEdit 现有 CodeMirror 语法扫描器，不证明与 Foundation 对所有转义/嵌套语法完全相同。测试验证 Node 侧算法和 CodeMirror 语法树，不验证 macOS AppKit 选区、Windows/Linux 原生桌面点击、辅助技术、菜单、快捷键或视觉布局逐项等价；本轮未改变文稿恢复、权限、隐私或数据保留行为。

## 2026-10-12 自定义语法引号的单字素簇端点（未发行源码）

CotEditor 7.1.1 [`SymbolPair.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/StringUtils/Pair/SymbolPair.swift) 将 `SymbolPair` 定义为 `Pair<Character>`；[`QuotePairRule.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/StringUtils/Pair/QuotePairRule.swift) 的 `escapeCharacter` 也为 Swift `Character`。因此，上游的一个引号端点或转义符可以由多个 Unicode 标量组成，只要它是一个扩展字素簇。CotEdit 上一增量把它们限制为一个标量，遗漏了组合附加符与 emoji ZWJ 字素。

现新增共享 `isSingleGrapheme` 判定，以 `Intl.Segmenter('und', { granularity: 'grapheme' })` 对 `.cotsyntax` 自定义引号端点及转义符作单个扩展字素簇检查；缺少 `Intl.Segmenter` 的运行时保留既有单码点规则，不尝试猜测多码点组合。双击命中可落在开/闭分隔符的任一 UTF-16 码元位置，并仍只选择当前语法树的完整 string/character Token。每端由多个字素组成的字符串（例如 Python `"""`）仍不参与这一 `QuotePairRule` 式双击分支；这没有改变语法着色器的多字符分隔符扫描，也不声称复刻 CotEditor 的语法解析器。

回归覆盖分解重音字素、带肤色修饰符的 ZWJ emoji、字素转义符、分隔符内部位置及多字素端点拒绝。定向 `cot-syntax.test.js`、`cot-syntax-mode.test.js`、`double-click-selection.test.js` 显式串行 Node 测试 **37/37**；完整显式项目范围 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **690/690**；本轮 5 个 JavaScript 源码/测试文件 `node --check` **5/5**。正式版本仍为 **0.5.16**，本增量未发行；只改源码、测试与文档，未构建、打包或运行 UI smoke。`dist/` 与 `release/` 的 **119** 个非临时文件修改前后摘要均为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。

`Intl.Segmenter` 使用当前 JavaScript/ICU 的字素边界版本，不保证与 Swift/Foundation 在所有 Unicode 版本、格式字符和异常序列上完全相同。Node/Linux 回归不验证 macOS AppKit 的实际双击命中、Windows/Linux 桌面鼠标映射、辅助技术或原生 UI/UX；不构成全量 1:1 parity。未修改菜单、快捷键、文稿恢复、权限、隐私或数据保留策略。


## 2026-10-12 Python 三引号语法 Token 双击（未发行源码）

CotEditor 7.1.1 的 [`EditorTextView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView.swift) 在双击字符处于语法高亮范围首尾引号时直接返回该语法范围；官方 [Python `Edit.json`](https://raw.githubusercontent.com/coteditor/CotEditor/7.1.1/CotEditor/Resources/Syntaxes/Python.cotsyntax/Edit.json) 将单引号规则列在三引号规则之前。此前 CotEdit 只把单个字素簇端点用于这项双击处理，且按声明顺序扫描重叠分隔符，故未能把 Python `"""…"""` / `'''…'''` 作为一个完整 Token 选中。

现将自定义字符串/字符界定符按开符长度稳定地长者优先扫描；双击规则只额外接纳 ASCII `"""` 与 `'''` 这两种精确三引号端点，并优先于同一语法中的单引号候选。单行 `string`/`character` Token 在开引号首字符或闭引号末字符双击时选中完整 Token；前缀不匹配时不回退到更短的单引号规则。普通单字素（包括组合符、ZWJ emoji）路径和任意其他多字素分隔符限制保持不变。最长优先扫描也使官方 Python 定义的短/长引号重叠可在语法扫描中正确选择三引号规则。

回归覆盖官方声明顺序下的单行与跨行三引号 tokenization、三引号 Token 首尾选择、非端点回退及前缀拒绝。定向 `cot-syntax-mode.test.js`、`double-click-selection.test.js`、`cot-syntax.test.js` 显式串行 Node 测试 **39/39**；完整显式项目范围 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **692/692**；变更的 JavaScript 源码/测试 `node --check` **4/4**。正式版仍为 **0.5.16**；仅修改源码、测试与文档，未构建、打包或运行 UI smoke。`dist/` 与 `release/` **119** 个非临时文件摘要保持 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。

此增量只扩展精确 Python 三引号分隔符；任意其他多字素分隔符仍不参与双击 Token 选择。CodeMirror 将跨行语法树范围按行分段，跨行三引号只验证高亮覆盖，双击仍不能证明会选择整个多行字符串；这是 Node/Linux 语法与选区测试，不验证 macOS AppKit、Windows/Linux 实际鼠标/键盘、菜单、辅助技术或桌面 UI/UX 逐项等价。未改变快捷键、菜单、恢复、权限、隐私或数据保留行为。


## 2026-10-12 内置语法引号边界双击选择（未发行源码）

CotEditor 7.1.1 [`EditorTextView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView.swift) 的 `selectionRange(forProposedRange:granularity:)` 在 `.selectByWord` 路径中，对双引号、单引号和反引号检查当前语法高亮范围；若点击字符正是该范围首尾的匹配引号，就返回整个语法范围。CotEdit 上一轮的整 Token 选择只依赖自定义 `.cotsyntax` 的 `coteditQuotePairs`；对于 CodeMirror 内置语言提供的字符串节点，双击引号边界仍落回默认选区。

现对没有自定义 quote-pair 规则的内置解析器增加有限回退：当 CodeMirror 当前 `string`/`character` 节点的源文本以同一个 ASCII `"`、`'` 或 `` ` `` 开始并结束，且双击位置恰为节点首/末 UTF-16 位置时，选择完整节点（含引号）。JavaScript 普通字符串、模板字符串及 Python 普通字符串有定向回归；双击内容仍走原配对内文路径。只要当前语法暴露自定义引号规则，就继续由已有自定义规则处理，尤其不会绕过 `prefixes` 不匹配的拒绝结果。


定向 `double-click-selection.test.js` 显式 Node 测试 **12/12**；完整显式项目范围 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **694/694**；变更源码/测试 `node --check` **2/2**。正式版本仍为 **0.5.16**；仅修改未发行源码、测试和文档，未构建、打包或运行 UI smoke。`dist/` 与 `release/` 的 **119** 个非临时文件摘要仍为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。此近似只覆盖已测的 JavaScript/Python 解析节点与 ASCII 引号边界；带前缀或跨行 Token 的节点范围、其他 CodeMirror 语言节点命名及实际鼠标命中仍需分别验证，不证明 macOS AppKit、Windows/Linux 原生桌面交互、菜单/快捷键或视觉 UI/UX 逐项等价。未改动菜单、快捷键、文稿恢复、权限、隐私或数据保留策略。

## 2026-10-12 双击配对搜索的有界窗口（未发行源码）

CotEditor 7.1.1 [`EditorTextView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView.swift) 的 `selectionRange(forProposedRange:granularity:)` 在搜索引号对和括号对前，以点击字符的 `wordRange` 为基点设置 `searchMargin = 50_000`，把搜索范围限制在局部，并扩展至 composed-character 边界；注释明确说明此举是为避免在大文稿中扫描全文。CotEdit 此前在双击配对回退中调用 `doc.toString()`，再由 `findEnclosingSymbolRange` 遍历整篇文稿。

现新增 `findEnclosingSymbolRangeNearPosition`：CodeMirror 文稿存在 `sliceString` 时仅读取 `[max(0, position - 50_000), min(doc.length, position + 50_001))`，在局部坐标运行原配对算法，再将命中范围加回全局 UTF-16 偏移。自定义 `.cotsyntax` 引号规则和内置语法 Token 的既有优先分支没有改变；只限制其后的配对引号/括号回退搜索，没有新增菜单、快捷键、设置或持久化字段，也不改变恢复、权限、隐私和数据保留行为。

回归覆盖：对 CodeMirror 式 `sliceString` 文稿断言实际读取不超过 100,001 个 UTF-16 单元且没有调用全文 `toString()`；大文稿中窗口内的局部括号仍可选中并映射回正确全文偏移；如果唯一配对符号落在 ±50,000 单元窗口外，则保留默认双击选择。定向 `double-click-selection` 与 `text-tools` 显式串行测试 **44/44**；完整项目显式 Node 集 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **697/697**；变更的 JavaScript 源码/测试 `node --check` **2/2**。正式版仍为 **0.5.16**，本增量未发行；`dist/` 4 个文件与 `release/` 115 个文件的逐文件聚合摘要前后相同，共 119 个非临时文件，SHA-256 为 `d628dc2523507d68b22ea7833e3d350fc9ab09101dc6f33f94d6e530a994d7d1`。未构建、未打包、未运行 Electron UI smoke，未删除文件或清理缓存。

边界：CotEdit 直接以 UTF-16 偏移截取，不像 CotEditor 那样将窗口扩展到 composed-character 边界；截点若位于扩展字素簇中，极端 Unicode 序列的配对搜索范围可能有差异。仅双击配对回退扫描受限，前置的 CodeMirror 语法树就绪/Token 查找并未因此获得同一预算。Node 测试证明局部切片和索引映射，不证明真实 Electron 鼠标命中、macOS AppKit、Windows/Linux 原生 UI、辅助技术或桌面 UI/UX 1:1 等价。


## 2026-10-12 双击配对搜索窗口的组合字素边界（未发行源码）
CotEditor 7.1.1 [`EditorTextView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView.swift) 先以点击字符范围为中心建立 ±50,000 的 UTF-16 搜索区间，再通过 `NSString.rangeOfComposedCharacterSequences(for:)` 将搜索区间扩展至完整组合字符序列。CotEdit 上一轮已把配对符号回退扫描限制在同样的约 ±50,000 UTF-16 区域，但直接切片；若原始窗口边缘落在扩展字素簇内部，局部配对解析可能从字素中间开始或结束。

现以运行时 `Intl.Segmenter('und', { granularity: 'grapheme' })` 检查原始窗口的左右边界；只有边界被字素簇切开时，才将实际配对搜索范围外扩至该簇边界。为保持资源上限，边界探测每侧最多带入 **4,096 UTF-16 单元**，最大 CodeMirror `sliceString` 请求为 **108,193 UTF-16 单元**（100,001 原始窗口 + 两侧各 4,096）；这部分额外上下文只用于确认并扩展边界，不计入配对搜索范围。若采样上下文仍从簇中间开始/结束，因无法确认完整边界则返回无匹配，让 CodeMirror 默认选择继续生效；不对超预算长簇作猜测。没有 `Intl.Segmenter` 的运行时保留原始有界搜索路径。自定义 `.cotsyntax` 与内置语法 Token 优先级没有改变，亦未修改菜单、快捷键或文稿持久化/恢复/权限/隐私设置。

回归覆盖：普通窗口仍恢复正确全文偏移且搜索距离不变；左边界跨越“`[` + combining mark”时纳入完整字素并命中；右边界落在“`]` + combining mark”内部时扩展到完整字素；超过边界探测预算的长字素使配对回退安全退出；单次切片最大长度不超过 **108,193**。依据为 [CotEditor 7.1.1 `EditorTextView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView.swift) 中 `searchMargin` 与 `rangeOfComposedCharacterSequences` 的上游实现。

验证：`test/double-click-selection.test.js` 显式串行 Node **18/18**；项目显式测试 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **700/700**；变更 JavaScript `node --check` **2/2**。正式版仍为 **0.5.16**；仅修改源码、测试、README 与本记录，未构建、未打包、未运行 Electron UI smoke。`dist/` **4** 个非临时文件的逐文件 SHA-256 聚合为 `b8bc2ac67884de18bc6dd06b57e6ce220a3d46db9e12608e0b9017be5de107a2`，`release/` **115** 个非临时文件的逐文件 SHA-256 聚合为 `88b212005a3e49ea61b19359f9cde3e8805b41266d6fdaa958b85f41995695e4`；本轮开始检查点与结束复核一致。Linux Node 测试不验证 `Intl.Segmenter` 对每个 Unicode 数据版本与 Swift/Foundation `Character` 的完全一致性，也不验证 Electron 实际鼠标命中、原生菜单、物理键盘或 macOS/Windows 桌面 UI/UX 1:1 等价。未删除文件、未清理缓存，恢复、权限、隐私与数据保留边界未变。


## 2026-10-12 Linux 外部编辑器菜单列出已注册应用（未发行源码）

CotEditor 7.1.1 [`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift) 的 `OpenWithExternalEditorMenu` 通过 `NSWorkspace.shared.urlsForApplications(toOpen:)` 查询适用于当前预览文稿的应用；默认编辑器在前，其余按本地化显示名排序，重名应用在有版本信息时附加版本号，最后保留 `Other…`。CotEdit 之前只有系统默认打开与“其他应用…”两项。

现仅在 Linux 文件预览菜单展开时，通过 GIO 对已经由当前窗口选定根目录校验的文件查询 content type 与已注册 `.desktop` ID。主进程按 XDG 数据目录优先级、有限递归深度与条目数量读取桌面元数据；隐藏/不显示条目不展示，名称按 Electron 当前 locale 选择，默认 handler 置顶，其余使用 `Intl.Collator` 排序；同名的其他应用仅在条目含版本号时附版本。菜单沿用既有系统默认按钮和“其他应用…”文件选择器。点击注册应用时 IPC 只传文件路径与 desktop ID；主进程重新解析所选文稿、重查该 MIME 类型的注册列表并确认 ID 仍在，然后以固定参数数组、`shell:false` 调用 `gio launch`，不将命令字符串交给 renderer。

资源界限：应用登记扫描最多 15,000 个目录项、目录深度最多 5；单个 `.desktop` 文件最多 128 KiB，显示名最多 160 字符、版本最多 80 字符，每次展示最多 64 个已注册应用；桌面条目路径索引只在主进程内缓存 60 秒。GIO 不可用、无法识别 MIME 或没有可解析条目时静默退回原有“默认应用／其他应用…”菜单。macOS/Windows 未实现注册应用枚举，仍使用原有菜单；本项也未复刻 CotEditor 的应用图标、AppKit/Launch Services 行为、版本信息可用性或 SwiftUI 菜单样式。

`test/linux-external-applications.test.js` 定向 Node 测试 **11/11**；完整显式项目 Node 测试 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **711/711**；5 个变更 JavaScript 文件 `node --check` **5/5**，CSS PostCSS 解析通过，HTML **411** 个 ID 唯一。另在当前 Linux 环境检查了 `gio info`、`gio mime` 与 `gio help launch` 的实际 CLI 接口；没有实际启动桌面应用或运行 Electron UI smoke。正式版本仍为 **0.5.16**；仅改未发行源码、测试与文档，未构建、打包或改写 `dist/`、`release/`。Node/mock 测试不证明不同 Linux 桌面环境的 GIO handler 发现、真实 app 启动、焦点/读屏器体验等价；macOS/Windows 原生行为未验证。未修改快捷键、文稿恢复、权限、隐私或数据保留策略。


本轮发布目录复核：`dist/` 4 个非临时文件的逐相对路径/逐文件 SHA-256 聚合为 `b8bc2ac67884de18bc6dd06b57e6ce220a3d46db9e12608e0b9017be5de107a2`；`release/` 115 个非临时文件聚合为 `88b212005a3e49ea61b19359f9cde3e8805b41266d6fdaa958b85f41995695e4`，与本轮开始时已记录检查点一致。聚合包含相对路径与每个文件 SHA-256；未修改任何发布目录文件。


## 2026-10-12 新文稿默认语法与新建文件扩展名（未发行源码）

CotEditor 7.1.1 的 [`DefaultSettings.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift) 将默认语法样式设为 `Plain Text`；[`DirectoryDocument.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document/DirectoryDocument.swift) 为文件夹浏览器中新建文稿读取当前默认语法的文件映射，并优先采用其声明的第一个扩展名。这个设置影响新建流程，而不是改写已打开文稿的识别结果。

CotEdit 新增持久化 `defaultSyntax` 偏好，默认 `plaintext`，在设置面板中提供按本地化名称排序的内置 CodeMirror 语法及已导入 `.cotsyntax`。选择后的默认语法用于之后的新未保存文稿（`未命名-n.<首个扩展名>` 和对应语法模式），以及文件夹浏览器“新建文件”；新建文件夹仍不读取语法偏好。扩展名遵循语法声明顺序，取第一个符合安全字符规则的扩展名；缺失、无效映射回退 `txt`。文件创建依旧由主进程执行：复核当前授权根目录，拒绝越界路径，使用排他创建避免覆盖，并只接受 `[A-Za-z0-9_+-]`、最多 32 字符的扩展名。设置偏好同时纳入现有设置文件导入/导出。若导入的偏好引用尚未安装的自定义语法，设置控件会显示“未安装语法”，实际新建暂回退到纯文本；安装该 `.cotsyntax` 后可直接生效。

验证：`test/default-syntax.test.js`、`test/settings.test.js`、`test/settings-file.test.js`、`test/directory-mutations.test.js`、`test/menu-coverage.test.js` 定向测试 **101/101**；串行运行显式列出的 76 个 `test/*.test.js` 文件 **719/719**；本轮变更的 JavaScript 源码与测试 `node --check` **10/10**；`index.html` 的 **412** 个 ID 均唯一。正式版仍为 **0.5.16**；仅修改未发行源码、测试和文档，未构建、打包、启动 Electron 或运行 UI smoke；未改写 `dist/` / `release/`，也未触碰文稿恢复、权限、隐私或数据保留策略。Node 与静态测试不验证真实设置面板、保存对话框、桌面菜单、键盘/读屏器、macOS/Windows 原生行为。

**仍有差异：**设置控件位于 CotEdit 自有编辑器设置面板，而不是 CotEditor 原生 Format 偏好页；可选清单仅包含当前 CotEdit 支持的内置语法及用户已导入语法，语法定义、扩展名注册顺序与上游不保证完全相同；CotEdit 新未保存文稿使用本项目的中文编号基名，而目录新文件名仍由系统 locale 映射。实现只对齐已核实的新建语法/扩展名流程，不代表菜单、快捷键、原生桌面 UI 或整体功能已与 CotEditor 7.1.1 全面一致。


## 2026-10-12 文稿检查器统计信息（未发行源码）
CotEditor 7.1.1 的 [`DocumentInspectorView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Inspector/DocumentInspectorView.swift) 将检查器组织为文件、文本设置、编辑计数和字符信息区段；其中编辑计数同时读取计数结果与位置结果。CotEdit 既有文稿检查器只有名称、路径、编码、换行符、行数、UTF-16 长度和保存状态。

本轮在现有检查器中增加当前语法模式、词数、字符数、光标行列与主选区字符数；数值从当前活动编辑器实时刷新，复用与状态栏相同的 `getTextStats`/`countCharacters` 统计和 CodeMirror 行列坐标。字符数以 `Intl.Segmenter` 字素簇计；词数使用 CotEdit 当前 Unicode 字母、数字及下划线连续串规则；光标行列从 1 起算，列按字素簇计；选区字符数只统计 CodeMirror 主选区，不累计其他多重选区。字符数明确标为“字素簇”，原有“长度（UTF-16 代码单元）”字段保留，两种单位不混淆。

`test/document-inspector.test.js` 覆盖组合附加符、emoji ZWJ 家庭字素、无选区与空选区区分及无效位置回退；兼容性和可访问性静态测试确认字段存在并接收刷新值。定向测试 **26/26**；显式列举的 78 个 `test/*.test.js` 文件串行测试 **729/729**；本轮 4 个改动 JavaScript 文件 `node --check` **4/4**；HTML **418** 个 ID 唯一。正式版本仍为 **0.5.16**，只修改未发行源码、测试和文档；未构建、打包、运行 Electron UI smoke，未改动 `dist/`、`release/` 或恢复、权限、隐私、数据保留策略。

限制：JavaScript `Intl.Segmenter` 的 Unicode 数据版本和 Foundation `Character` 可能不同；CotEdit 词语分段不等于 CotEditor/Foundation 的词枚举；此统计功能最初位于对话框，后续改造见下节；未新增原生文件属性、Finder 标签或检查器快捷键。Node/静态测试无法验证真实 Electron 菜单和桌面呈现、读屏器或 macOS/Windows 原生交互等价。

## 2026-10-12 文稿检查器非模态停靠与分组（未发行源码）

CotEditor 7.1.1 的 [`DocumentInspectorView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Inspector/DocumentInspectorView.swift) 实现 `HostedPaneView`，以可折叠 DisclosureGroup 呈现 File、Text Settings、Count、Character。CotEdit 原检查器是模态对话框，会阻塞继续编辑；本轮将其换成编辑区右侧的非模态停靠面板，面板打开时编辑仍可继续，保留现有统计字段并实时跟随文稿/光标/选区更新。字段整理为“文件”（名称、路径、保存状态）、“文本设置”（编码、换行符、语法模式）、“计数”（行数、词数、字素簇字符数、UTF-16 长度、光标位置、主选区字符数）三个可折叠区段；使用原生 HTML `details/summary`，默认展开，可键盘聚焦并折叠。开启检查器会收起其他临时检查面板，关闭按钮或 Escape 会将焦点交还编辑器；该面板不新增默认快捷键。

验证：`test/dialog-accessibility.test.js`、`test/coteditor-menu-parity.test.js`、`test/document-inspector.test.js`、`test/accessibility.test.js` 定向 Node **47/47**；显式列举的 78 个 `test/*.test.js` 文件串行 **729/729**；本轮变更的 JavaScript 源码/测试 `node --check` **3/3**；CSS PostCSS 解析通过；HTML **418** 个 ID 均唯一。正式版仍为 **0.5.16**；只修改未发行源码、测试和文档，未构建、打包、启动 Electron 或运行 UI smoke；未改写 `dist/` / `release/`，也未触碰恢复、权限、隐私或数据保留策略。

剩余差异：CotEdit 实现的是应用内右侧停靠面板，非原生 Cocoa `HostedPaneView`；只对齐 File/Text Settings/Count 三组，Unicode Character 详情仍在既有独立字符检查器中；尚无文件创建/修改时间、大小、标签、权限、所有者或 Finder 显示动作；面板宽度、驻留状态、辅助技术与系统主题/缩放行为未在原生 macOS/Windows UI 实测。上述 Node、HTML/CSS 静态检查不证明视觉、原生菜单、读屏器或平台交互 1:1 等价。


## 2026-10-12 文稿检查器 Character 区段（未发行源码）

CotEditor 7.1.1 的 [`DocumentInspectorView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Inspector/DocumentInspectorView.swift) 在 Count 后显示可折叠 Character 区段；[`EditorCounter.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Scanners/EditorCounter.swift) 仅在首个选择字符串恰为一个 Swift `Character` 时提供字符值。`CharacterPaneView` 对一个 Unicode 标量列出码位、名称、区块及一般类别；多标量 Character 只列码位。

CotEdit 现在在右侧非模态文稿检查器中新增默认展开的“字符”区段。它读取 CodeMirror 首个选择范围，并复用有界 Unicode grapheme 边界算法；仅当所选范围完整且恰为一个字素簇时，才列出其中的码位。单标量字符另显示名称、区块及类别；多标量字素簇保留全部码位但不伪造单一标量属性；无选区、空选区、部分字素选择或多字素选择则明确显示未选择单个字符。Unicode 元数据沿用本项目 Unicode 17 数据集，以 `textContent` 更新 DOM；异步刷新以递增请求号阻止旧选择的结果覆盖新选择。现有独立 Unicode 字符检查器和菜单快捷键不变。

验证：`test/document-inspector.test.js`、`test/dialog-accessibility.test.js`、`test/coteditor-menu-parity.test.js` 定向 **27/27**；显式逐个传入 78 个 `test/*.test.js` 文件的串行 Node 测试 **730/730**；本轮五个变更 JavaScript 文件 `node --check` **5/5**；PostCSS CSS 解析通过；HTML **423** 个 ID 唯一。正式版仍为 **0.5.16**；仅修改未发行源码、测试与文档；未构建、打包、启动 Electron 或运行 UI smoke，未改写 `dist/` / `release/`，未更改恢复、权限、隐私或数据保留行为。

限制：CodeMirror 首个选择范围和 JavaScript `Intl.Segmenter` 是对 CotEditor 首个 Swift `Character` 的跨平台近似；Foundation/AppKit 的 Unicode 数据版本、属性名称本地化和扩展字素分段可能不同。此区段只显示 Unicode 摘要字段，不是原生字符弹出检查器；未验证实际桌面布局、读屏器、macOS/Windows 菜单与视觉交互等价。


## 2026-10-12 文稿检查器文件大小（未发行源码）

CotEditor 7.1.1 [`DocumentInspectorView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Inspector/DocumentInspectorView.swift) 的 File 区段含 Size 行，并使用 `.byteCount(style: .file, includesActualByteCount: true)` 同时呈现易读容量和精确字节数。CotEdit 当前检查器此前仅提供名称、路径和保存状态，没有本机文件大小。

现于右侧停靠检查器“文件”分组增加“文件大小”。打开文件时直接取已读取 `Buffer` 的长度；桌面保存时由既有 `atomicWrite` 在原子替换成功后返回实际编码缓冲区长度，因此包含编码差异及 BOM，不另行读取文件、增加 IPC 路径或放宽文件访问边界。界面以十进制 kB/MB 等易读单位并列精确字节数；新建文稿和远程文稿明确显示无本地文件。仅把字段保存在当前文稿运行时对象中；恢复快照仍使用既有显式字段白名单，未纳入文件大小，不改恢复或数据保留策略。

`test/document-inspector.test.js` 覆盖零/小字节值、kB/MB 舍入、精确字节数和负数/小数/非有限/越界输入；`test/atomic-write.test.js` 验证包含 UTF-8 BOM 的 Unicode 文本返回值等于实际文件字节数；`test/coteditor-menu-parity.test.js` 检查检查器字段与打开/保存数据链路。定向 Node **29/29**；显式传入顶层 78 个 `test/*.test.js` 文件并串行运行 **732/732**；7 个变更 JavaScript 源码/测试 `node --check` **7/7**；`src/style.css` PostCSS 解析通过，HTML **424** 个 ID 全部唯一。正式版本仍为 **0.5.16**；仅修改未发行源码、测试和文档，未构建、打包、启动 Electron 或运行 UI smoke；`dist/` 4 个文件与 `release/` 115 个文件摘要与本轮开始时的检查点一致。未删除项目文件、清理缓存或改变权限、隐私、恢复及数据保留行为。

限制：显示的是文稿打开或最近一次本地保存时的大小快照；文稿未保存编辑不会改变文件大小，其他程序在外部修改文件时不会自动刷新。无本机路径的未保存/浏览器模式文稿、远程文稿没有该大小值。本轮只补齐 Size；创建/修改时间、标签、权限、所有者、“在 Finder 中显示”尚未实现。格式使用 CotEdit 的中文显示和十进制单位，不等同 Foundation `ByteCountFormatter` 的本地化细节；Node 与静态测试不验证真实桌面布局、读屏器、系统菜单或 macOS/Windows 原生交互等价。


## 2026-10-12 文稿检查器 POSIX 权限（未发行源码）

CotEditor 7.1.1 的 [`DocumentInspectorView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Inspector/DocumentInspectorView.swift) 在 File 区段显示 Permissions；[`FileAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/DocumentFile/FileAttributes.swift) 从文件属性的 `posixPermissions` 读取权限位；[`FilePermissions+FormatStyle.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/DocumentFile/FilePermissions/FilePermissions%2BFormatStyle.swift) 以八进制与符号形式组合完整展示，例如 `644 (-rw-r--r--)`。CotEdit 之前的检查器尚无权限字段。

CotEdit 现于“文件”分组增加“权限”，从打开文稿时已有 `fs.stat` 结果及原子保存后既有的 best-effort `stat` 快照中读取 POSIX mode，覆盖 owner/group/other 的读写执行位与 setuid/setgid/sticky 特殊位；不调用 `chmod`、不改文件权限、不增加 IPC 或文件读取 API。Windows 的 Node `mode` 位不等于 POSIX 权限或 ACL，因此显示“不可用”；未保存与远程文稿显示无本地文件。它是打开/最近保存时的快照，外部修改不会自动刷新；权限字段不进入恢复快照。

`test/document-inspector.test.js` 覆盖普通权限、setuid、setgid、sticky、无效输入、Windows 不误报，以及打开/原子保存/检查器的数据链路；`test/coteditor-menu-parity.test.js` 确认新字段在检查器中存在。定向测试 **30/30**；人工显式列出的 **76** 个顶层 `test/*.test.js` 文件串行测试 **733/733**（未使用 glob 自动发现，也未运行 `electron-ui-smoke.cjs`）；本轮 5 个 JavaScript 源码/测试 `node --check` **5/5**；PostCSS 解析与 HTML ID 唯一性静态检查通过。正式版本仍为 **0.5.16**；仅改未发行源码、测试和本文档，未构建、打包、启动 Electron 或运行 UI smoke，未修改 `dist/`、`release/`，未改变恢复、文件权限、隐私或数据保留策略。

限制：该早期记录当时只补权限展示；当前文件区差异请见本文件最新矩阵与下方增量。Node/静态测试不验证真实 macOS/Windows 检查器布局、ACL 语义、读屏器及原生交互，也不意味着 CotEdit 与 CotEditor 已整体完全一致。

## 2026-10-12 文稿检查器完整路径定位（未发行源码）

CotEditor 7.1.1 [`DocumentInspectorView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Inspector/DocumentInspectorView.swift) 在 File > Full Path 行旁提供 “Show in Finder” 按钮，并通过 `NSWorkspace.shared.activateFileViewerSelecting([fileURL])` 请求 Finder 定位并选择当前文件。CotEdit 原本有单独的“在文件管理器中显示”菜单动作，但文稿检查器路径行没有对应的就地入口。

现于路径文本旁增加带可见焦点样式、中文无障碍名称及提示的按钮；仅当运行于 Electron 桌面且活动文稿有本地路径、不是远程会话时显示。点击复用现有 `revealActiveFile` → preload `revealFile` → `document:reveal` 路径；主进程仍先 `fs.access` 再调用 `shell.showItemInFolder`。没有新 IPC、额外 `stat`/文件读取、菜单项或快捷键，也不改变恢复、权限、隐私及数据保留行为。

验证：定向 `document-inspector`、`coteditor-menu-parity`、`menu-coverage`、`accessibility` 显式 Node 测试 **102/102**；明确传入的 **76** 个顶层 `.test.js` 文件串行测试 **737/737**；变更 JavaScript `node --check` **2/2**；PostCSS CSS 解析通过，HTML **428** 个 ID 均唯一。正式版本仍为 **0.5.16**；仅修改未发行源码、测试及文档，未构建、打包、启动 Electron 或运行 UI smoke，未写入 `dist/` / `release/`。

边界：只有实际 Electron 桌面会显示该按钮；浏览器、新建未保存和远程文稿不显示。Electron `shell.showItemInFolder` 是跨平台的系统文件管理器近似，并不承诺所有发行版上的 Finder/Explorer/GIO 均完全选择成功；Node/静态检查不验证真实系统联动、桌面布局、菜单或读屏器 1:1 等价。该动作会将用户显式选中的本地文件路径交由系统文件管理器处理。

## 2026-10-12 文稿检查器数值所有者 UID/GID（未发行源码）

CotEditor 7.1.1 [`DocumentInspectorView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Inspector/DocumentInspectorView.swift) 的 File 区段显示 Owner。CotEdit 现增加“所有者（UID / GID）”行：主进程只从文稿打开时已有的 `fs.stat` 与原子保存成功后的 best-effort `fs.stat` 中读取数值 `uid/gid`；renderer 仅接受非负安全整数，以 `UID n · GID n` 显示。无本地文件/远程文稿按现有检查器状态显示；Windows 不把 Node 的身份字段假装为 POSIX 所有权，显示不可用。该值是打开/最近保存快照，不自动跟踪外部 `chown`。

不解析用户名/组名、不调用额外系统命令、不读取账户数据库、不增加 IPC 通道或文件读取，不改变权限、恢复/持久化、隐私与数据保留策略；菜单和快捷键未变化。与 CotEditor 仍有明确差异：不显示 Finder 标签，当前只显示数字 ID，不解析账户名；实际目标系统 Inspector、文件系统及读屏器行为未实测。

验证：`document-inspector.test.js`、`coteditor-menu-parity.test.js`、`accessibility.test.js` 定向 **54/54**；明确逐项传入的 **78** 个顶层 `.test.js` 串行测试 **739/739**；本轮六个变更 JavaScript 文件 `node --check` **6/6**。正式版仍为 **0.5.16**；只修改未发行源码、测试与文档，未构建、打包、启动 Electron 或运行 UI smoke，未写入 `dist/` / `release/`。


## 2026-10-12 注释符后添加空格偏好（未发行源码）

CotEditor 7.1.1 编辑设置帮助定义 “Add a space to comment delimiters”，官方默认值 `appendsCommentSpacer` 为 `true`；[`String+Commenting.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextEditing/String%2BCommenting.swift) 将该偏好用于行/块注释插入和取消。CotEdit 原来由 CodeMirror 命令固定添加一个空格，且没有对应编辑设置。

CotEdit 现于编辑器设置面板增加“注释符后添加空格”，默认开启以保持旧输出；设置持久化并随设置文件导入/导出。Toggle Comment（含默认 Mod-/ 与现有可配置动作）、Comment Out、行注释、块注释和显式 Uncomment 均使用同一值；关闭时注释插入不新增空格，取消注释仅移除分隔符并保留相邻空格。原菜单、快捷键与 IPC 路由不变，没有新增快捷键或菜单项。

验证：`editor-commands.test.js`、`settings.test.js`、`settings-file.test.js`、`coteditor-menu-parity.test.js`、`menu-coverage.test.js` 定向 **141/141**；按明确路径逐项传入 **78** 个顶层 `.test.js`、`--test-concurrency=1` 串行执行 **743/743**；本轮八个改动 JavaScript 源码/测试 `node --check` **8/8**；`index.html` 中 **430** 个 ID 均唯一。正式版仍为 **0.5.16**，该增量未发行；仅改源码、测试与文档，未构建、打包、启动 Electron 或运行 UI smoke，未改写 `dist/` / `release/`，未改变恢复、权限、隐私或数据保留策略。

边界：这是一项跨平台行为近似，不是 CotEditor 原生 Edit Settings 面板；测试不验证实际桌面视觉布局、系统菜单/键盘派发、读屏器或 macOS/Windows 1:1 行为，也不代表本项目与 CotEditor 已整体完全一致。

## 2026-10-12 自动缩进行为设置（未发行源码）

CotEditor 7.1.1 [编辑设置帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/settings_edit.html) 明确列出 “Automatically indent while typing”：按 Return/Enter 时，新行沿用上一行缩进；[`DefaultSettings.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift) 的 `.autoIndent` 默认值为 `true`。CotEdit 原先只有固定开启的 CodeMirror Enter 缩进，没有相应持久化开关。

现于编辑器设置增加默认开启的“自动缩进”。关闭时以高优先级纯换行命令覆盖 Return/Enter 的默认缩进行为；开启时保留现有 CodeMirror 默认命令，因此默认输出不变。该偏好纳入本地设置与设置文件导入/导出，文稿切换及分屏编辑器通过既有 compartment 重配置同步生效。菜单、快捷键和 IPC 不变；CodeMirror `indentOnInput()` 对输入配对字符的辅助行为不随此项改变，与 CotEditor 帮助中仅描述的 Return/Enter 语义区分。

验证：`editor-commands.test.js`、`settings.test.js`、`settings-file.test.js`、`coteditor-menu-parity.test.js` 定向 **95/95**；按明确列出的 **78** 个顶层 `.test.js`、`--test-concurrency=1` 串行执行 **747/747**；本轮六个变更 JavaScript 文件 `node --check` **6/6**；`index.html` **431** 个 ID 全部唯一。正式版仍为 **0.5.16**；只修改未发行源码、测试与文档，未构建、打包、启动 Electron 或运行 UI smoke，`dist/` / `release/` 未改写。

边界：自动缩进开关通过跨平台设置控件提供，并非 CotEditor 原生 Settings UI；Node 与静态测试不能证明真实键盘事件优先级、系统菜单、桌面视觉布局、读屏器或 macOS/Windows 原生编辑行为 1:1。未新增快捷键，也未改变恢复、权限、隐私或数据保留策略。

## 2026-10-12 打开文稿时检测缩进样式（未发行源码）

CotEditor 7.1.1 [编辑设置帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/settings_edit.html) 列出 “Detect indent style on document opening”：打开文稿后检测空格或制表符缩进；识别成功时调整 Tab 键是否扩展为空格，缩进行不足时回退到文稿默认缩进字符设置。官方 [`DefaultSettings.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift) 将 `detectsIndentStyle` 默认设为 `true`。CotEdit 原先没有这项偏好。

CotEdit 在编辑器设置中新增默认开启的“打开文稿时检测缩进样式”，并纳入现有本机设置归一化及设置文件导入/导出。只在构造已打开文稿时从原始文本检测，结果留在该文稿的运行时对象中，不写入文稿、会话/恢复数据或新增数据保留字段。扫描限制为前 1,000,000 UTF-16 code units、10,000 行；忽略空白行和含空格/Tab 混合前缀的行，至少两条同类纯前缀且占多数时分类为 `spaces` 或 `tabs`，否则保持未判定。识别为空格时普通 Tab 用现有软 Tab 插入，Backspace 对软 Tab 成组删除；识别为 Tab 时普通 Tab 插入单个制表符。未判定时完全沿用现有全局“使用空格缩进”及当前语法配置。选区 Tab 行缩进优先级与 Return/Enter 自动缩进不变。已有 Format > 制表符宽度 > “使用空格缩进”复选项显示活动文稿的有效检测状态；用户点击它时仅清除活动文稿的检测覆盖并写入全局手动偏好。无新菜单项、快捷键、IPC 或跨文稿检测刷新。

验证：显式路径运行 `test/indent-style-detection.test.js`、`test/settings.test.js`、`test/settings-file.test.js`、`test/menu-coverage.test.js`、`test/menu-state.test.js`、`test/editor-commands.test.js`、`test/coteditor-menu-parity.test.js`，**174/174**；本轮八个 JavaScript 源码/测试 `node --check` **8/8**；HTML **432** 个 ID 均唯一。`dist/` 4 个文件聚合 SHA-256 `b8bc2ac67884de18bc6dd06b57e6ce220a3d46db9e12608e0b9017be5de107a2`，`release/` 115 个文件聚合 SHA-256 `88b212005a3e49ea61b19359f9cde3e8805b41266d6fdaa958b85f41995695e4`，均与本轮开始前检查点一致。正式版仍为 **0.5.16**；仅修改未发行源码、测试和文档；没有构建、打包、启动 Electron 或运行 UI smoke，没有删除文件或清理缓存，也没有改恢复、权限、隐私或数据保留策略。

边界：两条一致缩进行、首段扫描预算和混合前缀排除属于 CotEdit 的保守有界启发式；已核实的 CotEditor 帮助未公开内部识别阈值，因此不宣称探测算法完全相同。设置控件、菜单复选态与文本键盘行为均未在真实桌面 UI 中验证；Node/静态测试不证明本机键盘事件、视觉布局、读屏器或 macOS/Windows 原生交互 1:1。

## 2026-10-12 多重替换管理器窗口可调整大小（未发行源码）

CotEditor 7.1.0 [发布说明](https://coteditor.com/releasenotes/7.1.0.en) 将部分设置对话框可调整大小列为改进。CotEdit 已有多个可缩放的设置/规则管理器，但较大的多重替换定义与规则编辑器仍固定尺寸：其左侧定义列表及右侧含多项规则选项的表单在密集工作流中只能使用默认窗口空间。本轮让该管理器复用已有 `resizable-settings-dialog` 约束，并令 `.multiple-replace-shell` 占据可用剩余高度；现有列表与表单继续独立滚动，窗口最小/最大尺寸仍受视口限制。导入、替换语义、菜单、快捷键、IPC 与数据持久化均不变。

验证：显式串行运行 `test/dialog-resizing.test.js` 与 `test/multiple-replace-import.test.js` **28/28**；`test/dialog-resizing.test.js` `node --check` **1/1**；`src/style.css` PostCSS 解析通过，HTML **433** 个 ID 全部唯一。完整测试套件未运行。`dist/` 4 个文件聚合 SHA-256 `8b050e411da6d63b154a4be87a905fc37f0426d19ceb3781661b1e2a9f7a0255`，`release/` 115 个文件聚合 SHA-256 `36fb16b3ea17f6112aded6757d93ee79b73728d1674bfed99169d32db2d02a76`，均与本轮修改前检查点一致。正式版本仍为 **0.5.16**；只修改源码、测试和文档，未构建、打包、启动 Electron 或运行 UI smoke。

限制：CotEditor 7.1.0 发布说明没有逐一列出哪些原生设置窗可缩放，因此本改动对齐其“部分设置对话框可调整大小”的桌面 UX 能力，并非声称该 CotEditor 版本中的多重替换窗与本窗逐项同构。当前测试仅验证 DOM/CSS 规则及导入测试，不验证 Electron Chromium 实际拖拽调整手柄、窗口缩放行为、桌面布局、系统菜单或读屏器；不据此宣称原生 UI 1:1。


## 2026-10-12 Markdown 自定义语法 blockquote 高亮（未发行源码）

CotEditor 7.1.1 官方 [`Markdown.cotsyntax/Regex/Highlights.json`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/Syntaxes/Markdown.cotsyntax/Regex/Highlights.json) 的 `keywords` 规则将 blockquote 定义为 `^([ ]{4}|\\t)?>[\\t ]`，并以 `(\\R[ \\t]*\\R)|\\z` 在空行或文稿末尾结束多行范围。CotEdit 逐行调用 CodeMirror `StreamLanguage`，原来会拒绝这个跨行终止正则，因而导入后不会产生该规则的高亮；本轮据官方原始 JSON 确认这一单项差异。

现在只有规则类别为 `keywords`、且 `begin`、`end`、`isMultiline` 和正则标记全部精确匹配上游这条规则时，编译器才附加 `endOnBlankLine` 状态标记。tokenizer 在普通段落续行继续着色；遇到空行或仅含空格/Tab 的行，在着色该分隔行之前结束范围；EOF 自然结束扫描。近似但不相同的表达式、其它类别或一般跨行终止规则仍维持拒绝，既有正则安全检查没有放宽。此适配仅覆盖原规则所需的行级行为，不将整份 Markdown 规则包或跨行 ICU 表达式视作完全支持。

验证：显式串行运行 `test/cot-syntax-regexp.test.js` 与 `test/cot-syntax-mode.test.js` **29/29**；本轮两个源码与两个测试文件 `node --check` **4/4**。完整测试套件未运行。正式版本仍为 **0.5.16**；仅修改未发行源码、测试、README 与本文档，未构建、打包、启动 Electron 或运行 UI smoke；未改写 `dist/` 或 `release/`，未改变恢复、权限、隐私及数据保留策略。开始检查点与结束复核的 `dist/` 4 文件聚合 SHA-256 为 `8b050e411da6d63b154a4be87a905fc37f0426d19ceb3781661b1e2a9f7a0255`，`release/` 115 文件聚合 SHA-256 为 `36fb16b3ea17f6112aded6757d93ee79b73728d1674bfed99169d32db2d02a76`。

限制：真实桌面语法着色、原生菜单、键盘、读屏器及 macOS/Windows UI 未实测；此 Node/CodeMirror 静态运行测试不证明与 CotEditor 原生解析器或平台视觉行为 1:1。空白行边界模拟官方多行匹配，不实现 CommonMark 解析器或其全部惰性续行/嵌套块规则。

## 2026-10-12 文稿检查器 Finder 标签（未发行源码）

CotEditor 7.1.1 [`DocumentInspectorView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Inspector/DocumentInspectorView.swift) 在 File 区段显示 Tags；[`FileAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/DocumentFile/FileAttributes.swift) 从扩展属性读取标签，[`FinderTag.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/DocumentFile/FinderTag.swift) 说明其数据是包含标签名与可选颜色编号的二进制 property list `[String]`，颜色编号范围为 0–7。此前 CotEdit 检查器缺少该项。

CotEdit 在“文件”分组新增只读“Finder 标签”行。仅 macOS 主进程对已打开/刚保存的绝对文件路径调用固定 `/usr/bin/xattr -p com.apple.metadata:_kMDItemUserTags <path>` 参数读取，不经过 shell；二进制 plist 解析仅接受顶层字符串数组，限制属性数据 64 KiB、对象 256、标签 32 个、单个标签名 256 个 UTF-16 码元，并映射上游 0–7 颜色编号。renderer 再以白名单归一化标签和颜色，通过 `textContent` 写入 DOM；用名称 chip 和颜色点展示，不解释标签内容为 HTML。打开/最近保存时读取快照，外部 Finder 修改不会自动刷新；不写 xattr，不把标签写入设置、恢复快照或持久化，不增加 IPC、菜单或快捷键。Linux/Windows 明确显示“仅 macOS”，新建与远程文稿显示无本地文件。

验证：显式串行运行 `test/document-inspector.test.js`、`test/coteditor-menu-parity.test.js`、`test/accessibility.test.js` **61/61**；本轮 5 个 JavaScript 源码/测试文件 `node --check` **5/5**；PostCSS CSS 解析通过，HTML **434** 个 ID 全部唯一。完整测试套件未运行。正式版本仍为 **0.5.16**；本轮仅修改未发行源码、测试、README 与兼容性文档，不构建、打包或启动 Electron，也不运行 UI smoke；不修改 `dist/` / `release/`，不改变文件权限、恢复、隐私或数据保留策略。macOS 原生 `xattr` 实际输出、App Sandbox 权限、Finder 颜色呈现、桌面布局及读屏器行为未在 Linux 环境实测；颜色点是应用内 CSS 近似，不等同 AppKit/SwiftUI 原生 tag swatch。


发布物只读复核：当前 `dist/` 为 4 个文件、`release/` 为 115 个文件；按相对路径、NUL 分隔、单文件 SHA-256 十六进制值及换行聚合，当前摘要分别为 `b8bc2ac67884de18bc6dd06b57e6ce220a3d46db9e12608e0b9017be5de107a2` 与 `88b212005a3e49ea61b19359f9cde3e8805b41266d6fdaa958b85f41995695e4`，与本文此前记录的 `8b050e…` / `36fb16…` 不同。也检查了常见清单聚合格式，仍未能复现先前值；由于本轮开始时未独立保存基线且无可用 Git 元数据，差异来源与发生时间无法判定。此轮没有改写、构建或打包这两个目录，也没有尝试修复。


## 2026-10-12 Find > Multiple Replace 定义快捷执行菜单（未发行源码）

CotEditor 7.1.1 [多重替换帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/howto_multiple_replace.html)说明：保存的命名定义可从 Find > Multiple Replace 子菜单直接选择运行，Manage Multiple Replace 是单独入口；官方 [Main.storyboard](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Storyboards/Base.lproj/Main.storyboard)也将该命令定义为子菜单。CotEdit 原先只有直接打开管理器的“多重替换…”菜单项，缺少一键执行已保存定义的入口。

现在该菜单列出定义名称，点击后按 ID 查找当前设置中的已保存定义，并复用现有多规则替换计算与单条编辑事务；整个结果仍可通过一次 Undo/Redo 撤销/重做。定义菜单项经主进程按窗口同步，仅传递受限长度的 ID/标题并过滤重复或不安全 ID；无文稿或文稿禁止编辑时运行项禁用，“管理多重替换…”仍可在无文稿时打开。选区范围沿用 CotEdit 当前“仅在当前选区中替换”偏好。

验证：显式串行运行 `test/menu-state.test.js`、`test/menu-coverage.test.js`、`test/coteditor-menu-parity.test.js`、`test/multiple-replace.test.js`、`test/multiple-replace-import.test.js`，**163/163 项测试通过**；`electron/main.cjs`、`electron/preload.cjs`、`electron/menu-state.cjs`、`src/main.js` 与两个变更测试文件 `node --check` **6/6**。未运行完整测试套件；未构建、打包、启动 Electron 或执行 UI smoke；未修改正式版本 **0.5.16**，`dist/` 与 `release/` 未触碰。

边界：Node 测试覆盖菜单状态/IPC 契约、输入清洗、路由及多重替换事务，但不证明原生菜单实际展开、跨窗口焦点派发或桌面视觉与 CotEditor 1:1；实现沿用 CotEdit 全局选区范围偏好，不主张与 CotEditor 的所有查找状态完全一致。恢复、权限、隐私和数据保留逻辑未改变。


## 2026-10-12 编辑时自动删除行尾空白（未发行源码）

CotEditor 7.1.1 [编辑设置帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/settings_edit.html)列出“Automatically trim trailing whitespace”与“Including whitespace-only lines”；官方 [`DefaultSettings.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift) 将 `autoTrimsTrailingWhitespace` 与 `trimsWhitespaceOnlyLines` 均设为 `false`。CotEdit 原有“删除行尾空白”是手动命令，缺少编辑时自动清理与纯空白行例外偏好。

CotEdit 现于编辑器设置新增两项复选框，默认均关闭并随本机偏好及设置文件导入/导出。开启自动清理后，普通输入、粘贴、删除、拖动及带编辑事件标记的文本命令，在同一 CodeMirror 事务内只清理本次改动所涉及行末尾的 ASCII 空格/Tab；不扫描无关行、不在打开文稿时批量改写；清理与触发编辑作为一个撤销/重做步骤。默认保留仅由空格/Tab 构成的行；开启“包含纯空白行”后，这些行也会在被编辑时清理。既有手动命令仍默认清理全文，未改变菜单或快捷键。

验证：显式运行 `test/auto-trim-whitespace.test.js`、`test/settings.test.js`、`test/settings-file.test.js`、`test/text-tools.test.js`、`test/document-line-ending-history.test.js`、`test/menu-coverage.test.js` 与 `test/coteditor-menu-parity.test.js`，累计 **168/168 项通过**（其中本功能测试 **8/8**）；上述 5 个变更 JavaScript 文件 `node --check` **5/5**。完整套件未运行。正式版本仍为 **0.5.16**；仅改动未发行源码、测试与本兼容性文档，未构建、打包、启动 Electron 或运行 UI smoke；`dist/` 和 `release/` 未触碰。此前记录的 `release/` 文件数/摘要核对差异仍未解决；本轮按范围限制未检查该目录。Node/静态测试不证明 Electron 实际按键派发、原生撤销菜单、桌面视觉或 macOS/Windows 与 CotEditor 1:1；恢复、权限、隐私及数据保留行为未改变。

限制：只作用于编辑事务报告为受改动范围的行；不把打开文件视为编辑，也不清理未触及行。CotEditor 上游帮助说明了用户可见行为和默认值，但未在本次核对中确定其内部改动行算法；CotEdit 的 ASCII 空格/Tab 边界与行范围选择是有界实现，不声称内部机制相同。


## 2026-10-12 增量：自动换行悬挂缩进（工作树）

CotEditor 7.1.1 的 `WindowSettingsView.swift` 在“Line wrapping”组提供“Indent wrapped lines by”及 **0–99 spaces** 数值控件；`DefaultSettings.swift` 默认 `enablesHangingIndent=true`、`hangingIndentWidth=0`。`TextContainer.swift` 对非逻辑行起点的换行片段，按行首空格/Tab 的排版宽度加 `hangingIndentWidth × spaceWidth` 计算额外缩进；若空间不足则不应用。CotEdit 现新增默认开启的设置、同范围列宽、本机持久化及设置文件导入/导出；可见行装饰仅在水平软换行时对续行缩进，Tab 按当前 Tab 宽度计列，并以测量到的 CSS 空格宽度近似 TextKit 排版，支持 RTL，不作用于纵排或正文文本。该设置没有单独菜单命令或默认快捷键，本增量未添加。

证据：[官方窗口设置视图](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Settings%20Window/Panes/WindowSettingsView.swift)、[默认设置](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift)、[TextContainer 排版实现](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/TextContainer.swift)。验证仅覆盖显式 Node 测试与静态结构；未运行完整套件、构建、打包、Electron 或 UI smoke，不能据此声称桌面视觉、原生键盘或各操作系统行为完全等价。正式版本仍为 0.5.16，改动未发行；发行目录摘要未决沿用既有说明，本轮未复查或修改 `dist/`、`release/`。


## 2026-10-12 输入时显示补全建议（未发行源码）

CotEditor 7.1.1 的 [Mode 设置帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/settings_mode.html)列出“Suggest completions while typing”，候选来源可分别选标准词、文稿词和语法词；[`ModeOptions.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/ModeOptions.swift)将自动建议默认设为关闭（General 与 Code 均为 `false`）。CotEdit 原先直接使用 CodeMirror 自动补全默认设置，缺少用户可控开关，且并未对齐上游默认行为。

CotEdit 现增加“输入时显示补全建议”复选框，默认关闭；启用后按当前 CodeMirror 语言提供者显示候选，设置即时应用于主编辑区与分屏，并随本机偏好及设置文件导入/导出。关闭自动建议不影响 Text > Complete / Alt+Escape 显式补全。文稿词来源仍只在显式请求时按需扫描，不因每次键入扫描全文；因此本项是跨平台自动触发近似，不实现 CotEditor 的逐模式候选来源、macOS 标准词典或 AppKit 补全弹窗。

依据：[CotEditor 7.1.1 模式设置帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/settings_mode.html)、[`ModeOptions.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/ModeOptions.swift)、[`ModeSettingsView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Settings%20Window/Panes/ModeSettingsView.swift)与 [`EditorTextView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView.swift)。验证采用显式 Node 测试 `settings.test.js`、`settings-file.test.js`、`document-completions.test.js`、`cot-syntax-mode.test.js`、`menu-coverage.test.js`，并对变更 JavaScript 执行 `node --check`；不构建、不启动 Electron、不运行 UI smoke，也不改动 `dist/` 或 `release/`。正式版本仍为 **0.5.16**，本增量为未发行源码、测试与文档。Node/静态测试不能证明 Electron 实际弹窗、目标平台键盘焦点、macOS AppKit 候选来源/读屏结果或桌面视觉 1:1；文稿恢复、隐私、权限及数据保留行为未改变。


## 2026-10-12 文末过度滚动设置（未发行源码）

根据 CotEditor 7.1.1 `WindowSettingsView.swift`、`DefaultSettings.swift` 和 Window 设置帮助，实现默认 0%、步长 10% 的“文末过度滚动”。百分比复用本机设置和现有设置文件导入/导出。启用后，编辑器在文末添加与可视编辑区高度成比例的滚动空间；100% 时按 CodeMirror 默认 `scrollPastEnd` 计算方式，使末行可到达编辑区顶部附近。0% 时正文容器的底部填充为空，不添加额外空间。为了避免错误的横向/纵向轴计算，此版本在纵排文本下停用此效果；其它视图布局、分屏和实际桌面滚动手感未通过原生 UI 验证。

显式运行 `test/overscroll.test.js`、`test/settings.test.js`、`test/settings-file.test.js`、`test/accessibility.test.js`，**82/82** 通过；6 个变更 JavaScript 源码/测试 `node --check` **6/6**；CSS 经 PostCSS 解析通过，`index.html` 的 **460** 个 ID 唯一。正式版仍为 **0.5.16**，改动仅限未发行源码、测试和文档；未运行完整测试套件、构建/打包、启动 Electron 或 UI smoke。Node/静态检查不证明 Cocoa 原生滚动观感、纵排支持、跨平台输入设备或菜单/辅助技术的 1:1 等价。


## CotEditor 7.1.1 对照增量：按语法控制输入时补全建议（2026-10-12，未发行源码）

依据 CotEditor 7.1.1 [`ModeSettingsView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Settings%20Window/Panes/ModeSettingsView.swift) 的 Completion 组，CotEditor 在每个 Mode 中提供 “Suggest completions while typing” 开关；CotEdit 原先只有一个全局开关。现保留全局默认值，并在现有设置面板增加活动语法三态选择：“跟随全局默认 / 开启 / 关闭”。未创建覆盖的语法继承全局设置；切回“跟随”会删除该语法覆盖。覆盖按语法 ID 有效化、上限 200 项，经现有本机偏好与设置文件导入/导出持久化；新建/切换文稿、手动切换语法和另存为导致语法变化时均按活动语法重配 CodeMirror 自动触发补全。显式 `Alt+Escape` 手动补全不受此设置影响；不新增菜单命令或默认快捷键，因为上游对应项位于 Mode 设置中。

前述范围仅描述自动触发开关的上一增量；下节继续实现了按语法筛选文稿词与语法词，并为安全的字面高亮规则添加候选回退。Standard words 的 macOS 系统词典及 AppKit 原生补全弹窗仍为跨平台差异；不声称 Cocoa 设置窗口、原生弹窗和键盘行为 1:1 一致。正式版本仍为 **0.5.16**。


验证：显式运行 `test/completion-mode-settings.test.js`、`test/settings.test.js`、`test/settings-file.test.js`、`test/menu-coverage.test.js`、`test/accessibility.test.js`、`test/coteditor-menu-parity.test.js`，**165/165** 通过；`src/main.js`、`lib/settings.js` 与四个修改/新增测试脚本 `node --check` **6/6**。完整套件未运行；未构建、打包、启动 Electron 或进行 UI smoke。正式版本仍为 **0.5.16**。


## 2026-10-12 对照增量：逐语法补全候选来源（未发行源码）

后续补齐前节标出的逐语法候选来源设置：活动语法现在可分别启用“文稿中的词”和“语法定义的词”，并可一键恢复该语法的默认来源；偏好按语法 ID 保存、校验并纳入现有设置文件导入/导出（最多 200 个语法）。默认情况下，代码语法提供文稿词与语法词，纯文本提供文稿词；自定义语法如明确含有补全词则启用语法词。文稿词加入自动建议来源时，仅在至少 3 个 Unicode 标量前缀后触发，并限制自动扫描在文稿前 250,000 个 UTF-16 单元内；显式 Alt+Escape 仍可扫描全文。自动建议继续默认关闭。

语法词会合并当前 CodeMirror 语言提供者，去重并按“语法”分组。自定义 `.cotsyntax` 若提供 `Completion.json`，优先使用该词表；若没有，则从非正则、无范围结束符的字面高亮规则中提取关键字、命令、类型、属性和值类别（最多 2,500 项）。这项安全近似不会从复杂正则推断词表，也不会重写高亮规则。CotEditor 的“标准词”来源依赖 macOS 系统词典，跨平台版本没有等价接口，因此界面明确显示为禁用；不声称该来源已实现。AppKit 原生补全弹窗、系统标准词、按语法配置界面的完整视觉一致性仍属于平台差异。

依据：CotEditor 7.1.1 [Mode 设置帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/settings_mode.html)列出 Standard words / Words in document / Words defined in syntax；[`ModeSettingsView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Settings%20Window/Panes/ModeSettingsView.swift)、[`ModeOptions.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/ModeOptions.swift)与 [`EditorTextView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView.swift)为设置、默认值和自动触发行为的依据；本地语法包格式中的 `Completion.json` 及 highlighting rules 为自定义语法实现依据。

验证：显式运行 `test/completion-word-types.test.js`、`test/completion-mode-settings.test.js`、`test/settings.test.js`、`test/settings-file.test.js`、`test/document-completions.test.js`、`test/cot-syntax-mode.test.js`、`test/menu-coverage.test.js`、`test/accessibility.test.js`、`test/coteditor-menu-parity.test.js`，**201/201** 通过；11 个变更 JavaScript 文件 `node --check` **11/11**；CSS 经 PostCSS 解析通过，`index.html` 的 **468** 个 ID 唯一。完整测试套件未运行；未构建、打包、启动 Electron 或进行 UI smoke。正式版本仍为 **0.5.16**，工作树改动未发行。


## 2026-10-12 CotEditor 行高倍数设置（未发行源码）

CotEditor 7.1.1 的[外观设置帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/settings_appearance.html)列出行高设置；[`AppearanceSettingsView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Settings%20Window/Panes/AppearanceSettingsView.swift)使用 **0.1–10.0**、步进 **0.1** 的倍数控件；[`DefaultSettings.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift)设默认值为 **1.3**。CotEdit 原先 `.cm-editor` 使用固定 **1.75** 行高。

现新增“行高”设置输入，默认 **1.3×**，数值规范化为 0.1 步进并限制在 0.1–10.0；无效/旧配置回退到 1.3。偏好经现有设置保存和设置文件导入/导出路径持久化，`applySettings()` 即时更新共享 CSS 变量，主编辑器与分屏视图共同继承；垂直文本列间距的兜底测量与页导引重算也读取实际行高。该项不新增菜单或快捷键。CotEdit 的打印 HTML 继续采用打印模板独立的 1.45 行高，本轮没有把编辑器行高扩展到打印设置。

验证：显式运行 `test/line-height-settings.test.js`、`test/settings.test.js`、`test/settings-file.test.js`、`test/accessibility.test.js`、`test/editor-viewport.test.js`，**105/105** 通过；`src/main.js`、`lib/settings.js` 与新增测试 `node --check` **3/3**；PostCSS CSS 解析通过；`index.html` **471** 个 ID 均唯一。完整测试套件未运行；正式版仍为 **0.5.16**，只修改未发行源码、测试与文档；未构建、打包、启动 Electron 或运行 UI smoke，未修改 `dist/` / `release/`。Node/静态测试不证明实际桌面行距、原生设置窗口、读屏器或 macOS/Windows UI/UX 等价；文稿恢复、权限、隐私和数据保留行为未改变。
