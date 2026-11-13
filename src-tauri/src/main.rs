// Edita (Tauri): window, native menus, file dialogs, recent files, settings/session storage and
// Windows integration. The editor itself (CodeMirror 6) runs in the web view (src/renderer.js).
// The title bar is the normal Windows one. All messages are shown by the web view in Edita's own
// themed dialogs.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, Wry};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

const MAX_RECENT: usize = 10;

// ---------- state ----------

/// State of the active tab, reported by the web view; anyDirty covers all tabs.
#[derive(Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
struct UiState {
    file_path: Option<String>,
    name: String,
    dirty: bool,
    any_dirty: bool,
    language: String,
    theme: String,
    layout: u32,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct FileResult {
    file_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Default)]
struct App {
    ui: Mutex<UiState>,
    recent: Mutex<Vec<String>>,
    force_close: AtomicBool,
    renderer_ready: AtomicBool,
    pending: Mutex<Vec<FileResult>>,
    checks: Mutex<HashMap<String, CheckMenuItem<Wry>>>,
}

fn data_dir(app: &AppHandle) -> PathBuf {
    let dir = app.path().app_config_dir().unwrap_or_else(|_| std::env::temp_dir().join("Edita"));
    let _ = fs::create_dir_all(&dir);
    dir
}

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("main")
}

fn update_title(app: &AppHandle) {
    let ui = app.state::<App>().ui.lock().unwrap().clone();
    let name = ui.file_path.clone().unwrap_or(if ui.name.is_empty() { "Untitled".into() } else { ui.name });
    if let Some(w) = main_window(app) {
        let _ = w.set_title(&format!("{}{} - Edita", name, if ui.dirty { " •" } else { "" }));
    }
}

// ---------- settings and session (stored as JSON next to recent.json) ----------

const STORE_KEYS: [(&str, &str); 2] = [("edita.prefs", "settings.json"), ("edita.session", "session.json")];

fn store_file(app: &AppHandle, key: &str) -> Option<PathBuf> {
    STORE_KEYS.iter().find(|(k, _)| *k == key).map(|(_, f)| data_dir(app).join(f))
}

#[tauri::command]
fn store_set(app: AppHandle, key: String, value: String) {
    if let Some(path) = store_file(&app, &key) {
        let _ = fs::write(path, value);
    }
}

/// Script run before the page loads: the saved settings/session (so the web view can read them
/// synchronously at start-up) and the version.
fn init_script(app: &AppHandle) -> String {
    let mut store = serde_json::Map::new();
    for (key, _) in STORE_KEYS {
        if let Some(text) = store_file(app, key).and_then(|p| fs::read_to_string(p).ok()) {
            store.insert(key.into(), serde_json::Value::String(text));
        }
    }
    format!(
        "window.__EDITA_STORE = {}; window.__EDITA_VERSION = {};",
        serde_json::Value::Object(store),
        serde_json::Value::String(app.package_info().version.to_string())
    )
}

// ---------- recent files ----------

fn load_recent(app: &AppHandle) {
    let list: Vec<String> = fs::read_to_string(data_dir(app).join("recent.json"))
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default();
    *app.state::<App>().recent.lock().unwrap() = list;
}

fn set_recent(app: &AppHandle, mut list: Vec<String>) {
    list.truncate(MAX_RECENT);
    let _ = fs::write(data_dir(app).join("recent.json"), serde_json::to_string(&list).unwrap());
    *app.state::<App>().recent.lock().unwrap() = list;
    rebuild_menu(app);
}

fn add_recent(app: &AppHandle, path: &str) {
    let mut list = app.state::<App>().recent.lock().unwrap().clone();
    list.retain(|p| p.to_lowercase() != path.to_lowercase());
    list.insert(0, path.to_string());
    set_recent(app, list);
}

fn remove_recent(app: &AppHandle, path: &str) {
    let mut list = app.state::<App>().recent.lock().unwrap().clone();
    list.retain(|p| p != path);
    set_recent(app, list);
}

// ---------- files ----------

