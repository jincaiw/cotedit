# Unicode 字符信息数据

字符信息面板使用 Unicode Character Database **17.0.0** 的字符名称、General_Category、Block 和 Age 数据。该版本与 CotEditor 上游当前区块表注明的 Unicode 17.0.0 一致；Age 表示字符首次分配到的 Unicode 版本，不是当前 Unicode 版本。

- [UnicodeData.txt](https://www.unicode.org/Public/17.0.0/ucd/UnicodeData.txt)：字符正式名称、类别及算法命名范围。
- [NameAliases.txt](https://www.unicode.org/Public/17.0.0/ucd/NameAliases.txt)：控制字符显示名称别名。
- [Blocks.txt](https://www.unicode.org/Public/17.0.0/ucd/Blocks.txt)：Unicode 区块范围。
- [DerivedAge.txt](https://www.unicode.org/Public/17.0.0/ucd/DerivedAge.txt)：每个码点首次分配的 Unicode 版本；生成器排序、检查重叠并合并相邻同版本范围，当前压缩为 1,788 个区间。
- 生成脚本：`scripts/build-unicode-character-data.py`。
- 生成结果：`lib/unicode-character-data.json`；文件包含 UCD 原始文件的 SHA-256，便于版本核验。
- 字符元数据 API 接受整数码点或恰好包含一个码点的字符串；空字符串、多码点字符串、非整数数值和越界码点返回 `null`，不会静默截取输入的首个码点。多标量字素由 `getUnicodeCharacterInfo()` 分别返回每个码点的元数据。
- 许可：Unicode License v3，全文见 [`docs/licenses/UNICODE-LICENSE-V3.txt`](licenses/UNICODE-LICENSE-V3.txt)。

重新生成：

```sh
python3 scripts/build-unicode-character-data.py
```

HFS+ 修改型 NFC/NFD 依赖 Apple 文件系统的特定规范化语义，当前跨平台实现不提供这两项；高级计数仅提供标准 NFD、NFC、NFKD、NFKC 与 NFKC_Casefold。规范化具体到最新码点的行为仍受 Electron/V8 内置 ICU 版本影响，界面不会将其宣称为 macOS Foundation 的原生实现。

字符信息选区的 Unicode 17.0 GB9c 局部边界校正另使用 [`lib/unicode-incb.js`](../lib/unicode-incb.js) 中的 `Indic_Conjunct_Break` Consonant、Extend、Linker 范围；数据来自官方 [DerivedCoreProperties.txt](https://www.unicode.org/Public/17.0.0/ucd/DerivedCoreProperties.txt)，遵循 Unicode License v3。此表仅服务于被截断上下文的边界识别，不用于字符名称/类别/区块数据，也不替代运行时 `Intl.Segmenter`。
