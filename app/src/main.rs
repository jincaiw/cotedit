mod document;

use std::collections::BTreeMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use document::{DecodedDocument, LineEnding, TextEncoding, decode, encode};

use gpui_kit::assets::Assets;
use gpui_kit::component::{
    ActiveTheme as _, Root, Sizable as _, WindowExt as _,
    button::{Button, ButtonVariants as _},
    dialog::{DialogAction, DialogFooter},
    h_flex,
    input::{self, Editor, EditorState, Input, InputEvent, InputState, Position, TabSize},
    scroll::ScrollableElement as _,
    v_flex,
};
use gpui_kit::prelude::FluentBuilder as _;
use gpui_kit::*;

static NEXT_WINDOW_ID: AtomicU64 = AtomicU64::new(1);

fn next_window_id() -> String {
    format!(
        "{}-{}",
        std::process::id(),
        NEXT_WINDOW_ID.fetch_add(1, Ordering::Relaxed)
    )
}

const OPEN_FILES: PathPromptOptions = PathPromptOptions {
    files: true,
    directories: false,
    multiple: true,
    prompt: None,
};

fn reveal_in_file_manager(path: &Path) -> std::io::Result<()> {
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg("-R").arg(path);
        command
    };

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut argument = std::ffi::OsString::from("/select,");
        argument.push(path.as_os_str());
        let mut command = Command::new("explorer");
        command.arg(argument);
        command
    };

    #[cfg(target_os = "linux")]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(path.parent().unwrap_or_else(|| Path::new(".")));
        command
    };

    command.spawn().map(|_| ())
}

fn line_range_for_selection(
    text: &str,
    selection: std::ops::Range<usize>,
) -> Option<std::ops::Range<usize>> {
    if text.is_empty() {
        return None;
    }
    let start = selection.start.min(text.len());
    let end = selection.end.min(text.len());
    let first_line = text[..start].rfind('\n').map_or(0, |offset| offset + 1);
    if start == text.len() && text.ends_with('\n') {
        return Some(text.len()..text.len());
    }
    let last_byte = if end > start { end - 1 } else { start };
    let last_line_start = text[..last_byte].rfind('\n').map_or(0, |offset| offset + 1);
    let last_line_end = text[last_byte..]
        .find('\n')
        .map_or(text.len(), |offset| last_byte + offset + 1);
    Some(first_line..last_line_end.max(last_line_start))
}

fn duplicate_line(
    text: &str,
    selection: std::ops::Range<usize>,
) -> Option<(String, std::ops::Range<usize>)> {
    let lines = line_range_for_selection(text, selection.clone())?;
    let selected_lines = &text[lines.clone()];
    let separator = if selected_lines.is_empty() {
        "\n"
    } else if selected_lines.ends_with('\n') {
        ""
    } else {
        "\n"
    };
    let mut duplicated = String::with_capacity(text.len() + selected_lines.len() + separator.len());
    duplicated.push_str(&text[..lines.end]);
    duplicated.push_str(separator);
    duplicated.push_str(selected_lines);
    duplicated.push_str(&text[lines.end..]);
    Some((duplicated, selection))
}

fn delete_line(
    text: &str,
    selection: std::ops::Range<usize>,
) -> Option<(String, std::ops::Range<usize>)> {
    let mut lines = line_range_for_selection(text, selection.clone())?;
    if lines.is_empty() {
        if lines.start == 0 {
            return None;
        }
        lines.start -= 1;
    }
    let mut deleted = String::with_capacity(text.len() - lines.len());
    deleted.push_str(&text[..lines.start]);
    deleted.push_str(&text[lines.end..]);
    let map_offset = |offset: usize| {
        if offset <= lines.start {
            offset
        } else if offset < lines.end {
            lines.start
        } else {
            offset - lines.len()
        }
    };
    Some((
        deleted,
        map_offset(selection.start)..map_offset(selection.end),
    ))
}

fn trim_trailing_whitespace(text: &str) -> String {
    let mut trimmed = String::with_capacity(text.len());
    for line in text.split_inclusive('\n') {
        let (contents, ending) = line
            .strip_suffix('\n')
            .map_or((line, ""), |line| (line, "\n"));
        trimmed.push_str(contents.trim_end_matches([' ', '\t']));
        trimmed.push_str(ending);
    }
    trimmed
}

fn map_offset_after_trim(text: &str, offset: usize) -> usize {
    let offset = offset.min(text.len());
    let mut input_offset = 0;
    let mut output_offset = 0;
    for line in text.split_inclusive('\n') {
        let (contents, newline) = line.strip_suffix('\n').map_or((line, 0), |line| (line, 1));
        let trimmed_len = contents.trim_end_matches([' ', '\t']).len();
        let line_end = input_offset + contents.len();
        if offset <= line_end {
            return output_offset + offset.saturating_sub(input_offset).min(trimmed_len);
        }
        input_offset += line.len();
        output_offset += trimmed_len + newline;
    }
    output_offset
}

#[cfg(test)]
mod text_command_tests {
    use super::{delete_line, duplicate_line, map_offset_after_trim, trim_trailing_whitespace};

    #[test]
    fn duplicates_selected_lines_without_moving_selection() {
        assert_eq!(
            duplicate_line("one\ntwo", 0..3),
            Some(("one\none\ntwo".to_owned(), 0..3))
        );
        assert_eq!(
            duplicate_line("one\ntwo\n", 4..4),
            Some(("one\ntwo\ntwo\n".to_owned(), 4..4))
        );
        assert_eq!(
            duplicate_line("one\n", 4..4),
            Some(("one\n\n".to_owned(), 4..4))
        );
    }

    #[test]
    fn deletes_selected_lines_and_clamps_selection() {
        assert_eq!(
            delete_line("one\ntwo\nthree", 4..7),
            Some(("one\nthree".to_owned(), 4..4))
        );
        assert_eq!(delete_line("only", 0..0), Some((String::new(), 0..0)));
    }

    #[test]
    fn trims_ascii_spaces_and_tabs_without_changing_newlines() {
        assert_eq!(
            trim_trailing_whitespace("alpha  \nbeta\t\n\nγamma  "),
            "alpha\nbeta\n\nγamma"
        );
    }

    #[test]
    fn maps_selection_offsets_across_removed_suffixes() {
        let text = "alpha  \nbeta\t\n";
        assert_eq!(map_offset_after_trim(text, 7), 5);
        assert_eq!(map_offset_after_trim(text, 8), 6);
        assert_eq!(map_offset_after_trim(text, text.len()), 11);
    }
}

fn write_atomically(path: &Path, contents: &[u8]) -> std::io::Result<()> {
    let destination = match std::fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => path.canonicalize()?,
        _ => path.to_path_buf(),
    };
    let mut file = atomic_write_file::AtomicWriteFile::options().open(destination)?;
    file.write_all(contents)?;
    file.commit()
}

fn content_hash(contents: &[u8]) -> [u8; 32] {
    Sha256::digest(contents).into()
}

fn file_content_hash(path: &Path) -> std::io::Result<Option<[u8; 32]>> {
    let mut file = match std::fs::File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error),
    };
    let mut hasher = Sha256::new();
    let mut buffer = [0; 64 * 1024];
    loop {
        let bytes_read = file.read(&mut buffer)?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }
    Ok(Some(hasher.finalize().into()))
}

fn same_file_path(first: &Path, second: &Path) -> bool {
    first == second
        || first
            .canonicalize()
            .ok()
            .zip(second.canonicalize().ok())
            .is_some_and(|(first, second)| first == second)
}

fn default_tab_size() -> usize {
    4
}

fn default_hard_tabs() -> bool {
    true
}

fn default_show_status_bar() -> bool {
    true
}

#[derive(Clone, Copy, Deserialize, Serialize)]
struct PersistedIndentation {
    #[serde(default = "default_tab_size")]
    tab_size: usize,
    #[serde(default = "default_hard_tabs")]
    hard_tabs: bool,
}

impl Default for PersistedIndentation {
    fn default() -> Self {
        Self {
            tab_size: default_tab_size(),
            hard_tabs: default_hard_tabs(),
        }
    }
}

impl PersistedIndentation {
    fn editor_tab_size(self) -> TabSize {
        TabSize {
            tab_size: self.tab_size.clamp(1, 99),
            hard_tabs: self.hard_tabs,
        }
    }
}

#[derive(Clone, Default, Deserialize, Serialize)]
struct PersistedDraft {
    path: Option<PathBuf>,
    untitled_index: Option<usize>,
    text: Option<String>,
    cursor_line: u32,
    cursor_column: u32,
    #[serde(default = "default_tab_size")]
    tab_size: usize,
    #[serde(default = "default_hard_tabs")]
    hard_tabs: bool,
    #[serde(default)]
    prevent_editing: bool,
}

#[derive(Clone, Default, Deserialize, Serialize)]
struct PersistedWindow {
    id: String,
    open_files: Vec<PathBuf>,
    active_file: Option<PathBuf>,
    #[serde(default)]
    active_untitled_index: Option<usize>,
    #[serde(default = "default_show_status_bar")]
    show_status_bar: bool,
    #[serde(default)]
    drafts: Vec<PersistedDraft>,
}