fn read_file_result(path: &str) -> FileResult {
    match fs::read(path) {
        Ok(bytes) => FileResult {
            file_path: path.into(),
            content: Some(String::from_utf8_lossy(&bytes).into_owned()),
            error: None,
        },
        Err(e) => FileResult {
            file_path: path.into(),
            content: None,
            error: Some(if e.kind() == std::io::ErrorKind::NotFound {
                "The file no longer exists.".into()
            } else {
                e.to_string()
            }),
        },
    }
}

/// Opens a file in a new tab (or reports the error in an Edita dialog).
fn send_file(app: &AppHandle, path: &str) {
    let file = read_file_result(path);
    if file.error.is_some() {
        remove_recent(app, path);
    } else {
        add_recent(app, path);
    }
    let st = app.state::<App>();
    if st.renderer_ready.load(Ordering::SeqCst) {
        let _ = app.emit("open-file", file);
    } else {
        st.pending.lock().unwrap().push(file);
    }
}

/// Files given on the command line (e.g. "Open with > Edita"); argv[0] is the program.
fn open_paths(app: &AppHandle, args: &[String], cwd: &Path) {
    for a in args.iter().skip(1).filter(|a| !a.starts_with('-')) {
        let p = cwd.join(a);
        if p.is_file() {
            let p = p.canonicalize().map(|c| strip_unc(&c)).unwrap_or(p);
            send_file(app, &p.to_string_lossy());
        }
    }
}

/// canonicalize() gives \\?\C:\... paths on Windows; show the normal form.
fn strip_unc(p: &Path) -> PathBuf {
    let s = p.to_string_lossy();
    match s.strip_prefix(r"\\?\") {
        Some(rest) if !rest.starts_with("UNC\\") => PathBuf::from(rest),
        _ => p.to_path_buf(),
    }
}

// ---------- menus ----------

