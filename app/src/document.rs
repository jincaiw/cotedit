use encoding_rs::{Encoding, UTF_8, UTF_16BE, UTF_16LE};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum LineEnding {
    Lf,
    CrLf,
    Cr,
    Nel,
    LineSeparator,
    ParagraphSeparator,
}

impl LineEnding {
    pub fn label(self) -> &'static str {
        match self {
            Self::Lf => "LF",
            Self::CrLf => "CRLF",
            Self::Cr => "CR",
            Self::Nel => "NEL",
            Self::LineSeparator => "LS",
            Self::ParagraphSeparator => "PS",
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Lf => "\n",
            Self::CrLf => "\r\n",
            Self::Cr => "\r",
            Self::Nel => "\u{0085}",
            Self::LineSeparator => "\u{2028}",
            Self::ParagraphSeparator => "\u{2029}",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TextEncoding {
    Utf8 { bom: bool },
    Utf16Le { bom: bool },
    Utf16Be { bom: bool },
    Windows1252,
    ShiftJis,
    Gbk,
    Big5,
}

impl TextEncoding {
    pub fn label(self) -> &'static str {
        match self {
            Self::Utf8 { bom: false } => "UTF-8",
            Self::Utf8 { bom: true } => "UTF-8 BOM",
            Self::Utf16Le { .. } => "UTF-16LE",
            Self::Utf16Be { .. } => "UTF-16BE",
            Self::Windows1252 => "Windows-1252",
            Self::ShiftJis => "Shift_JIS",
            Self::Gbk => "GBK",
            Self::Big5 => "Big5",
        }
    }

    fn encoding(self) -> &'static Encoding {
        match self {
            Self::Utf8 { .. } => UTF_8,
            Self::Utf16Le { .. } => UTF_16LE,
            Self::Utf16Be { .. } => UTF_16BE,
            Self::Windows1252 => Encoding::for_label(b"windows-1252").unwrap(),
            Self::ShiftJis => Encoding::for_label(b"shift_jis").unwrap(),
            Self::Gbk => Encoding::for_label(b"gbk").unwrap(),
            Self::Big5 => Encoding::for_label(b"big5").unwrap(),
        }
    }

    fn has_bom(self) -> bool {
        matches!(
            self,
            Self::Utf8 { bom: true } | Self::Utf16Le { bom: true } | Self::Utf16Be { bom: true }
        )
    }
}

#[derive(Clone, Debug)]
pub struct DecodedDocument {
    pub text: String,
    pub encoding: TextEncoding,
    pub line_endings: Vec<LineEnding>,
    pub dominant_line_ending: LineEnding,
}

impl Default for DecodedDocument {
    fn default() -> Self {
        Self {
            text: String::new(),
            encoding: TextEncoding::Utf8 { bom: false },
            line_endings: Vec::new(),
            dominant_line_ending: LineEnding::Lf,
        }
    }
}

pub fn decode(bytes: &[u8]) -> Result<DecodedDocument, String> {
    let (charset, bom, payload) = if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        (UTF_8, true, &bytes[3..])
    } else if bytes.starts_with(&[0xFF, 0xFE]) {
        (UTF_16LE, true, &bytes[2..])
    } else if bytes.starts_with(&[0xFE, 0xFF]) {
        (UTF_16BE, true, &bytes[2..])
    } else if std::str::from_utf8(bytes).is_ok() {
        (UTF_8, false, bytes)
    } else {
        let mut detector = chardetng::EncodingDetector::new();
        detector.feed(bytes, true);
        let detected = detector.guess(None, false);
        let supported = match detected.name() {
            "Shift_JIS" => charset_for(b"shift_jis"),
            "GBK" => charset_for(b"gbk"),
            "Big5" => charset_for(b"big5"),
            _ => charset_for(b"windows-1252"),
        };
        (supported, false, bytes)
    };

    let encoding = encoding_from_charset(charset, bom);
    let decoded = if charset == UTF_16LE || charset == UTF_16BE {
        if payload.len() % 2 != 0 {
            return Err("UTF-16 文稿包含不完整的 16 位码元".into());
        }
        let words = payload
            .chunks_exact(2)
            .map(|pair| {
                if charset == UTF_16LE {
                    u16::from_le_bytes([pair[0], pair[1]])
                } else {
                    u16::from_be_bytes([pair[0], pair[1]])
                }
            })
            .collect::<Vec<_>>();
        String::from_utf16(&words).map_err(|_| "UTF-16 文稿包含无效的代理项序列".to_owned())?
    } else {
        let (decoded, had_errors) = charset.decode_without_bom_handling(payload);
        if had_errors {
            return Err(format!("无法使用 {} 无损解码该文稿", charset.name()));
        }
        decoded.into_owned()
    };

    let (text, line_endings) = normalize_line_endings(&decoded);
    let dominant_line_ending = dominant_line_ending(&line_endings);
    Ok(DecodedDocument {
        text,
        encoding,
        line_endings,
        dominant_line_ending,
    })
}