#[derive(Default, Deserialize, Serialize)]
struct PersistedSession {
    version: u32,
    #[serde(default)]
    windows: Vec<PersistedWindow>,
    #[serde(default)]
    recent_files: Vec<PathBuf>,
    #[serde(default)]
    syntax_indentation: BTreeMap<String, PersistedIndentation>,
    #[serde(default, skip_serializing)]
    open_files: Vec<PathBuf>,
    #[serde(default, skip_serializing)]
    active_file: Option<PathBuf>,
}

fn session_file_path() -> Option<PathBuf> {
    dirs::config_dir().map(|directory| directory.join("CotEdit").join("gpui-session.json"))
}

fn load_session(path: Option<&Path>) -> PersistedSession {
    let mut session = path
        .and_then(|path| std::fs::read(path).ok())
        .and_then(|bytes| serde_json::from_slice::<PersistedSession>(&bytes).ok())
        .filter(|session| matches!(session.version, 1 | 2 | 3 | 4))
        .unwrap_or_default();
    if session.windows.is_empty()
        && (!session.open_files.is_empty() || session.active_file.is_some())
    {
        session.windows.push(PersistedWindow {
            id: "restored-legacy-window".to_owned(),
            open_files: std::mem::take(&mut session.open_files),
            active_file: session.active_file.take(),
            active_untitled_index: None,
            show_status_bar: true,
            drafts: Vec::new(),
        });
    }
    session.version = 4;
    session
}

fn load_syntax_indentation(path: Option<&Path>, language: &str) -> PersistedIndentation {
    load_session(path)
        .syntax_indentation
        .get(language)
        .copied()
        .unwrap_or_default()
}

fn save_session(path: Option<&Path>, session: &PersistedSession) -> std::io::Result<()> {
    let Some(path) = path else {
        return Ok(());
    };
    let Some(directory) = path.parent() else {
        return Ok(());
    };
    std::fs::create_dir_all(directory)?;
    let contents = serde_json::to_vec_pretty(session).map_err(std::io::Error::other)?;
    write_atomically(path, &contents)
}

fn language_for_path(path: Option<&Path>) -> &'static str {
    let Some(extension) = path
        .and_then(Path::extension)
        .and_then(|extension| extension.to_str())
    else {
        return "plaintext";
    };
    match extension.to_ascii_lowercase().as_str() {
        "c" | "h" => "c",
        "cc" | "cpp" | "cxx" | "hpp" => "cpp",
        "css" => "css",
        "go" => "go",
        "htm" | "html" => "html",
        "java" => "java",
        "js" | "jsx" | "mjs" | "cjs" => "javascript",
        "json" => "json",
        "md" | "markdown" => "markdown",
        "php" => "php",
        "py" => "python",
        "rs" => "rust",
        "sql" => "sql",
        "ts" | "tsx" => "typescript",
        "xml" | "xhtml" => "xml",
        "yaml" | "yml" => "yaml",
        _ => "plaintext",
    }
}

actions!(
    cotedit,
    [
        NewDocument,
        NewTab,
        NewWindow,
        Open,
        Save,
        SaveAs,
        RevertToSaved,
        RevealDocument,
        CopyFilePath,
        ClearRecentFiles,
        ToggleEditing,
        DuplicateLine,
        DeleteLine,
        TrimTrailingWhitespace,
        CloseTab,
        CloseWindow,
        NextTab,
        PreviousTab,
        Find,
        FindReplace,
        UseSelectionForFind,
        UseSelectionForReplace,
        FindNext,
        FindPrevious,
        GoToLine,
        ToggleLineNumbers,
        ToggleInvisibles,
        ToggleSoftWrap,
        ToggleStatusBar,
        MinimizeWindow,
        ZoomWindow,
        About,
        OpenHelp,
        ReportIssue,
        HideApplication,
        HideOtherApplications,
        ShowApplication,
        ResetSyntaxAnalysis,
        ToggleSpacesForIndentation,
        CustomTabWidth,
        SetUtf8,
        SetUtf8Bom,
        SetUtf16Le,
        SetUtf16Be,
        SetWindows1252,
        SetShiftJis,
        SetGbk,
        SetBig5,
        SetEolLf,
        SetEolCrLf,
        SetEolCr,
        SetEolNel,
        SetEolLs,
        SetEolPs,
        Quit
    ]
);

#[derive(Clone, PartialEq, Action)]
#[action(no_json)]
struct OpenRecentDocument {
    path: PathBuf,
}

#[derive(Clone, PartialEq, Action)]
#[action(no_json)]
struct SetSyntax {
    language: String,
}

#[derive(Clone, PartialEq, Action)]
#[action(no_json)]
struct SetTabWidth {
    width: usize,
}

struct Document {
    editor: Entity<EditorState>,
    path: Option<PathBuf>,
    language: String,
    saved_text: String,
    encoding: TextEncoding,
    saved_encoding: TextEncoding,
    line_endings: Vec<LineEnding>,
    line_ending: LineEnding,
    saved_line_ending: LineEnding,
    force_line_ending: bool,
    saved_disk_hash: Option<[u8; 32]>,
    show_line_numbers: bool,
    show_whitespaces: bool,
    soft_wrap: bool,
    tab_size: usize,
    hard_tabs: bool,
    prevent_editing: bool,
    _subscription: Subscription,
}

impl Document {
    fn title(&self) -> String {
        self.path.as_deref().and_then(Path::file_name).map_or_else(
            || "Untitled".to_owned(),
            |name| name.to_string_lossy().into_owned(),
        )
    }

    fn line_ending_status(&self) -> &'static str {
        let mut endings = self.line_endings.iter().copied();
        let Some(first) = endings.next() else {
            return self.line_ending.label();
        };
        if endings.any(|ending| ending != first) {
            "Mixed"
        } else {
            self.line_ending.label()
        }
    }

    fn is_dirty(&self, cx: &App) -> bool {
        let text = self.editor.read(cx).value();
        text.as_ref() != self.saved_text
            || self.encoding != self.saved_encoding
            || self.line_ending != self.saved_line_ending
            || self.force_line_ending
    }
}

#[derive(Clone)]
struct MenuState {
    line_numbers: bool,
    invisibles: bool,
    soft_wrap: bool,
    show_status_bar: bool,
    tab_size: usize,
    hard_tabs: bool,
    language: String,
    encoding: TextEncoding,
    line_ending: LineEnding,
    recent_files: Vec<PathBuf>,
    can_revert: bool,
    can_reveal_document: bool,
    prevent_editing: bool,
}

impl Default for MenuState {
    fn default() -> Self {
        Self {
            line_numbers: true,
            invisibles: false,
            soft_wrap: true,
            show_status_bar: true,
            tab_size: 4,
            hard_tabs: true,
            language: "plaintext".to_owned(),
            encoding: TextEncoding::Utf8 { bom: false },
            line_ending: LineEnding::Lf,
            recent_files: Vec::new(),
            can_revert: false,
            can_reveal_document: false,
            prevent_editing: false,
        }
    }
}

struct CotEdit {
    documents: Vec<Document>,
    active: usize,
    recent_files: Arc<Mutex<Vec<PathBuf>>>,
    session_file: Option<PathBuf>,
    window_session_id: String,
    session_revision: u64,
    show_status_bar: bool,
    focus_handle: FocusHandle,
    _menu_focus_subscription: Option<Subscription>,
}

impl CotEdit {
    fn new(
        window: &mut Window,
        cx: &mut Context<Self>,
        session_file: Option<PathBuf>,
        recent_files: Arc<Mutex<Vec<PathBuf>>>,
        saved_window: PersistedWindow,
    ) -> Self {
        let mut app = Self {
            documents: Vec::new(),
            active: 0,
            recent_files,
            session_file,
            window_session_id: saved_window.id.clone(),
            session_revision: 0,
            show_status_bar: saved_window.show_status_bar,
            focus_handle: cx.focus_handle(),
            _menu_focus_subscription: None,
        };
        let weak = cx.entity().downgrade();
        window.on_window_should_close(cx, move |window, cx| {
            weak.update(cx, |this, cx| this.request_close_window(window, cx))
                .is_err()
        });
        let weak = cx.entity().downgrade();
        app._menu_focus_subscription =
            Some(window.on_focus_in(&app.focus_handle, cx, move |_, cx| {
                let _ = weak.update(cx, |this, cx| install_menus(cx, this.menu_state()));
            }));
        app.add_document(None, DecodedDocument::default(), None, window, cx);
        if !saved_window.open_files.is_empty() {
            app.open_paths(saved_window.open_files, window, cx);
            if app.documents.len() > 1 && app.documents[0].path.is_none() {
                app.documents.remove(0);
                app.active = app.active.saturating_sub(1);
            }
        }
        app.restore_drafts(&saved_window.drafts, window, cx);
        if let Some(active_path) = saved_window.active_file.as_deref() {
            if let Some(ix) = app.documents.iter().position(|document| {
                document
                    .path
                    .as_deref()
                    .is_some_and(|path| same_file_path(path, active_path))
            }) {
                app.activate(ix, window, cx);
            }
        } else if let Some(ordinal) = saved_window.active_untitled_index {
            if let Some(ix) = app
                .documents
                .iter()
                .enumerate()
                .filter(|(_, document)| document.path.is_none())
                .nth(ordinal)
                .map(|(index, _)| index)
            {
                app.activate(ix, window, cx);
            }
        }
        app.persist_session(cx);
        install_menus(cx, app.menu_state());
        app
    }