// One menu entry: (id, label, accelerator shown). "-" is a separator; "@recent", "@syntax", "@theme"
// and "@layout" are submenus filled in by build_menu. Ids are the web view's command names.
type Entry = (&'static str, &'static str, &'static str);

const FILE_MENU: &[Entry] = &[
    ("new", "New", "Ctrl+N"),
    ("open", "Open...", "Ctrl+O"),
    ("@recent", "Open Recent", ""),
    ("-", "", ""),
    ("save", "Save", "Ctrl+S"),
    ("saveAs", "Save As...", "Ctrl+Shift+S"),
    ("-", "", ""),
    ("preferences", "Preferences...", "Ctrl+,"),
    ("-", "", ""),
    ("closeTab", "Close Tab", "Ctrl+W"),
    ("closeWindowMenu", "Close Window", "Ctrl+Shift+W"),
];

const EDIT_MENU: &[Entry] = &[
    ("undo", "Undo", "Ctrl+Z"),
    ("redo", "Redo", "Ctrl+Y"),
    ("-", "", ""),
    ("cut", "Cut", "Ctrl+X"),
    ("copy", "Copy", "Ctrl+C"),
    ("paste", "Paste", "Ctrl+V"),
    ("selectAll", "Select All", "Ctrl+A"),
    ("-", "", ""),
    ("fontUp", "Increase Font Size", "Ctrl++"),
    ("fontDown", "Decrease Font Size", "Ctrl+-"),
    ("-", "", ""),
    ("indentMore", "Increase Indent", "Ctrl+]"),
    ("indentLess", "Decrease Indent", "Ctrl+["),
    ("-", "", ""),
    ("find", "Find...", "Ctrl+F"),
    ("findNext", "Find Next", "F3"),
    ("findPrevious", "Find Previous", "Shift+F3"),
];

const VIEW_MENU: &[Entry] = &[
    ("@syntax", "Syntax", ""),
    ("@theme", "Theme", ""),
    ("@layout", "Layout", ""),
    ("focusGroup1", "Focus Left Group", "Ctrl+1"),
    ("focusGroup2", "Focus Right Group", "Ctrl+2"),
    ("moveToGroup1", "Move Tab to Left Group", "Ctrl+Shift+1"),
    ("moveToGroup2", "Move Tab to Right Group", "Ctrl+Shift+2"),
    ("-", "", ""),
    ("nextTab", "Next Tab", "Ctrl+Tab"),
    ("prevTab", "Previous Tab", "Ctrl+Shift+Tab"),
];

const TOOLS_MENU: &[Entry] = &[
    ("palette", "Command Palette...", "Ctrl+Shift+P"),
    ("-", "", ""),
    ("makeDefault", "Make Edita the Default Text Editor...", ""),
];

const HELP_MENU: &[Entry] = &[
    ("help:docs", "Documentation", "F1"),
    ("help:license", "License && Attribution", ""),
    ("help:privacy", "Privacy Policy", ""),
    ("-", "", ""),
    ("help:about", "About Edita", ""),
];

const MENUS: &[(&str, &[Entry])] =
    &[("&File", FILE_MENU), ("&Edit", EDIT_MENU), ("&View", VIEW_MENU), ("&Tools", TOOLS_MENU), ("&Help", HELP_MENU)];

// View > Syntax choices; ids must match LANGUAGES in renderer.js.
const SYNTAXES: &[(&str, &str)] = &[
    ("plain", "Plain Text"),
    ("asm", "Assembly (ALP)"),
    ("cpp", "C / C++ / Arduino"),
    ("css", "CSS"),
    ("html", "HTML"),
    ("java", "Java"),
    ("javascript", "JavaScript"),
    ("json", "JSON"),
    ("markdown", "Markdown"),
    ("php", "PHP"),
    ("python", "Python"),
    ("rust", "Rust"),
    ("vb", "VB.NET"),
];
// View > Theme choices; ids must match THEMES in themes.js.
const THEMES: &[(&str, &str)] = &[("light", "Light"), ("dark", "Dark (default)")];
const LAYOUTS: &[(&str, &str, &str)] = &[("1", "Single", "Alt+Shift+1"), ("2", "Two Columns", "Alt+Shift+2")];

/// Menu text with the shortcut shown on the right. The keys themselves are handled in the web view
/// (src/edita-api.js), so they work the same whether or not the menu has the keyboard focus.
fn label(text: &str, accel: &str) -> String {
    if accel.is_empty() { text.into() } else { format!("{text}\t{accel}") }
}

fn plain(text: &str) -> String {
    text.replace("&&", "\u{1}").replace('&', "").replace('\u{1}', "&")
}

fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let st = app.state::<App>();
    let ui = st.ui.lock().unwrap().clone();
    let recent = st.recent.lock().unwrap().clone();
    let mut checks = HashMap::new();
    let menu = Menu::new(app)?;
    for (title, entries) in MENUS {
        let sub = Submenu::new(app, *title, true)?;
        for (id, text, accel) in entries.iter() {
            match *id {
                "-" => sub.append(&PredefinedMenuItem::separator(app)?)?,
                "@recent" => {
                    let r = Submenu::new(app, *text, true)?;
                    if recent.is_empty() {
                        r.append(&MenuItem::with_id(app, "none", "No recent files", false, None::<&str>)?)?;
                    } else {
                        for (i, p) in recent.iter().enumerate() {
                            let num = if i < 9 { format!("&{}  ", i + 1) } else { String::new() };
                            r.append(&MenuItem::with_id(app, format!("recent:{i}"), format!("{num}{}", p.replace('&', "&&")), true, None::<&str>)?)?;
                        }
                        r.append(&PredefinedMenuItem::separator(app)?)?;
                        r.append(&MenuItem::with_id(app, "clearRecent", "Clear Recent Files", true, None::<&str>)?)?;
                    }
                    sub.append(&r)?;
                }
                "@syntax" | "@theme" | "@layout" => {
                    let r = Submenu::new(app, *text, true)?;
                    let items: Vec<(String, &str, &str, bool)> = match *id {
                        "@syntax" => SYNTAXES.iter().map(|(k, l)| (format!("syntax:{k}"), *l, "", *k == ui.language)).collect(),
                        "@theme" => THEMES.iter().map(|(k, l)| (format!("theme:{k}"), *l, "", *k == ui.theme)).collect(),
                        _ => LAYOUTS.iter().map(|(k, l, a)| (format!("layout{k}"), *l, *a, (*k == "2") == (ui.layout == 2))).collect(),
                    };
                    for (cid, l, a, on) in items {
                        let item = CheckMenuItem::with_id(app, &cid, label(l, a), true, on, None::<&str>)?;
                        r.append(&item)?;
                        checks.insert(cid, item);
                    }
                    sub.append(&r)?;
                }
                _ => sub.append(&MenuItem::with_id(app, *id, label(text, accel), true, None::<&str>)?)?,
            }
        }
        menu.append(&sub)?;
    }
    *st.checks.lock().unwrap() = checks;
    Ok(menu)
}

