# Edita

<a href="https://apps.microsoft.com/detail/9nx9lhr4bt68"><img src="https://get.microsoft.com/images/en-us%20dark.svg" width="200" alt="Get it from Microsoft"/></a>

A simple text/code editor for students, teachers and developers, by Vidyasagar Academy.
Built with Tauri 2 (Rust) and CodeMirror 6, so Edita is small to download and uses little memory.

## Install

Install from the Microsoft Store: https://apps.microsoft.com/detail/9nx9lhr4bt68

## Run from source

Requires Node.js 22.12 or newer, pnpm, and Rust (stable, MSVC toolchain) with the
[Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) for Windows.

```
pnpm install
pnpm start
```

`pnpm start` builds the editor page into `ui/` (esbuild) and opens Edita in development mode.

## Build the Windows installer

```
pnpm run dist
```

This creates `src-tauri/target/release/bundle/nsis/Edita_<version>_x64-setup.exe` (about 1.8 MB). Edita uses Microsoft Edge WebView2, which is part of
Windows 10 and 11; the installer downloads it only if it is missing. The installer lets the user pick the
install folder and adds Start menu and desktop shortcuts. It is not code-signed yet, so Windows SmartScreen
shows "Windows protected your PC" the first time: click **More info › Run anyway**.
For publishing on the Microsoft Store, see [STORE.md](STORE.md) and the listing material in [store-listing](store-listing/).

## Features

- Several files open at once, one tab each. Click a tab to switch, click × (or middle-click) to close.
  A ● on a tab means unsaved changes.
- Two colour themes: Dark (default, Monokai-style, amber cursor like Sublime) and Light. Default font: Consolas 21.
- Opens at 840x620, centred, every time (no remembered size). A shortcut set to Run: Maximised opens it maximised.
- Reopens the files that were open last time (File › Open Recent lists the last 10 files).
- Tools › Command Palette (Ctrl+Shift+P) searches and runs any menu command.
- Tools › Make Edita the Default Text Editor registers Edita for text/code files (per user) and opens
  Windows Settings › Default apps to confirm. The uninstaller removes the registration.
- All messages (unsaved changes, errors, questions) use Edita's own dialogs in the current theme.
- Preferences (File > Preferences, Ctrl+,): theme, font, font size, indent size, editor colours
  (background, text, cursor, selection, current line), and on/off switches for word suggestions,
  auto-closing brackets/quotes, colour swatches, current-line highlight and line wrapping.
  Changes apply immediately and are remembered. View > Theme stays in sync.
- Word suggestions while typing, taken from words already in the file (plus language keywords where available).
  Enter or Tab accepts, Esc dismisses.
- Auto-closing of ( [ { and ' " — typing the closing character steps over it.
- Colour swatches before #hex, rgb()/rgba() and hsl() colours (Plain Text, CSS, HTML, JS, PHP, JSON, Markdown).
  Click a swatch to open a colour picker; the value is rewritten in the same format.
- Side-by-side editing (View › Layout › Two Columns): two panes, each with its own tabs.
  Drag a tab to the other pane, or use View › Move Tab to Left/Right Group.
- Help › Documentation, License & Attribution (every bundled package and Rust crate with its licence),
  Privacy Policy and About.
- Status bar with cursor line/column, indent size and current syntax, coloured like the Windows title bar.
- Title bar like Sublime: full file path, `•` for unsaved changes.

## Keyboard shortcuts

| Action | Shortcut |
|---|---|
| New / Open / Save / Save As | Ctrl+N / Ctrl+O / Ctrl+S / Ctrl+Shift+S |
| Preferences | Ctrl+, |
| Close Tab / Close Window | Ctrl+W / Ctrl+Shift+W |
| Next / Previous Tab | Ctrl+Tab / Ctrl+Shift+Tab |
| Layout: Single / Two Columns | Alt+Shift+1 / Alt+Shift+2 |
| Focus Left / Right group | Ctrl+1 / Ctrl+2 |
| Move tab to Left / Right group | Ctrl+Shift+1 / Ctrl+Shift+2 |
| Undo / Redo | Ctrl+Z / Ctrl+Y |
| Cut / Copy / Paste / Select All | Ctrl+X / Ctrl+C / Ctrl+V / Ctrl+A |
| Font size bigger / smaller | Ctrl + / Ctrl - (also Ctrl+mouse wheel) |
| Indent / Outdent | Ctrl+] / Ctrl+[ (Tab / Shift+Tab also work) |
| Find / Find Next / Find Previous | Ctrl+F / F3 / Shift+F3 |
| Command Palette | Ctrl+Shift+P |
| Documentation | F1 |

## Syntax highlighting

Edita picks the syntax from the file extension. You can change it with View > Syntax.

| Syntax | Extensions |
|---|---|
| Assembly (ALP) | .asm .s .a51 .inc |
| C / C++ / Arduino | .c .h .cpp .hpp .cc .cxx .ino |
| CSS (incl. CSS3) | .css |
| HTML | .html .htm |
| Java (4-space indent) | .java |
| JavaScript | .js .mjs .cjs .jsx |
| JSON | .json |
| Markdown | .md .markdown |
| PHP | .php |
| Python (4-space indent) | .py .pyw |
| Rust (4-space indent) | .rs |
| VB.NET (4-space indent) | .vb |
| Plain Text | everything else |

## Project layout

- `src-tauri/src/main.rs`: the Rust side (window, menus, file dialogs, recent files, settings and session
  storage, command line / single window, "Make Edita the default text editor")
- `src-tauri/tauri.conf.json`: app and installer settings
- `src/edita-api.js`: bridge between the editor page and the Rust side; keyboard shortcuts, right-click menu
- `src/index.html`: the editor page (tab bar, editor, status bar)
- `src/renderer.js`: tabs, the CodeMirror editor and menu commands
- `src/themes.js`, `src/asm.js`, `src/colors.js`, `src/preferences.js`, `src/dialogs.js`, `src/palette.js`:
  themes, assembly highlighter, colour swatches, Preferences, message dialogs, command palette
- `src/help.js`: Documentation, License & Attribution and About (the privacy policy link is `PRIVACY_URL` here)
- `scripts/build-web.js`: builds `ui/` and collects every licence into `src/generated/licenses.json`
- `scripts/make-installer-art.ps1`, `scripts/installer-license.js`, `installer/hooks.nsh`: installer images,
  licence page and uninstall cleanup
- `assets/icon.png`: the app icon (epsilon logo). To change it, replace this file and run `pnpm run icons`.
- `logo.png`: the Vidyasagar Academy logo (installer, About and Help)
- `PRIVACY.md`: privacy policy

## Status

Done: step 1 (foundation), step 2 (syntax highlighting, tabs), step 3 (themes, preferences, editing aids),
step 4 (split view, Help pages, Windows installer), step 5 (1.3.0: Tauri/Rust engine, GPL-3.0, privacy policy).

## License

Edita is free and open-source software under the [GNU General Public License v3.0](LICENSE).
Developed by Prof. Dattaraj S. Vidyasagar & Prof. Yash D. Vidyasagar, for Vidyasagar Academy.
Copyright 2026 Vidyasagar Academy (https://vsa.edu.in/software/, softinquiry@vsa.edu.in).
Anyone redistributing Edita must keep the copyright and credit notices in [NOTICE](NOTICE).
Third-party components and their licences are listed in Help > License & Attribution.
See also the [Privacy Policy](PRIVACY.md).