    fn persist_session(&self, cx: &App) {
        let Some(session_path) = self.session_file.as_deref() else {
            return;
        };
        let mut session = load_session(Some(session_path));
        session
            .windows
            .retain(|window| window.id != self.window_session_id);
        session.windows.push(PersistedWindow {
            id: self.window_session_id.clone(),
            open_files: self
                .documents
                .iter()
                .filter_map(|document| document.path.clone())
                .collect(),
            active_file: self.documents[self.active].path.clone(),
            active_untitled_index: self.documents[self.active].path.is_none().then(|| {
                self.documents[..self.active]
                    .iter()
                    .filter(|document| document.path.is_none())
                    .count()
            }),
            show_status_bar: self.show_status_bar,
            drafts: self
                .documents
                .iter()
                .enumerate()
                .map(|(index, document)| {
                    let text = document.editor.read(cx).value();
                    let cursor = document.editor.read(cx).cursor_position();
                    PersistedDraft {
                        path: document.path.clone(),
                        untitled_index: document.path.is_none().then(|| {
                            self.documents[..index]
                                .iter()
                                .filter(|previous| previous.path.is_none())
                                .count()
                        }),
                        text: (text.as_ref() != document.saved_text).then(|| text.to_string()),
                        cursor_line: cursor.line,
                        cursor_column: cursor.character,
                        tab_size: document.tab_size,
                        hard_tabs: document.hard_tabs,
                        prevent_editing: document.prevent_editing,
                    }
                })
                .collect(),
        });
        session.version = 4;
        session.recent_files = self.current_recent_files();
        session.open_files.clear();
        session.active_file = None;
        if let Err(error) = save_session(Some(session_path), &session) {
            eprintln!("Couldn’t save CotEdit session: {error}");
        }
    }

    fn remember_syntax_indentation(&self, language: &str, tab_size: usize, hard_tabs: bool) {
        let Some(path) = self.session_file.as_deref() else {
            return;
        };
        let mut session = load_session(Some(path));
        session.syntax_indentation.insert(
            language.to_owned(),
            PersistedIndentation {
                tab_size: tab_size.clamp(1, 99),
                hard_tabs,
            },
        );
        if let Err(error) = save_session(Some(path), &session) {
            eprintln!("Couldn’t save CotEdit indentation defaults: {error}");
        }
    }

    fn schedule_session_persist(&mut self, cx: &mut Context<Self>) {
        self.session_revision = self.session_revision.wrapping_add(1);
        let revision = self.session_revision;
        let timer = cx.background_executor().timer(Duration::from_millis(500));
        let weak = cx.entity().downgrade();
        cx.spawn(async move |_, cx| {
            timer.await;
            let _ = weak.update(cx, |this, cx| {
                if this.session_revision == revision {
                    this.persist_session(cx);
                }
            });
        })
        .detach();
    }

    fn remove_window_session(&self) {
        let Some(session_path) = self.session_file.as_deref() else {
            return;
        };
        let mut session = load_session(Some(session_path));
        session
            .windows
            .retain(|window| window.id != self.window_session_id);
        if let Err(error) = save_session(Some(session_path), &session) {
            eprintln!("Couldn’t update CotEdit session: {error}");
        }
    }

    fn restore_drafts(
        &mut self,
        drafts: &[PersistedDraft],
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        for draft in drafts {
            let document_index = if let Some(path) = draft.path.as_deref() {
                self.documents.iter().position(|document| {
                    document
                        .path
                        .as_deref()
                        .is_some_and(|document_path| same_file_path(document_path, path))
                })
            } else {
                draft.untitled_index.and_then(|ordinal| {
                    self.documents
                        .iter()
                        .enumerate()
                        .filter(|(_, document)| document.path.is_none())
                        .nth(ordinal)
                        .map(|(index, _)| index)
                })
            };
            let index = document_index.unwrap_or_else(|| {
                self.add_document(None, DecodedDocument::default(), None, window, cx);
                self.documents.len() - 1
            });
            let tab_size = draft.tab_size.clamp(1, 99);
            let hard_tabs = draft.hard_tabs;
            self.documents[index].tab_size = tab_size;
            self.documents[index].hard_tabs = hard_tabs;
            self.documents[index].prevent_editing = draft.prevent_editing;
            let editor = self.documents[index].editor.clone();
            editor.update(cx, |editor, cx| {
                editor.set_tab_size(
                    TabSize {
                        tab_size,
                        hard_tabs,
                    },
                    cx,
                );
                if let Some(text) = draft.text.as_deref() {
                    editor.set_value(text, window, cx);
                }
                editor.set_cursor_position(
                    Position {
                        line: draft.cursor_line,
                        character: draft.cursor_column,
                    },
                    window,
                    cx,
                );
            });
        }
        self.update_title(window, cx);
    }

    fn current_recent_files(&self) -> Vec<PathBuf> {
        match self.recent_files.lock() {
            Ok(recent_files) => recent_files.clone(),
            Err(poisoned) => poisoned.into_inner().clone(),
        }
    }

    fn remember_recent(&mut self, path: &Path) {
        let mut recent_files = match self.recent_files.lock() {
            Ok(recent_files) => recent_files,
            Err(poisoned) => poisoned.into_inner(),
        };
        recent_files.retain(|recent| !same_file_path(recent, path));
        recent_files.insert(0, path.to_path_buf());
        recent_files.truncate(10);
    }

    fn clear_recent_files(&mut self, _: &ClearRecentFiles, _: &mut Window, cx: &mut Context<Self>) {
        match self.recent_files.lock() {
            Ok(mut recent_files) => recent_files.clear(),
            Err(poisoned) => poisoned.into_inner().clear(),
        }
        self.persist_session(cx);
        install_menus(cx, self.menu_state());
        cx.notify();
    }

    fn add_document(
        &mut self,
        path: Option<PathBuf>,
        decoded: DecodedDocument,
        saved_disk_hash: Option<[u8; 32]>,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let language = language_for_path(path.as_deref());
        let indentation = load_syntax_indentation(self.session_file.as_deref(), language);
        let tab_size = indentation.editor_tab_size();
        let text = decoded.text;
        let editor = cx.new(|cx| {
            EditorState::new(window, cx)
                .tab_size(tab_size)
                .language(language)
                .line_number(true)
                .indent_guides(true)
                .soft_wrap(true)
                .default_value(text.clone())
        });
        let subscription = cx.subscribe_in(&editor, window, |this, _, event, window, cx| {
            if matches!(event, InputEvent::Change) {
                this.update_title(window, cx);
                this.schedule_session_persist(cx);
                cx.notify();
            }
        });
        self.documents.push(Document {
            editor,
            path,
            language: language.to_owned(),
            saved_text: text,
            encoding: decoded.encoding,
            saved_encoding: decoded.encoding,
            line_endings: decoded.line_endings,
            line_ending: decoded.dominant_line_ending,
            saved_line_ending: decoded.dominant_line_ending,
            force_line_ending: false,
            saved_disk_hash,
            show_line_numbers: true,
            show_whitespaces: false,
            soft_wrap: true,
            tab_size: tab_size.tab_size,
            hard_tabs: tab_size.hard_tabs,
            prevent_editing: false,
            _subscription: subscription,
        });
        self.active = self.documents.len() - 1;
        self.editor()
            .update(cx, |editor, cx| editor.focus(window, cx));
        self.update_title(window, cx);
        cx.notify();
    }

    fn editor(&self) -> Entity<EditorState> {
        self.documents[self.active].editor.clone()
    }

    fn menu_state(&self) -> MenuState {
        let document = &self.documents[self.active];
        let recent_files = self.current_recent_files();
        MenuState {
            line_numbers: document.show_line_numbers,
            invisibles: document.show_whitespaces,
            soft_wrap: document.soft_wrap,
            show_status_bar: self.show_status_bar,
            tab_size: document.tab_size,
            hard_tabs: document.hard_tabs,
            language: document.language.clone(),
            encoding: document.encoding,
            line_ending: document.line_ending,
            recent_files,
            can_revert: document.path.is_some(),
            can_reveal_document: document.path.is_some(),
            prevent_editing: document.prevent_editing,
        }
    }

    fn update_title(&self, window: &mut Window, cx: &App) {
        let document = &self.documents[self.active];
        let dirty = if document.is_dirty(cx) { "● " } else { "" };
        window.set_window_title(&format!("{dirty}{} — CotEdit", document.title()));
        window.set_window_edited(self.documents.iter().any(|doc| doc.is_dirty(cx)));
    }