fn rebuild_menu(app: &AppHandle) {
    if let (Some(w), Ok(menu)) = (main_window(app), build_menu(app)) {
        let _ = w.set_menu(menu);
    }
}

/// Ticks the current syntax, theme and layout (clicking a ticked item would otherwise untick it).
fn apply_checks(app: &AppHandle) {
    let st = app.state::<App>();
    let ui = st.ui.lock().unwrap().clone();
    let layout = format!("layout{}", if ui.layout == 2 { 2 } else { 1 });
    for (id, item) in st.checks.lock().unwrap().iter() {
        let on = *id == format!("syntax:{}", ui.language) || *id == format!("theme:{}", ui.theme) || *id == layout;
        let _ = item.set_checked(on);
    }
}

#[derive(Serialize)]
struct PaletteCommand {
    id: String,
    label: String,
    accelerator: String,
}

/// Flat list of runnable menu commands for the command palette, e.g. "View › Theme › Light".
#[tauri::command]
fn get_commands(app: AppHandle) -> Vec<PaletteCommand> {
    let recent = app.state::<App>().recent.lock().unwrap().clone();
    let mut out = Vec::new();
    let mut push = |id: String, label: String, accel: &str| out.push(PaletteCommand { id, label, accelerator: accel.into() });
    for (title, entries) in MENUS {
        let top = plain(title);
        for (id, text, accel) in entries.iter() {
            match *id {
                "-" | "palette" => {}
                "@recent" => {
                    for (i, p) in recent.iter().enumerate() {
                        push(format!("recent:{i}"), format!("File › Open Recent › {p}"), "");
                    }
                    if !recent.is_empty() {
                        push("clearRecent".into(), "File › Open Recent › Clear Recent Files".into(), "");
                    }
                }
                "@syntax" => SYNTAXES.iter().for_each(|(k, l)| push(format!("syntax:{k}"), format!("View › Syntax › {l}"), "")),
                "@theme" => THEMES.iter().for_each(|(k, l)| push(format!("theme:{k}"), format!("View › Theme › {l}"), "")),
                "@layout" => LAYOUTS.iter().for_each(|(k, l, a)| push(format!("layout{k}"), format!("View › Layout › {l}"), a)),
                _ => push(id.to_string(), format!("{top} › {}", plain(text)), accel),
            }
        }
    }
    out
}

/// Runs a menu command (menu click, command palette or right-click menu).
fn handle_command(app: &AppHandle, id: &str) {
    if let Some(i) = id.strip_prefix("recent:").and_then(|n| n.parse::<usize>().ok()) {
        let path = app.state::<App>().recent.lock().unwrap().get(i).cloned();
        if let Some(p) = path {
            send_file(app, &p);
        }
    } else if id == "clearRecent" {
        set_recent(app, Vec::new());
    } else if id == "closeWindowMenu" {
        if let Some(w) = main_window(app) {
            let _ = w.close();
        }
    } else if id != "none" {
        if id.contains(':') && !id.starts_with("help:") || id.starts_with("layout") {
            apply_checks(app); // the web view reports the real choice back with set_state
        }
        let _ = app.emit("menu", id);
    }
}

#[tauri::command]
fn run_command(app: AppHandle, id: String) {
    handle_command(&app, &id);
}

/// Right-click menu in the editor and text fields (like Sublime's).
#[tauri::command]
fn context_menu(app: AppHandle, window: WebviewWindow, editable: bool, can_copy: bool) -> tauri::Result<()> {
    let item = |id: &str, text: &str, accel: &str, on: bool| MenuItem::with_id(&app, id, label(text, accel), on, None::<&str>);
    let menu = Menu::with_items(&app, &[
        &item("undo", "Undo", "Ctrl+Z", editable)?,
        &item("redo", "Redo", "Ctrl+Y", editable)?,
        &PredefinedMenuItem::separator(&app)?,
        &item("cut", "Cut", "Ctrl+X", editable && can_copy)?,
        &item("copy", "Copy", "Ctrl+C", can_copy)?,
        &item("paste", "Paste", "Ctrl+V", editable)?,
        &PredefinedMenuItem::separator(&app)?,
        &item("selectAll", "Select All", "Ctrl+A", editable)?,
    ])?;
    window.popup_menu(&menu)
}