pub fn encode(
    text: &str,
    previous_text: &str,
    encoding: TextEncoding,
    line_endings: &[LineEnding],
    fallback: LineEnding,
    force_line_ending: bool,
) -> Result<(Vec<u8>, Vec<LineEnding>), String> {
    let output_eols = if force_line_ending {
        vec![fallback; text.bytes().filter(|byte| *byte == b'\n').count()]
    } else {
        reconcile_line_endings(previous_text, text, line_endings, fallback)
    };
    let mut eol_iter = output_eols.iter().copied();
    let mut serialized = String::with_capacity(text.len());
    for character in text.chars() {
        if character == '\n' {
            serialized.push_str(eol_iter.next().unwrap_or(fallback).as_str());
        } else {
            serialized.push(character);
        }
    }

    let (body, _, had_errors) = encoding.encoding().encode(&serialized);
    if had_errors {
        return Err(format!(
            "所选 {} 编码无法表示文稿中的全部字符",
            encoding.label()
        ));
    }
    let mut bytes = Vec::with_capacity(body.len() + 3);
    if encoding.has_bom() {
        match encoding {
            TextEncoding::Utf8 { .. } => bytes.extend_from_slice(&[0xEF, 0xBB, 0xBF]),
            TextEncoding::Utf16Le { .. } => bytes.extend_from_slice(&[0xFF, 0xFE]),
            TextEncoding::Utf16Be { .. } => bytes.extend_from_slice(&[0xFE, 0xFF]),
            _ => {}
        }
    }
    bytes.extend_from_slice(&body);
    Ok((bytes, output_eols))
}

fn reconcile_line_endings(
    previous_text: &str,
    text: &str,
    previous_endings: &[LineEnding],
    fallback: LineEnding,
) -> Vec<LineEnding> {
    let old_lines = previous_text.split('\n').collect::<Vec<_>>();
    let new_lines = text.split('\n').collect::<Vec<_>>();
    let mut endings = vec![fallback; new_lines.len().saturating_sub(1)];
    let diff = similar::TextDiff::from_slices(&old_lines, &new_lines);
    for operation in diff.ops() {
        if !matches!(
            operation.tag(),
            similar::DiffTag::Equal | similar::DiffTag::Replace
        ) {
            continue;
        }
        for (old_line, new_line) in operation.old_range().zip(operation.new_range()) {
            if let (Some(old_ending), Some(new_ending)) =
                (previous_endings.get(old_line), endings.get_mut(new_line))
            {
                *new_ending = *old_ending;
            }
        }
    }
    endings
}

fn charset_for(label: &[u8]) -> &'static Encoding {
    Encoding::for_label(label).expect("encoding_rs supports the declared charset")
}

fn encoding_from_charset(charset: &'static Encoding, bom: bool) -> TextEncoding {
    if charset == UTF_8 {
        TextEncoding::Utf8 { bom }
    } else if charset == UTF_16LE {
        TextEncoding::Utf16Le { bom }
    } else if charset == UTF_16BE {
        TextEncoding::Utf16Be { bom }
    } else if charset.name() == "Shift_JIS" {
        TextEncoding::ShiftJis
    } else if charset.name() == "GBK" {
        TextEncoding::Gbk
    } else if charset.name() == "Big5" {
        TextEncoding::Big5
    } else {
        TextEncoding::Windows1252
    }
}

fn normalize_line_endings(text: &str) -> (String, Vec<LineEnding>) {
    let mut normalized = String::with_capacity(text.len());
    let mut endings = Vec::new();
    let mut chars = text.chars().peekable();
    while let Some(character) = chars.next() {
        let ending = match character {
            '\r' if chars.peek() == Some(&'\n') => {
                chars.next();
                Some(LineEnding::CrLf)
            }
            '\r' => Some(LineEnding::Cr),
            '\n' => Some(LineEnding::Lf),
            '\u{0085}' => Some(LineEnding::Nel),
            '\u{2028}' => Some(LineEnding::LineSeparator),
            '\u{2029}' => Some(LineEnding::ParagraphSeparator),
            _ => None,
        };
        if let Some(ending) = ending {
            normalized.push('\n');
            endings.push(ending);
        } else {
            normalized.push(character);
        }
    }
    (normalized, endings)
}

fn dominant_line_ending(endings: &[LineEnding]) -> LineEnding {
    let mut counts = std::collections::HashMap::new();
    let mut winner = LineEnding::Lf;
    let mut highest_count = 0;
    for ending in endings {
        let count = counts.entry(*ending).or_insert(0);
        *count += 1;
        if *count > highest_count {
            winner = *ending;
            highest_count = *count;
        }
    }
    winner
}