    fn new_document(&mut self, _: &NewDocument, window: &mut Window, cx: &mut Context<Self>) {
        self.add_document(None, DecodedDocument::default(), None, window, cx);
        self.persist_session(cx);
    }

    fn new_tab(&mut self, _: &NewTab, window: &mut Window, cx: &mut Context<Self>) {
        self.add_document(None, DecodedDocument::default(), None, window, cx);
        self.persist_session(cx);
    }

    fn reset_syntax_analysis(
        &mut self,
        _: &ResetSyntaxAnalysis,
        _: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let language = self.documents[self.active].language.clone();
        self.editor().update(cx, |editor, cx| {
            editor.set_highlighter(language, cx);
        });
    }

    fn set_tab_width(&mut self, action: &SetTabWidth, _: &mut Window, cx: &mut Context<Self>) {
        let document = &mut self.documents[self.active];
        document.tab_size = action.width.clamp(1, 99);
        let language = document.language.clone();
        let tab_size = document.tab_size;
        let hard_tabs = document.hard_tabs;
        self.editor().update(cx, |editor, cx| {
            editor.set_tab_size(
                TabSize {
                    tab_size,
                    hard_tabs,
                },
                cx,
            );
        });
        self.remember_syntax_indentation(&language, tab_size, hard_tabs);
        install_menus(cx, self.menu_state());
        self.persist_session(cx);
        cx.notify();
    }

    fn custom_tab_width(
        &mut self,
        _: &CustomTabWidth,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let current_width = self.documents[self.active].tab_size;
        let input =
            cx.new(|cx| InputState::new(window, cx).default_value(current_width.to_string()));
        let weak = cx.entity().downgrade();
        window.open_dialog(cx, move |dialog, _, _| {
            let input = input.clone();
            let weak = weak.clone();
            dialog
                .title("Custom Tab Width")
                .child(
                    v_flex()
                        .gap_2()
                        .child("Enter a width from 1 to 99 columns.")
                        .child(Input::new(&input).id("custom-tab-width")),
                )
                .on_ok(move |_, window, cx| {
                    let Ok(width) = input.read(cx).value().trim().parse::<usize>() else {
                        window.push_notification("Enter a tab width from 1 to 99", cx);
                        return false;
                    };
                    if !(1..=99).contains(&width) {
                        window.push_notification("Enter a tab width from 1 to 99", cx);
                        return false;
                    }
                    let _ = weak.update(cx, |this, cx| {
                        this.set_tab_width(&SetTabWidth { width }, window, cx)
                    });
                    true
                })
        });
    }

    fn toggle_spaces_for_indentation(
        &mut self,
        _: &ToggleSpacesForIndentation,
        _: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let document = &mut self.documents[self.active];
        document.hard_tabs = !document.hard_tabs;
        let language = document.language.clone();
        let tab_size = document.tab_size;
        let hard_tabs = document.hard_tabs;
        self.editor().update(cx, |editor, cx| {
            editor.set_tab_size(
                TabSize {
                    tab_size,
                    hard_tabs,
                },
                cx,
            );
        });
        self.remember_syntax_indentation(&language, tab_size, hard_tabs);
        install_menus(cx, self.menu_state());
        self.persist_session(cx);
        cx.notify();
    }

    fn set_syntax(&mut self, action: &SetSyntax, _: &mut Window, cx: &mut Context<Self>) {
        let language = action.language.clone();
        let indentation = load_syntax_indentation(self.session_file.as_deref(), &language);
        let tab_size = indentation.editor_tab_size();
        let document = &mut self.documents[self.active];
        document.language = language.clone();
        document.tab_size = tab_size.tab_size;
        document.hard_tabs = tab_size.hard_tabs;
        self.editor().update(cx, |editor, cx| {
            editor.set_highlighter(language, cx);
            editor.set_tab_size(tab_size, cx);
        });
        install_menus(cx, self.menu_state());
        self.persist_session(cx);
        cx.notify();
    }

    fn open_help(&mut self, _: &OpenHelp, _: &mut Window, cx: &mut Context<Self>) {
        cx.open_url("https://github.com/jincaiw/cotedit#readme");
    }

    fn report_issue(&mut self, _: &ReportIssue, _: &mut Window, cx: &mut Context<Self>) {
        cx.open_url("https://github.com/jincaiw/cotedit/issues/new");
    }

    fn reveal_document(&mut self, _: &RevealDocument, window: &mut Window, cx: &mut Context<Self>) {
        let Some(path) = self.documents[self.active].path.clone() else {
            return;
        };
        if let Err(error) = reveal_in_file_manager(&path) {
            window.push_notification(format!("Could not show the file: {error}"), cx);
        }
    }

    fn copy_file_path(&mut self, _: &CopyFilePath, window: &mut Window, cx: &mut Context<Self>) {
        let Some(path) = self.documents[self.active].path.as_ref() else {
            return;
        };
        cx.write_to_clipboard(ClipboardItem::new_string(
            path.to_string_lossy().into_owned(),
        ));
        window.push_notification("File path copied", cx);
    }

    fn open_recent_document(
        &mut self,
        action: &OpenRecentDocument,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        self.open_paths(vec![action.path.clone()], window, cx);
    }

    fn hide_application(&mut self, _: &HideApplication, _: &mut Window, cx: &mut Context<Self>) {
        cx.hide();
    }

    fn hide_other_applications(
        &mut self,
        _: &HideOtherApplications,
        _: &mut Window,
        cx: &mut Context<Self>,
    ) {
        cx.hide_other_apps();
    }

    fn show_application(&mut self, _: &ShowApplication, _: &mut Window, cx: &mut Context<Self>) {
        cx.activate(true);
    }

    fn minimize_window(&mut self, _: &MinimizeWindow, window: &mut Window, _: &mut Context<Self>) {
        window.minimize_window();
    }

    fn about(&mut self, _: &About, window: &mut Window, cx: &mut Context<Self>) {
        window.open_dialog(cx, |dialog, _, _| {
            dialog.title("About CotEdit").child(
                v_flex()
                    .gap_2()
                    .child("CotEdit")
                    .child("Cross-platform text editor")
                    .child(format!(
                        "GPUI preview · version {}",
                        env!("CARGO_PKG_VERSION")
                    )),
            )
        });
    }

    fn zoom_window(&mut self, _: &ZoomWindow, window: &mut Window, _: &mut Context<Self>) {
        window.zoom_window();
    }

    fn new_window(&mut self, _: &NewWindow, _: &mut Window, cx: &mut Context<Self>) {
        let session_file = self.session_file.clone();
        let recent_files = self.recent_files.clone();
        let saved_window = PersistedWindow {
            id: next_window_id(),
            ..PersistedWindow::default()
        };
        if let Err(error) = cx.open_window(WindowOptions::default(), move |window, cx| {
            let view = cx.new(|cx| Self::new(window, cx, session_file, recent_files, saved_window));
            cx.new(|cx| Root::new(view, window, cx))
        }) {
            eprintln!("Couldn’t open a CotEdit window: {error}");
        }
    }

    fn open(&mut self, _: &Open, window: &mut Window, cx: &mut Context<Self>) {
        let picked = cx.prompt_for_paths(OPEN_FILES);
        cx.spawn_in(window, async move |this, cx| {
            if let Some(paths) = picked.await?? {
                this.update_in(cx, |this, window, cx| this.open_paths(paths, window, cx))?;
            }
            anyhow::Ok(())
        })
        .detach_and_log_err(cx);
    }

    fn open_paths(&mut self, paths: Vec<PathBuf>, window: &mut Window, cx: &mut Context<Self>) {
        for path in paths {
            if let Some(ix) = self
                .documents
                .iter()
                .position(|doc| doc.path.as_ref() == Some(&path))
            {
                self.remember_recent(&path);
                self.activate(ix, window, cx);
                continue;
            }
            match std::fs::read(&path)
                .map_err(|error| error.to_string())
                .and_then(|bytes| decode(&bytes).map(|decoded| (decoded, content_hash(&bytes))))
            {
                Ok((decoded, disk_hash)) => {
                    self.add_document(Some(path.clone()), decoded, Some(disk_hash), window, cx);
                    self.remember_recent(&path);
                }
                Err(error) => window
                    .push_notification(format!("Couldn’t open {}: {error}", path.display()), cx),
            }
        }
        self.persist_session(cx);
        install_menus(cx, self.menu_state());
    }

    fn activate(&mut self, ix: usize, window: &mut Window, cx: &mut Context<Self>) {
        if ix >= self.documents.len() {
            return;
        }
        self.active = ix;
        install_menus(cx, self.menu_state());
        self.editor()
            .update(cx, |editor, cx| editor.focus(window, cx));
        self.update_title(window, cx);
        self.persist_session(cx);
        cx.notify();
    }

    fn save(&mut self, _: &Save, window: &mut Window, cx: &mut Context<Self>) {
        let document = &self.documents[self.active];
        if let Some(path) = document.path.clone() {
            self.write_document(path, window, cx);
            return;
        }
        self.save_as_path(window, cx);
    }

    fn save_as(&mut self, _: &SaveAs, window: &mut Window, cx: &mut Context<Self>) {
        self.save_as_path(window, cx);
    }