// ---------- commands used by the web view ----------

#[tauri::command]
fn set_state(app: AppHandle, state: UiState) {
    *app.state::<App>().ui.lock().unwrap() = state;
    update_title(&app);
    apply_checks(&app);
}

#[tauri::command]
async fn open_file(app: AppHandle, window: WebviewWindow) -> Option<FileResult> {
    reveal_pointer();
    let picked = app.dialog().file().set_parent(&window).blocking_pick_file()?;
    let path = picked.into_path().ok()?;
    let file = read_file_result(&path.to_string_lossy());
    if file.error.is_none() {
        add_recent(&app, &file.file_path);
    }
    Some(file)
}

#[tauri::command]
fn read_file(path: String) -> FileResult {
    read_file_result(&path)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveResult {
    file_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

/// Saves content; shows a Save As dialog when path is null. Returns { filePath }, { error } or null (cancelled).
#[tauri::command]
async fn save_file(app: AppHandle, window: WebviewWindow, path: Option<String>, content: String) -> Option<SaveResult> {
    let path = match path {
        Some(p) => p,
        None => {
            reveal_pointer();
            let current = app.state::<App>().ui.lock().unwrap().file_path.clone();
            let mut dlg = app.dialog().file().set_parent(&window);
            match current.as_deref().map(Path::new) {
                Some(p) => {
                    if let Some(dir) = p.parent() {
                        dlg = dlg.set_directory(dir);
                    }
                    dlg = dlg.set_file_name(p.file_name().unwrap_or_default().to_string_lossy());
                }
                None => dlg = dlg.set_file_name("Untitled.txt"),
            }
            dlg.blocking_save_file()?.into_path().ok()?.to_string_lossy().into_owned()
        }
    };
    match fs::write(&path, content) {
        Ok(()) => {
            add_recent(&app, &path);
            Some(SaveResult { file_path: path, error: None })
        }
        Err(e) => Some(SaveResult { file_path: path, error: Some(e.to_string()) }),
    }
}

#[tauri::command]
fn close_window(app: AppHandle) {
    app.state::<App>().force_close.store(true, Ordering::SeqCst);
    if let Some(w) = main_window(&app) {
        let _ = w.close();
    }
}

#[tauri::command]
fn get_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
fn renderer_ready(app: AppHandle) {
    let st = app.state::<App>();
    st.renderer_ready.store(true, Ordering::SeqCst);
    for file in st.pending.lock().unwrap().drain(..) {
        let _ = app.emit("open-file", file);
    }
}

/// Only web and e-mail links (Help > About / License) are opened, in the browser / mail app.
#[tauri::command]
fn open_external(app: AppHandle, url: String) {
    let lower = url.to_lowercase();
    if lower.starts_with("https://") || lower.starts_with("http://") || lower.starts_with("mailto:") {
        let _ = app.opener().open_url(url, None::<&str>);
    }
}

/// Edit > Cut / Copy / Paste: sends the usual keys to the focused field, so the web view's own
/// clipboard handling runs (the same as pressing Ctrl+X / Ctrl+C / Ctrl+V).
#[tauri::command]
fn send_keys(which: String) {
    #[cfg(windows)]
    {
        let key = match which.as_str() {
            "cut" => b'X',
            "copy" => b'C',
            "paste" => b'V',
            _ => return,
        };
        win::send_ctrl_key(key as u16);
    }
}

// ---------- Windows-specific helpers ----------

#[cfg(windows)]
mod win {
    use std::mem::{size_of, zeroed};
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::*;

    fn key(vk: u16, up: bool) -> INPUT {
        let mut i: INPUT = unsafe { zeroed() };
        i.r#type = INPUT_KEYBOARD;
        i.Anonymous.ki = KEYBDINPUT { wVk: vk, wScan: 0, dwFlags: if up { KEYEVENTF_KEYUP } else { 0 }, time: 0, dwExtraInfo: 0 };
        i
    }

    pub fn send_ctrl_key(vk: u16) {
        let inputs = [key(VK_CONTROL, false), key(vk, false), key(vk, true), key(VK_CONTROL, true)];
        unsafe { SendInput(inputs.len() as u32, inputs.as_ptr(), size_of::<INPUT>() as i32) };
    }

    /// With Windows' "Hide pointer while typing" on, the pointer stays hidden inside a file dialog
    /// opened from the keyboard (e.g. Ctrl+S). A zero-distance mouse move shows it again.
    pub fn reveal_pointer() {
        let mut i: INPUT = unsafe { zeroed() };
        i.r#type = INPUT_MOUSE;
        i.Anonymous.mi = MOUSEINPUT { dx: 0, dy: 0, mouseData: 0, dwFlags: MOUSEEVENTF_MOVE, time: 0, dwExtraInfo: 0 };
        unsafe { SendInput(1, &i, size_of::<INPUT>() as i32) };
    }

    /// True when Edita runs from an MSIX package (the Microsoft Store version).
    pub fn is_packaged() -> bool {
        use windows_sys::Win32::Storage::Packaging::Appx::GetCurrentPackageFullName;
        let mut len: u32 = 0;
        // ERROR_INSUFFICIENT_BUFFER (122) means there is a package name; APPMODEL_ERROR_NO_PACKAGE (15700) means none.
        unsafe { GetCurrentPackageFullName(&mut len, std::ptr::null_mut()) == 122 }
    }

    /// How the shortcut that started Edita asks for the window: Some(true) = maximised,
    /// Some(false) = minimised (shortcut Properties > Run).
    pub fn startup_show() -> Option<bool> {
        use windows_sys::Win32::System::Threading::{GetStartupInfoW, STARTF_USESHOWWINDOW, STARTUPINFOW};
        let mut si: STARTUPINFOW = unsafe { zeroed() };
        si.cb = size_of::<STARTUPINFOW>() as u32;
        unsafe { GetStartupInfoW(&mut si) };
        if si.dwFlags & STARTF_USESHOWWINDOW == 0 {
            return None;
        }
        match si.wShowWindow {
            3 => Some(true),           // SW_SHOWMAXIMIZED
            2 | 6 | 7 => Some(false),  // minimised
            _ => None,
        }
    }
}

fn reveal_pointer() {
    #[cfg(windows)]
    win::reveal_pointer();
}

// ---------- "Make Edita the default text editor" (Tools menu) ----------

// File types Edita registers for. Windows only lets the user pick the default app,
// so Edita registers itself (per user, no admin needed) and opens Settings > Default apps.
const FILE_TYPES: &[&str] = &[
    "txt", "log", "ini", "md", "ino", "c", "h", "cpp", "hpp", "py", "java", "js", "json", "html", "htm", "css", "php",
    "rs", "vb", "asm", "s",
];

#[derive(Serialize)]
struct RegisterResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    ok: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    types: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[tauri::command]
fn make_default(app: AppHandle) -> RegisterResult {
    let fail = |e: String| RegisterResult { ok: None, types: None, error: Some(e) };
    if cfg!(debug_assertions) {
        return fail("This works in the installed Edita (not when run with pnpm start).".into());
    }
    #[cfg(windows)]
    {
        // The Microsoft Store (MSIX) version declares its file types in its package manifest, so
        // Windows already offers Edita for them: just open Settings > Default apps.
        if win::is_packaged() {
            let _ = app.opener().open_url("ms-settings:defaultapps", None::<&str>);
            return RegisterResult { ok: Some(true), types: Some(FILE_TYPES.len()), error: None };
        }
        if let Err(e) = register_file_types() {
            return fail(format!("Windows did not accept the registration: {e}"));
        }
        let _ = app.opener().open_url("ms-settings:defaultapps?registeredAppUser=Edita", None::<&str>);
        RegisterResult { ok: Some(true), types: Some(FILE_TYPES.len()), error: None }
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        fail("This is only available on Windows.".into())
    }
}

#[cfg(windows)]
fn register_file_types() -> std::io::Result<()> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    let exe = std::env::current_exe()?;
    let exe_s = exe.to_string_lossy().to_string();
    let exe_name = exe.file_name().unwrap_or_default().to_string_lossy().to_string();
    let open_cmd = format!("\"{exe_s}\" \"%1\"");
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let cls = hkcu.create_subkey(r"Software\Classes")?.0;
    let (prog, _) = cls.create_subkey("Edita.File")?;
    prog.set_value("", &"Edita Document")?;
    cls.create_subkey(r"Edita.File\DefaultIcon")?.0.set_value("", &format!("{exe_s},0"))?;
    cls.create_subkey(r"Edita.File\shell\open\command")?.0.set_value("", &open_cmd)?;
    let appkey = format!(r"Applications\{exe_name}");
    cls.create_subkey(format!(r"{appkey}\shell\open\command"))?.0.set_value("", &open_cmd)?;
    let (supported, _) = cls.create_subkey(format!(r"{appkey}\SupportedTypes"))?;
    let (caps, _) = hkcu.create_subkey(r"Software\Edita\Capabilities")?;
    caps.set_value("ApplicationName", &"Edita")?;
    caps.set_value("ApplicationDescription", &"A simple text editor by Vidyasagar Robotics Academy")?;
    caps.set_value("ApplicationIcon", &format!("{exe_s},0"))?;
    let (assoc, _) = caps.create_subkey("FileAssociations")?;
    for t in FILE_TYPES {
        supported.set_value(format!(".{t}"), &"")?;
        cls.create_subkey(format!(r".{t}\OpenWithProgids"))?.0.set_value("Edita.File", &"")?;
        assoc.set_value(format!(".{t}"), &"Edita.File")?;
    }
    hkcu.create_subkey(r"Software\RegisteredApplications")?.0.set_value("Edita", &r"Software\Edita\Capabilities")?;
    Ok(())
}

// ---------- window ----------

fn create_window(app: &AppHandle) -> tauri::Result<()> {
    // Always opens at the same default size, centred (the size is never remembered). A shortcut's
    // "Run: Maximised" setting is honoured.
    let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
        .title("Untitled - Edita")
        .inner_size(840.0, 620.0)
        .min_inner_size(420.0, 300.0)
        .center()
        .visible(false)
        .menu(build_menu(app)?)
        // Edita uses the web view's own drag and drop (tabs between the two columns).
        .disable_drag_drop_handler()
        .initialization_script(&init_script(app))
        // Never navigate the editor window away; web links open in the browser.
        .on_navigation(|url| {
            matches!(url.scheme(), "tauri" | "asset")
                || url.host_str() == Some("tauri.localhost")
                || (cfg!(debug_assertions) && url.host_str() == Some("localhost"))
        })
        .build()?;

    #[cfg(windows)]
    let show = win::startup_show();
    #[cfg(not(windows))]
    let show: Option<bool> = None;
    if show == Some(true) {
        window.maximize()?;
    }
    window.show()?;
    if show == Some(false) {
        window.minimize()?;
    }
    let _ = window.set_focus();

    let handle = app.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            let st = handle.state::<App>();
            // With unsaved tabs, let the web view ask about each one before closing.
            if !st.force_close.load(Ordering::SeqCst) && st.ui.lock().unwrap().any_dirty {
                api.prevent_close();
                let _ = handle.emit("menu", "closeWindow");
            }
        }
    });
    Ok(())
}

fn main() {
    tauri::Builder::default()
        // One Edita window: opening another file while Edita runs adds a tab to the running window.
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            if let Some(w) = main_window(app) {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
            open_paths(app, &argv, Path::new(&cwd));
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(App::default())
        .setup(|app| {
            let handle = app.handle().clone();
            load_recent(&handle);
            create_window(&handle)?;
            let args: Vec<String> = std::env::args().collect();
            let cwd = std::env::current_dir().unwrap_or_default();
            open_paths(&handle, &args, &cwd);
            Ok(())
        })
        .on_menu_event(|app, event| handle_command(app, event.id().as_ref()))
        .invoke_handler(tauri::generate_handler![
            set_state, open_file, read_file, save_file, close_window, get_version, get_commands, run_command,
            make_default, open_external, renderer_ready, store_set, context_menu, send_keys
        ])
        .run(tauri::generate_context!())
        .expect("error while running Edita");
}
