# CotEdit

CotEdit 是一个独立开发的跨平台文本与源代码编辑器，界面、菜单、快捷键与功能对齐 [CotEditor](https://coteditor.com/)（对齐基线：CotEditor 7.1.2）。基于 Electron + CodeMirror 6，支持 macOS、Windows 与 Linux。

CotEdit 是跨平台桌面文本编辑器，不能将 Electron/CodeMirror 宣称为 CotEditor 的逐像素或文本内核移植。跨平台功能、按平台差异和未完成事项列于[兼容性记录](docs/compatibility.md)；持续差异计划见[实施计划](docs/parity-plan.md)，菜单逐项差异见[菜单清单](docs/menu-parity.md)。

## 当前对齐状态

- 对照 CotEditor 7.1.2 与上游 `main`（`f90e70a644d968e33d48cc6b8258e72a06957f32`）建立持续差异盘点和实施顺序，详见 [docs/parity-plan.md](docs/parity-plan.md)、[docs/menu-parity.md](docs/menu-parity.md) 与[兼容性记录](docs/compatibility.md)。跨平台项目仍有未完成的设置、菜单和目标系统实机验收；不宣称与 Cocoa 原生应用完全等价。
- CotEdit 提供按语法拼写检查、智能引号/破折号、自动文本替换和系统字典右键建议；Edit > 语音可朗读选区/全文，Inspector 有总开关，Help 提供发行说明/问题报告入口。系统语法检查、自动更正、原生拼写/替换面板及 AppKit 语音菜单仍受平台接口限制。

## 1.0.4（2026-10-13）

- Format > Font 新增“显示字体…”选择器，可输入字体系列、查看预览并保存；选择应用于主编辑器、分屏编辑器和打印，未安装的字体按标准/等宽字体类型栈回退。
- 字体族名称限制为安全字符和 80 字符以内；新增无障碍对话框、常见字体建议与焦点恢复。Electron 没有可靠系统字体枚举，因此不把建议列表称为已安装字体清单；Cocoa `NSFontPanel` 与 Antialias 控件保留平台差异。
- 修复 CodeMirror 滚动区自己的 monospace 默认值覆盖编辑器字体的问题，确保选择的字体真正作用于文本行；文件拖放管理器关闭时只在焦点仍留在已关闭对话框内才恢复焦点，避免异步关闭事件抢走后续编辑焦点。
- `npm test` **885/885** 通过；`npm run test:ui` **4/4** 通过，生产构建成功。

## 1.0.3（2026-10-13）

- 完成按语法的输入时拼写检查，以及智能引号、智能破折号和自动文本替换设置；旧版自定义替换规则默认保持手动，用户可逐条启用输入时替换。
- Edit 菜单新增开始/停止朗读和显示检查器总开关；分屏焦点键位按 CotEditor 菜单 storyboard 调整，移除没有上游静态快捷键依据的默认分屏键位。
- Help 菜单新增 CotEdit 发行说明、报告问题和项目主页入口，使用固定 HTTPS 地址交由系统默认浏览器打开。
- 稳定设置面板和标签溢出菜单的 UI 冒烟步骤；补充拼写/语音/Inspector/文本替换/Help 回归覆盖。
- `npm test` **878/878** 通过；`npm run test:ui` **4/4** 通过，生产构建成功。

## 1.0.2（2026-10-13）

- 对齐 CotEditor 主题管理工作流：可保存多个导入主题、切换、重命名、删除，并编辑正文/背景/选区/语法高亮颜色及选区、插入点、搜索高亮的系统颜色跟随选项。
- 首次启动时迁移此前已激活的自定义主题；内置主题名称保留且不可被自定义主题覆盖；自定义主题最多保存 64 个。

## 1.0.1（2026-10-13）

- 补充 GitHub Actions 发布流程：打 `v*` 标签后在 macOS、Windows、Linux 原生 runner 构建 DMG/ZIP、NSIS、AppImage/DEB，运行单元测试并将安装包附加到 GitHub Release。
- 修正项目主页/仓库元数据，并同步应用版本为 1.0.1。

## 1.0.0（2026-10-12）

首个正式发布版。相对 0.5.16 完成 CotEditor 7.1.2 对齐与跨平台健壮性修复：

- **远程编辑（rmate）**：SSH 反向转发场景下接收 rmate 连接（默认关闭，端口 52698，仅绑定 127.0.0.1），远端保存经同一连接回传；“外部集成…”对话框提供开关、端口与 SSH/客户端命令示例；断开后文稿仍可编辑，另存为本机文件。
- **14 个内置编辑器主题**：与 CotEditor 7.1.2 字节一致（Anura、Classic、Dendrobates、Kawazu、Lakritz、Mono、Note、Printen、Pulse、Resinifictrix 及各自暗色变体），默认 Anura，明暗配对主题随外观切换。
- **捐赠入口**：应用菜单“捐赠 CotEdit…”与捐赠对话框（对齐上游 7.1.2 非 App Store 变体）。
- **跨平台修复**：符号链接根目录（macOS `/var` 等）下的文件夹浏览/新建/打开/预览/外部应用守卫；Linux 外部应用桌面条目枚举；沙箱 EEXIST 错误码兼容。
- **冒烟测试 macOS 化**：CDP 修饰键掩码、平台快捷键标签、多字符快捷键持久化契约、Collator 区域等 14 处修复；对话框关闭焦点竞态修复。

完整测试套件 **866/866** 通过；Electron UI 冒烟测试 3 项中 2 项稳定通过（第三项在长序列累积状态下受时序抖动影响，隔离复现均通过）。

## 2026-10-12 桌面冒烟测试 macOS 可运行化与对话框焦点竞态修复（未发行源码）

首次完整运行 `test:ui`（Electron CDP 冒烟测试），修复其 14 处潜伏问题使其在 macOS 上可运行，并修复一个真实的应用缺陷。测试侧修复：排序断言改用渲染进程实际 `navigator.language` 构造 Collator（原用 Node 默认 en-US 与中文系统的 zh 排序不一致）；CDP `Input.dispatchKeyEvent` 修饰键位掩码按协议使用（Meta=4、Ctrl=2、Alt=1、Shift=8），原 ⌘A/⌘L/⌘⌥I/⌘K 误用 2（Ctrl）在 macOS 上不触发；重复快捷键捕获改用与 `quickActions`（CmdOrCtrl+K）冲突的平台命令修饰键；快捷键标签断言按平台选择 `⌘S`/`⌃⌥X`/`⌃⌥⇧SS` 等格式；多字符快捷键持久化值按 `lib/shortcuts.js` 契期望 `SS`（保留原始大小写，仅显示层大写）；`多重替换…` 期待值改为上游同款的 `管理多重替换…`；Quick Actions 三处 Ctrl+K 统一为 `commandModifier`；补上测试 2 缺失的 `usesMeta`/`commandModifier` 定义（原后置定义导致 TDZ）。应用侧修复：新增 `restoreDialogFocus()`——`<dialog>` 的 `close` 事件为排队任务，工具栏自定义/恢复/高级计数/远程集成/捐赠对话框的关闭焦点恢复可能晚于新打开 UI 的聚焦并把焦点抢走（表现为设置面板打开后焦点被已关闭对话框的按钮捕获），现仅当焦点处于失效状态（body/ detached/ 已关闭对话框内）时才恢复。冒烟测试 3 项中 2 项稳定通过，另 1 项在隔离复现中通过、长序列累积状态下仍受时序抖动影响；`npm test` **866/866** 保持全绿。

## 2026-10-12 CotEditor 7.1.2 内置编辑器主题（未发行源码）

将 CotEditor 7.1.2 的 14 个内置主题按上游资源原样打包，并在外观设置提供主题选择。现提供自定义主题库，可导入多个 `.cottheme`、切换、改名、删除及编辑颜色；选区、插入点与搜索高亮可选择跟随系统颜色。自定义主题最多保存 64 个；自定义名称不能与内置主题重名。

显式运行 `test/builtin-themes.test.js`、`test/settings.test.js`、`test/accessibility.test.js`、`test/version.test.js`，**N/N** 见当次 CI 输出；另跑完整套件 **866/866**，`node --check` 覆盖变更的 `src/main.js` 与 `src/builtin-themes.js`，`npm run build` 通过且 `dist/` bundle 内含主题数据。主题管理与颜色工作流已实现跨平台版本；Node/静态检查不证明真实桌面观感与 SwiftUI ThemeEditor 视觉/辅助技术行为一致。

## 2026-10-12 CotEditor 7.1.2 捐赠菜单项与捐赠面板（未发行源码）

依据 CotEditor 7.1.2 [主菜单定义](https://github.com/coteditor/CotEditor/blob/7.1.2/CotEditor/Storyboards/Base.lproj/Main.storyboard)、[`AppDelegate.showDonationWindow(_:)`](https://github.com/coteditor/CotEditor/blob/7.1.2/CotEditor/Sources/Application/AppDelegate.swift)、[`DonationView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.2/CotEditor/Sources/Panels/DonationView.swift) 与[捐赠帮助页](https://github.com/coteditor/CotEditor/blob/7.1.2/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/about_donation.html)，应用菜单在“关于”与“设置…”之间加入“捐赠 CotEdit…”（无快捷键），点击打开捐赠对话框。对话框沿用上游非 App Store 分发变体（`NoAppPurchaseView`）的文案与入口：说明文字、App Store 链接（id1024640650）、GitHub Sponsors 链接（github.com/sponsors/1024jp/），均经既有 `openExternalUrl` 通道在系统浏览器打开；应用内购仅存在于 App Store 版本，本跨平台版本不伪造购买流程。对话框沿用现有 `dialog` 无障碍模式（`aria-labelledby`、焦点归还）。上游将捐赠从设置窗口移至应用菜单/关于侧，本地原设置结构不受影响。

显式运行 `test/coteditor-menu-parity.test.js`、`test/menu-coverage.test.js`、`test/accessibility.test.js`、`test/menu-state.test.js`，全绿；完整套件 **866/866**，3 个变更文件 `node --check` 全过，HTML ID 唯一性检查通过。未构建、未启动 Electron、未触碰 `dist/`；不证明原生菜单与 macOS 面板逐像素一致。

## 2026-10-12 符号链接根目录路径守卫修复（未发行源码）

在 macOS（`/var` → `/private/var`）与任何经符号链接进入的文件夹上，文件夹浏览/新建/打开/预览/外部应用启动既有的 `realpath(root)` 与词法 `resolve(requested)` 对比会误判“路径超出已选文件夹范围”，且外部应用枚举的 `realPath !== entry.filePath` 恒真过滤掉全部桌面条目；沙箱还会把 `mkdir` 的 EEXIST 错误码改写为 broker 错误导致唯一命名退避失效。修复：新增共享模块 `electron/root-path.cjs`，`resolveWithinRoot()` 对词法根/规范根双侧判 containment（这是唯一真实的越界判据），目标不存在时回溯最近的已存在祖先继续防符号链接逃逸，同时向调用方回显其原始词法路径（与既有调用方契约、Linux 行为一致）；`directory-search`/`directory-mutations`/`directory-navigation`/`main.cjs` 的守卫全部切换到该模块，`openRegularFileInRoot` 的 TOCTOU 比较改为 inode 为主；Linux 外部应用枚举改用规范目录 containment 并保留词法 desktopPath 用于 `gio launch`；EEXIST 判定兼容消息文本。此前“完整测试套件未运行”，本轮首次全量运行即暴露上述问题。

显式运行 `test/directory-search.test.js`、`test/directory-open.test.js`、`test/directory-mutations.test.js`、`test/directory-navigation.test.js`、`test/linux-external-applications.test.js`、`test/menu-coverage.test.js`，修复前 **46** 个失败 → **0**；完整套件 **866/866**（含本轮新增主题测试）。`node_modules/electron` 二进制因跨卷 rename 需 `TMPDIR` 与 `ELECTRON_CACHE` 同卷方能完成安装。修复不改变任何用户可见文案或行为契约，仅消除符号链接根上的误判。

## 2026-10-12 CotEditor 风格不可见字符分类显示（未发行源码）

依据 CotEditor 7.1.1 [不可见字符指南](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/howto_display_invisibles.html)、[`WindowSettingsView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Settings%20Window/Panes/WindowSettingsView.swift)、[`DefaultSettings.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift) 和[主菜单定义](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Storyboards/Base.lproj/Main.storyboard)，补齐“换行符、制表符、空格、其他空白、其他控制字符”五类独立显示偏好。总开关默认关闭；类别默认值依次为开启、开启、关闭、开启、开启。选项沿用现有本机设置及设置文件导入/导出，主/分屏编辑器即时刷新；View 菜单现称“显示不可见字符”，不新增菜单命令或快捷键。CRLF 在编辑器中以一个行尾符号表示；CotEdit 的控制字符采用控制图片或带码位提示的菱形标记，并跳过 U+200D 零宽连接符以免破坏 emoji 连字。打印显示设置独立，本轮未修改打印模板。

显式运行 `test/invisible-character-display.test.js`、`test/settings.test.js`、`test/settings-file.test.js`、`test/menu-coverage.test.js`、`test/menu-state.test.js`、`test/coteditor-menu-parity.test.js`、`test/accessibility.test.js`，**198/198** 通过；6 个变更 JavaScript 源码/测试 `node --check` **6/6**，PostCSS CSS 解析通过，HTML **476** 个 ID 唯一。完整测试套件未运行；正式版本仍为 **0.5.16**，本轮仅修改未发行源码、测试与文档；未构建、打包、启动 Electron 或运行 UI smoke，未触碰 `dist/` / `release/`。这些检查不证明桌面符号字形、原生菜单/键盘、真实排版或辅助技术与 Cocoa 1:1。

## 2026-10-12 CotEditor 风格匹配括号高亮开关（未发行源码）

依据 CotEditor 7.1.1 [编辑设置帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/settings_edit.html)、[`EditSettingsView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Settings%20Window/Panes/EditSettingsView.swift) 与 [`DefaultSettings.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift)，补齐默认开启的“高亮匹配括号”编辑设置。CotEdit 新增独立复选项，偏好沿用既有设置存储及设置文件导入/导出，并通过 CodeMirror compartment 即时应用到主/分屏编辑器和切换后的文稿；不新增菜单或快捷键。它与前一项“按语法自动插入闭括号与引号”相互独立。

显式运行 `test/matching-braces.test.js`、`test/settings.test.js`、`test/settings-file.test.js`、`test/accessibility.test.js`，**97/97** 通过；本次变更的 3 个 JavaScript 文件 `node --check` **3/3**，HTML **470** 个 ID 唯一。完整测试套件未运行；正式版仍为 **0.5.16**，仅修改未发行源码、测试和文档；未构建、打包、启动 Electron 或运行 UI smoke，未触碰 `dist/` / `release/`。CotEditor 帮助描述为插入点移过括号时短暂高亮；CodeMirror `bracketMatching()` 则在光标邻接括号时显示匹配高亮，行为是有界近似，Node/静态测试不验证原生 UI、真实键鼠和无障碍 1:1。

## 2026-10-12 CotEditor 行高倍数设置（未发行源码）

依据 CotEditor 7.1.1 [外观设置帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/settings_appearance.html)、[`AppearanceSettingsView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Settings%20Window/Panes/AppearanceSettingsView.swift) 与 [`DefaultSettings.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift)，CotEditor 的行高倍数默认为 **1.3×**，范围 **0.1–10.0×**、步进 **0.1**；CotEdit 原先编辑器行高固定为 **1.75×**。现加入“行高”设置，使用同一默认值、范围与步进，经既有本机偏好及设置文件导入/导出保存，并即时作用于主编辑器和分屏编辑器；垂直排版列间距回退与页导引测量沿用当前设置。不新增菜单或快捷键。

显式运行 `test/line-height-settings.test.js`、`test/settings.test.js`、`test/settings-file.test.js`、`test/accessibility.test.js`、`test/editor-viewport.test.js`，**105/105** 通过；本轮变更的 JavaScript 源码/测试 `node --check` **3/3**，PostCSS CSS 解析通过，HTML **471** 个 ID 唯一。完整测试套件未运行；正式版仍为 **0.5.16**，本轮仅改未发行源码、测试和文档，未构建、打包、启动 Electron 或做 UI smoke，未触碰 `dist/` / `release/`。CotEdit 打印模板仍使用独立 **1.45×** 行高，本轮未调整；静态/Node 验证不证明桌面视觉、原生排版、键盘或辅助技术 1:1 等价。

## 2026-10-12 CotEditor 风格默认窗口尺寸留空回退（未发行源码）

依据 CotEditor 7.1.1 [Window 设置帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/settings_window.html)，宽、高输入现在默认留空；每个留空维度沿用上次实际窗口尺寸，首次运行或本机尺寸记录无效时回退到 **1280×820**。用户仍可分别设宽 860–4000、高 600–4000 像素，设置即刻调整当前窗口，并用于之后创建的窗口。实际尺寸复用应用现有本机 localStorage 保存，不写新文件，也不纳入设置文件导入/导出；显式宽高/留空偏好仍随原设置文件导入/导出。窗口先在后台完成 renderer 与编辑器初始化、应用目标尺寸后再显示，避免启动时先显示固定尺寸再跳变；不新增菜单或快捷键，也不改恢复、隐私或文稿保留策略。

显式运行 `test/window-size.test.js`、`test/settings.test.js`、`test/settings-file.test.js`、`test/accessibility.test.js`、`test/menu-state.test.js`、`test/coteditor-menu-parity.test.js`，**143/143** 通过；8 个变更 JavaScript 文件 `node --check` **8/8**，HTML **468** 个 ID 唯一。完整测试套件未运行；正式版仍为 **0.5.16**，仅改未发行源码、测试和文档，不构建/打包、不启动 Electron/做 UI smoke；`dist/` 和 `release/` 未修改。测试不证明真实窗口几何、显示器 DPI、首帧时序或 macOS 原生窗口管理行为完全一致。

## 2026-10-12 当前语法的自动配对括号与引号（未发行源码）

依据 CotEditor 7.1.1 [Mode 设置帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/settings_mode.html) 与 [`ModeOptions.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/ModeOptions.swift)，补齐“Automatically insert closing brackets and quotes” 模式选项：通用模式默认关闭、代码模式默认开启。CotEdit 原先对所有语法一律启用 CodeMirror `closeBrackets()`；现在设置面板提供当前语法“跟随模式默认／开启／关闭”，默认按代码或纯文本类型回退，显式覆盖最多 200 个语法 ID，经既有偏好与设置文件导入/导出保存，并在切换文稿、语法或偏好时即时重配主/分屏编辑器。不新增菜单项或快捷键，不修改文稿文本或恢复/隐私策略。

显式运行 `test/symbol-balancing.test.js`、`test/settings.test.js`、`test/settings-file.test.js`、`test/accessibility.test.js`、`test/completion-mode-settings.test.js`，**99/99** 通过；5 个变更 JavaScript 文件 `node --check` **5/5**，HTML **469** 个 ID 唯一。完整套件未运行；正式版仍为 **0.5.16**，本项仅未发行源码/测试/文档；未构建、打包、启动 Electron 或运行 UI smoke，未改 `dist/` / `release/`。CodeMirror 配对符号插件只是跨平台近似，不证明字符串/注释上下文、输入法、原生 Mode 设置界面或 AppKit 事件行为与 CotEditor 完全一致。

## 2026-10-12 CotEditor 风格文末过度滚动（未发行源码）

依据 CotEditor 7.1.1 [Window 设置源码](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Settings%20Window/Panes/WindowSettingsView.swift)、[默认设置](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift) 和[设置帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/settings_window.html)，新增默认 0%、0–100%（每次 10%）的“文末过度滚动”设置：0% 停在文末，100% 可将末行滚到编辑区顶部。设置复用现有偏好及设置文件导入/导出；仅对横排编辑器生效，不新增菜单或快捷键。

显式运行 `test/overscroll.test.js`、`test/settings.test.js`、`test/settings-file.test.js`、`test/accessibility.test.js`，**82/82** 通过；本轮变更的 6 个 JavaScript 源码/测试 `node --check` **6/6**；PostCSS CSS 解析通过，HTML **460** 个 ID 唯一。正式版仍为 **0.5.16**，仅修改未发行源码、测试与文档；未运行完整测试套件、构建/打包、启动 Electron 或进行 UI smoke。桌面原生滚动手感、纵排及跨平台原生菜单/无障碍未实测，不能据此声称 1:1。

## 2026-10-12 按语法缩进回退全局设置（未发行源码）

CotEditor 7.1.1 的 Mode 设置允许关闭某语法的自定义缩进并回到全局 style/width。CotEdit 现于“格式 > 当前语法的缩进宽度”加入“跟随全局设置”单选项；选择后仅移除活动语法的 `indentByLanguage` 覆写，保留其他语法偏好并重新应用编辑器设置。菜单勾选状态随活动文稿更新；已有设置导入/导出结构不变，因此被清除的语法自然回退到全局缩进偏好。不新增快捷键、IPC 权限或文稿数据字段。

显式运行 `test/menu-coverage.test.js`、`test/menu-state.test.js`、`test/settings.test.js`、`test/settings-file.test.js`，**130/130** 通过；8 个变更 JavaScript 源码/测试 `node --check` **8/8**。完整套件未运行；正式版仍为 **0.5.16**，仅修改工作树源码、测试与文档，未构建、打包、启动 Electron 或运行 UI smoke，未触碰 `dist/` / `release/`。Node/静态测试不证明真实桌面原生菜单、Cocoa Mode 偏好窗或跨平台键鼠/辅助技术 1:1。

## 2026-10-12 快捷键标签 Unicode 全串大写（未发行源码）

依据 CotEditor 7.1.1 [快捷键实现提交 `897e55f`](https://github.com/coteditor/CotEditor/commit/897e55f1103c6c14e906bbbca536e6e715af04b4)，快捷键帮助/快速操作复用的格式器与桌面菜单的自定义标签格式器现对完整按键字符串执行 Unicode 大写映射；`ss`、`SS` 与 `ß` 均显示为 `SS`，`aß` 显示为 `ASS`。显示可有意丢失大小写差别；快捷键捕获、持久化值、大小写敏感的匹配及冲突判断不变。

显式运行 `test/shortcuts.test.js`、`test/shortcut-menu.test.js`、`test/coteditor-menu-parity.test.js`，**50/50** 通过；4 个变更 JavaScript 源码/测试 `node --check` **4/4**。完整测试套件未运行；正式版本仍为 **0.5.16**，仅修改未发行源码、测试及文档，未构建、打包、启动 Electron 或运行 UI smoke，未触碰 `dist/` / `release/`。Node 测试不证明所有 Unicode 大小写映射均与 Foundation 逐项一致，也不验证原生菜单实际绘制、键盘/输入法或各平台辅助技术行为。

## 2026-10-12 高级字符计数的 HFS+ 修改型规范化（未发行源码）
依据 CotEditor 7.1.1 [`CharacterCountOptionsView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Accessory%20Views/Advanced%20Character%20Count/CharacterCountOptionsView.swift)、[`String+AdvancedCounting.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/StringUtils/String%2BAdvancedCounting.swift) 与 [`String+Normalization.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/StringUtils/String%2BNormalization.swift)，高级字符计数的规范化菜单现按标准形式与 HFS+ 修改型分组，新增 Modified NFD/NFC。与 CotEditor 相同，字素簇计数不显示规范化选项；Unicode 标量、UTF-16 与字节计数可选这些形式。计数设置复用现有偏好和设置文件导入/导出；不改 Text 菜单入口或快捷键。

显式运行 `test/advanced-character-count.test.js`、`test/settings.test.js`、`test/settings-file.test.js`、`test/text-tools.test.js`、`test/menu-coverage.test.js` 与 `test/accessibility.test.js`，**162/162** 通过；5 个变更 JavaScript 源码/测试 `node --check` **5/5**。正式版本仍为 **0.5.16**；仅为未发行工作树，未运行全套、未构建/打包/启动 Electron/UI smoke，也未写入 `dist/` / `release/`。桌面原生控件和 Foundation 实机语义未验证。

## 2026-10-12 HFS+ Modified NFD/NFC（未发行源码）
依据 CotEditor 7.1.1 [`String+Normalization.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/StringUtils/String%2BNormalization.swift)，Text > 文本转换 > Unicode 规范化现提供 Modified NFD 与 Modified NFC，排列在标准规范化形式旁；有选区时处理选区，无选区时沿用光标所在单词目标，不新增快捷键。实现用生成的 Unicode 3.2 规范分解数据、HFS+ 不分解范围与 `Full_Composition_Exclusion` 分段合成规则近似 CotEditor 的历史 HFS+ 变换，不调用 macOS CoreFoundation 文件系统 API，也不把普通 JavaScript NFD/NFC 冒充为修改型形式。

此前显式运行的 5 个定向 `.test.js` 文件 **144/144**，12 个变更 JavaScript 源码/测试 `node --check` **12/12**；完整套件未运行。正式版本仍为 **0.5.16**；改动只在未发行工作树，未构建、打包、启动 Electron 或运行 UI smoke，未触碰 `dist/` / `release/`。平台原生菜单、文本布局和 Foundation 实机行为未验证，不据此声称 1:1 等价。

## 2026-10-12 自动换行续行缩进（未发行源码）

依据 CotEditor 7.1.1 [`WindowSettingsView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Settings%20Window/Panes/WindowSettingsView.swift)、[`DefaultSettings.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift) 和 [`TextContainer.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/TextContainer.swift)，补齐默认开启的“缩进自动换行行”设置及 0–99 列附加缩进。续行依据行首空格/Tab 的显示列数加附加列计算；在水平软换行时按字体空格宽度调整行装饰，支持从右到左方向，纵排或关闭自动换行时不作用。仅改变视图呈现，不改正文；设置通过既有本机偏好与设置文件导入/导出持久化，无新增菜单或快捷键。

显式运行 `test/hanging-indent.test.js`、`test/settings.test.js`、`test/settings-file.test.js`、`test/accessibility.test.js`，**81/81** 通过；变更 JS `node --check` **5/5**；PostCSS CSS 解析通过，HTML **457** 个 ID 唯一。正式版本仍为 **0.5.16**；只修改工作树源码、测试与文档，未运行完整测试套件、未构建/打包/启动 Electron、未做 UI smoke，未改 `dist/` 或 `release/`。CotEdit 用 CodeMirror/CSS 对 Cocoa `NSTextContainer` 近似；静态和 Node 测试不证明真实桌面排版、原生 UI/UX 或平台行为 1:1。发行目录摘要未决仍沿用先前记录；本轮未复查或触碰相关目录。

## 2026-10-12 大纲导航栏与菜单（未发行源码）

依据 CotEditor 7.1.1 官方[大纲菜单指南](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/howto_show_outlinemenu.html)、[主窗口菜单定义](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Storyboards/Base.lproj/Main.storyboard) 与[导航栏默认设置](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift)，在编辑器上方新增默认显示的导航栏：大纲菜单按插入点定位当前项，前后箭头沿用既有大纲跳转，选择条目跳至对应行；“显示导航栏”由 View 菜单和设置面板控制并持久化。“查找 > 打开大纲菜单”聚焦该选择器；按 CotEditor 4.1.1 官方[快捷键自定义说明](https://coteditor.com/releasenotes/4.1.1.en)提供可自定义快捷键，但不臆造默认键位。

显式列出的 9 个定向测试文件 **198/198**；14 个变更 JavaScript 源码/测试 `node --check` **14/14**；PostCSS CSS 解析通过，HTML **440** 个 ID 唯一。正式版仍为 **0.5.16**，本增量未发行；未运行完整测试套件、未构建/打包/启动 Electron、未做 UI smoke。静态/Node 检查不证明 macOS 原生控件视觉、键盘派发或读屏器等价；大纲识别仍受 CotEdit 各语法解析器支持范围限制。本轮未改 `dist/` 或 `release/`；只读计数为 4/116，与先前记录的 4/115 不一致，且只读重算摘要亦与先前兼容记录不同。本轮没有独立起始基线、项目无可用 Git 元数据，来源与发生时间无法确认；不尝试修复，也不声称当前摘要未变。

## 2026-10-12 文稿检查器 Finder 标签（未发行源码）

依据 CotEditor 7.1.1 [`FileAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/DocumentFile/FileAttributes.swift) 与 [`FinderTag.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/DocumentFile/FinderTag.swift)，在文件区段增加只读 Finder 标签名称与颜色点。macOS 从文件本地扩展属性读取 bplist 字符串数组；解析有 64 KiB、256 个对象、32 个标签及 256 字符标签名上限。Linux/Windows 显示“仅 macOS”；新建/远程文稿不伪造本地标签。标签只在打开/最近保存时读取，不持久化，不新增菜单、快捷键、权限或文稿恢复数据。

显式指定的检查器、菜单兼容与无障碍测试 **61/61**；5 个变更 JavaScript 文件 `node --check` **5/5**；PostCSS CSS 解析通过，HTML **434** 个 ID 唯一。完整测试套件未运行；未构建、打包、启动 Electron 或运行 UI smoke。原生 macOS 限制见[兼容性记录](docs/compatibility.md)。

## 2026-10-12 Markdown 自定义语法 blockquote 高亮（未发行源码）

依据 CotEditor 7.1.1 官方 [`Markdown.cotsyntax/Regex/Highlights.json`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/Syntaxes/Markdown.cotsyntax/Regex/Highlights.json) 的 `keywords` blockquote 规则，补齐此前因终止表达式需要跨行而被 CotEdit 逐行语法 tokenizer 拒绝的高亮。仅当类别、`begin`、`end` 与 `isMultiline` 均精确匹配该上游规则时，CotEdit 才用跨行范围状态近似其“空白行或文稿结束”为终止：引用标记和其段落续行着色，空/空白行及后续普通段落不着色。其他多行正则和正则安全限制不放宽。

`test/cot-syntax-regexp.test.js` 与 `test/cot-syntax-mode.test.js` 显式串行 **29/29**；本轮四个变更 JavaScript 源码/测试 `node --check` **4/4**。正式版本仍为 **0.5.16**，此改动只在未发行源码、测试与文档；未运行完整测试套件、构建、打包、启动 Electron 或 UI smoke，未修改 `dist/` / `release/`，也未改恢复、权限、隐私或数据保留策略。

本适配仅针对该条官方 blockquote 规则；空白行终止由逐行状态模拟，不实现完整 Markdown 解析器，不能据此声称行尾/平台着色与 CotEditor 原生完全等价。详细范围见[兼容性记录](docs/compatibility.md)。

## 2026-10-12 多重替换管理器窗口可调整大小（未发行源码）

依据 CotEditor 7.1.0 [发布说明](https://coteditor.com/releasenotes/7.1.0.en) 对部分设置对话框可调整大小的改进，将包含定义列表、长规则表和多项正则选项的多重替换管理窗口接入 CotEdit 现有受限可调整布局。窗口尺寸受可视区域约束；列表与编辑表单继续按可用高度滚动。多重替换行为、导入、菜单和快捷键不变。

显式串行运行 `test/dialog-resizing.test.js` 与 `test/multiple-replace-import.test.js` **28/28**；`test/dialog-resizing.test.js` `node --check` **1/1**；CSS PostCSS 解析通过，HTML **433** 个 ID 唯一。完整测试套件未运行。正式版本仍为 **0.5.16**；仅修改未发行源码、测试和文档，未构建、打包、启动 Electron 或运行 UI smoke；`dist/` 4 个文件与 `release/` 115 个文件摘要未变。桌面实测限制见[兼容性记录](docs/compatibility.md)。

## 2026-10-12 状态栏背景外观选择（未发行源码）

依据 CotEditor 7.1.0 [发布说明](https://coteditor.com/releasenotes/7.1.0.en)、7.1.1 [外观设置帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/settings_appearance.html) 及 [`DefaultSettings.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift) 的 `prefersOpaqueBarBackground=false`，新增“状态栏使用不透明背景”开关。默认关闭时状态栏使用编辑器主题背景；开启时使用应用面板底色。该偏好通过现有本机设置与设置文件导入/导出持久化，与原“显示状态栏”及其菜单复选项相互独立；无新菜单、快捷键或 IPC。

本实现用纯色主题匹配模拟背景反映，不等同 macOS 27 的原生半透明/材质效果。定向显式测试 `settings.test.js`、`settings-file.test.js`、`accessibility.test.js`、`coteditor-menu-parity.test.js` **94/94**；变更 JavaScript `node --check` **5/5**；PostCSS CSS 解析通过；HTML **433** 个 ID 均唯一。未运行完整测试套件（最近一次记录为 747/747，非本轮结果）。正式版仍为 **0.5.16**，仅修改未发行源码、测试和文档，未构建、打包、启动 Electron 或运行 UI smoke；`dist/` 4 个文件与 `release/` 115 个文件摘要均与本轮开始前一致，未改写这两个目录。

## 2026-10-12 打开文稿时检测缩进样式（未发行源码）

依据 CotEditor 7.1.1 [编辑设置帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/settings_edit.html) 与 [`DefaultSettings.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift)，新增默认开启、可持久化且随设置文件导入/导出的“打开文稿时检测缩进样式”。仅对已打开文稿扫描最多 1 MB / 10,000 行；至少两条一致的纯空格或纯 Tab 缩进行才覆盖当前文稿的普通 Tab 插入及软 Tab Backspace。混合前缀、平票或样本不足沿用原语法/全局设置。现有“使用空格缩进”菜单显示活动文稿的有效状态；用户点击后清除该文稿的检测覆盖并切回手动设置。选区 Tab 缩进和 Return 自动缩进保持原逻辑，不新增菜单项、快捷键、IPC、文稿保存字段或恢复数据字段。

7 个明确指定测试文件 **174/174**；8 个变更 JavaScript 文件 `node --check` **8/8**；HTML **432** 个 ID 唯一。`dist/` 4 个文件、`release/` 115 个文件的聚合 SHA-256 与变更前检查点一致。正式版仍为 **0.5.16**；本轮只改未发行源码、测试和文档，未构建、打包、启动 Electron 或运行 UI smoke。检测阈值是 CotEdit 有界启发式，未证实与 CotEditor 内部算法逐行一致；静态/Node 测试不证明真实菜单布局、原生键盘派发、读屏器或 macOS/Windows 行为 1:1。详见[兼容性记录](docs/compatibility.md)。

## 2026-10-12 自动缩进行为设置（未发行源码）

依据 CotEditor 7.1.1 [编辑设置帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/settings_edit.html) 与 [`DefaultSettings.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift)，增加默认开启的“自动缩进”偏好。开启时沿用现有 Return/Enter 缩进；关闭时插入不继承上一行缩进的新行。设置可持久化并随设置文件导入/导出；文稿切换与分屏视图同步应用。未新增菜单、快捷键或 IPC，配对字符输入时的 `indentOnInput()` 行为保持不变。

四个定向测试文件 **95/95**；显式路径传入 **78** 个顶层 `.test.js` 串行回归 **747/747**；六个变更 JavaScript 文件 `node --check` **6/6**；HTML **431** 个 ID 唯一。正式版仍为 **0.5.16**；未构建、打包、启动 Electron 或运行 UI smoke，未写入 `dist/` / `release/`，未改变恢复、权限、隐私或数据保留策略。Node/静态测试不证明原生键盘派发、真实桌面布局、读屏器及 macOS/Windows 1:1 等价。

## 2026-10-12 文稿检查器所有者 UID/GID（未发行源码）

CotEditor 7.1.1 的 [`DocumentInspectorView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Inspector/DocumentInspectorView.swift) 在 File 区段列出 Owner。CotEdit 现于非模态检查器文件分组显示数值 UID/GID，复用文稿打开和原子保存后已经取得的 `fs.stat` 快照；不读取账户数据库、不解析用户名、不新增 IPC 通道或文件读取，也不改菜单/快捷键。值只反映打开/最近保存时快照；Windows 不把无意义的 Node `uid/gid` 当作 POSIX 所有者，显示不可用。Finder 标签仍未实现。

定向检查器/菜单兼容/无障碍测试 **54/54**；显式逐项传入 **78** 个顶层 `test/*.test.js` 串行测试 **739/739**；六个变更 JavaScript 源码/测试 `node --check` **6/6**；HTML **429** 个 ID 唯一。正式版仍为 **0.5.16**；只修改未发行源码、测试与文档，未构建、打包、启动 Electron 或运行 UI smoke，未改写 `dist/`、`release/`。Node/静态检查不验证真实桌面布局、账户名映射、Finder/Explorer、读屏器或 macOS/Windows 原生行为 1:1；未改变恢复、权限、隐私或数据保留策略。

## 2026-10-12 注释符后添加空格偏好（未发行源码）

依据 CotEditor 7.1.1 [编辑设置帮助](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Resources/CotEditor.help/Contents/Resources/en.lproj/pgs/settings_edit.html)、[`DefaultSettings.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift) 与 [`String+Commenting.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextEditing/String%2BCommenting.swift)，新增默认开启的“注释符后添加空格”持久化设置。开关覆盖 Toggle Comment、Comment Out、行注释、块注释及显式取消注释；关闭时不为新注释插入 spacer，并保留原注释文本已有的相邻空格。设置写入现有偏好及设置文件导入/导出；不新增菜单项或快捷键，默认输出不变。

五个定向 `.test.js` 文件 **141/141**；逐项列出的 **78** 个顶层 `.test.js` 串行测试 **743/743**；变更 JavaScript 源码/测试 `node --check` **8/8**；HTML **430** 个 ID 均唯一。正式版仍为 **0.5.16**，本增量未发行；只修改源码、测试与文档，未构建、打包、启动 Electron 或运行 UI smoke，未改写 `dist/` / `release/`，未改变恢复、权限、隐私或数据保留策略。Node/静态测试不证明原生 Settings UI、读屏器、macOS/Windows 菜单绘制或编辑器 1:1 等价。

## 2026-10-12 文稿检查器路径定位到文件管理器（未发行源码）

依据 CotEditor 7.1.1 [`DocumentInspectorView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Inspector/DocumentInspectorView.swift) 的 File > Full Path 行及 `NSWorkspace.shared.activateFileViewerSelecting` 动作，在 CotEdit 路径旁增加可聚焦的“在文件管理器中显示”按钮。它只在桌面端已有本地路径且非远程文稿时出现，复用现有 `revealFile` IPC、路径访问检查与 Electron `shell.showItemInFolder`；未增加文件读取 API、菜单项、快捷键或路径元数据访问。较早增量中的“尚未实现”记录保留为当时状态；当前差异以兼容性矩阵为准。

检查器/菜单/无障碍定向测试 **102/102**；显式列出的 **76** 个顶层 `test/*.test.js` 串行测试 **737/737**；变更 JavaScript `node --check` **2/2**；PostCSS CSS 解析通过，HTML **428** 个 ID 唯一。正式版仍为 **0.5.16**；仅修改未发行源码、测试和文档，未构建、打包、启动 Electron 或运行 UI smoke，未修改 `dist/`、`release/`。静态与 Node 测试不证明 macOS Finder/Linux 文件管理器/Windows Explorer 的实际弹出、选中、键盘/读屏器交互或视觉等价；操作可能把目标文件名/路径显示给系统文件管理器。未改变恢复、权限、隐私或数据保留策略。

## 2026-10-12 文稿检查器创建/修改时间（未发行源码）

依据 CotEditor 7.1.1 [`DocumentInspectorView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Inspector/DocumentInspectorView.swift) 的 File 区段，在 CotEdit 非模态文稿检查器新增“创建时间”和“修改时间”。时间戳复用本地文稿读取时的 `fs.stat` 结果，并在现有原子保存成功后尽力读取更新；无法读取保存后元数据不会把已成功写入报告为失败。无本地文件显示“无本地文件”，文件系统不提供创建时间时显示“不可用”；显示值是打开/最近保存时的快照，外部修改不会自动刷新。本轮未新增文件访问 API，也未改恢复快照、权限、隐私或数据保留策略。

检查器定向测试 **8/8**，显式列出的 78 个顶层 `.test.js` 串行测试 **735/735**，变更 JavaScript/CJS `node --check` **5/5**。正式版本仍为 **0.5.16**；只修改未发行源码、测试与文档，未构建、打包或运行 UI smoke，未修改 `dist/`、`release/`。Node/static 检查不验证真实桌面布局、文件系统时间精度或 macOS/Windows 原生 Inspector 等价；详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：依据 CotEditor 7.1.1 [`DocumentInspectorView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Inspector/DocumentInspectorView.swift) 与 [`EditorCounter.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Scanners/EditorCounter.swift)，在非模态文稿检查器中补齐可折叠“字符”区段。首个选区必须恰为一个完整字素簇才显示码位；单 Unicode 标量另显示名称、Unicode 区块和一般类别，多标量字素只列码位，空选区、多字素选区或字素不完整选区显示未选择状态；选择更新时异步刷新并丢弃过时结果。定向测试 **27/27**，显式列出的 78 个 `.test.js` **730/730**，改动 JavaScript `node --check` **5/5**，PostCSS CSS 解析通过，HTML **423** 个 ID 唯一。正式版仍为 **0.5.16**；只修改未发行源码、测试和文档，未构建、打包或运行 UI smoke，未改 `dist/`、`release/`、恢复、权限、隐私或数据保留策略。字符分段使用 JavaScript `Intl.Segmenter`，Unicode 属性来自本项目 Unicode 17 数据；不代表 Foundation/AppKit 同版本语义或原生 Character 面板。前次记录中“字符详情仍为独立检查器”的差异已由本轮核心摘要区段补齐，平台视觉/读屏器仍未实测，详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：依据 CotEditor 7.1.1 [`DocumentInspectorView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Inspector/DocumentInspectorView.swift) 的 File > Size，在文稿检查器新增“文件大小”行；打开时取实际读取字节，桌面保存时取原子写入实际编码字节，并显示易读十进制单位与精确字节数。新文稿/远程文稿显示无本地文件；大小是打开或最近保存时的快照，不自动反映其他程序的外部修改。定向测试 **29/29**，显式列出的 78 个 `.test.js` **732/732**，JavaScript `node --check` **7/7**，源 CSS PostCSS 解析通过，HTML **424** 个 ID 唯一。正式版仍为 **0.5.16**；只改未发行源码、测试和文档，未构建、打包或运行 UI smoke，未改 `dist/`、`release/`、恢复、权限、隐私或数据保留策略。本段尾部“不完整”列表记录当时状态；创建/修改时间、权限与文件管理器定位已在后续增量补齐，所有者 UID/GID 见本文开头最新记录，Finder 标签仍未实现；跨平台原生 UI/读屏器未验证，详见[兼容性记录](docs/compatibility.md)。


本轮未发行增量：依据 CotEditor 7.1.1 [`DocumentInspectorView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Inspector/DocumentInspectorView.swift) 中的 `HostedPaneView` 与 DisclosureGroup 分组，将 CotEdit 原文稿检查器从阻塞编辑的模态对话框改为编辑区右侧非模态停靠面板；编辑可继续进行，文件/文本设置/计数分组可折叠，统计值继续随活动文稿、光标与主选区实时刷新。定向 Node **47/47**，显式列举的 78 个 `.test.js` **729/729**，改动 JavaScript `node --check` **3/3**，PostCSS CSS 解析通过，HTML **418** 个 ID 唯一。正式版仍为 **0.5.16**；仅改未发行源码、测试和文档，未构建、打包或运行 UI smoke，未改 `dist/`、`release/`、恢复、权限、隐私或数据保留策略。此为应用内停靠面板而非原生 Cocoa pane；Character 区段仍由独立 Unicode 字符检查器提供，原生文件元数据、Finder 动作、实际桌面布局/读屏器以及 macOS/Windows 行为未验证，详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：依据 CotEditor 7.1.1 [`DocumentInspectorView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Inspector/DocumentInspectorView.swift)，为 CotEdit 文稿检查器补齐语法模式、词数、字素簇字符数、光标行列和主选区字符数，并随现有文稿/选区更新路径刷新。定向 Node **26/26**、完整显式 Node **729/729**、改动 JavaScript 源码/测试 `node --check` **5/5**、HTML **418** 个 ID 均唯一。正式版仍为 **0.5.16**；仅修改未发行源码、测试和文档，未构建、打包或运行 UI smoke，也未修改 `dist/`、`release/`、恢复、权限、隐私或数据保留策略。词数沿用 CotEdit 当前 Unicode 字母/数字/下划线 token 口径；字素计数使用 JavaScript `Intl.Segmenter`，不声称等同 Foundation/ICU；选区统计只计当前主选区。该次统计改进当时仍使用对话框；随后已改为非模态停靠面板，见本文件最新记录。Node/静态检查不验证原生菜单、实际视觉、读屏器或 macOS/Windows 行为等价，详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：对照 CotEditor 7.1.1 的 [`DefaultSettings.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift)（默认语法为 Plain Text）与 [`DirectoryDocument.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document/DirectoryDocument.swift)（文件夹中新建文稿取默认语法的首个扩展名），新增持久化“新文稿默认语法”设置，支持 CotEdit 内置语法及已导入 `.cotsyntax`；新未保存文稿会采用所选语法/扩展名，文件夹浏览器的新文件也按此扩展名创建。设置随设置文件导入/导出；若偏好引用了未安装的语法，UI 标示“未安装”，新建流程回退纯文本 `.txt`；Electron 主进程校验扩展名字符并保留排他创建和目录边界校验。定向 Node **101/101**、完整显式 Node **719/719**、变更 JavaScript `node --check` **10/10**、HTML **412** 个 ID 唯一。正式版仍为 **0.5.16**；仅修改未发行源码、测试和文档，未构建、打包或运行 UI smoke。Node/static 检查不验证 Electron 原生菜单、实际设置面板/文件保存对话框、读屏器或 macOS/Windows 行为 1:1；未新增快捷键，也未改动恢复、权限、隐私或数据保留策略。详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：依据 CotEditor 7.1.1 `FilePreviewView.swift` 的外部编辑器菜单，在 Linux 文件夹预览中按 GIO 当前 MIME handler 列出已注册应用；默认 handler 置顶，其他应用按 locale 排序，重名时仅在桌面条目有版本号时显示版本，并保留“其他应用…”。选择应用后，主进程重新校验根目录内普通文稿并重查该应用注册状态，再用 `gio launch` 固定参数调用。GIO 不可用时原有默认／其他应用入口不变；macOS/Windows 仍使用原菜单。定向测试 **11/11**、完整显式 Node **711/711**、变更 JavaScript 语法检查 **5/5**、CSS PostCSS 解析通过、HTML **411** 个 ID 唯一。正式版仍为 **0.5.16**；仅修改未发行源码、测试和文档，未构建、打包或运行 UI smoke；`dist/` 与 `release/` 文件数与摘要未变。当前 Linux GIO CLI 已核对，但未启动桌面应用；Node/mock 测试不验证真实菜单绘制、GIO app 启动、读屏器或 macOS/Windows 行为等价。未修改快捷键、恢复、权限、隐私或数据保留策略，详见[兼容性记录](docs/compatibility.md)。

本项目基于 Electron、Vite 和 CodeMirror 6 的跨平台纯文本与代码编辑器，借鉴 CotEditor 的桌面编辑工作流，但不是 CotEditor 的移植。上游的 Swift/Cocoa 文稿模型、macOS 原生菜单和辅助技术行为，无法在 Windows/Linux 上做到逐项一致。

本轮未发行增量：依据 CotEditor 7.1.1 [`EditorTextView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView.swift) 对 `rangeOfComposedCharacterSequences` 扩展配对搜索范围的处理，CotEdit 的双击配对回退现在会在原始 ±50,000 UTF-16 搜索边界被扩展字素簇截断时，将搜索边界扩展到已确认的字素边界。边界探测每侧最多读取 4,096 UTF-16 单元；最大切片为 108,193 单元，超出探测预算、无法确认完整边界时保留默认选择，不猜测。定向双击测试 **18/18**、完整显式 Node 测试 **700/700**，变更 JavaScript `node --check` **2/2**。正式版仍为 **0.5.16**；只改未发行源码、测试和文档，未构建、未打包、未运行 UI smoke；`dist/` 与 `release/` 的 **119** 个非临时文件摘要未变。`Intl.Segmenter` 的 Unicode/ICU 数据版本与 Swift/Foundation 可能不同；测试不证明原生鼠标命中或各平台 UI/UX 1:1 等价，菜单、快捷键、恢复、隐私与数据保留行为未变，详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：依据 CotEditor 7.1.1 [`EditorTextView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView.swift)，把双击配对引号/括号回退搜索限制在点击位置前后各 **50,000 个 UTF-16 单元**，通过 CodeMirror `sliceString` 读取局部文本并把命中范围映射回全文坐标；现有语法 Token 与自定义 `.cotsyntax` 优先逻辑不变。定向双击/文本工具测试 **44/44**，完整显式 Node 测试 **697/697**，变更 JavaScript `node --check` **2/2**。正式版仍为 **0.5.16**；只修改未发行源码、测试及文档，未构建、打包或运行 UI smoke；`dist/` 与 `release/` 的 **119** 个非临时文件聚合 SHA-256 保持 `d628dc2523507d68b22ea7833e3d350fc9ab09101dc6f33f94d6e530a994d7d1`。CotEditor 还会把窗口边界扩展至组合字符边界；CotEdit 使用直接 UTF-16 局部切片，边界落在扩展字素簇时可能不同。本改动只限制配对回退扫描，不限制前置语法树解析，也不验证真实桌面鼠标命中或原生 UI/UX 1:1 等价；菜单、快捷键、恢复、隐私及数据保留行为未变，详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：依据 CotEditor 7.1.1 `EditorTextView.swift` 的 `.selectByWord` 语法范围处理，JavaScript/Python 等 CodeMirror 内置语法现可在双击字符串 Token 的首/尾 ASCII `"`、`'` 或 `` ` `` 时选中整个语法 Token（含引号）；点击字符串内容仍只选配对内文，自定义 `.cotsyntax` 引号及其前缀拒绝逻辑优先保留。定向双击测试 **12/12**，显式全量 Node 测试 **694/694**，两份变更 JavaScript `node --check` **2/2**。正式版仍为 **0.5.16**；仅修改未发行源码、测试与文档，未构建、未打包或运行 UI smoke；`dist/` 与 `release/` 的 **119** 个非临时文件聚合 SHA-256 保持 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。仅覆盖本轮实际验证的 JavaScript/Python 解析节点与明确引号边界，不声明原生 AppKit、其他语法 Token 或跨平台鼠标交互 1:1 等价；菜单、快捷键、恢复、权限、隐私与数据保留行为未变，详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：依据 CotEditor 7.1.1 `EditorTextView.swift`、`QuotePairRule.swift` 与官方 Python `.cotsyntax/Edit.json`，双击活动自定义语法中的单 Unicode 标量字符串/字符引号分隔符时，若命中实际 CodeMirror `string`/`character` Token 且规则前缀匹配，选中完整 Token（含分隔符）；按现有语法解析结果保留转义关闭符，前缀不匹配时不绕过规则。定向语法/双击 Node 测试 **36/36**，全量显式 Node 测试 **689/689**，本轮 6 个 JavaScript 文件 `node --check` **6/6**。正式版仍为 **0.5.16**；仅修改未发行源码、测试与文档，未构建、未打包或运行 UI smoke；`dist/` 与 `release/` 119 个非临时文件聚合 SHA-256 仍为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。多字符/多标量分隔符（如三引号）和 Swift `Character` 组合字素尚未覆盖；这只是 CodeMirror 语法 Token 范围的跨平台近似，不证明 macOS AppKit、Windows 实际桌面交互、原生菜单或快捷键逐项等价；恢复、隐私与数据保留行为未变，详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：依据 CotEditor 7.1.1 `EditorTextView.swift`、`QuotePairRule.swift` 与官方 Python `.cotsyntax/Edit.json`，双击活动自定义语法中的单 Unicode 标量字符串/字符引号分隔符时，若命中实际 CodeMirror `string`/`character` Token 且规则前缀匹配，选中完整 Token（含分隔符）；按现有语法解析结果保留转义关闭符，前缀不匹配时不绕过规则。定向语法/双击 Node 测试 **36/36**，全量显式 Node 测试 **689/689**，本轮 6 个 JavaScript 文件 `node --check` **6/6**。正式版仍为 **0.5.16**；仅修改未发行源码、测试与文档，未构建、未打包或运行 UI smoke；`dist/` 与 `release/` 119 个非临时文件聚合 SHA-256 仍为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。多字符/多标量分隔符（如三引号）和 Swift `Character` 组合字素尚未覆盖；这只是 CodeMirror 语法 Token 范围的跨平台近似，不证明 macOS AppKit、Windows 实际桌面交互、原生菜单或快捷键逐项等价；恢复、隐私与数据保留行为未变，详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：依据 CotEditor 7.1.1 `EditorTextView.swift`，无修饰键双击平衡引号、括号或尖括号内文时，CotEdit 现在优先选择最内层配对范围；普通文本、未配对符号及修饰键双击仍沿用原有 CodeMirror 行为。仅为跨平台选区算法近似，不包含上游自定义语法引号作用域或原生 AppKit 等价；本轮显式 Node 定向/全量测试及未改动范围校验详见[兼容性记录](docs/compatibility.md)。正式版仍为 **0.5.16**；未构建、未打包、未运行 UI smoke，也未改动恢复、隐私或数据保留行为。

本轮未发行增量：依据 CotEditor 7.1.1 `String+Commenting.swift`，自定义 `.cotsyntax` 现在保留有序的多组行注释符；Toggle Comment 的菜单预测与执行会按声明顺序检查候选，首个命中候选决定完整取消还是注释分支；显式“取消注释”在首选分隔符不匹配时继续尝试后续候选，插入仍使用首个分隔符。定向注释/语法/菜单测试 **137/137**，完整显式 Node 测试 **680/680**，变更 JavaScript `node --check` **4/4**。正式版仍为 **0.5.16**；仅改未发行源码、测试和文档，未构建、未打包或运行 UI smoke；`dist/` 与 `release/` 共 119 个非临时文件聚合 SHA-256 未变。此近似不覆盖多候选混合匹配以外的 Foundation 字符范围语义、结构化注释作用域，也不声明原生菜单、实体键盘或平台 UI/UX 1:1 等价；恢复、隐私与数据保留行为未变，详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：依据 CotEditor 7.1.1 `String+Commenting.swift`，保留并传递自定义 `.cotsyntax` 块注释的 `isNestable` 标记；Toggle Comment（语法同时有行/块注释）与显式“取消注释”在删除块包装前校验内部开闭分隔符平衡。平衡嵌套仍可移除所选外层包装；未闭合内层开始符或多余结束符不再被误当成外层结束符删除。定向语法/注释测试 **50/50**，显式项目 Node 测试 **678/678**，变更 JavaScript `node --check` **5/5**。正式版仍为 **0.5.16**；只改未发行源码、测试和文档，未构建、未打包、未运行 UI smoke。此增量不改变仅块注释语法的 Toggle 回退，也不解析字符串/结构化语法作用域，不声明原生菜单、实体键盘或 macOS/Windows UI/UX 1:1 等价；恢复、隐私及数据保留行为未变，详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：依据 CotEditor 7.1.1 `String+Commenting.swift`，Toggle Comment 的块注释预演现把空光标扩展到所在行内容；当每个目标行均被块注释包裹时，菜单状态与实际操作共用同一预演结果并取消注释。重复空光标目标会合并；部分命中仍让全部目标进入注释分支。定向 `editor-commands`、`menu-state`、`menu-coverage`、`coteditor-menu-parity` 显式测试 **114/114**，显式项目 Node 测试 **675/675**，修改的 JavaScript `node --check` **2/2**。正式版仍为 **0.5.16**；仅修改未发行源码、测试和文档，未构建、未打包、未运行 UI smoke。`dist/` 4 个文件与 `release/` 115 个文件的逐文件摘要清单改动前后相同，清单 SHA-256 为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。本项仅扩展同时定义行/块注释语法下 Toggle Comment 的空光标块取消检测；不扩展仅块注释回退、嵌套平衡、结构化作用域，也不声明原生菜单、实体键盘或 macOS/Windows UI/UX 1:1 等价。恢复、隐私与数据保留行为未改变，详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：CotEditor 7.1.1 按语法中块注释分隔符的声明顺序逐一尝试取消注释；CotEdit 自定义语法此前只向命令暴露第一组分隔符。现在自定义语法保留完整的有序块注释列表，显式“取消注释”按顺序预演各组，首个命中对用于单次编辑；覆盖空光标/非空选区混合、部分命中及 Undo/Redo。定向注释/菜单/语法模式测试 **128/128**，显式项目范围 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **671/671**，变更 JavaScript `node --check` **4/4**。正式版仍为 **0.5.16**；未构建、未打包或运行 UI smoke；`dist/` 与 `release/` 的 **119** 个非临时文件摘要前后均为 `48b70018fe25011cf39f257334fb18c41c5926af225d87c22fe0cf70a752c76b`。此增量只扩展显式取消注释，不扩展 Toggle Comment 或嵌套注释平衡；不声明原生菜单、实体键盘或 macOS/Windows UI/UX 1:1 等价。恢复、隐私和数据保留行为未变，详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：依据 CotEditor 7.1.1 `String+Commenting.swift`，显式“取消注释”在空光标与非空选区混用时，也把空光标所在行纳入块注释优先检测；重复目标合并后预演 CodeMirror `blockUncomment`，命中时单次提交并映射原选择，未命中则保留原行注释回退。回归覆盖跨行混合选择、部分块命中、Undo/Redo 与行注释回退。定向注释/菜单测试 **109/109**，显式项目范围 `TMPDIR=/dev/shm node --test --test-concurrency=1 test/*.test.js` **669/669**，变更 JavaScript `node --check` **2/2**。正式版仍为 **0.5.16**；只修改未发行源码、测试和文档，未构建、未打包、未运行 UI smoke；`dist/` 与 `release/` 119 个非临时文件摘要未变。本项仍不覆盖嵌套/多变体注释或原生菜单、实体键盘及平台 UI/UX 1:1 等价；恢复、隐私和数据保留行为未改变，详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：依据 CotEditor 7.1.1 将 Comment Out 与 Toggle Comment/Uncomment 分作独立操作的实现，在“注释”菜单新增无快捷键“注释所选内容”：语法有行注释分隔符时优先采用行注释，否则回退到块注释；无分隔符或只读时不修改文稿。菜单、preload IPC 白名单、renderer 路由、启用状态及行优先/块回退/无语法无操作/Undo/Redo 均有 Node 回归。定向注释/菜单测试 **105/105**；项目测试范围 `node --test --test-concurrency=1 test/*.test.js` **665/665**；8 个变更 JavaScript 文件 `node --check` **8/8**。`dist/` 与 `release/` 共 **119** 个非临时文件摘要保持 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`；正式版仍为 **0.5.16**。验证时曾误用不带文件范围的 `node --test`，意外自动启动 `test/electron-ui-smoke.cjs`；该 UI smoke 在 Quick Actions/文件拖放步骤因目标菜单节点为 `null` 而失败，之后未重跑。未构建或打包。实现仅使用 CodeMirror 当前暴露的首个行/块分隔符，静态路由与 Node 测试不证明原生菜单、实体键盘或完整 CotEditor UI/UX 等价，详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：依据 CotEditor 7.1.1 `EditorTextView+Commenting.swift` 与 `String+Commenting.swift`，当语法同时提供行/块注释且选区有完整块包裹时，Toggle Comment 现在优先取消块注释；多选区只有全部匹配才走取消分支，部分匹配仍按注释掉处理。键盘、菜单及自定义快捷键共用原命令路由。定向注释/菜单 Node 测试 **53/53**，完整串行 Node 测试 **662/662**，变更 JavaScript `node --check` **2/2**；`dist/` 与 `release/` 的 **119** 个非临时文件摘要未变：`8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。正式版仍为 **0.5.16**；未构建、未打包、未运行 UI smoke。范围仅覆盖当前 CodeMirror 语法暴露的首个块分隔符对，不代表嵌套块注释或原生 UI/物理键盘已完全等价，详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：依据 CotEditor 7.1.1 [`EditorTextView+Commenting.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView%2BCommenting.swift) 与 [`String+Commenting.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextEditing/String%2BCommenting.swift)，Toggle Comment 在无行注释符但有块注释符的语法中现回退为按行块注释；快捷键、原生菜单和可自定义快捷键共用同一路由，菜单“注释掉/取消注释”状态以该路径的预演结果同步。仅块注释语法的连续/不连续选区编辑、取消、菜单状态和 Undo/Redo 有 Node 回归。定向注释/菜单 Node 测试 **52/52**，完整串行 Node 测试 **661/661**，本轮 4 个变更 JavaScript 文件 `node --check` **4/4**；`dist/` 与 `release/` 的 119 个非临时文件摘要保持 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。正式版仍为 **0.5.16**；未构建、未打包、未运行 UI smoke。仅对齐无行注释语法的回退；不表示块注释检测的全部 `canUncomment` 语义、显式 Comment Out/Uncomment 或原生桌面 UI 已完全等价，详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：Toggle Comment 现在把单一连续选区及多个不连续选区中的唯一目标行合并计算最小共同视觉缩进；空格计 1 列、Tab 按当前 Tab Width 计列，目标落在 Tab 内时不拆分。依据 CotEditor 7.1.1 `String+Commenting.swift` 对 `selectedRanges` 的范围处理与视觉缩进算法；多选区/空白行/Tab 边界/撤销重做均有 Node 回归。定向测试 **28/28**、完整串行 Node **657/657**、变更 JavaScript `node --check` **2/2**。正式版仍为 **0.5.16**；未构建、未打包、未运行 UI smoke；不宣称原生编辑器或全部注释模式 1:1 等价，详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：依据 CotEditor 7.1.1 [`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift) 的 `Kind` 属性行，普通文本文件夹预览现在在“编码”前显示通用“类型：文本”。该值仅在预览结果带有成功解码产生的编码标量时生成；媒体、可执行文件、二进制 plist 和未知状态继续沿用各自已有属性，不从扩展名或文件内容猜测 macOS UTType 名称。没有新增菜单、快捷键、文件读取、权限或保留行为。定向属性/菜单/目录预览串行 Node 测试 **80/80**，完整串行 Node **653/653**，变更 JavaScript `node --check` **2/2**；`dist/` 与 `release/` 119 个非临时文件前后聚合 SHA-256 均为 `2d3a24cc19f8482a2466d3e6ad5d1ad7cc1ac67da1a46f0b0433945d3e4ac017`。正式版本仍为 **0.5.16**；未构建、未打包、未运行 UI smoke。不构成原生 Quick Look/UTType 等价声明。

本轮未发行增量：依据 CotEditor 7.1.1 的 [`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift) 与 [`ImageAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/File%20Content%20Attributes/ImageAttributes.swift)，目录图像预览现把已识别色彩模型（RGB/Gray）与有限命名配置（sRGB/Display P3）分开显示，例如“色彩模型 RGB · 色彩配置文件 sRGB”；无 profile 的图像只显示已验证模型。主进程保留旧 `imageColorSpace` 字段，并新增 `imageColorModel`/`imageColorProfile` 白名单标量；未知、矛盾或带未解析 ICC 的声明仍不猜测。沿用最多 512 KiB 文件头读取，不解码/传递图像字节，不改菜单或快捷键。定向串行测试 **95/95**，完整串行 Node **644/644**，变更 JavaScript `node --check` **6/6**；`dist/` 与 `release/` 共 **119** 个非临时文件摘要改动前后均为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。正式版本仍为 **0.5.16**；未构建、未打包、未运行 UI smoke。色彩名称只对齐受限解析结果，不等同 AppKit/ImageIO profile 识别或 CotEditor 原生分行布局，不构成全量 1:1 parity，详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：文件夹 GIF 预览现在仅在 GIF87a/89a 首帧具有完整有效的全局或局部 RGB 调色板、帧范围与有界图像数据子块时显示通用“色彩模型 RGB”；沿用既有最多 512 KiB 预览前缀，不解码 LZW、不向 renderer 传图像字节，也不改菜单或快捷键。`image-dimensions`、`directory-search` 与 `menu-coverage` 定向串行测试 **94/94**，完整串行 Node **643/643**，三个变更 JavaScript 文件 `node --check` **3/3**。`dist/` 和 `release/` 共 **119** 个非临时文件改动前后聚合 SHA-256 均为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。正式版本仍为 **0.5.16**；未构建、未打包、未运行 UI smoke。GIF 头部/Node 测试不验证 GIF 解码器、CotEditor 的 ImageIO 映射或原生桌面布局等价，详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：文件夹 PNG 图像预览依据有效 IHDR `color type` 报告受限通用模型：0/4 为 `Gray`，2/3/6 为 `RGB`；先验证 IHDR CRC、格式字段及该类型允许的位深，索引色 type 3 还要求唯一、CRC 有效且条目数符合位深的 PLTE，并须在既有 512 KiB 预览前缀内到达 IDAT。有效显式 sRGB 声明仍优先；ICC profile、未知/畸形 cICP 或结构矛盾时不猜测命名色彩空间/模型。只向 renderer 返回 `Gray`/`RGB` 标量，不解码、不传递图像字节，无菜单或快捷键变化。依据 CotEditor 7.1.1 `ImageAttributes` 属性工作流及 PNG 规范；不等同 ImageIO/AppKit 色彩管理或 Quick Look。图像解析/目录预览/菜单静态定向测试 **91/91**，完整串行 Node **640/640**，改动 JavaScript `node --check` **3/3**。正式版仍为 **0.5.16**；未构建、未打包、未运行 UI smoke。`dist/` 与 `release/` 共 119 个非临时文件前后聚合 SHA-256 均为 `4a8c5fcd39def0271cf9073d39365937aef07082334b3f62ce20c6005442b724`。Linux Node 测试不证明各平台原生图像解码、桌面布局或辅助技术 1:1 等价，详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：经典 TIFF 的唯一 IFD0 `PhotometricInterpretation`（tag 262）为 `SHORT/count=1/value=0`（WhiteIsZero）或 `1`（BlackIsZero）时，文件夹图像预览现在显示通用“色彩模型 Gray”；这两个 TIFF 规范值覆盖灰度/二值图像，不推断 ICC 配置文件。若存在 ICC、重复/畸形标签、EXIF 未校准/保留值或与 EXIF sRGB 声明冲突，则保持未知。仅回传固定 `Gray` 标量，沿用 512 KiB 读取上限，不解码或传图像字节；不增加菜单或快捷键。定向解析/目录预览/菜单静态测试 **90/90**、完整串行 Node **639/639**、改动 JavaScript `node --check` **5/5**。正式版仍为 **0.5.16**；未构建、未打包、未运行 UI smoke。`dist/` 与 `release/` 共 119 个非临时文件聚合 SHA-256 前后均为 `54ee6bbd69b23393e9fe697fc2829f30b1e604461d2ae3ae322ef663a48eb6c9`。这只是受限 TIFF 模型标记，不等于 CotEditor 的 ImageIO/AppKit 色彩空间识别或各平台原生预览。详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：文件夹 TIFF 图像预览现在会在既有 512 KiB 前缀中识别 EXIF IFD `ColorSpace`（tag 40961）为 `SHORT/count=1/value=1` 的显式 sRGB；若 TIFF IFD0 或 Exif IFD 声明 ICC profile tag 34675，则不显示推断色彩空间。未校准值、保留值、畸形 IFD 均保持未知；仅回传固定 `sRGB` 标量，不解码图像或传递图像字节。CotEditor 7.1.1 的 `ImageAttributes`/预览显示色彩空间属性，但这项受限解析不等同 AppKit/ImageIO 色彩管理。图像解析与目录预览定向测试 **38/38**，完整串行 Node **636/636**，变更 JavaScript 语法检查 **3/3**；正式版仍为 **0.5.16**。未构建、未打包、未运行 UI smoke，`dist/` 与 `release/` 119 个非临时文件摘要前后均为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：文件夹 PNG 预览现在还会识别规范定义的 CICP sRGB 信号 `[1, 13, 0, 1]`（BT.709 primaries、IEC 61966-2-1 transfer、PNG RGB identity matrix、full range），不再只认 `sRGB` chunk。仅当 cICP chunk 在 PLTE/IDAT 前完整出现、长度和 CRC 有效且无重复时返回固定 `sRGB` 标量；高优先级但未知的 cICP 不回退猜测较低优先级的 `sRGB` chunk。仍只检查既有 512 KiB 预览缓冲区，不解码或向 renderer 传图像字节。图像解析/目录预览定向测试 **36/36**，完整串行 Node **634/634**，变更 JavaScript 语法检查 **3/3**；正式版仍为 **0.5.16**。未构建、未打包、未运行 UI smoke，未写 `dist/` 或 `release/`；首轮全量测试曾因根文件系统临时写入 `ENOSPC` 有 1 项失败，改用 `/dev/shm` 临时目录后全量通过，未清理或删除文件。此受限解析不等同 CotEditor 的 AppKit/ImageIO 色彩管理，详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：依据 CotEditor 7.1.1 的 [`PreviewDocument.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document/PreviewDocument.swift) 及 Apple QuickTime `mvhd`/`tkhd` 定义，文件夹预览新增受限 ISO BMFF 影片元数据读取：只在既有 512 KiB 前缀内完整读到 `moov` 时，显示电影时长和按视频轨道矩阵方向换算的显示尺寸；支持 `mvhd`/`tkhd` 版本 0/1 与扩展长度 atom。`moov` 超出前缀、结构矛盾或不能确认视频轨道时不猜测；媒体样本不解码/播放，也不向 renderer 传字节。已识别的 ISO BMFF 容器默认不从文件夹路径纯文本打开或在新窗口打开，明确的“以纯文本打开”和外部应用入口仍可用；无新增菜单项或快捷键。完整串行 Node **633/633**，改动 JavaScript 语法检查 **7/7**。正式版仍为 **0.5.16**；未构建、未打包、未运行 UI smoke，未改写 `dist/` 或 `release/`。这不是 AVFoundation/codec 覆盖或原生 UI 等价声明，详见[兼容性记录](docs/compatibility.md)。

本轮未发行增量：CotEditor 7.1.1 通过 AVAsset 加载音频时长；RIFF/WAVE 格式说明指出 PCM 数据前后可带信息块。CotEdit 不再要求经典 PCM `data` 块是末块，仅按已验证的 `fmt `/`data` 字段、采样帧对齐及 RIFF/实际文件边界计算时长；不额外读取或解码音频，不向 renderer 传音频字节。完整处于 512 KiB 预览前缀内的尾块会校验；超出前缀的尾部结构不作完整验证。定向解析/目录预览/菜单测试 **81/81**，完整串行 Node **626/626**，改动 JavaScript `node --check` **5/5**；正式版仍为 **0.5.16**。未构建、未打包、未运行 UI smoke，未写 `dist/` 或 `release/`。

较早的未发行 AIFF 预览增量：依据 CotEditor 7.1.1 的 [`PreviewDocument.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document/PreviewDocument.swift)、[`AudioAttributes.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/File%20Content%20Attributes/AudioAttributes.swift) 与 [`FilePreviewView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Content%20View/FilePreviewView.swift) 核实其音频预览显示时长；当时 CotEdit 仅从限定的经典 AIFF PCM `COMM`/`SSND` 头部计算时长，并将 AIFF-C 仅作音频分类。此处记录的 AIFC 限制已由上方最新条目扩展为 `NONE`/`sowt` PCM。依据 [AIFF 1.3 规范](https://www.mmsp.ece.mcgill.ca/Documents/AudioFormats/AIFF/Docs/AIFF-1.3.pdf)校验 chunk 边界、sample frame 与 80 位扩展精度采样率。此项当时解析/目录预览/菜单定向测试 **81/81**，完整串行 Node **626/626**，变更 JavaScript `node --check` **6/6**；正式版仍为 **0.5.16**。仅修改未发行源码、测试和文档，未构建、未打包、未运行 UI smoke，未改写 `dist/` 或 `release/`。读取上限仍为 512 KiB；音频载荷不解码、不传 renderer。此为静态格式子集，不代表 CotEditor 的 AVFoundation 支持范围，也不验证原生 UI/媒体行为。

本轮未发行源码增量：依据 CotEditor 7.1.1 的 `ImageAttributes` 字段与 [CIPA EXIF 2.3 规范](https://www.cipa.jp/std/documents/e/DC-008-2012_E.pdf)，文件夹图像预览仅在 JPEG APP1 的 EXIF IFD `ColorSpace`（tag 40961）为 SHORT/count=1/value=1 时报告 sRGB；未校准值、保留值、畸形或冲突标签，以及检测到 JPEG ICC_PROFILE APP2 时不报告。复用既有 512 KiB 预览缓冲区，只回传固定 `sRGB` 标量，不解压 ICC 或传送图像字节。解析/目录预览/菜单定向测试 **77/77**，完整串行 Node **623/623**，变更 JavaScript `node --check` **3/3**；正式版仍为 **0.5.16**，仅修改未发行源码、测试和文档，未构建、未打包、未运行 UI smoke。`dist/` 与 `release/` 共 119 个文件的当前聚合摘要为 `48b70018fe25011cf39f257334fb18c41c5926af225d87c22fe0cf70a752c76b`；本轮未写入发布目录。结束时磁盘可用约 **837 MiB**、使用率 **99%**；未清理缓存或删除文件。Node 测试不能证明 Electron/Chromium 实际显示色彩管理、Quick Look/ImageIO、原生菜单或各平台 UI 等价。

此前的未发行 DPI 增量：依据 CotEditor 7.1.1 文件预览的 `ImageAttributes`，目录图像预览现在可在受限头部中读取时显示水平 DPI：PNG pHYs、JPEG JFIF、BMP 与经典 TIFF；单位缺失/未知或头部不完整时不猜测。沿用既有 512 KiB 上限，不解码或向 renderer 传递图像字节；本项不提供 Quick Look、缩略图、ICC 配置文件名称或完整格式支持；受限色彩空间支持见上方最新增量。定向解析/预览/菜单测试 **55/55**；当时全套串行 Node（排除一个因临时文件写入 `ENOSPC` 的既有用例）**608/608**，被排除用例的限制见[兼容性记录](docs/compatibility.md)。正式版仍为 **0.5.16**；未构建、未打包、未运行 UI smoke。

本轮未发行兼容增量：依据 [CotEditor 7.1.0 官方发布说明](https://coteditor.com/releasenotes/7.1.0.en) 的语法文件拖放导入，在“自定义语法菜单”的语法列表接受 1–20 个 `.cotsyntax` 文件夹。主进程复核绝对路径、扩展名、普通目录/文件、符号链接与原有每文件 1 MiB/总量 3 MiB 限制；整批解析和规范化成功后只提交一次偏好更新。同 ID 更新现有包；若整批会超过 20 个自定义语法则拒绝整个批次、保留原列表。拖放不切换当前文稿语法；原菜单目录选择导入行为保持不变，无新增快捷键。定向测试 **17/17**、完整串行 Node **593/593**、变更 JavaScript `node --check` **8/8**、CSS PostCSS 解析通过、HTML **407** 个 ID 唯一。正式版仍为 **0.5.16**；仅改未发行源码、测试和文档，未构建、未打包、未运行 UI smoke；`dist/` 与 `release/` 119 个文件摘要保持 `c12cce7950b62b947a6462d16b6370b0396409f662804662a5b7a3edf8e00464`。Linux Node/静态测试不能证明 Electron/目标系统的原生文件夹拖放、路径提取、菜单或辅助技术行为，详见[兼容性记录](docs/compatibility.md)。

本轮未发行兼容增量：依据 CotEditor 7.1.1 `DirectoryDocument.shouldOpen` 对二进制 Property List 的处理，文件夹预览现在识别以 `bplist` 开头的二进制 plist，不把正文解码成文本，并禁用默认“打开”与“在新窗口打开”；主进程默认编辑打开复核最多读取 6 字节。显式“以纯文本打开”仍沿用根目录范围校验；仅此主动操作会按检测编码解释二进制字节并跳过通用 NUL 比例保护，保存可能改写原始数据。外部应用打开保持可用，XML plist 不受影响，预览正文预算仍为 512 KiB。此为魔数判断，不查询 Apple UTI，也不等同 Quick Look。目录/编码/打开/菜单定向测试 **74/74**，完整串行 Node **587/587**，7 个变更 JavaScript 文件 `node --check` **7/7**，CSS PostCSS 解析通过，HTML **406** 个 ID 唯一。正式版仍为 **0.5.16**；未构建、未打包、未运行 UI smoke。

本轮新增未发行文件类型保护：除沿用 macOS/Linux POSIX 执行权限判断外，文件夹预览还识别常见 ELF、Mach-O 与 FAT Mach-O 四字节签名，默认编辑/新窗口 IPC 也复核签名；预览读取预算不变，主进程复核最多读 4 字节，显式“以纯文本打开”仍可覆盖。仅为受限跨平台近似，不等于 Apple UTI 分类；Windows PE、无执行位脚本和其他格式未纳入。定向目录/打开/菜单测试 **64/64**、完整串行 Node **586/586**、变更 JavaScript `node --check` **2/2**；CSS 解析通过、HTML **406** 个 ID 唯一。正式版仍为 **0.5.16**；未构建、未打包、不运行 UI smoke。

本轮未发行源码性能增量：混合行尾元数据映射改为按 LF 位置处理，不再由 JavaScript 逐 UTF-16 单元扫描旧文稿和新文稿；24 组长 Unicode 文稿、多处稀疏编辑与旧字符扫描参考算法逐项等价。CotEditor 7.1.1 也记录过持续高 CPU 修复，但上游修复针对窄窗口语法工具栏，本增量仅优化 CotEdit 自身行尾映射，不声称根因相同。定向 `text-tools` 测试 **29/29**、完整串行 Node **585/585**、变更 JS `node --check` **2/2**。同机合成基准（1,100 万 UTF-16 单元、44 万 LF、5 次，取中位数）从 **89.55 ms** 降至 **38.33 ms**（57.19%）；此微基准不代表真实 Electron UI 性能。正式版仍为 **0.5.16**；未构建、未打包、未运行 UI smoke，`dist/` 与 `release/` 119 个文件摘要保持 `bef0e3f93413b7658f9b5a6631df36210a555a528562aa11e1871a08be361354`。兼容边界见[记录](docs/compatibility.md)。

本轮追加未发行改进：文件夹浏览器识别 Unix 执行权限文件，不读取正文并阻止默认“打开”／新窗口路径将其作为文本文稿载入；用户仍可明确选择“以纯文本打开”，也可使用系统默认或其他应用。依据 CotEditor 7.0.8（沿用于 7.1.1）的文件类型处理；本项目以 macOS/Linux POSIX 执行位近似，不冒称等同 Apple UTI 检测。定向测试 **63/63**、完整串行 Node 测试 **584/584**、变更 JavaScript `node --check` **6/6**。正式版本仍为 **0.5.16**；未构建、未打包或运行 UI smoke。具体边界见[兼容性记录](docs/compatibility.md)。

本轮未发行源码增量：文件预览的外部编辑器操作维持 CotEditor 7.1.1 风格的“主按钮打开默认应用 + 展开菜单选择默认应用或其他应用”，并支持键盘菜单导航；另将混合行尾 `Replace All` 映射改为按未变更的 ChangeSet 间隙流式保留原行尾，覆盖连续正则替换移除换行前缀时不应改变未匹配区域行尾的要求。没有新增快捷键，也没有改变目录访问、文稿恢复、隐私或数据保留边界。具体等价边界和验证见 [兼容性记录](docs/compatibility.md)。

## 0.5.16 发布后的未发行源码增量

- CotEditor 7.1.1 上游将快捷键 key equivalent 扩为任意非空字符串；CotEdit 原有 8 个 Unicode 标量限制偏紧，且片段菜单 IPC 另有 UTF-16 长度/全小写分支。本轮将 renderer、设置、片段与主进程命令/片段菜单净化统一到最多 **16 个 Unicode 标量**，多字符大小写保持，超长/空白/控制内容仍拒绝；16 个补充平面 emoji（32 个 UTF-16 单元）可通过，17 个被拒。CotEditor 上游证据：[7.1.1 发布说明](https://coteditor.com/releasenotes/7.1.1.en)与[快捷键实现提交](https://github.com/coteditor/CotEditor/commit/897e55f1103c6c14e906bbbca536e6e715af04b4)。保留 16 标量本地安全上限，因此不声称无界长度 1:1 等价。快捷键/设置/片段/菜单定向 **63/63**、完整串行 Node **580/580**、变更 JS `node --check` **7/7**。正式版仍为 **0.5.16**；未构建、未打包、未运行 UI smoke，`dist/` 与 `release/`（不含临时 `.manus-*` 文件）119 个文件组合 SHA-256 保持 `54ee6bbd69b23393e9fe697fc2829f30b1e604461d2ae3ae322ef663a48eb6c9`。Linux Node 测试不验证实体键盘、输入法、Electron 原生菜单或 macOS 行为；未改文稿恢复、隐私、权限或数据保留边界。

- 文件夹浏览器“新建文件／新建文件夹”默认名称现在按 Electron 主进程 `app.getLocale()` 本地化，映射参照 CotEditor 7.1.1 官方 `Application/Localizable.xcstrings`（例如 `zh-CN`：`未命名.txt`／`未命名文件夹`，`zh-TW`：`未命名檔案夾`，英文或未知 locale 回退为 `Untitled.txt`／`untitled folder`）；同名自动编号和不覆盖创建不变。本轮只对齐基名，扩展名仍固定 `.txt`，没有 CotEditor 默认语法首扩展名选择。定向目录/菜单测试 **54/54**、完整串行 `node --test --test-concurrency=1 test/*.test.js` **578/578**、变更 JavaScript `node --check` **4/4**。正式版仍为 **0.5.16**；只改未发行源码、测试及文档，未构建、未打包、未运行 UI smoke，`dist/` 与 `release/` 未触碰；Node 测试不验证 Electron 真机 locale 或原生文件协调、菜单及辅助技术行为。

- 对齐 CotEditor 7.1.1 多光标帮助中的 Escape 操作：仅在编辑器获得焦点、按下无修饰 Escape、所有选区均为空插入点且没有弹出对话框/编辑器键位已处理该事件时，收束多个光标并保留 CodeMirror 排序后的首个插入点；不影响 Alt+Escape 文本补全、IME 合成、非空选区或单光标。依据 [CotEditor 7.1.1 上游按键说明提交](https://github.com/coteditor/CotEditor/commit/6caaf1a1ebb98852222cd6b5c7d3b7ca3e39a733) 中的多光标 Escape 文档。定向测试 **3/3**、完整串行 `node --test --test-concurrency=1 test/*.test.js` **571/571**、变更 JavaScript `node --check` **3/3**。正式版仍为 **0.5.16**；未构建、未打包、未运行 UI smoke。`dist/` 与 `release/` 共 **120** 个文件，本轮前后按相对路径与内容计算的聚合 SHA-256 均为 `af519ebf087d4c5a0a7ebd2e7f7d637bc24ae6692802844cebaff167c202f1e5`。Linux Node/CodeMirror 测试不验证 Electron 实际焦点/事件顺序、原生菜单或平台辅助技术行为，不代表 1:1 等价。

- 本轮按 CotEditor 7.1.1 上游 [“Improve key descriptions in UI” 提交](https://github.com/coteditor/CotEditor/commit/6caaf1a1ebb98852222cd6b5c7d3b7ca3e39a733)的完整名称用法，将 CotEdit 快捷键帮助、快速操作提示及快捷键录入取消提示中的 `Esc` 统一显示为 `Escape`；快捷键绑定、事件匹配和原生 accelerator 不变。定向快捷键/菜单测试 **41/41**，完整串行 Node 测试 **568/568**；变更 JavaScript `node --check` **4/4**，CSS 解析通过、HTML **397** 个 ID 唯一。正式版仍为 **0.5.16**；未构建、未打包、未运行 UI smoke。`dist/` 与 `release/` 前后摘要均为 `b68917e4523a6e69ad1ba0e37448b3a483e580c5b68c2f5d704e6e5e658b011f`。Node/静态检查不验证目标系统上的原生菜单绘制或可访问性行为。

- 文件夹侧栏新增独立的“筛选文件名…”输入，对当前目录的文件与子文件夹名称作 NFC 规范化、大小写不敏感的字面子串筛选；与递归文件内容查找分离。筛选通过既有主进程目录列表接口执行，维持所选根目录校验、跳过符号链接、最多扫描 10,000 项/显示 500 项，并限制查询为 256 个 Unicode 字符。过滤时保留预览文稿路径，清除或匹配恢复后仍标示选中项；切换根目录清空过滤条件。对应 CotEditor 6.1.0 新增、6.1.2 保持选择的文件浏览器行为；依据 [6.1.0](https://coteditor.com/releasenotes/6.1.0.en)、[6.1.1](https://coteditor.com/releasenotes/6.1.1.en)、[6.1.2](https://coteditor.com/releasenotes/6.1.2.en)。CotEdit 没有同类 Add File/Folder 命令，未增加菜单项或快捷键；不宣称原生 UI/辅助技术 1:1 等价。 定向目录/菜单/无障碍回归 **73/73**，完整串行 Node 测试 **567/567**；本轮 6 个 JavaScript 源码/测试文件 `node --check` **6/6**，CSS PostCSS 解析通过，HTML **397** 个 ID 无重复。正式版本仍为 **0.5.16**；仅更改源码、测试和文档，未构建、未打包、未运行 UI smoke；`dist/` 与 `release/` 未触碰（120 个文件）。Node 与静态检查不验证 Electron 实际 UI、原生菜单或辅助技术行为。

- 本轮补入 CotEditor 7.1.1 `Format > Tab Width > Use Spaces for Indentation`：新增默认关闭的复选偏好；开启后 Tab 插入到下一逻辑制表位的空格，Backspace 按制表位删除软空格，多光标/选区在单个可撤销事务内处理。偏好纳入本机保存、多窗口同步及设置文件导入/导出，无新增快捷键。定向测试 **128/128**、完整串行 Node 测试 **563/563**、变更 JavaScript `node --check` **12/12**。正式版仍为 **0.5.16**；未构建、未打包、未运行桌面 UI smoke。`dist/` 与 `release/` 共 120 个文件摘要未变：`effd3020781958400de4e3615d4c5766be6f457c907c65fa908cca7050939dee`。CodeMirror/静态测试不能证明 macOS/Windows 原生菜单和键盘行为 1:1 等价。

- 本轮补入 CotEditor 7.1.1 `Format > Font > Font Type` 对应菜单：“标准／等宽”单选项控制编辑器与打印字体族，默认仍为当前等宽字体；偏好纳入已有设置导入/导出及多窗口同步，不新增快捷键。依据上游 [Main.storyboard](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Storyboards/Base.lproj/Main.storyboard)。定向测试 **127/127**、完整串行 `npm test` **551/551**、11 个变更 JavaScript 文件 `node --check` **11/11**，CSS 静态结构检查通过。正式版本仍为 **0.5.16**；未构建、未打包、未运行 UI smoke。`dist/` 与 `release/` 共 120 个文件的清单摘要前后均为 `25b72633568088334507c4eb060d3dba362036d83af43b46587c49d63d099dff`。平台字体面板与原生菜单呈现未验证，不宣称与 AppKit 字体管理器等价。

- 本轮对齐 CotEditor 7.1.1 `Format > Font > Ligatures`：新增“使用字体连字”原生菜单复选项，与已有设置偏好、CodeMirror CSS 和打印 CSS 共用状态；默认勾选，不新增快捷键。定向 Node 测试 **110/110**、完整串行 `npm test` **546/546**，6 个变更 JavaScript 文件 `node --check` **6/6**。正式版本仍为 **0.5.16**；仅改未发行源码、测试和文档，未构建、未运行 UI smoke 或打包；`dist/` 与 `release/` 共 120 个文件未改写。Linux Node 测试不验证 macOS/Windows 原生菜单行为。

- 本轮补齐 Edit >“插入反斜线”快捷键：依据 CotEditor 7.1.1 稳定版 storyboard 的 `keyEquivalent="¥"`，macOS 菜单提示/默认组合为 `⌘¥`；非 ASCII 键由 renderer 派发，不注册无效 Electron 原生 accelerator。Windows/Linux 使用 CotEdit 平台替代键 `Ctrl+Alt+Y`（不宣称上游同键位），并限定活动编辑器焦点。完整串行 Node 测试 **544/544**、6 个变更 JavaScript 文件 `node --check` **6/6**；正式版仍为 **0.5.16**。未构建、未打包、未运行 UI smoke；`dist/` 与 `release/` 共 120 个文件摘要未变。真实 macOS 键盘布局、Electron 原生菜单/按键行为未验证。

- Edit > 替换新增 CotEditor 7.1.1 `Replace Dashes` 对应命令“将双连字符替换为长破折号”：有选区时按每个选区将非重叠 ASCII `--` 对转换为 `—`；不替换单个连字符或其他 Unicode 横线，不在输入时自动替换，也不新增快捷键。此为依据 Apple 文档的确定性跨平台近似，不宣称等同 `NSTextView` action。定向测试 **87/87**、完整串行 Node 测试 **526/526**、运行时 JavaScript `node --check` **5/5**；正式版仍为 **0.5.16**。未构建、未打包、未运行 UI smoke；`dist/` 与 `release/` 共 120 个文件的聚合 SHA-256 保持 `b68917e4523a6e69ad1ba0e37448b3a483e580c5b68c2f5d704e6e5e658b011f`。Linux 测试不验证 AppKit/Electron 原生菜单、输入行为或平台无障碍等价，恢复、隐私和数据保留边界未变。

- 本轮未发行增量：选区匹配高亮加入 CotEditor 7.1.1 风格的可取消延迟（默认 0.5 秒，范围 0–10 秒、步进 0.25 秒），在“高亮所选文字的其他匹配项”下方提供设置，并随本机偏好及设置文件导入/导出保存；选择或正文变化会立即清除旧匹配并重新计时。高亮仍限单一选区、选中文本不超过 200 个 UTF-16 单元、当前可见范围及 100 个匹配，沿用 CodeMirror `SearchCursor` 文字语义。定向测试 **55/55**、完整串行 Node 测试 **522/522**、`node --check` **8/8**；未构建、未打包、未运行 UI smoke，Linux Node/静态测试不证明原生平台等价。
- 新增 CotEditor 7.1.1 `.cotrpl` `regexOptions.useUnicodeWordBoundaries`（位 64）导入、管理器编辑/保存及正则 `\b`/`\B` 边界近似校验；替换与独立高亮共用路径，测试覆盖 `Intl.Segmenter('und')` 词段边缘、传统边界差异、`$1` 捕获及数字反向引用重映射。定向测试 **80/80**、完整串行 Node 测试 **514/514**；变更 JavaScript 文件 `node --check` **7/7 通过**。实现不等同 Foundation/ICU 原生语义，宿主 Unicode 数据版本和正则备选分支的后置校验仍有限制。正式版仍为 **0.5.16**；本轮只改未发行源码、测试与文档，未构建、未打包、未运行 UI smoke。
- 本轮未发行兼容性修正：对 CotEditor 7.1.1 使用的 ICU `dotMatchesLineSeparators` 语义，启用 dotAll 且未启用 Unix 行分隔模式时，CRLF 现由一个正则 `.` 原子匹配，不会被拆成两个点号；转义点号、字符类和 `useUnixLineSeparators` 路径保持原样。依据 [ICU 正则说明](https://unicode-org.github.io/icu/userguide/strings/regexp.html)。定向多重替换测试 **39/39**，完整串行 Node 测试 **511/511**，变更 JavaScript `node --check` **2/2**。正式版仍为 **0.5.16**；未构建、未打包、未运行 UI smoke，`dist/` 与 `release/` 聚合摘要保持 `b68917e4523a6e69ad1ba0e37448b3a483e580c5b68c2f5d704e6e5e658b011f`（120 个文件）。Linux Node 回归不验证原生 Foundation/ICU 实机、Electron 桌面 UI 或 macOS/Windows 行为；未更改恢复、隐私或数据保留边界。
- 未发行修正：混合行尾文稿中，Undo/Redo 若只改变行尾元数据，renderer 现在也会将恢复后的行尾列表与默认行尾同步回文稿模型，避免保存时沿用旧格式；“恢复到已保存版本”把正文与行尾状态放在同一事务恢复，因此即使正文未变，后续编辑/保存仍保留已保存的混合行尾。Node 回归覆盖元数据型撤销/重做、序列化与后续插入；正式版本仍为 **0.5.16**，未构建、未运行 UI smoke 或打包，Linux Node 测试不证明 macOS/Windows 原生行为。
- 未发行行尾同步优化：renderer 同步器现在按分隔符值比较 EOL 列表，而不是按数组引用判断；CodeMirror 对相同值复制出的新数组不会再被当作语义变化，因而不会仅为无变化元数据触发额外的警告/状态栏/会话持久化刷新。真实行尾 Undo/Redo 仍按变化同步。此为 CotEdit 内部更新去重，不是 CotEditor 特性或原生等价声明；Node 回归覆盖相同值新数组与真实元数据变化两种路径。
- 新增普通 `moveLineUp` / `moveLineDown` 命令与混合行尾的状态回归：测试 CRLF/PS 原文、NEL 文稿回退格式、未受影响分隔符以及 Undo/Redo 序列化；新建的分隔符按当前 CodeMirror 路径使用回退样式。此测试记录 CotEdit 当前行为，不将具体分隔符归属规则归因于 CotEditor；完整串行 Node 测试 **509/509**，未发行测试/文档增量，正式版本仍为 **0.5.16**，未构建、未打包或运行 UI smoke。
- 未发行快捷键修正：快捷键事件在 `KeyboardEvent.isComposing` 为真或旧版 IME 标记 `keyCode=229` 时不再匹配/录入命令；renderer 全局 `keydown` 在此情形直接返回，不阻止默认事件，也不把输入法组合中的 Escape 当作关闭面板或快捷键。CotEditor 7.1.1 新增了单次按键输出多字符快捷键的支持；非组合态下该多字符路径保持不变。依据 [CotEditor 7.1.1 发布说明](https://coteditor.com/releasenotes/7.1.1.en)与 [MDN `KeyboardEvent.isComposing`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing)。定向快捷键测试 **31/31**，完整串行 `npm test` **510/510**，变更 JavaScript 的 `node --check` **3/3**。正式版本仍为 **0.5.16**；仅改未发行源码、测试与文档，未构建、未打包或运行 UI smoke；Linux Node/静态测试不验证真实 IME、Electron 输入法行为或各平台原生快捷键。
- Text > “首字母大写”仍以 Unicode 空白分段且不把标点当分隔符；现先对每段整体执行 JavaScript locale-aware 小写，再大写首个 Unicode 标量，保留希腊词尾 sigma 等上下文映射（例如 `ΟΣ` → `Ος`）。界面沿用运行时默认 locale；这是对 Foundation `localizedCapitalized` 工作流的近似，不宣称 locale 选择或所有 Unicode 映射等价。
- 文件夹预览新增“其他应用…”：由主进程弹出应用选择器，并在选择后复核文稿仍位于当前根目录再启动；原“默认应用”按钮不变，所选应用路径不持久化。macOS 选择器默认从 `/Applications` 开始并按 `.app` 过滤，Windows 按 `.exe` 过滤，Linux 保留系统默认位置且不作扩展名过滤；macOS `.app`、Windows `.exe` 与 Linux 可执行文件仍由主进程最终校验。不枚举系统已注册应用，也不复刻 CotEditor 原生菜单/图标/版本标记。
- View 菜单提供显示/隐藏标签栏、显示/隐藏工具栏、显式关闭分屏和垂直堆叠分屏编辑器；对应偏好保存在本机，并可在设置面板修改。
- View > 自定义工具栏…支持 8 个现有工具单独显示/隐藏及上移/下移排序；设置弹窗提供取消、应用和恢复默认，偏好本机保存并随设置导入/导出及跨窗口同步，不新增快捷键。
- 桌面版草稿恢复改为 userData 中的本机 gzip 原子恢复库，仅保存未保存文稿与恢复元数据，不保存原文件路径；每窗口最多 20 份、全局最多 100 份，压缩文件上限 64 MiB、解压数据上限 128 MiB。旧 localStorage 会话仅在导入并读回核验成功后迁移清除；恢复面板支持恢复所选/全部、稍后保留、删除所选与二次确认清空，正在窗口中编辑的草稿不能删除。草稿不自动过期；达到容量限制时不自动淘汰已有数据。恢复库未加密，依赖当前系统账户的数据目录权限。
- Text > 注释补入切换注释、行注释、块注释和取消注释，使用当前语言定义的注释分隔符；未给上游未声明快捷键的动作另造键位。
- Text > 文本转换与 Unicode 规范化在无选区时作用于光标所在单词；有选区时仅转换所选范围。全大写/小写改用 `toLocaleUpperCase` / `toLocaleLowerCase` 的本地化 Unicode 映射，UTF-8 BOM 的菜单状态、恢复状态和实际字节输出也纳入编码路径；默认 locale 协商仍不承诺与 Foundation 在所有系统上一致。
- 复核确认“文本补全”（Alt+Escape）、RTL 书写方向与 Page Guide 已在本工作树接通；本轮不重复实现，仅补足菜单路由与兼容性测试说明。
- Text > 显示字符使用 `⌥⌘I`（Windows/Linux：`Ctrl+Alt+I`），仅在选中单个 Unicode 字素时启用，并将 Unicode 17.0.0 字符名称、区块、General_Category 及逐标量码点/UTF-16/UTF-8 信息面板定位到选区；View > 检查器仍是独立的光标字符检查面板。
- Edit > 按 Unicode 码点插入…支持 `U+`、`0x`、`\u` 前缀或裸十六进制输入，提供字符预览并拒绝代理项/越界码点；未发行源码现保存最近 10 个成功插入的有效码点，历史按钮只回填输入框，仍须明确确认“插入”。历史仅存码点值于本机应用偏好，随设置文件导出；不记录输入正文。Edit 同时提供插入反斜线和插入日元符号，均按活动选区插入。日元符号现使用上游 `⌘Y`（Windows/Linux：`Ctrl+Y`）；Unicode 码点命令无上游默认快捷键。反斜线默认键现按 CotEditor 7.1.1 storyboard 映射 macOS `⌘¥`；Windows/Linux 使用 CotEdit 平台替代键 `Ctrl+Alt+Y`。实际 `KeyboardEvent.key` 会受键盘布局影响，本轮未实测目标 macOS 键盘或 Electron 原生菜单。此 HTML 对话框不是 Cocoa 原生输入面板。
- Find > 大纲新增按光标位置跳转相邻条目（`⌥⌘↑/↓`）；View 中标签栏、工具栏、侧栏在 macOS 跟随 CotEditor 默认键位，Windows/Linux 使用无冲突替代。空白字符、缩进参考线与页导引菜单已归入 Format；行上/下移在 macOS 使用 `⌃⌘↑/↓`，Windows/Linux 保留无冲突替代键。
- 设置面板可选择新文稿默认 LTR/RTL；已保存文稿的方向在本机按路径记住（最多 500 个条目，不写入纯文本文件）。打开混合换行文稿会即时提示，并保留状态栏检查入口。
- 文件夹预览新增“默认应用”打开；主进程再次核验所选根目录、真实路径及普通文件类型，越界/逃逸符号链接/目录或启动失败会提示错误并保留预览。
- 文件夹搜索与预览使用已打开的文件句柄复核普通文件，并以最多上限加一字节的读取识别检查后增长的文件：搜索不超过 1 MiB，预览不超过 512 KiB；支持的平台额外拒绝末端符号链接，读取结果仍经根目录范围校验。
- 桌面打印在存在选区时可选择打印全文、仅打印选区或取消；之后仍由系统打印对话框确认打印机与页面范围。
- Unicode 规范化菜单顺序现与 CotEditor 一致，并新增完整的 **NFKC Case-Fold**：使用 Unicode 17.0.0 官方 `NFKC_CF` 映射，覆盖全量大小写折叠、兼容映射和默认忽略码点删除。
- `.cottheme` 中 CotEditor 支持的 `usesSystemSetting` 角色现在映射到 CSS 系统选择色、文本色和强调色，并依应用浅/深色方案更新；旧 Chromium 会回退至应用强调色。
- 打印会传递当前文稿 LTR/RTL 方向，RTL 打印的行号移至右侧；仍是 HTML/CSS 打印页，不宣称等同 AppKit 原生排版。Text > Unicode 规范化与高级字符计数器现均提供 HFS+ Modified NFD/NFC；高级计数的字素簇单位按 CotEditor 设计隐藏规范化选项。
- 新文稿默认开启自动换行，与 CotEditor 默认偏好一致；已保存的显式换行设置不迁移覆盖。纵排时停用水平换行扩展但保留偏好，切回横排后恢复。`Alt+Escape` 文稿补全会按需扫描当前文稿中的 Unicode 词并与语法包候选并列，不在每次击键时扫描全文。
- “高亮当前行背景”偏好默认关闭，与 CotEditor 窗口设置对齐；开关在设置面板即时应用并跨会话保存。
- “高亮所选文字的其他匹配项”默认开启，选择一段文字后默认等待 0.5 秒再高亮可见范围内的相同文本；设置面板可按 0.25 秒步进调整至 0–10 秒，也可关闭该高亮。匹配数与选区长度受上限约束，实际筛选语义沿用 CodeMirror。
- URL 解码遇到格式错误的百分号序列或无效 UTF-8 时保留整段原文，不再弹出失败提示；此失败回退对应 CotEditor 7.1.1 的 `removingPercentEncoding ?? substring` 行为。有效输入仍使用 JavaScript `decodeURIComponent`，不据此宣称与 Foundation 所有 URL 编解码语义等价。
- Edit > 替换提供直引号与弯引号双向转换；“替换直引号为弯引号”仅在每行内将未转义、成对的 ASCII 引号映射为英文弯引号，保留词内撇号和未配对/转义引号。CotEditor 的系统替换使用 macOS 用户选择的单/双引号样式，CotEdit 不读取该偏好，故此项是有界跨平台近似。
- Edit 菜单新增“以富文本复制”（默认 `⇧⌘C` / `Ctrl+Shift+C`）：仅有非空选区时启用，将编辑字体与当前渲染到编辑器的语法颜色写入 RTF/HTML，并同时提供纯文本回退；多选区按文稿 EOL 连接。
- 仅打印选区且启用行号时，行号从该选区在原文稿中的起始行接续，不再从 1 重新编号。
- “格式 > 语法 > 自定义语法菜单…”可筛选并隐藏内置或导入语法；偏好本机保存，可取消未应用更改或一键显示全部。当前文稿正在使用已隐藏语法时，状态栏以禁用项保留其名称，格式菜单仍按设置隐藏；未为该命令另造快捷键。
- 新增“格式 > 语法 > 显示文件映射冲突…”和设置面板入口；仅在扩展名、文件名或 shebang 解释器规则重复时启用，报告表按规则显示首选语法与其他冲突语法。用户导入语法现在与 CotEditor 一样优先于内置映射；文件名、扩展名、`#!/usr/bin/env …` 检测与冲突报告共用同一优先级索引。
- “重置语法”、另存为后的映射重算及旧格式恢复草稿的默认语言回退都会传入当前正文，因此 shebang/XML 声明映射在这些路径仍可识别。
- 对照 CotEditor 官方 `SyntaxMap.json`，为已有兼容解析器补齐扩展名、文件名与 shebang 别名（如 `Package.resolved`、`.editorconfig`、Dockerfile、`.jsonl`、`.mts/.cts` 和 Python/Shell 解释器）；另按 CotEditor 7.1 所述 JSON 派生类型行为将 `.geojson` 自动映射为 JSON（跨平台按扩展名近似）。不为没有可用模式的上游语法冒充实现。CotEdit 无独立 SVG 语法，因此 SVG 采用现有 XML 模式。
- 修复语法设置弹窗快速关闭/重开时迟到的 `close` 事件清空新草稿的竞态；烟测现在等待取消后的弹窗关闭，并在真实 Electron UI 中验证三类映射冲突。
- 语法模式状态栏选择器新增“最近使用”分组：自动识别或手动切换的最近 6 个非纯文本语法按最新优先；仍可在“所有语法”中选择完整列表。完整语法列表按系统 locale 进行不区分大小写的自然数字排序，接近 CotEditor 的排序习惯。隐藏语法若在最近列表中仍可由该组选择；不在最近列表的隐藏活动语法继续以禁用项显示，避免状态标签消失。
- 依据 CotEditor 上游提交 `efd522f9fc9362a5211aef528b96a87dcad11335` 的 70 个 `.cotsyntax` 包，新增受限安全数值反向引用：有界单原子捕获与引用最多重复 8 次，使官方 Markdown 粗体/斜体规则进入 CodeMirror 实际着色；复杂、变宽或无界形式仍拒绝。另按逐行执行实测剔除 8 条“能编译但必需消费 `\R`”的无效规则；12,550 条高亮中有 12,533 条进入活动集，17 条高亮与 4 条大纲仍因安全、翻译或行级语义边界未启用；仅对 reStructuredText 官方 overline 规则做精确保语义转换，大纲 103/107 条可用，详见[兼容性说明](docs/compatibility.md)。
- 状态栏语法模式、编码和换行符选择器增加 `:focus-visible` 键盘焦点环；真实 Electron 烟测覆盖键盘焦点可见性，并在 860、940、1100、1280px 视口确认默认 8 个工具栏操作无重叠或越界。
- 桌面版新增 CotEditor RMate/SSH 远程编辑集成：设置默认关闭，可选端口默认 `52698`，TCP 服务只监听 `127.0.0.1`，最多接收 100 MiB 文稿；设置面板显示 SSH 反向转发与远端 `rmate -p` 示例。远程打开保留显示名/远端路径、语法类型、行号、编码、BOM 和混合行尾；保存通过 RMate socket 回传，断连后仍可编辑，之后保存会提示为本机文件另存。远程路径只可复制，不作为本机文件 reveal。服务没有额外认证，依赖用户通过 SSH 转发；本机其他进程也能连接 loopback 监听端口。
- View > “快速操作…”以 `⌘K`（Windows/Linux：`Ctrl+K`）打开可搜索菜单命令的键盘友好对话框，搜索原生菜单层级并复用原菜单动作；与 CotEditor 工作流对应，但 HTML 对话框、平台菜单和焦点行为并非 Cocoa 原生控件的 1:1 复刻。
- 格式菜单将全局“制表符宽度”与“当前语法的缩进宽度”分开：Tab 显示宽度提供 2/4/8 与自定义 1–99 列（默认 4），每种语法可选 Tab 或 1–99 个空格；新/未设置的偏好默认 Tab 缩进，已有显式偏好不会被迁移覆盖。编辑器显示、缩进参考线和 HTML 打印按各自设置工作；设置文件导入/导出也保留全局 Tab Width。自定义输入是跨平台 HTML 数字控件，不是 AppKit Stepper。
- 设置面板增加“使用字体连字”开关，关闭时通过 CSS `font-variant-ligatures: none` 应用于 CodeMirror 内容和 HTML 打印；默认保持本应用当前渲染。该 CSS 属性不能控制操作系统抗锯齿，字体和渲染引擎也可能限制效果；参见 [CotEditor issue #1670](https://github.com/coteditor/CotEditor/issues/1670) 与 [MDN CSS 文档](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-variant-ligatures)。
- Text > “插入片段”提供随当前语法动态筛选的原生子菜单，设置面板可创建、编辑、删除和排序全局或按语法限定的命令片段，并为单个片段录入快捷键。内置命令/片段键位冲突会被拒绝；组合键显示在菜单中，并在编辑器获得焦点时插入对应片段。模板兼容 CotEditor 的 `<<<SELECTION>>>` 与 `<<<CURSOR>>>` 标记，多光标、换行缩进和选区替换通过单次编辑事务插入；片段随设置导入/导出，最多 100 条，单条模板最多 12 KiB、总量最多 40 KiB。命令片段和文件拖放规则使用独立管理器；两者都是跨平台 HTML 对话框，不是 Cocoa 原生偏好窗。
- 桌面版 File Drop 按 CotEditor 7.1.1 的匹配顺序工作：“编辑器设置 > 文件拖放…”可创建、删除、排序及编辑规则的语法范围、扩展名、说明与插入模板；规则列表支持键盘上下键浏览，模板变量可从按钮插入。空语法/扩展条件匹配全部，第一条命中规则生效，无匹配时插入绝对路径。支持 8 种路径、文件名、扩展名及目录变量，以及 `FILECONTENT`、`IMAGEWIDTH`、`IMAGEHEIGHT`；CotEditor 默认 HTML 图片模板现包含尺寸属性。只有用户主动拖放且首条匹配规则明确引用 `FILECONTENT` 时，主进程才读取正文：仅接受普通严格 UTF-8 文本，每个文件及每次拖放总量最多 64 KiB；二进制/非 UTF-8、目录、符号链接、超限或读取期间变化都会取消整次插入。只有模板引用尺寸变量时才读取图像文件头，支持 PNG/GIF/JPEG/BMP/WebP/经典 TIFF，每文件最多 1 MiB、每次拖放合计最多 4 MiB；不解码图像，无法识别或超限时整次不插入。路径类模板不读取文件内容。规则随设置导入/导出；每次最多 32 个文件、路径最多 4 KiB、最终插入最多 64 KiB、最多 100 条规则。macOS `.textClipping`、BigTIFF、HEIC/SVG 等格式仍未覆盖，不能视为全平台 1:1。
- 多重替换定义管理器支持拖放 CotEditor `.cotrpl` JSON5/JSON 与 UTF-8 TSV 文件，也可按“导入…”选择多个文件；按定义名冲突时先询问是否覆盖。文件限 64 KiB、每个查找/替换字段限 4 KiB、单定义最多 100 条规则并继续遵守现有 48 KiB 容量；TSV 的空替换列可导入。新增 CotEditor `.cotrpl` 定义级 `settings.matchesFullWord` 导入与可编辑选项，仅作用于非正则文字规则，并在执行/高亮中采用一致的 Unicode 字母、标记、数字及下划线边界；CotEdit 不声称其与 Foundation 词边界完全相同。`unescapesReplacementString` 已支持导入、编辑和设置持久化，仅对正则规则解码 `\0`、`\t`、`\n`、`\r`、引号与 `\\` 一次（不支持 Unicode 标量转义）；`textualOptions` 应用 `caseInsensitive`（1）和 `anchored`（8）：文字规则可忽略大小写，或仅从整个文稿/每个选区范围的起点匹配（不是逐行匹配）；`literal`（2）保存逐字符精确比较选项（关闭规范等价），并可在管理器中编辑；位未启用时，文字规则默认采用有限 NFD 规范等价匹配，但不保证 Foundation 的完整 Unicode 搜索语义等价；`regexOptions` 仅应用 `caseInsensitive`（1）、`allowCommentsAndWhitespace`（2）、`ignoreMetacharacters`（4）、`dotMatchesLineSeparators`（8）与 `anchorsMatchLines`（16）及 `useUnixLineSeparators`（32）；位 2 在未转义 Pattern_White_Space 与 `#` 行注释上做受限预处理，保留字符类、转义空白/井号及 `\Q…\E` 引用内容，但不保证与 Foundation/ICU 的完整词法及空白分类等价；位 16 近似映射到 JavaScript `m`，行终止符识别与 Foundation/ICU 不完全相同（例如 VT、FF、NEL）；位 32 将 LF 作为唯一行分隔符：无 dotAll 时把未转义且位于字符类外的 `.` 映射为非 LF 字符集，并在同时启用位 16 时仅让锚点匹配 LF；启用注释模式时 `#` 注释也延续到 LF。此为 JavaScript 正则上的受限实现，`\R` 等显式 ICU 行匹配转换不随之改变，不代表 Foundation/ICU 完全等价；其余掩码位仍不应用并提示；独立“高亮”按原文逐条匹配启用规则并合并重叠命中，不改动文稿。批量替换以分离的精确编辑块提交，保留替换命中之间原有的混合行尾；新增换行使用文稿回退行尾，整组操作可作为一次 Undo/Redo。此项仅在当前工作树，尚未进入正式 0.5.16 包。
- 前一轮未发行增量：CotEditor 7.1.1 `.cotrpl` `regexOptions.anchorsMatchLines`（Foundation 位值 16）现可导入、在管理器中查看/编辑并随设置持久化；仅作用于正则规则的批量替换与独立高亮，近似映射到 JavaScript `m`。JS 多行锚点识别 LF、CR、U+2028、U+2029，不把 VT、FF、NEL 当作行边界，CRLF 零宽锚点行为也不承诺与 Foundation/ICU 一致；位 1 与位 8 可组合，其他掩码位继续提示但不应用。定向替换/导入/设置回归 **44/44**，完整 `npm test` **436/436**，6 个变更 JavaScript 文件 `node --check` 通过。正式版仍为 **0.5.16**；未构建、未运行 UI smoke 或打包，`dist/` 与 `release/` 未由本轮改写；0.5.16 Linux 包 SHA-256 校验通过。可用空间约 **638 MiB**；新增复选框未经真实 UI 验收，Linux Node 测试不证明 macOS/Windows 原生行为。
- 最新未发行增量：CotEditor 7.1.1 `.cotrpl` `regexOptions.allowCommentsAndWhitespace`（Foundation raw bit 2）现可导入、在多重替换管理器中查看/编辑并随设置持久化；仅作用于正则模式，支持未转义 Pattern_White_Space 和 `#` 行注释，保留转义空白/井号、普通字符类及 `\Q…\E` 引用内容，仍不是 ICU 引擎或完整词法等价。官方依据：[Apple 选项说明](https://developer.apple.com/documentation/foundation/nsregularexpression/options-swift.struct/allowcommentsandwhitespace)、[Foundation raw bit 定义](https://github.com/swiftlang/swift-corelibs-foundation/blob/main/Sources/Foundation/NSRegularExpression.swift) 与 [CotEditor 7.1.1 raw-value 编码模型](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/MultipleReplace%2BCodable.swift)。定向替换/导入/设置回归 **68/68**，完整 `npm test` **441/441**，6 个变更 JavaScript 文件 `node --check` 通过。正式版仍为 **0.5.16**；未构建、未运行 UI smoke 或打包；`dist/` 与 `release/` 文件树聚合 SHA-256 校验值与修改前相同（`b68917e4523a6e69ad1ba0e37448b3a483e580c5b68c2f5d704e6e5e658b011f`）。可用空间约 **637 MiB**；新增复选框未经 Electron UI 验收，Linux Node 测试不证明 macOS/Windows 原生行为。
- 本轮未发行增量：导入 CotEditor 7.1.1 `.cotrpl` 的 `settings.textualOptions` Foundation `anchored` 位（8），在多重替换管理器中可查看/编辑并随设置文件持久化；只约束非正则文字规则从整个文稿或各选区范围的起点开始查找，不是逐行匹配，也不改变正则规则。该实现以 JavaScript RegExp 起点锚定近似 Foundation 搜索范围语义，不保证完整 Unicode 比较等价。定向替换/导入/设置测试 **73/73**，完整 `npm test` **443/443**，7 个变更 JavaScript 文件 `node --check` 通过。正式版本仍为 **0.5.16**；未构建、未运行 Electron UI smoke 或打包，`dist/` 与 `release/` 树摘要仍为 `b68917e4523a6e69ad1ba0e37448b3a483e580c5b68c2f5d704e6e5e658b011f`。可用空间约 **637 MiB**；新增复选框未经真实 Electron UI 验收，Linux Node 测试不能证明 macOS/Windows 原生行为。
- Text > Indentation 的制表符/空格互转现按全局 Tab Width 在制表位上转换，完整支持 1–99 列；修复原实现把宽度硬截为 16 列的问题，并为 99 列、多制表位及宽度上限添加回归测试。
- 快捷键录入新增单个非 ASCII 可打印按键支持（如 `ß`）：按浏览器的逻辑 `event.key` 匹配；帮助列表与 Electron 菜单标签保留捕获到的 Unicode 键值（`ß` 不会因大写转换显示成 `SS`），多字符输出保持原样；Electron 菜单不注册无效原生 accelerator。键盘布局和各平台原生菜单仍待实机验证。
- 上一轮整词选项验证：整词设置导入/执行/选区边界与设置文件回归通过；完整 `npm test` **417/417 通过**，`src/main.js`、导入器与替换模块 `node --check` 通过。因可用空间约 656 MiB，未运行 UI smoke、构建或打包；正式版仍为 **0.5.16**，`dist/`、release 包与校验清单未更改。新增 HTML 控件未作真实 Electron UI 验收，macOS/Windows 原生菜单与行为仍未验证。
- 此前未发行增量：`.cotrpl` 的 `settings.unescapesReplacementString` 现可导入、编辑和持久化；仅正则规则解码 CotEditor 支持的 `\0`、`\t`、`\n`、`\r`、引号与 `\\` 一次，文字规则不解码；新建 CotEdit 定义缺省关闭以保留已有行为，不支持 Unicode 标量转义。定向回归 **27/27**、完整 `npm test` **419/419**、6 个变更 JavaScript 文件 `node --check` 通过；之后的 regexOptions 支持见下项。正式版本仍为 **0.5.16**；该增量未运行构建或打包，未改写发行物。
- 此前 Unicode 码点输入增量验证：偏好和设置文件针对性测试 **33/33 通过**；完整 `npm test` **409/409 通过**，renderer 与设置模块 `node --check` 通过。可用磁盘空间约 658 MB，本轮跳过 Electron UI smoke 与构建；UI 交互尚未实机核验。正式版本仍为 **0.5.16**；未运行构建，未触碰 `dist/`、历史发行物或源码归档，正式 Linux 包状态未变。macOS/Windows 原生菜单、字体渲染和辅助技术仍未实机核验。


- 最新未发行修正：启用/导入 `.cotrpl` `regexOptions.anchorsMatchLines`（Foundation 位 16）时，CotEdit 的 `^`/`$` 多行锚点现不会把 CRLF 中间当作额外零宽边界；替换不再因此拆开 CRLF，真正的空 LF 行仍可匹配。分隔符集合仍近似 JavaScript 多行语义（LF、CR、U+2028、U+2029），不含 VT、FF、NEL，不宣称完整 Foundation/ICU 等价。依据 [Apple `anchorsMatchLines` 文档](https://developer.apple.com/documentation/foundation/nsregularexpression/options-swift.struct/anchorsmatchlines)及 [CotEditor 7.1.1 混合行尾修复说明](https://coteditor.com/releasenotes/7.1.1.en)。定向测试 **50/50**、完整 `npm test` **445/445**，三个变更 JavaScript 文件 `node --check` 通过；正式版本仍为 **0.5.16**，未构建、未运行 UI smoke 或打包。`dist/`、`release/` 未改写。
- 本轮未发行增量：导入并持久化 CotEditor `.cotrpl` `regexOptions.useUnixLineSeparators`（位 32），可在多重替换管理器中编辑；受限实现只把 LF 视为行分隔符，并明确保留 JavaScript/ICU 差异。完整测试 447/447，未构建或打包，正式 0.5.16 与 `dist/`、`release/` 均未改写。
- 新建多重替换定义默认启用 `regexOptions.anchorsMatchLines` 的按行锚点，与 CotEditor 7.1.1 默认设置对齐；既有定义不迁移，导入的显式 `regexOptions: 0` 仍关闭。JavaScript 多行正则仍是受限近似，详见[兼容性说明](docs/compatibility.md)。
- 多重替换正则在默认非 dotAll 状态下，`.` 现在排除 ICU 标准行终止符；启用 `regexOptions.dotMatchesLineSeparators` 时才可匹配它们。`useUnixLineSeparators` 仍仅把 LF 视为分隔符。这是对 JavaScript 正则的边界适配，不代表与 Foundation/ICU 引擎完全等价。
- 本轮未发行增量：多重替换默认文字规则按 Unicode NFD 进行规范等价搜索；正则规则仅在启用 `regexOptions.ignoreMetacharacters` 时采用该文字路径。通过 `Intl.Segmenter` 限定完整扩展字素簇边界并映射回原始 UTF-16 区间，替换与独立高亮共用映射；既有定义不迁移，`textualLiteral` 缺省/false 时按新默认进行规范等价匹配；显式 `textualOptions.literal`（位 2）仍逐字符精确比较。仅覆盖多重替换，不扩展普通查找面板或真正正则；CotEditor 7.0.2 的修复说明是功能依据，不表示与 Foundation/ICU 全部搜索语义等价。
- 对照 CotEditor 7.1.1 混合行尾修复说明，普通 Find > Replace All 的编辑块构造现由共享 helper 生成，并新增 Node 回归覆盖多处替换、替换文本内行尾归一化、未命中区域行尾保留及 Undo/Redo 元数据恢复。定向搜索/高亮/替换 **54/54**、完整 `npm test` **495/495**、3 个 JavaScript 文件 `node --check` **3/3**。此为未发行源码/测试；未构建、未打包、未运行 UI smoke，Linux Node 回归不证明 Electron renderer 或 macOS/Windows 原生行为等价。
## 0.5.16 行编辑与按模式排序

- “文本 > 行”现包含排序、按模式排序、反转、随机打乱和删除重复项；无选区时处理整份文稿，有选区时按完整行处理。
- 按模式排序可用整行、指定分隔符列或受限安全正则/捕获组提取排序键，并提供大小写、语言规则、数值、首行固定和降序选项；表单会实时预览排序键并拒绝超出安全兼容范围的正则。
- 排序、反转、随机和去重会保留跟随原行的混合行尾；为重排后新增分隔符使用文稿默认行尾。
- CotEditor 原始 storyboard 中上述五项没有静态快捷键，因此 CotEdit 不臆造快捷键；菜单顺序按上游排列。

## 0.5.15 文件预览新窗口打开

- 文件夹导航中的只读预览新增“在新窗口打开”；现有窗口保留当前预览，新窗口加载目标文稿。
- 主进程在创建新窗口前重新解析文件真实路径，并再次验证文件位于当前选定根目录内且为普通文件；路径通过符号链接逃出根目录时拒绝打开。
- 新窗口文稿在 renderer 完成加载后按指定窗口路由，避免多个窗口同时打开时把文稿送入其他窗口。
- 这是 CotEditor 文件浏览器已公开的工作流对应实现；Electron 窗口前台顺序仍需 macOS/Windows 实机验证。

## 0.5.14 ICU 可选 possessive 量词兼容

- 对简单单字符原子或单原子非捕获组的 ICU `?+` 增加不回退转换；可变宽 `\R?+`、复合原子及其他有界/复合 possessive 形式仍明确拒绝，不以静默降级换取导入率。
- 这使上游 PowerShell 语法包的两条数字规则进入活动集。重扫本机 70 个 `.cotsyntax` 包后，活动高亮规则为 **12,538/12,550**；另 12 条高亮和 5 条大纲规则仍因语义/安全边界未启用。
- 验证：`npm test` **164 项通过**；`npm run test:ui` **1/1 通过**。本机 Linux 构建可验证，不替代 macOS/Windows 原生菜单、打印和辅助技术实机验收。

## 0.5.13 纵排连续滚动与语法规则兼容

- 纵排长文现在有实际横向文稿宽度，渲染列按文档行号定位；水平滚动会同步 CodeMirror 的虚拟行视口，插入点保持不动。900 行真实 Electron 回归覆盖转到行、大纲/搜索跳转及滚到中部列。
- 将 ICU `*+`、`++` 在简单确定性原子上的无界 possessive 重复转换为终端原子保护断言，避免回溯且保留匹配语义；安全边界不接受有界或复合原子量词。
- 70 个上游 `.cotsyntax` 包扫描中，高亮活动规则由 12,256 条升至 12,536/12,550；剩余 14 条及 5 条大纲规则继续明确禁用并记录原因，不以导入成功冒充完整语义支持。
- 验证：`npm test` **163 项通过**；`npm run test:ui` **1/1 通过**。Windows/macOS 原生安装、打印和辅助技术仍需对应系统实机验证。

## 0.5.12 纵排长文定位修正

- 修正 CodeMirror 虚拟文档 y 偏移与纵排物理列位置不一致的问题：选区变化后复位失真的垂直偏移，让远端插入点回到编辑视口。
- 真实 Electron/Xvfb 900 行 Markdown 回归覆盖“转到行 900”、大纲跳到远端标题、从第 1 行查找 `line-900`；三条路径均检查光标/查找选区可见。
- 该修正覆盖选区驱动的导航/查找/大纲跳转，不等于实现整篇文稿的连续横向列滚动或分页打印一致性；平台原生差异仍见兼容说明。

## 0.5.11 快捷键冲突与编辑器焦点修复

- CotEditor 当前 storyboard 将 `⌘L` 同时分配给“转到行”和“自定义包围选区”。CotEdit 两项菜单均显示 `⌘L`（Windows/Linux：`Ctrl+L`），但不重复注册系统加速键：编辑器有焦点且主选区非空时打开自定义包围；其他情况打开“转到行”。
- 新增共享键位解析与冲突白名单单测；真实 Electron/CDP smoke 分别触发有选区/无选区路径，并验证对话框 Escape 行为。
- 修正浏览器预览快捷键过滤器误把 CodeMirror 编辑区当作普通表单控件的问题。
- 0.5.11 历史验证为 `npm test` **160 项通过**、`npm run test:ui` **1 项通过**；该版 Linux 包为 AppImage 127,560,907 bytes、DEB 100,181,260 bytes（0.5.11/amd64）。

## 0.5.10 菜单与桌面无障碍增量

- 对照 CotEditor 主菜单 storyboard，Text > 文本转换新增“转换为全角/半角”和“字母数字转换为全角/半角”；仅对非空选区启用。通用宽度转换覆盖可打印 ASCII、空格及 Unicode 半角片假名/浊音；Roman 命令只转换 ASCII 与全角英文字母、数字，不声称覆盖 Foundation/ICU 的所有宽度映射。
- “包围所选内容”新增“自定义…”，可分别输入开始/结束字符串、留空结束符时复用开始符，并记忆上次输入；对话框校验开始符非空。
- 当前文稿标签以 `tabpanel` 关联活动文稿标签。新增真实 Electron/CDP UI 烟测，覆盖标签切换、溢出菜单 Home/End/Escape、查找 Escape 焦点恢复和自定义包围文稿变更。对照 storyboard，CotEditor 在“自定义…”上为 `⌘L`，而 CotEdit 将该组合保留给“转到行”，因此不重复注册冲突快捷键。
- `npm run package:linux` 已重新生成 0.5.10 x86_64 AppImage 和 amd64 DEB；DEB 元数据核对为 0.5.10/amd64，解包的共享应用 payload 在 Xvfb 下通过整套 Electron/CDP UI 烟测。AppImage FUSE 默认启动及实际 DEB 安装流程未在本轮核验。
- 依据 CotEditor [主菜单 storyboard](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Storyboards/Base.lproj/Main.storyboard)、[文本转换实现](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView%2BTransformation.swift)和[自定义包围实现](https://github.com/coteditor/CotEditor/blob/main/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView%2BSurroundSelection.swift)核对命令层级与行为；这不是原生 Cocoa 字符转换或对话框移植。

## 0.5.9 桌面打开流程与兼容性修正

- macOS 文稿 `open-file` 事件和 Windows/其他平台的 Electron `second-instance` 启动参数会转交现有窗口；应用启动参数也会解析为文稿路径，并在 renderer 就绪后再派发。不会自动注册或更改系统文件关联。
- 修复大小写不敏感的 `.cotsyntax` 字面结束符在 `İ` 等 Unicode 大小写转换会扩展字符数时使用错位原文偏移的问题；安全支持仅成员的负向 POSIX `xdigit` 类。
- 草稿恢复现在先过滤无效记录再限制为最多 20 份，损坏条目不再占掉有效恢复槽位；纵排打印页 HTML 会保留纵向排版样式。
- 增加系统文稿打开、草稿恢复及 Unicode 兼容回归覆盖；本轮全量测试 121 项通过，Electron/CDP 冒烟检查验证了启动参数和第二实例打开文稿。

## 0.5.8 文本转换与 Unicode 规范化

- Text > 文本转换新增 Unicode 首字母大写与 URL 组件编码/解码；无选区时禁用，新命令不会覆盖整行。
- 新增 NFC、NFD、NFKC、NFKD 四种 Unicode 规范化菜单操作，支持兼容字符转换，并在无效 URL 编码时安全提示而不改动文稿。
- 本轮全量回归测试增至 115 项，覆盖转换算法、菜单 IPC 路由和选区启用状态。

## 0.5.7 文本菜单补齐与版本显示同步

- Text 菜单新增“将缩进转换为空格/制表符”，按当前编辑器制表位处理选中行的前导缩进。
- 新增所选文本用单/双引号、圆括号、花括号或方括号包围；无选区时菜单项禁用，不额外分配未经上游核实的快捷键。
- 侧栏版本号改为从 `package.json` 自动读取，并新增回归测试，避免发布版本与界面显示不一致。
- 本轮 113 项测试全部通过，Vite 生产构建通过；Linux 安装包随后重新构建。

## 0.5.6 菜单、语法补全与打印对齐

- Edit 菜单补入 Delete，并把 Select All 放回“选择”子菜单；文件菜单在新建与打开之间增加分组分隔线。
- `.cotsyntax` 导入现可读取 `Completion.json` 并接入 CodeMirror 自动补全；本机 CotEditor 的 70 个语法包均可安全导入，合计 9,709 个词条。
- 页面设置新增可选打印行号，行号设置会随其他打印偏好保存；打印正文仍采用转义后的纯文本，不执行文稿 HTML。
- `.cottheme` 导入保留说明、作者等元数据，并记录 `usesSystemSetting` 标记；目前仍不根据系统外观动态解析这些标记。
- 修复 Vite 源入口引用旧哈希资源而导致生产构建失败的问题。

## 0.5.5 纵排文本（中日韩）

- “显示 > 纵排文本（中日韩）”和设置面板新增同一偏好开关；菜单复选状态在窗口/文稿切换时跟随活动窗口同步。
- 编辑区使用 `writing-mode: vertical-rl` 呈现纵排文字，并在保留行号设置时显示列旁行号；关闭行号时不会额外绘制编号。
- 这是跨平台 CSS 近似模式，全局偏好不随单个文稿保存；鼠标定位/选区、大纲和搜索跳转、打印以及 Cocoa 原生排版尚未证明与 CotEditor 一致。Linux Electron 实测了中日文混排显示、键盘输入和行号/滚动布局。

## 0.5.4 编码警告检查与模式缩进

- 新增“查看 > 检查器 > 警告”和工具栏编码警告检查器；按目标编码严格 round-trip 扫描将列出无法无损表示的字符、Unicode 码位、首次行列和出现次数。行尾格式、编辑内容或目标编码改变时，已打开的面板会刷新；保存时原有的无损检查仍会阻止数据丢失。
- 扫描在主进程的受控 IPC 中执行，输入遵循 12,000,000 UTF-16 单元限制，结果最多显示 200 种不同字符；超出时仍汇总总数并注明截断。
- 缩进宽度可分别按语法模式设置并保存在本机偏好中；没有模式覆盖时回退到默认缩进。格式菜单、状态栏切换和 Tab/自动缩进均使用当前模式值。
- 修正 ICU 正则搜索在 CRLF、CR、NEL、LS、PS 中的命中行号；可转换固定宽度原子组。无法忠实表达的 ICU possessive 量词和依赖回溯行为的原子组现在明确拒绝，不再静默改变匹配语义。
- 统一快捷键帮助、原生菜单和平台加速键注册表，补入“重置语法分析”；提升浅/深主题次要文字对比度，且减少动态效果设置会停用动画、过渡和滚动动画。

## 0.5.3 文件夹搜索、文件预览与换行诊断

- 新增左侧文件夹导航视图，可选择根文件夹、浏览子目录、返回上级并打开文本文件；打开文件夹菜单/快捷键直接进入该视图，打开文稿侧栏仍可单独切换。
- 新增当前窗口内打开文稿的前进/后退历史；从文件夹搜索结果打开的文稿也进入该历史，重复打开已存在文稿不会创建重复标签。
- 目录列表通过受限 Electron IPC 加载：各窗口的已选根目录相互隔离，列表每次最多 500 项、遍历上限 10,000 项，跳过符号链接；词法路径与真实路径都须位于已选根目录内。
- 文件夹搜索已并入同一侧栏，可按文本/正则与大小写递归查找，并从命中位置打开文稿；搜索和文件列表共用所选根目录，路径及真实路径均限制在根目录内。
- 单击文件可查看最多 512 KiB 的只读预览，然后选择按扩展名语法打开或“以纯文本打开”；二进制文件不作为文本预览，预览不会修改文稿。
- 预览和搜索沿用受限 IPC、文件大小上限、忽略目录与符号链接策略；这不是 Finder Quick Look、Cocoa 文件协调或 NSDocument 行为的逐项移植。
- 文稿含有多种行尾时，状态栏会显示可聚焦的警告入口；也可通过“格式 > 行尾 > 检查混合换行符…”打开检查器，且仅在混合行尾时启用。检查器按 LF、CRLF、CR、NEL、LS、PS 分类统计并列出有限行号样本，可选择保留原样或显式统一为主流格式。
- Edit > Select 新增“选择包围符号内容”，选择光标/选区最近匹配的 `()`、`[]`、`{}` 或单双引号/反引号内部内容；仅为安全的常见符号子集，注释/语言语法上下文暂不解析。官方来源未核实该命令默认快捷键，故不擅自分配。
- 增加目录列表排序、符号链接逃逸、路径穿越和混合行尾诊断测试，并补充侧栏/检查器无障碍回归。

## 0.5.1 本轮增量完善

- 浮动的大纲、字符检查器和文件夹搜索面板通过关闭按钮或 Escape 关闭时，更新 `aria-expanded` 并在焦点来自面板内部时返回对应入口；新增回归覆盖。
- `.cotsyntax` 高亮规则新增有界、单原子数字反向引用支持；高风险嵌套量词与歧义重复仍会拒绝，避免同步正则阻塞编辑器。
- 本轮 `npm test` 共 83 项通过，生产构建通过。

## 0.5.0 本轮完善

- 多文稿标签、文稿侧栏、草稿恢复、新建/打开/保存/另存为、最近文稿列表和独立窗口；每个窗口分别保存恢复草稿。
- **72 个内置语法模式选项**，覆盖常见 Web、系统、脚本、科学和配置格式；还可导入 CotEditor `.cotsyntax` 语法包，以自定义文件关联、注释/字符串分隔符和字面量高亮。
- 文稿内查找/替换和递归目录搜索；支持 ICU `\R`、`\h`、`\v`、`\Q…\E`、Unicode `\w`/`\W`、`\d`/`\D` 与 `\b`/`\B` 的兼容转换。查找计数、全选和替换共用 CodeMirror 搜索游标，包含零宽匹配；这仍不是完整 ICU 引擎。
- 分屏编辑、Markdown/代码大纲、Unicode 字符检查器、行号、折叠、缩进、括号匹配、撤销/重做和文本统计。
- BOM 优先编码识别与 UTF-8、UTF-16、Shift_JIS、GBK、Big5、Windows-1252 等编码转换；编码检测是启发式估计。保存时会阻止目标编码无法表示字符造成的静默数据丢失。
- 按行保留 LF、CRLF、CR、NEL、LS、PS 六种换行；尽可能保留未改变的行尾，新插入行使用默认行尾；可显式统一整篇文稿行尾。
- 原生菜单包含 File/Edit/Format/View/Text/Find/Window/Script/Help 分组；Script 按 CotEditor 菜单顺序排在 Window 后。增加恢复到已保存版本、在文件管理器中显示/复制路径、选词、字体大小、不可见字符分类显示、缩进参考线、文稿侧栏和状态栏控制；格式菜单还提供换行、编码、语法、界面外观与缩进。
- Script 菜单可加载本机应用数据目录中的 JavaScript 转换脚本。菜单内有“打开脚本文件夹…”和“重新加载脚本”；只读取目录直下一层的 `.js` 普通文件，最多 100 个、单个不超过 256 KB。
- 可在“格式 > 导入 CotEditor 主题…”或设置面板导入 `.cottheme` JSON。主题在本机保留，可清除恢复；映射文本、背景、选区、当前行、插入点、不可见字符、搜索高亮和主要语法类别颜色。
- 可从“格式 > 语法 > 导入 CotEditor 语法…”导入 `.cotsyntax` 文件夹；最多保留 20 个自定义包，支持 `Info.json` 文件映射、`Edit.json` 注释/字符串/字符界定符、`Regex/Highlights.json` 字面量与受限 ICU 正则（含安全数值反向引用）、成对/跨行范围、`Regex/Outlines.json` 大纲模板及块缩进定界符。导入前限制 JSON 大小并拒绝符号链接；不支持或不安全的规则会计数提示。
- 纯文稿打印使用独立打印页，不会打印 CotEdit 侧栏和工具栏；自制图标已包含 Linux PNG、Windows ICO、macOS ICNS。
- 快捷键表与原生菜单共用注册表；`⌘D` 对齐 CotEditor 的“选择单词”，复制行改为 `⌘⇧D`（Windows/Linux 为 Alt+Shift+↓）；标签页支持方向键浏览和屏幕阅读器语义，设置弹层具有 Escape 关闭和焦点返回行为。

## JavaScript 转换脚本

在 **脚本 > 打开脚本文件夹…** 打开的目录中放入 `.js` 文件，然后选择“脚本 > 重新加载脚本”。文件正文会作为异步转换函数运行，接收 `input` 对象并通过 `return` 返回新字符串。例如：

```js
// @name: 转为大写
return input.text.toLocaleUpperCase();
```

`input.text` 是当前选区；没有选区时是全文。另提供 `input.selection`、`input.filename` 和 `input.language`。脚本必须返回字符串；运行超过 1.5 秒会被终止。脚本在 Web Worker 中执行，没有 Node、DOM 或 Electron preload API；它仍是用户提供的代码，只应运行自己信任的脚本。此机制只提供文本转换，不是 CotEditor 的 AppleScript/JavaScript for Automation API，也不支持其文稿、窗口或应用对象模型。

## CotEditor 主题导入

从“格式 > 导入 CotEditor 主题…”或设置面板选择 `.cottheme` 文件。主题需含有效的 `text.color` 与 `background.color`，可识别 6/8 位十六进制颜色。CotEdit 会映射编辑器底色、文字、选区、当前行、插入点、不可见字符、搜索高亮，以及关键字、命令、类型、属性、变量、数值、数字、字符串、字符和注释颜色。字体属性、上游完整语义样式和配套 `.cotsyntax` 规则仍未逐项移植。

## CotEditor 语法包导入

从 **格式 > 语法 > 导入 CotEditor 语法…** 选择 `.cotsyntax` 文件夹。导入的语法会保存在本机，并出现在语法下拉框和原生“格式 > 语法”菜单；若扩展名未被内置模式占用，会自动关联到该语法。单个 JSON 文件最大 1 MB、读取总量最大 3 MB，符号链接会被拒绝。

这仍是安全的兼容子集：支持 `Info.json` 的 `fileMap`、`Edit.json` 的基础注释与字符串/字符界定符、字面量和受限 ICU 正则高亮、成对或跨行范围、大纲模板及块缩进定界符。安全检查会跳过高风险或尚未支持的表达式并提示数量；这**不代表完整的 CotEditor ICU 正则/上下文语法解析器，也不保证所有上游包逐条一致**。上次完整上游样本的计数和本轮新增兼容范围见[兼容性说明](docs/compatibility.md)。

## 运行与构建

```bash
npm install
npm run dev
npm test
npm run test:ui
npm run build
```

开发桌面窗口时先运行 Vite，再设置 `COTEDIT_DEV_URL=http://127.0.0.1:5173` 并运行 `npm run desktop:dev`。打包命令：

```bash
npm run package:linux
npm run package:windows
npm run package:mac
```

CotEdit 发布包元数据使用项目主页 `https://github.com/jincaiw/cotedit`；历史 0.5.16 发行状态记录如下。

## 0.5.16 历史 Linux 发行与兼容性验证

正式发行版仍为 **0.5.16**；工作源码以 CotEditor **7.1.1 稳定版**为兼容基线（不将 7.2 alpha 当作稳定目标）。本轮修正 `.cotrpl` 定义级 `matchesFullWord`：由“只检查命中范围外侧都不是字母/标记/数字/下划线”改为 ICU 默认 `\b` 的两端 word/non-word 类别切换，使用 Alphabetic、Mark、Decimal_Number、Connector_Punctuation、U+200C 和 U+200D；覆盖标点端点、罗马数字、非十进制数字、连接标点、join controls 与默认模式下的撇号边界。CotEditor 7.1.1 `TextFind.swift` 以 `^\b.+\b$` 和 transparent bounds 做全词检查；ICU 明确把 UAX #29 `useUnicodeWordBoundaries` 作为另一种 opt-in 语义，CotEdit 本轮未实现该位，也不宣称与 Foundation/ICU 全部一致。此前文件夹搜索非正则文字模式已补 NFD 规范等价匹配；预览保留原文，正则模式不归一化。
定向多重替换测试 **37/37**，完整 `npm test` **464/464**，两处变更 JavaScript 文件 `node --check` **2/2** 通过。正式 0.5.16 AppImage/DEB SHA-256 清单校验通过；未构建、未运行 UI smoke 或打包，`dist/` 与 `release/` 未触碰。测试在 Linux Node 环境运行，不证明 macOS/Windows 原生菜单、Foundation 文本系统或辅助技术等价；文稿隐私、权限和数据保留策略未改变。
0.5.16 Linux x64 AppImage 约 **122 MiB**、amd64 DEB 约 **96 MiB**；DEB 元数据核对为 0.5.16。SHA-256 见 [`release/CotEdit-0.5.16-SHA256SUMS`](release/CotEdit-0.5.16-SHA256SUMS)；原源码 ZIP 为 [`/workspace/CotEdit-0.5.16-source.zip`](/workspace/CotEdit-0.5.16-source.zip)。本机 70 个上游 `.cotsyntax` 包统计为 **12,533/12,550** 条高亮、**103/107** 条大纲可用；17 条高亮和 4 条大纲仍因明确安全、翻译或行级语义边界停用。DEB 实机安装未核验。AppImage 默认 FUSE 启动因当前用户无 `/dev/fuse` 读取权限未核验。Windows NSIS 安装器本轮未完成（Wine 无法加载 `kernel32.dll`），macOS 原生构建/签名及实机辅助技术仍未验证。旧安装包、校验清单和原源码 ZIP 未覆盖。

此前的候选交付件为 [Linux x64 AppImage](/workspace/CotEdit-0.5.16-unreleased-2026-10-09-linux-x86_64.AppImage)（约 **122 MiB**）、[amd64 DEB](/workspace/CotEdit-0.5.16-unreleased-2026-10-09-linux-amd64.deb)（约 **96 MiB**）、[Linux x64 便携包 tar.gz](/workspace/CotEdit-0.5.16-unreleased-2026-10-09-linux-x64-portable.tar.gz)（约 **131 MiB**）和[未发行源码 ZIP](/workspace/CotEdit-0.5.16-unreleased-2026-10-09-source.zip)（约 **3.6 MiB**）；[SHA-256 清单](/workspace/CotEdit-0.5.16-unreleased-2026-10-09-SHA256SUMS)记录的是这些较早文件。它们生成时的 DEB 元数据为 `0.5.16/amd64`，当时包内 `app.asar` 通过 Electron UI smoke；DEB 未安装到系统，AppImage 仅以解包模式测试（FUSE 直接启动未核验）。这些候选早于后续默认应用打开、句柄限量读取、大小写映射和菜单状态修复，不能代表当前源码；候选未放入 `release/`，正式包和 SHA-256 清单未覆盖，原源码 ZIP 亦保留。Windows/macOS 原生构建、签名与平台实机辅助技术仍未验证。

0.5.9 Linux x86_64 AppImage（约 122 MiB）与 amd64 DEB（约 96 MiB）已生成；DEB 元数据为 0.5.9/amd64，ASAR 已核对版本及系统打开 helper/preload。解包的 DEB 应用已在虚拟显示器下启动，CDP 确认版本 0.5.9 和启动时传入的文稿内容；开发运行的启动路径和第二实例路径也通过 CDP 实测。源码 ZIP 与 SHA-256 已重新生成并通过完整性校验。由于 `/dev/fuse` 仅 root 可读，AppImage 的默认 FUSE 启动未核验。Windows/macOS 原生构建/签名、真实打印对话框和 VoiceOver/NVDA 辅助技术尚未实测。

剩余差距包括完整 ICU 与 `.cotsyntax` 上下文语法语义、所有复杂正则/主题渲染、完整偏好设置/本地化/无障碍，以及 NSDocument/Cocoa 原生窗口和文本系统行为。File Drop 的 `FILECONTENT` 已支持严格限量的主动拖放读取（仅 UTF-8 普通文件；单文件/单次拖放正文合计最多 64 KiB；路径模板不读取正文）；`IMAGEWIDTH/IMAGEHEIGHT` 已支持 PNG/GIF/JPEG/BMP/WebP/经典 TIFF 的有限头部解析（不含 BigTIFF）；macOS `.textClipping` 与 Cocoa 原生设置交互仍未实现。多重替换“高亮全部”的结果仍可能不同于顺序执行后的真实匹配；Unicode 规范等价匹配已覆盖多重替换和普通查找/替换文字模式；普通文字搜索以 NFD 校验并排除仅兼容等价匹配，真正正则路径仍未扩展。纵排长文的导航、搜索、目录及中段横向滚动已通过 900 行实测，但不代表所有极端文档、字体、换行设置和打印驱动完全一致。编码检测仍为启发式；Windows/macOS 原生构建、签名、实际读屏器行为、系统级快捷键冲突和多发行版 Linux 安装也未完整验证。功能差异和已核对快捷键见[兼容性说明](docs/compatibility.md)。

上游项目与功能说明见 [CotEditor GitHub](https://github.com/coteditor/CotEditor) 与 [CotEditor 官网](https://coteditor.com/)；主题和语法资源样例见 [Themes](https://github.com/coteditor/CotEditor/tree/main/CotEditor/Resources/Themes) 与 [Syntaxes](https://github.com/coteditor/CotEditor/tree/main/CotEditor/Resources/Syntaxes)。
- 该修正覆盖选区驱动的导航/查找/大纲跳转，不等于实现整篇文稿的连续横向列滚动。另用生成的打印 HTML 在 Electron/Chromium 以 A4 导出 900 行纵排 PDF（27 页），PDF 抽取确认 1–900 行无缺失；这不替代 macOS/Windows 原生打印对话框、驱动及分页体验实测。

## 2026-10-11 最新未发行正则兼容修正

基于 CotEditor **7.1.1 稳定版**，多重替换正则的默认 `.` 现排除 ICU 标准行终止符 LF、VT、FF、CR、NEL、LS、PS；启用 `regexOptions.useUnixLineSeparators` 时仅排除 LF，启用 `regexOptions.dotMatchesLineSeparators` 时允许跨行匹配。只转换未转义且位于字符类外的点号，`\.` 与 `[.]` 保持字面含义。此实现仍是 JavaScript 正则上的有限兼容层；dotAll 对 CRLF 的单点匹配不保证与 ICU 相同。依据 [Apple `dotMatchesLineSeparators`](https://developer.apple.com/documentation/foundation/nsregularexpression/options-swift.struct/dotmatcheslineseparators)、[Apple `useUnixLineSeparators`](https://developer.apple.com/documentation/foundation/nsregularexpression/options-swift.struct/useunixlineseparators) 和 [ICU 正则参考](https://unicode-org.github.io/icu/userguide/strings/regexp.html)。

定向多重替换/导入回归 **61/61**、完整 `npm test` **465/465**，两个变更 JavaScript 文件 `node --check` 通过。正式版仍为 **0.5.16**；本轮改动仅为未发行源码、测试和文档，未构建、未运行 UI smoke 或打包；`dist/` 与 `release/` 保持不变，隐私与数据保留策略未更改。测试运行于 Linux Node，不证明 macOS/Windows 原生 Foundation、菜单或辅助技术等价。完整差异见[兼容性说明](docs/compatibility.md)。

README 较早条目中“`anchorsMatchLines` 未识别 VT、FF、NEL”的描述记录了上一阶段状态；当前工作树的默认多行锚点已识别 LF、VT、FF、CR、NEL、LS、PS，并抑制 CRLF 中间的额外边界。启用 `useUnixLineSeparators` 时仍只识别 LF。


## 2026-10-11 快捷键绑定 IPC 校验回归

CotEditor 7.1.1 官方发布说明包含“单次按键产生多个字符”的快捷键支持；CotEdit 对应的 renderer 捕获/匹配已支持多字符逻辑键值，本轮将主进程 IPC 的独立净化规则抽至 `electron/shortcut-bindings.cjs`，保持运行规则不变，并新增直接 Node 回归覆盖注册表 ID、NFC 规范化（多字符保留大小写，单字符沿用既有大小写规范）、最多 8 个 Unicode 标量、修饰键要求及 F1–F24 例外。多字符和非 ASCII 键仍由 renderer 派发，而非 Electron 原生 accelerator。

定向快捷键/设置/菜单/包清单测试 **43/43**，完整 `npm test` **476/476**，变更的 3 个 JavaScript 文件 `node --check` **3/3**。正式版本仍为 **0.5.16**；本轮仅改源码、测试与文档，未构建、未运行 UI smoke 或打包；`dist/` 与 `release/` 聚合 SHA-256 仍为 `b68917e4523a6e69ad1ba0e37448b3a483e580c5b68c2f5d704e6e5e658b011f`。Node 测试验证的是逻辑和 IPC 净化，不证明 macOS/Windows 原生菜单、实体键盘布局或输入法行为；文稿隐私及数据保留策略未变。

## 2026-10-11 快捷键 Unicode 标量边界回归（未发行测试）

补充主进程 IPC 净化测试：恰好 8 个补充平面 Unicode 标量可通过、9 个被拒；不换行空格、双向格式控制符和 NUL 等非可打印内容被拒。该增量只新增测试并记录边界，不改变快捷键行为。依据 [CotEditor 7.1.1 稳定版发布说明](https://coteditor.com/releasenotes/7.1.1.en) 的多字符快捷键改进项。

定向快捷键测试 **29/29**，完整 `npm test` **476/476**，`node --check` **2/2**。正式版本仍为 **0.5.16**；仅未发行测试与文档变更，不构建、不运行 UI smoke、不打包，`dist/` 与 `release/` 保持不变。Linux Node 测试不证明 macOS/Windows 原生菜单、键盘布局或输入法行为等价；文稿隐私及数据保留策略未变。

## 2026-10-11 多字符快捷键标签大小写可辨（历史状态，后续已对齐上游格式）

当时快捷键设置与自定义菜单显示多字符键串原始大小写。该显示策略已被本文件顶部的 2026-10-12 增量取代：标签现按 CotEditor 7.1.1 对整个按键字符串大写；内部快捷键值仍保留原始大小写，匹配与冲突判断仍区分 `SS` 和 `ss`。

定向测试 **48/48**，完整 `npm test` **479/479**，本轮 6 个 JavaScript 源码/测试文件 `node --check` **6/6**。正式版本仍为 **0.5.16**；本项为未发行源码，未构建、未运行 UI smoke、未打包。按排除既有 `.tmp` 辅助文件的正式文件集合计，`dist/` 4 个、`release/` 115 个，共 119 个文件未改写；组合文件指纹为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。Linux Node 测试不证明目标平台的实体键盘、输入法或原生菜单行为，也不代表 1:1/native parity；文稿隐私和数据保留策略未改。

## 2026-10-11 首字母大写标点分词修正（未发行源码）

CotEditor 7.1.1 的大小写转换调用 Foundation `localizedCapitalized`；Apple 文档说明“词”通常由空格、制表符或行终止符分隔，常见标点未必分词。CotEdit 原逻辑把连字符、下划线和撇号都当作词界，可能将 `mother-in-law` 改成 `Mother-In-Law`。现改为按 Unicode 空白分词，在词内保留标点边界；例如 `can't STOP mother-in-law FOO_BAR` 转为 `Can't Stop Mother-in-law Foo_bar`。实现仍使用 JavaScript 当前 locale 大小写映射，不宣称与 Foundation 在所有语言、系统和标点规则上完全等价。

定向 `text-tools` 测试 **24/24**，完整 `npm test` **480/480**，变更的 `lib/text-tools.js` 与 `test/text-tools.test.js` `node --check` **2/2**。正式版本仍为 **0.5.16**；本轮仅改未发行源码、测试与文档，未构建、未运行 UI smoke、未打包。`dist/` 与 `release/` 119 个正式文件的组合指纹仍为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。测试运行于 Linux Node，不验证 macOS Foundation 实机大小写/本地化行为、其他平台界面或辅助技术；隐私和数据保留策略未改变。依据 [CotEditor 7.1.1 转换源码](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView%2BTransformation.swift) 与 [Apple `localizedCapitalized` 文档](https://developer.apple.com/documentation/foundation/nsstring/localizedcapitalized)。


## 2026-10-11 首字母大写的上下文映射修正（未发行源码）

在此前按空白分段、保留词内标点的基础上，现对每段先整体执行 locale-aware 小写，再本地化大写首个 Unicode 标量，避免逐字符小写丢失上下文规则；例如希腊语 `ΟΣ ΑΣ` → `Ος Ας`。辅助函数可接收显式 locale，菜单沿用 JavaScript 运行时默认 locale；不承诺与 Foundation `localizedCapitalized` 的 locale 协商或全部 Unicode 分词/映射等价。依据 [CotEditor 7.1.1 转换源码](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView%2BTransformation.swift)、[Apple `localizedCapitalized` 文档](https://developer.apple.com/documentation/foundation/nsstring/localizedcapitalized)及 [JavaScript `toLocaleLowerCase` 说明](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/toLocaleLowerCase)。

定向 `text-tools` 测试 **25/25**，完整 `npm test` **481/481**，变更的 `lib/text-tools.js` 与 `test/text-tools.test.js` `node --check` **2/2**。正式版本仍为 **0.5.16**；未构建、未运行 UI smoke、未打包。`dist/` 4 个、`release/` 115 个，共 **119** 个正式文件保持原样，组合指纹 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。测试仅在 Linux Node 运行，不能验证 macOS Foundation 实机行为、Windows/macOS UI 或辅助技术；隐私与数据保留策略未改变。

## 2026-10-11 多重替换 ICU 命名捕获引用（未发行源码）

多重替换正则模板现支持 ICU/Foundation 的 `${name}` 命名捕获引用；已定义但未参与匹配的可选组展开为空，既有 `$<name>` 写法继续有效。依据 CotEditor 7.1.1 `TextFind.swift` 的 Foundation 替换 API 调用与 [ICU 官方模板语法](https://unicode-org.github.io/icu/userguide/strings/regexp.html)。本轮只补模板插值格式，不表示 JavaScript 正则层或完整替换模板与 Foundation/ICU 完全等价。

定向多重替换/导入测试 **62/62**，完整 `npm test` **484/484**，变更的 JavaScript 源码与测试 `node --check` **3/3**。正式版本仍为 **0.5.16**；仅修改未发行源码、测试和文档，不构建、不运行 UI smoke、不打包；`dist/` 与 `release/` 逐文件哈希核验未改变。Linux Node 测试不验证 macOS Foundation 实机或 Electron/macOS/Windows/Linux UI 行为；文稿隐私与数据保留策略未改变。


## 2026-10-11 字符信息选区的区域指示符配对修正（未发行源码）

字符信息选区验证现能保留 Unicode UAX #29 GB12/GB13 的区域指示符奇偶配对：当左右 16 个 UTF-16 单元的快速上下文恰好从一串旗帜符号中间开始时，不再把本来属于旗帜字素的单个区域指示符误认作独立字符；普通文本仍使用原来的局部快速路径。依据 CotEditor 7.1.1 字符信息选区源码与 Unicode UAX #29；这只补该上下文边界，不代表与 macOS 原生实现完全等价。

定向测试 **6/6**，完整 `npm test` **486/486**，变更的 JavaScript 文件 `node --check` **3/3**。正式版仍为 **0.5.16**；此项属未发行源码，未构建、未运行 UI smoke 或打包。`dist/` 与 `release/` 的 120 个文件未变。测试运行于 Linux Node，不验证 CodeMirror 实际光标边界、macOS Foundation/AppKit 或原生 UI；文稿隐私与数据保留策略未变。


## 2026-10-11 字符信息选区的 GB11 长 Extend 序列修正（未发行源码）

字符信息选区此前用光标前后各 16 个 UTF-16 单元作字素验证；Unicode UAX #29 GB11 的 `Extended_Pictographic Extend* ZWJ × Extended_Pictographic` 中 `Extend*` 可任意重复，窗口若截在长组合附加符序列中，会让末尾表情符号看起来像单独字素。现仅当边界检测确认窗口确实截断了一个 GB11 前缀时，回退到全文验证；普通文本、旗帜区域指示符之外的常规情况仍使用局部路径。回归覆盖 20 个组合附加符构成的 ZWJ 序列、错误拒绝末尾单独表情符号、接受完整字素，以及不符合 GB11 时不触发回退。实现使用当前 JavaScript Unicode 属性与 `Intl.Segmenter`，不声称等同 macOS Foundation/AppKit。

定向 `character-selection` 测试 **8/8**，完整 `npm test` **488/488**；变更 JavaScript 源码与测试 `node --check` **2/2**。正式版本仍为 **0.5.16**；本轮仅改未发行源码、测试和文档，未构建、未运行 UI smoke 或打包。测试运行于 Linux Node，不验证 CodeMirror 实际光标边界、macOS Foundation/AppKit、原生菜单或辅助技术行为；隐私与数据保留策略未变。依据 [Unicode UAX #29 GB11](https://www.unicode.org/reports/tr29/) 与 [CotEditor 7.1.1 Character Inspector 源码](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Accessory%20Views/CharacterInspectorView.swift)。


## 2026-10-11 字符信息选区的 Indic GB9c 边界修正（未发行源码）

补齐与上一轮 GB11 修正相邻的 Unicode 字素边界：Unicode 17.0 UAX #29 GB9c 的 Indic 连字规则可包含任意长的 InCB Extend/Linker 链；若 16 UTF-16 单元局部窗口截掉前置辅音，末尾辅音可能被误当成独立字素。现在只在尾端是 InCB Consonant、链中存在 Linker、前置 InCB Consonant 位于窗口外时回退全文验证；无 Linker 的长组合符、非 Indic 辅音尾端与完整上下文不触发。精确属性范围来自 Unicode 17.0.0 官方 [`DerivedCoreProperties.txt`](https://www.unicode.org/Public/17.0.0/ucd/DerivedCoreProperties.txt)，规则依据 [UAX #29 Revision 47 GB9c](https://www.unicode.org/reports/tr29/tr29-47.html)。这是 `Intl.Segmenter` 上的边界校验补丁，不宣称与 CotEditor/macOS Foundation/AppKit 等价。

定向 `character-selection` 测试 **11/11**，完整 `npm test` **491/491**，变更的 3 个 JavaScript 文件 `node --check` **3/3**。正式版本仍为 **0.5.16**；本轮仅改未发行源码、测试和文档，未构建、未运行 UI smoke 或打包。`dist/`、`release/` 共 120 个文件逐文件哈希清单未变，正式 AppImage/DEB 校验通过。验证只在 Linux Node 24.19/ICU 78.3 运行，不证明 CodeMirror 实际 caret、macOS/Windows 原生文本/UI 或辅助技术行为；文稿隐私与数据保留策略未变。

## 2026-10-11 普通单次替换的混合行尾回归（未发行源码）
CotEditor 7.1.1 [正式发布说明](https://coteditor.com/releasenotes/7.1.1.en)将混合行尾文稿的 Redo 修复与 Replace All 修复分别列出。CotEdit 普通 Replace 原先手动组装单个编辑，未经过刚为 Replace All 抽出的共享构造器；现让单次替换也复用该 helper，统一替换文本行尾归一化并显式使用构造结果定位替换后光标。新增回归针对第二处命中，把含 CRLF 的替换文本归一为内部 LF，确认匹配外的 CRLF、CR、PS、NEL 不变，并检查 Undo/Redo 恢复精确行尾元数据。
定向 `search-tools` 测试 **11/11**，完整 `npm test` **496/496**，两个变更 JavaScript 文件 `node --check` **2/2**。正式版本仍为 **0.5.16**；本轮只修改未发行源码、测试与文档，未构建、未打包、未运行 UI smoke。`dist/` 与 `release/` 未写入；按排除 `.manus-*` 临时文件的同一 119 个发布文件清单逐项比较，改动前后聚合 SHA-256 均为 `54ee6bbd69b23393e9fe697fc2829f30b1e604461d2ae3ae322ef663a48eb6c9`。验证运行于 Linux Node 24.19 / ICU 78.3；状态级回归不证明 Electron renderer 实际交互或 macOS Foundation/AppKit、Windows/macOS 原生菜单、文本行为与辅助技术等价。文稿隐私与数据保留策略未改变。


## 2026-10-11 字符信息中的 Unicode Age（未发行源码）

CotEditor 7.1.1 的字符检查器会在 Unicode scalar 有 Age 属性时显示首次分配版本。CotEdit 现从 Unicode 17.0 官方 `DerivedAge.txt` 生成并保存紧凑年龄区间表及输入文件 SHA-256；字符信息 API 返回 `age`，面板为每个标量显示“Unicode 版本：Unicode x.y”，无 Age 的未分配码位不显示该行。回归覆盖 U+0041 → 1.1、U+1F600 → 6.1、U+1FAEA → 17.0、U+0378 无 Age，以及 U+10FFFF 虽为 `Cn` 非字符但 Age 为 2.0 的 UCD 边界。该字段表示首次分配版本，不是当前 Unicode 版本。

依据 [CotEditor 7.1.1 Character Inspector](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Accessory%20Views/CharacterInspectorView.swift)、[Unicode 17.0 `DerivedAge.txt`](https://www.unicode.org/Public/17.0.0/ucd/DerivedAge.txt) 和 [Unicode Character Database Age 属性说明](https://www.unicode.org/reports/tr44/)。定向字符信息/字符计数测试 **9/9**，完整 `npm test` **497/497**，变更 JavaScript 文件 `node --check` **3/3**、Python 生成器语法检查通过。正式版本仍为 **0.5.16**；未构建、未打包、未运行 UI smoke。正式 AppImage/DEB SHA-256 校验通过；本轮未触及 `dist/` 或 `release/`。测试在 Linux Node 环境运行，不证明 macOS/Windows 原生 Inspector、菜单、辅助技术或 UI 等价；文稿隐私与数据保留策略未改变。

## 2026-10-11 Unicode 元数据输入边界（未发行源码）

`getUnicodeScalarInfo()` 现只接受整数码点或恰好包含一个码点的字符串；多码点字符串、空值、非整数数值及越界值返回 `null`，不再把任意输入静默转换后只读取首个码点。现有字符面板继续传入整数码点。测试同时校验 Unicode 17 Age 数据的版本标记、DerivedAge 输入 SHA-256 格式、1,788 个排序且不重叠的压缩区间及相邻同版本合并不变量；[Unicode 数据说明](docs/unicode-character-data.md) 补列 DerivedAge 来源与 API 输入契约。

定向测试 **6/6**，完整 `npm test` **499/499**，变更 JavaScript 源码与测试 `node --check` **2/2**。正式版仍为 **0.5.16**；本轮仅改未发行源码、测试与文档，未构建、未打包、未运行 UI smoke。`dist/` 与 `release/` 120 个文件的聚合 SHA-256 与修改前相同：`6f659a1ad7c8aa3063788ba2bd57bd14e26cc12a95ca06ee76f3867a00369758`。Node 测试运行于 Linux，不验证 Electron 实际面板呈现或 macOS/Windows 原生行为；隐私与数据保留策略未改变。


## 2026-10-12 查找工具栏按钮名称（未发行 UI 源码）

查找工具栏按钮现提供显式可访问名称“查找与替换”，放大镜符号标为装饰性内容；可见按钮文字与快捷键提示不变，面板 `aria-controls` / `aria-expanded` 关系保持原样。依据 [W3C WAI-ARIA Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) 关于按钮可访问名称的要求。本轮只修改 HTML 标记和静态 Node 回归，不宣称 CotEditor 原生辅助技术等价，也未运行真实读屏器或 UI smoke。

## 2026-10-12 行重排事务的混合行尾 Undo/Redo 回归（未发行测试）

为 `transformActiveLineBlock` 所用的“正文变化 + 显式 `setDocumentLineEndings` 效果”历史路径补回归：反转三行混合 CRLF/PS 文稿时，检查转换后的分隔符、Undo/Redo 后的精确序列化，以及重做后新插入行仍采用原文稿回退 NEL。本轮测试验证现有实现已通过，因此只新增测试与说明，不改生产源码。依据 CotEditor 7.1.1 正式发布说明中关于混合行尾文稿 Redo 的修复；不将此状态测试解释为 Cocoa 原生行为等价。

定向 `document-line-ending-history` **5/5**，完整串行 `npm test` **508/508**，新增测试文件 `node --check` 通过；正式版本仍为 **0.5.16**，本项为未发行测试/文档增量。未构建、未运行 UI smoke、未打包；Linux Node/CodeMirror state 测试不证明 Electron renderer、macOS/Windows 原生文本系统或 1:1 parity。


## 2026-10-12 半角 Hangul 宽度转换（未发行源码）
CotEditor 7.1.1 的普通全/半角命令使用可逆 Foundation `fullwidthToHalfwidth` 转换；CotEdit 现将半角 Hangul U+FFA0–U+FFDC 中有 Unicode 映射的字符逐码点转换为规范 Hangul Jamo，并能反向还原对应 Jamo。未映射码点、预组音节和兼容 Jamo 保持不变；相邻 Jamo 不合成为音节，不把全段内容作为通用 NFKC 处理。依据 [CotEditor 7.1.1 转换源码](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Text%20View/EditorTextView%2BTransformation.swift)、[Apple `fullwidthToHalfwidth`](https://developer.apple.com/documentation/foundation/stringtransform/fullwidthtohalfwidth) 和 [ICU 宽度转换文档](https://unicode-org.github.io/icu/userguide/transforms/general/)；本机 `uconv` ICU 74.2 单码点比对为正向 **61/61**、反向 Hangul Jamo **256/256**。定向 `text-tools` **26/26**、完整串行 Node 测试 **523/523**，变更 JavaScript 文件语法检查 **2/2**。正式版仍为 **0.5.16**；只改源码、测试及文档，未构建、未打包、未运行 UI smoke。`dist/`、`release/` 共 **119** 个文件的聚合 SHA-256 前后均为 `8cf6be7444d1cf989516770f39bbc8a39fef3a5b03d2adad287bb0495fd44eec`。验证在 Linux Node / ICU transliterator 环境进行，不能证明 macOS Foundation 实机、Windows/macOS 桌面 UI、菜单或辅助技术 1:1 等价；隐私及数据保留策略未变。


## 2026-10-12 孤立日文组合标记宽度转换（未发行源码）
CotEdit 普通“转为半角”现将独立 U+3099 COMBINING KATAKANA-HIRAGANA VOICED SOUND MARK、U+309A COMBINING KATAKANA-HIRAGANA SEMI-VOICED SOUND MARK 映射为 U+FF9E/U+FF9F；反向命令沿用现有 NFKC 路径还原。已识别的片假名基字符与组合标记仍先作为整体映射，未覆盖字符不做宽泛规范化。CotEditor 7.1.1 调用 Foundation 可逆 `.fullwidthToHalfwidth`；Apple 文档说明该变换对应 CFString 转换。本机 ICU 74.2 `uconv` 对这两个独立码点的双向映射均为 **2/2**，与 CotEdit 新测试一致；这只是 ICU 对照，不等于 macOS Foundation 实机验证。定向 `text-tools` **27/27**、完整串行 Node 测试 **524/524**、`node --check` **2/2**；新增用例在源码修正前按预期失败。正式版仍为 **0.5.16**；只改源码、测试和文档，未构建、未打包、未运行 UI smoke。`dist/`、`release/` 共 **120** 个文件的聚合 SHA-256 前后均为 `b68917e4523a6e69ad1ba0e37448b3a483e580c5b68c2f5d704e6e5e658b011f`。Linux Node/ICU 回归不证明 macOS Foundation、Electron 桌面 UI、菜单、辅助技术或各目标平台 1:1 等价；恢复、隐私和数据保留策略未变。


## 2026-10-12 Edit > Substitutions 的 Replace Text（未发行源码）

新增“替换文本”和本机替换词管理器：规则按区分大小写的字面触发词匹配，在每个非空选区内由左至右扫描、优先最长匹配，不级联；所有选区一次事务、一次 Undo。菜单要求文稿可编辑、有选区且存在启用规则。不会自动改写输入，也不读取或同步 macOS 系统替换词；这是 CotEditor 菜单的本机规则近似，不是 AppKit/系统词典等价实现。依据 [CotEditor 7.1.1 菜单定义](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Storyboards/Base.lproj/Main.storyboard) 与 [Apple 文本替换指南](https://support.apple.com/en-us/guide/mac-help/mh35735/mac)。核心替换事务 **5/5**、菜单路由 **45/45**、完整串行 Node 测试 **534/534**、本轮 11 个 JavaScript 文件 `node --check` **11/11**。正式版仍为 **0.5.16**；未构建、未打包、未运行 UI smoke，未写入 `dist/` 或 `release/`。Linux Node 和静态检查不证明实际 Electron UI、macOS 原生行为或跨平台 1:1 parity；完整边界见[兼容性说明](docs/compatibility.md)。


## 2026-10-12 忽略变音符号查找（未发行源码）

查找栏新增默认关闭的“忽略变音符号”选项，普通文字模式可查找预组合/分解重音与词中重音（如 `naive` → `naïve`）；搜索、高亮及替换共用映射后的完整原文区间。偏好写入现有本机设置并随设置文件导入/导出，正则模式下禁用；不新增快捷键，也不做宽度折叠或声称等同 Apple Foundation。依据 CotEditor 7.1.1 [默认查找偏好](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Application/Defaults/DefaultSettings.swift)、[TextFind](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/TextFind/TextFind.swift) 与 Apple [`diacriticInsensitive`](https://developer.apple.com/documentation/foundation/nsstring/compareoptions/diacriticinsensitive)。完整串行 Node 测试 **539/539**，6 个变更 JS 文件语法检查 **6/6**，HTML 静态结构 **396 个唯一 ID、79 项引用已解析**。正式版仍为 **0.5.16**；未构建、未打包、未运行 UI smoke、未写入 `dist/` 或 `release/`。完整边界见[兼容性说明](docs/compatibility.md)。


### 2026-10-12 快捷键：Emoji ZWJ 键值（未发行）

快捷键捕获与 IPC 现接纳结构有效的 emoji ZWJ 键值（例如 `👩🏽‍💻`），同时继续拒绝孤立连接符、双向控制和其他格式/控制字符；未新增默认键位。定向快捷键 **21/21**、完整串行 Node 回归 **541/541**、`node --check` **4/4**。正式版仍为 **0.5.16**；未构建、未打包、未运行 UI smoke，实际桌面输入及原生菜单尚未逐平台验证。详见 [`docs/compatibility.md`](docs/compatibility.md)。


## 2026-10-12 文件夹浏览器 Add / New File / New Folder（未发行源码）

依据 CotEditor 7.1.1 [FileBrowserViewController.swift](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Sidebar/File%20Browser/FileBrowserViewController.swift) 与 [DirectoryDocument.swift](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document/DirectoryDocument.swift)，文件夹浏览器现提供底部加号菜单“新建文件／新建文件夹”，无默认快捷键。CotEdit 仅在用户明确选取菜单项后，由主进程在当前目录内排他创建空文件或新文件夹；重名时自动使用编号避免覆盖。创建时清除文件名筛选与文件内容搜索，刷新并聚焦新项；新文件显示在只读预览中。保留当前窗口已选根目录校验，拒绝越界路径及离开根目录的符号链接。

**明确差异：**文件名目前固定为 `Untitled.txt` 和 `untitled folder`，不按 CotEditor 默认语法推导扩展名或本地化文件名；不提供 CotEditor 原生文件浏览器的右键同类命令，也不复刻创建后原生行内重命名/选取编辑、NSFileCoordinator 或 macOS 辅助技术行为。因此这是经测试的功能增量，不代表完整 1:1 UI/UX 等价。

定向目录/菜单/无障碍测试 **78/78**；完整串行 `node --test --test-concurrency=1 test/*.test.js` **576/576**；变更 JavaScript `node --check` **7/7**，CSS 解析通过，HTML **402** 个 ID 唯一。正式版仍为 **0.5.16**；按既定选择未构建、未打包、未运行 Electron UI smoke。`dist/` 与 `release/` 未触碰（共 **120** 个文件）；Node/静态测试不验证实际 Electron UI、原生菜单、系统文件协调、键盘焦点/事件时序或辅助技术行为。未改变恢复、隐私、权限和数据保留边界。


## 2026-10-12 未发行快捷键兼容增量

依据 [CotEditor 7.1.1 发布说明](https://coteditor.com/releasenotes/7.1.1.en)及[加入多字符按键快捷键的上游提交](https://github.com/coteditor/CotEditor/commit/897e55f1103c6c14e906bbbca536e6e715af04b4)，将 CotEdit 原来每个键值最多 16 个 Unicode 标量的限制扩展为每个安全可打印键值最多 **16,384 个 Unicode 标量**，并对所有命令快捷键键值再统一施加 **16,384 标量累计预算**（最坏不超过 64 KiB UTF-8 键值文本）。renderer 录入/匹配、设置持久化和主进程 IPC 使用一致边界；大小写与 NFC 行为保持不变。片段快捷键也可超过旧 16 标量限制，但继续受既有片段库 **40 KiB 总字节上限**和同一单键上限约束。空白、控制/格式字符、异常 ZWJ、未知命令 ID、无修饰的可打印键仍拒绝；没有新增默认快捷键或菜单动作。CotEditor 接受非空 key equivalent，CotEdit 仍保留明确的本地总预算，因此不声称无限长度的 1:1 等价。

定向快捷键/设置/IPC/片段/菜单测试 **67/67**，完整串行 Node 测试 **596/596**，4 个变更 JavaScript 文件 `node --check` **4/4**。正式版仍为 **0.5.16**；仅修改未发行源码、测试与文档，未构建、未打包、未运行 UI smoke。`dist/` 与 `release/` 未触碰；本轮初始与最终包含全部文件的摘要均为 `b68917e4523a6e69ad1ba0e37448b3a483e580c5b68c2f5d704e6e5e658b011f`（含 1 个既存 `.manus-*` 临时文件；排除此文件后为 119 个文件）。Node 测试不验证真实键盘布局、输入法、Electron 原生菜单或 macOS/Windows 桌面行为。


## 2026-10-12 按模式排序样例行高亮（未发行源码）

依据 CotEditor 7.1.1 的 [`PatternSortView.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Document%20Window/Accessory%20Views/PatternSortView.swift)、[`CSVSortPattern.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/LineSort/CSVSortPattern.swift) 与 [`RegularExpressionSortPattern.swift`](https://github.com/coteditor/CotEditor/blob/7.1.1/Packages/EditorCore/Sources/LineSort/RegularExpressionSortPattern.swift)，按模式排序的样例行现在高亮实际排序键范围：整行、去除两侧空白后的分隔列、正则整匹配或所选捕获组。正则范围使用 JavaScript RegExp indices；高亮通过安全文本节点构造。此为即时预览，不改变排序结果、正则语义、快捷键、菜单或任何持久化/恢复/隐私/数据保留行为。定向测试 **55/55**、完整串行 Node 测试 **603/603**、变更 JavaScript `node --check` **3/3**，CSS PostCSS 解析通过、HTML **408** 个 ID 唯一。正式版仍为 **0.5.16**；未构建、未打包、未运行 UI smoke，也未改写 `dist/` 或 `release/`。Node/静态验证不能确认实际 Electron 视觉对比、原生菜单或各平台辅助技术表现；详见[兼容性记录](docs/compatibility.md)。


## 本轮未发行增量：文件夹预览显示常见图像尺寸

依据 CotEditor 7.1.1 `FilePreviewView.swift` 的图像属性信息，文件夹侧栏现可从当前已有、最多 512 KiB 的预览缓冲区识别 PNG、GIF、JPEG、BMP、WebP 与经典 TIFF 的像素宽高；只传回尺寸数字，不解码或渲染图像，也不把字节交给 renderer。识别为图像后，侧栏展示“宽 × 高 像素”，禁用默认纯文本打开/新窗口，但保留用户明确选择的“以纯文本打开”和外部应用路径。此功能仅覆盖可从有限文件头读取尺寸的常见格式，不等同 CotEditor 的 Quick Look；不提供缩略图、DPI、色彩空间或完整文件有效性检查，BigTIFF、HEIC、SVG 等不纳入。共享头部解析器不改变读取预算、文稿恢复、隐私或数据保留策略。目录预览/File Drop/菜单定向测试 **95/95**、完整串行 Node **604/604**、变更 JavaScript `node --check` **6/6**；CSS PostCSS 解析通过，HTML **408** 个 ID 唯一。正式版仍为 **0.5.16**；只改未发行源码、测试和文档，未构建、未打包、未运行 UI smoke，`dist/` 与 `release/` 未改写。


## 2026-10-12 未发行增量：JPEG EXIF DPI

文件夹图像预览现可在既有 512 KiB 受限缓冲区内读取 JPEG APP1 EXIF 的 `XResolution` 与英寸/厘米 `ResolutionUnit`；有效 JFIF 值优先，EXIF 作为无有效 JFIF 时的回退。EXIF IFD/rational 访问限于所属 APP1 段，缺单位或数据不完整时不猜测，不解码图像、不向 renderer 传图像字节。解析器、目录预览、菜单定向测试 **67/67**，完整串行 Node 套件 **612/612**，变更 JavaScript 语法检查 **3/3**。正式版本仍为 **0.5.16**；未构建、未打包、未运行 UI smoke，未触碰 `dist/` 或 `release/`，未清理磁盘。当前根文件系统可用约 **843 MiB**、使用率 **99%**，继续遵守暂不构建/打包的边界。平台与图像解码差异见[兼容性记录](docs/compatibility.md)。


本轮未发行增量：文件夹预览现在可将经典 TIFF IFD0 中合法的 `PhotometricInterpretation`（tag 262，SHORT/count=1/value=2）显示为通用“色彩模型 RGB”，不误称为 sRGB 配置文件。遇到 ICC tag、畸形/重复字段、显式未校准 EXIF 或 EXIF 与 RGB 模型矛盾时仍不猜测；仅检查既有 512 KiB 预览缓冲区并回传有限字符串标量，不传递图像字节。目录预览/解析/菜单定向测试 **89/89**，完整串行 Node **638/638**，本轮变更 JS `node --check` **5/5**；`dist/` 与 `release/` 119 个非临时文件逐项 SHA-256 未变。正式版本仍为 **0.5.16**；未构建、未打包、未运行 UI smoke。此项不等同 AppKit/ImageIO 色彩管理，详见[兼容性记录](docs/compatibility.md)。


### 未发行源码增量：CotEditor 7.1.1 JPEG 灰度预览

文件夹预览现在会在验证通过的 JFIF 8-bit 单分量帧上显示 `Gray` 模型；三分量 JFIF（YCbCr）、非标准或截断头部仍保持未知，不猜 profile、不解码图像，读取限额仍为 512 KiB。依据 [CotEditor 7.1.1 图像属性实现](https://github.com/coteditor/CotEditor/blob/7.1.1/CotEditor/Sources/Models/File%20Content%20Attributes/ImageAttributes.swift) 与 [JFIF 1.02 规范](https://www.w3.org/Graphics/JPEG/jfif3.pdf)。定向测试 48/48、完整串行 Node 测试 646/646、变更 JavaScript `node --check` 3/3；正式版仍为 0.5.16，未构建/打包/运行 UI smoke，`dist/` 与 `release/` 119 个文件摘要未变。原生 ImageIO 映射和桌面 UI 未验证；不宣称全量 1:1 parity。详见[兼容性记录](docs/compatibility.md)。

### 2026-10-12 文件夹预览属性分组（未发行源码）
CotEditor 7.1.1 的文件预览使用标签—值形式展示属性；CotEdit 现将文件夹预览的大小、编码、图像尺寸/DPI/色彩、音视频时长等从单行摘要改为语义化 `<dl>/<dt>/<dd>` 分组。只展示已有受限预览返回的有限标量，未知或无效属性不猜测；DOM 使用 `textContent` 构造，不插入文件元数据 HTML。定向回归 **55/55**，完整串行 Node **652/652**，变更 JS `node --check` **4/4**，PostCSS 解析通过。正式版仍为 **0.5.16**；未构建、未打包、未运行 UI smoke，`dist/` 和 `release/` 119 个非临时文件摘要未变。实际平台排版与辅助技术行为未验证；详见[兼容性记录](docs/compatibility.md)。

### 2026-10-12 自定义语法引号字素簇双击选择（未发行源码）

自定义语法的双击引号选择现支持组合附加符和 emoji ZWJ 等单个扩展字素簇端点/转义符；点击分隔符内任一 UTF-16 码元会选中完整语法 Token。多个字素组成的端点（如 Python 三引号）仍不纳入该选择分支。依据 CotEditor 7.1.1 `SymbolPair = Pair<Character>` 与 `QuotePairRule.escapeCharacter: Character`；JavaScript/ICU 与 Swift/Foundation 的 Unicode 分段版本可能不同，不代表所有平台的原生点击行为 1:1 等价。定向测试 **37/37**、完整显式 Node 测试 **690/690**、变更 JavaScript `node --check` **5/5**。正式版仍为 **0.5.16**；仅更新未发行源码、测试和文档，未构建、打包或运行 UI smoke，`dist/` 与 `release/` 未修改。详见[兼容性记录](docs/compatibility.md)。


### 2026-10-12 Python 三引号双击选择（未发行源码）
依据 CotEditor 7.1.1 `EditorTextView.swift` 与官方 Python `Edit.json`，自定义语法引号现在按较长分隔符优先扫描；单行 `"""…"""` / `'''…'''` Token 在开分隔符首字符或闭分隔符末字符双击时选中完整 Token，前缀不匹配不会被较短单引号规则绕过。定向显式 Node 测试 **39/39**，完整显式 Node 测试 **692/692**，变更 JavaScript `node --check` **4/4**。正式版仍为 **0.5.16**；未构建、未打包、未运行 UI smoke；`dist/` 与 `release/` 119 个非临时文件摘要未变。任意其他多字素端点仍未支持；跨行 Token 的选区和各平台原生点击未验证，详见[兼容性记录](docs/compatibility.md)。


## 2026-10-12 对照增量：逐语法自动补全

当时的增量在设置面板保留“全局默认：输入时显示补全建议”，并增加活动语法的“跟随全局默认 / 开启 / 关闭”控制；每个语法可独立覆盖全局偏好，恢复继承会移除覆盖。设置随本机偏好和设置文件导入/导出保存，`Alt+Escape` 显式手动补全不受影响，也未增加菜单命令/快捷键。候选来源选项的续作已见下节。正式版本仍为 **0.5.16**，两项改动均未发行。


前一增量验证（2026-10-12）：显式运行 `test/completion-mode-settings.test.js`、`test/settings.test.js`、`test/settings-file.test.js`、`test/menu-coverage.test.js`、`test/accessibility.test.js`、`test/coteditor-menu-parity.test.js`，**165/165** 通过；6 个变更 JavaScript 源码/测试文件 `node --check` **6/6**。完整测试套件未运行；未构建、打包、启动 Electron 或做 UI smoke。正式版仍为 **0.5.16**；仅更新未发行工作树源码、测试及文档。


## 2026-10-12 对照增量：逐语法补全候选来源

设置面板现在可按活动语法选择文稿词与语法词，支持恢复语法默认值，并通过本机设置与设置文件导入/导出保存。语法词合并 CodeMirror 当前语言提供者；自定义语法没有 `Completion.json` 时，会从安全的字面关键字/命令/类型/属性/值高亮规则提取候选。文稿词自动扫描限制在 250,000 个 UTF-16 单元内，显式 `Alt+Escape` 仍可按需扫描全文。macOS 系统“标准词”来源在跨平台版本中明确显示为不可用；复杂正则派生词表与原生 AppKit 补全弹窗仍非 1:1 移植。验证边界和上游来源见[兼容性记录](docs/compatibility.md)。本项未发行；正式版本仍为 **0.5.16**。