    fn save_as_path(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        let current_path = self.documents[self.active].path.clone();
        let directory = current_path
            .as_deref()
            .and_then(Path::parent)
            .map(Path::to_path_buf)
            .or_else(std::env::home_dir)
            .unwrap_or_default();
        let name = current_path
            .as_deref()
            .and_then(Path::file_name)
            .map_or_else(
                || "Untitled.txt".to_owned(),
                |name| name.to_string_lossy().into_owned(),
            );
        let picked = cx.prompt_for_new_path(&directory, Some(&name));
        cx.spawn_in(window, async move |this, cx| {
            if let Some(path) = picked.await?? {
                this.update_in(cx, |this, window, cx| this.write_document(path, window, cx))?;
            }
            anyhow::Ok(())
        })
        .detach_and_log_err(cx);
    }

    fn write_document(&mut self, path: PathBuf, window: &mut Window, cx: &mut Context<Self>) {
        let document = &self.documents[self.active];
        let same_document = document
            .path
            .as_deref()
            .is_some_and(|saved_path| same_file_path(saved_path, &path));
        let disk_hash = match file_content_hash(&path) {
            Ok(disk_hash) => disk_hash,
            Err(error) => {
                window.push_notification(
                    format!("Couldn’t check {} before saving: {error}", path.display()),
                    cx,
                );
                return;
            }
        };
        let conflict = if same_document {
            disk_hash != document.saved_disk_hash
        } else {
            disk_hash.is_some()
        };
        if conflict {
            let active = self.active;
            let (title, message) = if same_document && disk_hash.is_none() {
                (
                    "The file was removed",
                    "The file no longer exists at its original path. Recreate it with the current document?",
                )
            } else if same_document {
                (
                    "The file changed on disk",
                    "Another application changed this file after CotEdit opened it. Overwrite those changes?",
                )
            } else {
                (
                    "Replace existing file?",
                    "The selected path already contains a file. Replace it with this document?",
                )
            };
            let answer = window.prompt(
                PromptLevel::Warning,
                title,
                Some(message),
                &["Overwrite", "Cancel"],
                cx,
            );
            cx.spawn_in(window, async move |this, cx| {
                if answer.await? == 0 {
                    this.update_in(cx, |this, window, cx| {
                        if this.active == active {
                            this.write_document_now(path, window, cx);
                        }
                    })?;
                }
                anyhow::Ok(())
            })
            .detach_and_log_err(cx);
            return;
        }
        self.write_document_now(path, window, cx);
    }

    fn write_document_now(&mut self, path: PathBuf, window: &mut Window, cx: &mut Context<Self>) {
        let document = &mut self.documents[self.active];
        let text = document.editor.read(cx).value().to_string();
        let (bytes, line_endings) = match encode(
            &text,
            &document.saved_text,
            document.encoding,
            &document.line_endings,
            document.line_ending,
            document.force_line_ending,
        ) {
            Ok(encoded) => encoded,
            Err(error) => {
                window.push_notification(format!("Couldn’t save {}: {error}", path.display()), cx);
                return;
            }
        };
        match write_atomically(&path, &bytes) {
            Ok(()) => {
                document.path = Some(path.clone());
                document.saved_text = text;
                document.saved_encoding = document.encoding;
                document.line_endings = line_endings;
                document.saved_line_ending = document.line_ending;
                document.force_line_ending = false;
                document.saved_disk_hash = Some(content_hash(&bytes));
                self.update_title(window, cx);
                self.remember_recent(&path);
                self.persist_session(cx);
                install_menus(cx, self.menu_state());
                cx.notify();
            }
            Err(error) => {
                window.push_notification(format!("Couldn’t save {}: {error}", path.display()), cx)
            }
        }
    }

    fn find_next(&mut self, _: &FindNext, _: &mut Window, cx: &mut Context<Self>) {
        self.editor().update(cx, |editor, cx| {
            editor.next_search_match(cx);
        });
    }

    fn find_previous(&mut self, _: &FindPrevious, _: &mut Window, cx: &mut Context<Self>) {
        self.editor().update(cx, |editor, cx| {
            editor.previous_search_match(cx);
        });
    }

    fn go_to_line(&mut self, _: &GoToLine, window: &mut Window, cx: &mut Context<Self>) {
        let editor = self.editor();
        let cursor = editor.read(cx).cursor_position();
        let input =
            cx.new(|cx| InputState::new(window, cx).default_value((cursor.line + 1).to_string()));
        window.open_dialog(cx, move |dialog, _, _| {
            let input = input.clone();
            let editor = editor.clone();
            dialog
                .title("Go to Line")
                .child(Input::new(&input).id("line-number"))
                .footer(DialogFooter::new().child(
                    DialogAction::new().child(Button::new("go-to-line-confirm").label("Go")),
                ))
                .on_ok(move |_, window, cx| {
                    let Ok(line) = input.read(cx).value().trim().parse::<u32>() else {
                        window.push_notification("Enter a line number greater than zero", cx);
                        return false;
                    };
                    if line == 0 {
                        window.push_notification("Enter a line number greater than zero", cx);
                        return false;
                    }
                    editor.update(cx, |editor, cx| {
                        editor.set_cursor_position(
                            Position {
                                line: line - 1,
                                character: 0,
                            },
                            window,
                            cx,
                        );
                    });
                    true
                })
        });
    }

    fn duplicate_line(&mut self, _: &DuplicateLine, window: &mut Window, cx: &mut Context<Self>) {
        if self.documents[self.active].prevent_editing {
            return;
        }
        self.editor().update(cx, |editor, cx| {
            let original = editor.value();
            let Some((duplicated, selection)) = duplicate_line(&original, editor.selected_range())
            else {
                return;
            };
            if duplicated == original.as_ref() {
                return;
            }
            editor.replace_all(duplicated, window, cx);
            editor.set_selected_range(selection, cx);
        });
        cx.notify();
    }

    fn delete_line(&mut self, _: &DeleteLine, window: &mut Window, cx: &mut Context<Self>) {
        if self.documents[self.active].prevent_editing {
            return;
        }
        self.editor().update(cx, |editor, cx| {
            let original = editor.value();
            let Some((deleted, selection)) = delete_line(&original, editor.selected_range()) else {
                return;
            };
            if deleted == original.as_ref() {
                return;
            }
            editor.replace_all(deleted, window, cx);
            editor.set_selected_range(selection, cx);
        });
        cx.notify();
    }

    fn trim_trailing_whitespace(
        &mut self,
        _: &TrimTrailingWhitespace,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        if self.documents[self.active].prevent_editing {
            return;
        }
        self.editor().update(cx, |editor, cx| {
            let original = editor.value();
            let selection = editor.selected_range();
            let trimmed = trim_trailing_whitespace(&original);
            if trimmed == original.as_ref() {
                return;
            }
            let selection = map_offset_after_trim(&original, selection.start)
                ..map_offset_after_trim(&original, selection.end);
            editor.replace_all(trimmed, window, cx);
            editor.set_selected_range(selection, cx);
        });
        cx.notify();
    }

    fn toggle_editing(&mut self, _: &ToggleEditing, _: &mut Window, cx: &mut Context<Self>) {
        self.documents[self.active].prevent_editing = !self.documents[self.active].prevent_editing;
        install_menus(cx, self.menu_state());
        self.persist_session(cx);
        cx.notify();
    }

    fn toggle_line_numbers(
        &mut self,
        _: &ToggleLineNumbers,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let document = &mut self.documents[self.active];
        document.show_line_numbers = !document.show_line_numbers;
        let visible = document.show_line_numbers;
        document.editor.update(cx, |editor, cx| {
            editor.set_line_number(visible, window, cx);
        });
        install_menus(cx, self.menu_state());
    }

    fn toggle_status_bar(&mut self, _: &ToggleStatusBar, _: &mut Window, cx: &mut Context<Self>) {
        self.show_status_bar = !self.show_status_bar;
        install_menus(cx, self.menu_state());
        self.persist_session(cx);
        cx.notify();
    }

    fn toggle_invisibles(
        &mut self,
        _: &ToggleInvisibles,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let document = &mut self.documents[self.active];
        document.show_whitespaces = !document.show_whitespaces;
        let visible = document.show_whitespaces;
        document.editor.update(cx, |editor, cx| {
            editor.set_show_whitespaces(visible, window, cx);
        });
        install_menus(cx, self.menu_state());
    }

    fn toggle_soft_wrap(
        &mut self,
        _: &ToggleSoftWrap,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let document = &mut self.documents[self.active];
        document.soft_wrap = !document.soft_wrap;
        let wrap = document.soft_wrap;
        document.editor.update(cx, |editor, cx| {
            editor.set_soft_wrap(wrap, window, cx);
        });
        install_menus(cx, self.menu_state());
    }

    fn set_encoding(
        &mut self,
        encoding: TextEncoding,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        self.documents[self.active].encoding = encoding;
        self.update_title(window, cx);
        install_menus(cx, self.menu_state());
        cx.notify();
    }

    fn set_line_ending(
        &mut self,
        line_ending: LineEnding,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let document = &mut self.documents[self.active];
        document.line_ending = line_ending;
        document.force_line_ending = true;
        self.update_title(window, cx);
        install_menus(cx, self.menu_state());
        cx.notify();
    }

    fn set_utf8(&mut self, _: &SetUtf8, window: &mut Window, cx: &mut Context<Self>) {
        self.set_encoding(TextEncoding::Utf8 { bom: false }, window, cx);
    }

    fn set_utf8_bom(&mut self, _: &SetUtf8Bom, window: &mut Window, cx: &mut Context<Self>) {
        self.set_encoding(TextEncoding::Utf8 { bom: true }, window, cx);
    }

    fn set_utf16_le(&mut self, _: &SetUtf16Le, window: &mut Window, cx: &mut Context<Self>) {
        self.set_encoding(TextEncoding::Utf16Le { bom: true }, window, cx);
    }

    fn set_utf16_be(&mut self, _: &SetUtf16Be, window: &mut Window, cx: &mut Context<Self>) {
        self.set_encoding(TextEncoding::Utf16Be { bom: true }, window, cx);
    }

    fn set_windows_1252(
        &mut self,
        _: &SetWindows1252,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        self.set_encoding(TextEncoding::Windows1252, window, cx);
    }

    fn set_shift_jis(&mut self, _: &SetShiftJis, window: &mut Window, cx: &mut Context<Self>) {
        self.set_encoding(TextEncoding::ShiftJis, window, cx);
    }

    fn set_gbk(&mut self, _: &SetGbk, window: &mut Window, cx: &mut Context<Self>) {
        self.set_encoding(TextEncoding::Gbk, window, cx);
    }

    fn set_big5(&mut self, _: &SetBig5, window: &mut Window, cx: &mut Context<Self>) {
        self.set_encoding(TextEncoding::Big5, window, cx);
    }

    fn set_eol_lf(&mut self, _: &SetEolLf, window: &mut Window, cx: &mut Context<Self>) {
        self.set_line_ending(LineEnding::Lf, window, cx);
    }

    fn set_eol_crlf(&mut self, _: &SetEolCrLf, window: &mut Window, cx: &mut Context<Self>) {
        self.set_line_ending(LineEnding::CrLf, window, cx);
    }

    fn set_eol_cr(&mut self, _: &SetEolCr, window: &mut Window, cx: &mut Context<Self>) {
        self.set_line_ending(LineEnding::Cr, window, cx);
    }

    fn set_eol_nel(&mut self, _: &SetEolNel, window: &mut Window, cx: &mut Context<Self>) {
        self.set_line_ending(LineEnding::Nel, window, cx);
    }

    fn set_eol_ls(&mut self, _: &SetEolLs, window: &mut Window, cx: &mut Context<Self>) {
        self.set_line_ending(LineEnding::LineSeparator, window, cx);
    }

    fn set_eol_ps(&mut self, _: &SetEolPs, window: &mut Window, cx: &mut Context<Self>) {
        self.set_line_ending(LineEnding::ParagraphSeparator, window, cx);
    }

    fn request_close_window(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        self.persist_session(cx);
        let has_changes = self.documents.iter().any(|document| document.is_dirty(cx));
        if !has_changes {
            self.remove_window_session();
            window.remove_window();
            return;
        }
        let answer = window.prompt(
            PromptLevel::Warning,
            "Discard unsaved changes?",
            Some("The open documents have changes that have not been saved."),
            &["Discard Changes", "Cancel"],
            cx,
        );
        cx.spawn_in(window, async move |this, cx| {
            if answer.await? == 0 {
                this.update_in(cx, |this, window, _| {
                    this.remove_window_session();
                    window.remove_window();
                })?;
            }
            anyhow::Ok(())
        })
        .detach_and_log_err(cx);
    }

    fn revert_to_saved(&mut self, _: &RevertToSaved, window: &mut Window, cx: &mut Context<Self>) {
        let index = self.active;
        let Some(path) = self.documents[index].path.clone() else {
            return;
        };
        if self.documents[index].is_dirty(cx) {
            let answer = window.prompt(
                PromptLevel::Warning,
                "Discard changes and revert?",
                Some("The current document will be replaced with its contents on disk."),
                &["Revert", "Cancel"],
                cx,
            );
            cx.spawn_in(window, async move |this, cx| {
                if answer.await? == 0 {
                    this.update_in(cx, |this, window, cx| {
                        if this.active == index {
                            this.reload_document(index, &path, window, cx);
                        }
                    })?;
                }
                anyhow::Ok(())
            })
            .detach_and_log_err(cx);
        } else {
            self.reload_document(index, &path, window, cx);
        }
    }

    fn reload_document(
        &mut self,
        index: usize,
        path: &Path,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let bytes = match std::fs::read(path) {
            Ok(bytes) => bytes,
            Err(error) => {
                window
                    .push_notification(format!("Couldn’t reload {}: {error}", path.display()), cx);
                return;
            }
        };
        let decoded = match decode(&bytes) {
            Ok(decoded) => decoded,
            Err(error) => {
                window
                    .push_notification(format!("Couldn’t decode {}: {error}", path.display()), cx);
                return;
            }
        };
        let document = &mut self.documents[index];
        let text = decoded.text;
        document.editor.update(cx, |editor, cx| {
            editor.set_value(&text, window, cx);
            editor.set_cursor_position(Position::default(), window, cx);
        });
        document.saved_text = text;
        document.encoding = decoded.encoding;
        document.saved_encoding = decoded.encoding;
        document.line_endings = decoded.line_endings;
        document.line_ending = decoded.dominant_line_ending;
        document.saved_line_ending = decoded.dominant_line_ending;
        document.force_line_ending = false;
        document.saved_disk_hash = Some(content_hash(&bytes));
        self.update_title(window, cx);
        self.persist_session(cx);
        install_menus(cx, self.menu_state());
        cx.notify();
    }

    fn close_window(&mut self, _: &CloseWindow, window: &mut Window, cx: &mut Context<Self>) {
        self.request_close_window(window, cx);
    }

    fn close_tab(&mut self, _: &CloseTab, window: &mut Window, cx: &mut Context<Self>) {
        self.close_document(self.active, window, cx);
    }

    fn close_document(&mut self, ix: usize, window: &mut Window, cx: &mut Context<Self>) {
        if ix >= self.documents.len() {
            return;
        }
        if self.documents.len() == 1 {
            self.request_close_window(window, cx);
            return;
        }
        if self.documents[ix].is_dirty(cx) {
            let answer = window.prompt(
                PromptLevel::Warning,
                "Discard changes to this document?",
                Some("This document has unsaved changes."),
                &["Discard Changes", "Cancel"],
                cx,
            );
            cx.spawn_in(window, async move |this, cx| {
                if answer.await? == 0 {
                    this.update_in(cx, |this, window, cx| this.remove_tab(ix, window, cx))?;
                }
                anyhow::Ok(())
            })
            .detach_and_log_err(cx);
            return;
        }
        self.remove_tab(ix, window, cx);
    }

    fn remove_tab(&mut self, ix: usize, window: &mut Window, cx: &mut Context<Self>) {
        if ix >= self.documents.len() || self.documents.len() <= 1 {
            return;
        }
        self.documents.remove(ix);
        if ix < self.active {
            self.active -= 1;
        } else if self.active >= self.documents.len() {
            self.active = self.documents.len() - 1;
        }
        self.editor()
            .update(cx, |editor, cx| editor.focus(window, cx));
        self.update_title(window, cx);
        self.persist_session(cx);
        cx.notify();
    }

    fn quit(&mut self, _: &Quit, window: &mut Window, cx: &mut Context<Self>) {
        self.request_close_window(window, cx);
    }

    fn next_tab(&mut self, _: &NextTab, window: &mut Window, cx: &mut Context<Self>) {
        self.activate((self.active + 1) % self.documents.len(), window, cx);
    }

    fn previous_tab(&mut self, _: &PreviousTab, window: &mut Window, cx: &mut Context<Self>) {
        let ix = (self.active + self.documents.len() - 1) % self.documents.len();
        self.activate(ix, window, cx);
    }

    fn render_tabs(&self, cx: &mut Context<Self>) -> impl IntoElement {
        h_flex()
            .flex_none()
            .w_full()
            .items_center()
            .gap_1()
            .px_2()
            .py_1()
            .bg(cx.theme().secondary)
            .border_b_1()
            .border_color(cx.theme().border)
            .child(
                h_flex()
                    .flex_1()
                    .min_w_0()
                    .overflow_x_scrollbar()
                    .gap_1()
                    .children(self.documents.iter().enumerate().map(|(ix, document)| {
                        let selected = ix == self.active;
                        let title = format!(
                            "{}{}",
                            document.title(),
                            if document.is_dirty(cx) { " •" } else { "" }
                        );
                        h_flex()
                            .flex_none()
                            .items_center()
                            .gap_0()
                            .child(
                                Button::new(("document-tab", ix))
                                    .small()
                                    .when(selected, |button| button.secondary())
                                    .label(title)
                                    .on_click(cx.listener(move |this, _, window, cx| {
                                        this.activate(ix, window, cx)
                                    })),
                            )
                            .child(
                                Button::new(("close-document-tab", ix))
                                    .small()
                                    .ghost()
                                    .label("×")
                                    .tooltip("Close tab")
                                    .on_click(cx.listener(move |this, _, window, cx| {
                                        this.close_document(ix, window, cx)
                                    })),
                            )
                    })),
            )
            .child(
                Button::new("new-document-tab")
                    .small()
                    .ghost()
                    .label("+")
                    .tooltip("New tab")
                    .on_click(cx.listener(|this, _, window, cx| {
                        this.add_document(None, DecodedDocument::default(), None, window, cx);
                        this.persist_session(cx);
                    })),
            )
    }
}

impl Render for CotEdit {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let document = &self.documents[self.active];
        let position = document.editor.read(cx).cursor_position();
        let title = document.title();
        let dirty = document.is_dirty(cx);
        let encoding = document.encoding.label();
        let line_ending = document.line_ending_status();

        v_flex()
            .id("cotedit-workspace")
            .track_focus(&self.focus_handle)
            .size_full()
            .bg(cx.theme().background)
            .text_color(cx.theme().foreground)
            .on_action(cx.listener(Self::new_document))
            .on_action(cx.listener(Self::new_tab))
            .on_action(cx.listener(Self::new_window))
            .on_action(cx.listener(Self::open))
            .on_action(cx.listener(Self::save))
            .on_action(cx.listener(Self::save_as))
            .on_action(cx.listener(Self::revert_to_saved))
            .on_action(cx.listener(Self::reveal_document))
            .on_action(cx.listener(Self::copy_file_path))
            .on_action(cx.listener(Self::clear_recent_files))
            .on_action(cx.listener(Self::toggle_editing))
            .on_action(cx.listener(Self::duplicate_line))
            .on_action(cx.listener(Self::delete_line))
            .on_action(cx.listener(Self::trim_trailing_whitespace))
            .on_action(cx.listener(Self::close_tab))
            .on_action(cx.listener(Self::close_window))
            .on_action(cx.listener(Self::next_tab))
            .on_action(cx.listener(Self::previous_tab))
            .on_action(cx.listener(Self::quit))
            .on_action(cx.listener(Self::set_utf8))
            .on_action(cx.listener(Self::set_utf8_bom))
            .on_action(cx.listener(Self::set_utf16_le))
            .on_action(cx.listener(Self::set_utf16_be))
            .on_action(cx.listener(Self::set_windows_1252))
            .on_action(cx.listener(Self::set_shift_jis))
            .on_action(cx.listener(Self::set_gbk))
            .on_action(cx.listener(Self::set_big5))
            .on_action(cx.listener(Self::set_eol_lf))
            .on_action(cx.listener(Self::set_eol_crlf))
            .on_action(cx.listener(Self::set_eol_cr))
            .on_action(cx.listener(Self::set_eol_nel))
            .on_action(cx.listener(Self::set_eol_ls))
            .on_action(cx.listener(Self::set_eol_ps))
            .on_action(cx.listener(|this, _: &Find, _, cx| {
                this.editor()
                    .update(cx, |editor, cx| editor.open_search(false, cx));
            }))
            .on_action(cx.listener(|this, _: &FindReplace, _, cx| {
                if !this.documents[this.active].prevent_editing {
                    this.editor()
                        .update(cx, |editor, cx| editor.open_search(true, cx));
                }
            }))
            .on_action(cx.listener(|this, _: &UseSelectionForFind, _, cx| {
                this.editor()
                    .update(cx, |editor, cx| editor.open_search(false, cx));
            }))
            .on_action(cx.listener(|this, _: &UseSelectionForReplace, _, cx| {
                if !this.documents[this.active].prevent_editing {
                    this.editor()
                        .update(cx, |editor, cx| editor.open_search(true, cx));
                }
            }))
            .on_action(cx.listener(Self::go_to_line))
            .on_action(cx.listener(Self::toggle_line_numbers))
            .on_action(cx.listener(Self::toggle_invisibles))
            .on_action(cx.listener(Self::toggle_soft_wrap))
            .on_action(cx.listener(Self::toggle_status_bar))
            .on_action(cx.listener(Self::minimize_window))
            .on_action(cx.listener(Self::zoom_window))
            .on_action(cx.listener(Self::about))
            .on_action(cx.listener(Self::reset_syntax_analysis))
            .on_action(cx.listener(Self::set_tab_width))
            .on_action(cx.listener(Self::custom_tab_width))
            .on_action(cx.listener(Self::toggle_spaces_for_indentation))
            .on_action(cx.listener(Self::set_syntax))
            .on_action(cx.listener(Self::open_help))
            .on_action(cx.listener(Self::report_issue))
            .on_action(cx.listener(Self::hide_application))
            .on_action(cx.listener(Self::hide_other_applications))
            .on_action(cx.listener(Self::show_application))
            .on_action(cx.listener(Self::open_recent_document))
            .on_action(cx.listener(Self::find_next))
            .on_action(cx.listener(Self::find_previous))
            .child(self.render_tabs(cx))
            .child(
                h_flex().flex_1().min_h_0().items_stretch().child(
                    Editor::new(&document.editor)
                        .appearance(false)
                        .readonly(document.prevent_editing)
                        .flex_1()
                        .min_h_0()
                        .h_full(),
                ),
            )
            .when(self.show_status_bar, |workspace| {
                workspace.child(
                    h_flex()
                        .flex_none()
                        .h_7()
                        .px_3()
                        .gap_3()
                        .items_center()
                        .bg(cx.theme().secondary)
                        .border_t_1()
                        .border_color(cx.theme().border)
                        .text_sm()
                        .text_color(cx.theme().muted_foreground)
                        .child(format!("{}{}", title, if dirty { " • Edited" } else { "" }))
                        .child(div().flex_1())
                        .child(format!("{encoding} · {line_ending}"))
                        .child(div().flex_1())
                        .child(format!(
                            "Line {}, column {}",
                            position.line + 1,
                            position.character + 1
                        )),
                )
            })
    }
}

fn install_commands(cx: &mut App) {
    cx.bind_keys([
        KeyBinding::new("secondary-n", NewDocument, None),
        KeyBinding::new("secondary-shift-n", NewWindow, None),
        KeyBinding::new("secondary-t", NewTab, None),
        KeyBinding::new("secondary-o", Open, None),
        KeyBinding::new("secondary-s", Save, None),
        KeyBinding::new("secondary-shift-s", SaveAs, None),
        KeyBinding::new("secondary-w", CloseTab, None),
        KeyBinding::new("secondary-shift-w", CloseWindow, None),
        KeyBinding::new("secondary-shift-[", PreviousTab, None),
        KeyBinding::new("secondary-shift-]", NextTab, None),
        KeyBinding::new("ctrl-tab", NextTab, None),
        KeyBinding::new("ctrl-shift-tab", PreviousTab, None),
        KeyBinding::new("secondary-f", Find, Some("Editor")),
        KeyBinding::new("secondary-e", UseSelectionForFind, Some("Editor")),
        KeyBinding::new("secondary-shift-e", UseSelectionForReplace, Some("Editor")),
        KeyBinding::new("secondary-g", FindNext, Some("Editor")),
        KeyBinding::new("secondary-shift-g", FindPrevious, Some("Editor")),
        KeyBinding::new("secondary-l", GoToLine, Some("Editor")),
        KeyBinding::new("secondary-r", ResetSyntaxAnalysis, None),
        KeyBinding::new("cmd-m", MinimizeWindow, None),
        KeyBinding::new("cmd-h", HideApplication, None),
        KeyBinding::new("cmd-alt-h", HideOtherApplications, None),
        KeyBinding::new("secondary-q", Quit, None),
    ]);
    install_menus(cx, MenuState::default());
}

fn install_menus(cx: &mut App, state: MenuState) {
    let mut recent_menu_items = if state.recent_files.is_empty() {
        vec![
            MenuItem::action(
                "No Recent Files",
                OpenRecentDocument {
                    path: PathBuf::new(),
                },
            )
            .disabled(true),
        ]
    } else {
        state
            .recent_files
            .iter()
            .map(|path| {
                let name = path.file_name().map_or_else(
                    || path.display().to_string(),
                    |name| name.to_string_lossy().into_owned(),
                );
                let parent = path
                    .parent()
                    .map_or_else(String::new, |parent| parent.display().to_string());
                MenuItem::action(
                    format!("{name} — {parent}"),
                    OpenRecentDocument { path: path.clone() },
                )
            })
            .collect()
    };
    recent_menu_items.push(MenuItem::separator());
    recent_menu_items.push(
        MenuItem::action("Clear Menu", ClearRecentFiles).disabled(state.recent_files.is_empty()),
    );
    let recent_menu = Menu::new("Open Recent").items(recent_menu_items);
    cx.set_menus([
        Menu::new("CotEdit").items([
            MenuItem::action("About CotEdit", About),
            MenuItem::separator(),
            MenuItem::os_submenu("Services", SystemMenuType::Services),
            MenuItem::separator(),
            MenuItem::action("Hide CotEdit", HideApplication),
            MenuItem::action("Hide Others", HideOtherApplications),
            MenuItem::action("Show CotEdit", ShowApplication),
            MenuItem::separator(),
            MenuItem::action("Quit CotEdit", Quit),
        ]),
        Menu::new("File").items([
            MenuItem::action("New", NewDocument),
            MenuItem::action("New Window", NewWindow),
            MenuItem::action("New Tab", NewTab),
            MenuItem::separator(),
            MenuItem::action("Open…", Open),
            MenuItem::submenu(recent_menu),
            MenuItem::separator(),
            MenuItem::action("Save", Save),
            MenuItem::action("Save As…", SaveAs),
            MenuItem::action("Revert to Saved", RevertToSaved).disabled(!state.can_revert),
            MenuItem::action("Show in File Manager", RevealDocument)
                .disabled(!state.can_reveal_document),
            MenuItem::action("Copy File Path", CopyFilePath).disabled(!state.can_reveal_document),
            MenuItem::separator(),
            MenuItem::action("Close", CloseTab),
        ]),
        Menu::new("Edit").items([
            MenuItem::os_action("Undo", input::Undo, OsAction::Undo),
            MenuItem::os_action("Redo", input::Redo, OsAction::Redo),
            MenuItem::separator(),
            MenuItem::os_action("Cut", input::Cut, OsAction::Cut),
            MenuItem::os_action("Copy", input::Copy, OsAction::Copy),
            MenuItem::os_action("Paste", input::Paste, OsAction::Paste),
            MenuItem::os_action("Select All", input::SelectAll, OsAction::SelectAll),
        ]),
        Menu::new("Format").items([
            MenuItem::submenu(
                Menu::new("Line Endings").items([
                    MenuItem::action("LF", SetEolLf).checked(state.line_ending == LineEnding::Lf),
                    MenuItem::action("CRLF", SetEolCrLf)
                        .checked(state.line_ending == LineEnding::CrLf),
                    MenuItem::action("CR", SetEolCr).checked(state.line_ending == LineEnding::Cr),
                    MenuItem::action("NEL", SetEolNel)
                        .checked(state.line_ending == LineEnding::Nel),
                    MenuItem::action("Line Separator", SetEolLs)
                        .checked(state.line_ending == LineEnding::LineSeparator),
                    MenuItem::action("Paragraph Separator", SetEolPs)
                        .checked(state.line_ending == LineEnding::ParagraphSeparator),
                ]),
            ),
            MenuItem::submenu(
                Menu::new("Text Encoding").items([
                    MenuItem::action("UTF-8", SetUtf8)
                        .checked(matches!(state.encoding, TextEncoding::Utf8 { bom: false })),
                    MenuItem::action("UTF-8 BOM", SetUtf8Bom)
                        .checked(matches!(state.encoding, TextEncoding::Utf8 { bom: true })),
                    MenuItem::action("UTF-16LE", SetUtf16Le)
                        .checked(matches!(state.encoding, TextEncoding::Utf16Le { .. })),
                    MenuItem::action("UTF-16BE", SetUtf16Be)
                        .checked(matches!(state.encoding, TextEncoding::Utf16Be { .. })),
                    MenuItem::action("Western (Windows-1252)", SetWindows1252)
                        .checked(state.encoding == TextEncoding::Windows1252),
                    MenuItem::action("Japanese (Shift_JIS)", SetShiftJis)
                        .checked(state.encoding == TextEncoding::ShiftJis),
                    MenuItem::action("Simplified Chinese (GBK)", SetGbk)
                        .checked(state.encoding == TextEncoding::Gbk),
                    MenuItem::action("Traditional Chinese (Big5)", SetBig5)
                        .checked(state.encoding == TextEncoding::Big5),
                ]),
            ),
            MenuItem::submenu(
                Menu::new("Syntax").items(
                    [
                        ("Plain Text", "plaintext"),
                        ("C", "c"),
                        ("C++", "cpp"),
                        ("CSS", "css"),
                        ("Go", "go"),
                        ("HTML", "html"),
                        ("Java", "java"),
                        ("JavaScript", "javascript"),
                        ("JSON", "json"),
                        ("Markdown", "markdown"),
                        ("PHP", "php"),
                        ("Python", "python"),
                        ("Rust", "rust"),
                        ("SQL", "sql"),
                        ("TypeScript", "typescript"),
                        ("XML", "xml"),
                        ("YAML", "yaml"),
                    ]
                    .into_iter()
                    .map(|(label, language)| {
                        MenuItem::action(
                            label,
                            SetSyntax {
                                language: language.to_owned(),
                            },
                        )
                        .checked(state.language == language)
                    }),
                ),
            ),
            MenuItem::action("Reset Syntax Analysis", ResetSyntaxAnalysis),
            MenuItem::separator(),
            MenuItem::submenu(
                Menu::new("Tab Width").items([
                    MenuItem::action("2", SetTabWidth { width: 2 }).checked(state.tab_size == 2),
                    MenuItem::action("4", SetTabWidth { width: 4 }).checked(state.tab_size == 4),
                    MenuItem::action("8", SetTabWidth { width: 8 }).checked(state.tab_size == 8),
                    MenuItem::action("Custom…", CustomTabWidth),
                    MenuItem::separator(),
                    MenuItem::action("Use Spaces for Indentation", ToggleSpacesForIndentation)
                        .checked(!state.hard_tabs),
                ]),
            ),
            MenuItem::action("Show Invisibles", ToggleInvisibles).checked(state.invisibles),
            MenuItem::action("Wrap Lines", ToggleSoftWrap).checked(state.soft_wrap),
            MenuItem::separator(),
            MenuItem::action("Prevent Editing", ToggleEditing).checked(state.prevent_editing),
        ]),
        Menu::new("View").items([
            MenuItem::action("Show Line Numbers", ToggleLineNumbers).checked(state.line_numbers),
            MenuItem::action("Show Status Bar", ToggleStatusBar).checked(state.show_status_bar),
        ]),
        Menu::new("Text").items([
            MenuItem::action("Indent", input::Indent),
            MenuItem::action("Outdent", input::Outdent),
            MenuItem::separator(),
            MenuItem::action("Duplicate Line", DuplicateLine).disabled(state.prevent_editing),
            MenuItem::action("Delete Line", DeleteLine).disabled(state.prevent_editing),
            MenuItem::action("Trim Trailing Whitespace", TrimTrailingWhitespace)
                .disabled(state.prevent_editing),
        ]),
        Menu::new("Find").items([
            MenuItem::action("Find…", Find),
            MenuItem::action("Find Next", FindNext),
            MenuItem::action("Find Previous", FindPrevious),
            MenuItem::separator(),
            MenuItem::action("Use Selection for Find", UseSelectionForFind),
            MenuItem::action("Use Selection for Replace", UseSelectionForReplace)
                .disabled(state.prevent_editing),
            MenuItem::action("Find and Replace…", FindReplace).disabled(state.prevent_editing),
            MenuItem::separator(),
            MenuItem::action("Go to Line…", GoToLine),
        ]),
        Menu::new("Window").items([
            MenuItem::action("Close Window", CloseWindow),
            MenuItem::separator(),
            MenuItem::action("Minimize", MinimizeWindow),
            MenuItem::action("Zoom", ZoomWindow),
        ]),
        Menu::new("Help").items([
            MenuItem::action("CotEdit Help", OpenHelp),
            MenuItem::action("Report an Issue…", ReportIssue),
        ]),
    ]);
}

fn build_workspace_root(
    window: &mut Window,
    cx: &mut App,
    session_file: Option<PathBuf>,
    recent_files: Arc<Mutex<Vec<PathBuf>>>,
    saved_window: PersistedWindow,
) -> Entity<Root> {
    let view = cx.new(|cx| CotEdit::new(window, cx, session_file, recent_files, saved_window));
    cx.new(|cx| Root::new(view, window, cx))
}

fn main() {
    gpui_kit::application().with_assets(Assets).run(|cx| {
        cx.set_app_identity("com.cotedit.CotEdit", "CotEdit");
        gpui_kit::init(cx);
        install_commands(cx);
        let session_file = session_file_path();
        let mut session = load_session(session_file.as_deref());
        if session.windows.is_empty() {
            session.windows.push(PersistedWindow {
                id: next_window_id(),
                ..PersistedWindow::default()
            });
        }
        let recent_files = Arc::new(Mutex::new(session.recent_files));
        for (index, saved_window) in session.windows.into_iter().enumerate() {
            let file = session_file.clone();
            let recent = recent_files.clone();
            if index == 0 {
                gpui_kit::open_window(WindowOptions::default(), cx, move |window, cx| {
                    build_workspace_root(window, cx, file, recent, saved_window)
                })
                .expect("failed to open CotEdit window");
            } else {
                cx.open_window(WindowOptions::default(), move |window, cx| {
                    build_workspace_root(window, cx, file, recent, saved_window)
                })
                .expect("failed to restore a CotEdit window");
            }
        }
    });
}
