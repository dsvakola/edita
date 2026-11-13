# Publishing Edita on the Microsoft Store

Nothing has been submitted yet. This is what a Store release will need.

## Choose a package type

1. **Win32 installer (EXE) submission** — simplest. Partner Center accepts the NSIS installer that
   `pnpm run dist` makes. Requirements:
   - The installer must be hosted at a stable, versioned **HTTPS URL** (for example a GitHub Release asset).
   - It must install **silently**: the Tauri NSIS installer supports `/S`. Give that as the silent switch.
   - It must be **code-signed** with a certificate from a trusted CA (set
     `bundle.windows.certificateThumbprint` / `signCommand` in `src-tauri/tauri.conf.json`).
   - Use `"webviewInstallMode": { "type": "offlineInstaller" }` (or `embedBootstrapper`) so installation
     never depends on a download (adds about 127 MB / 1.8 MB to the installer respectively). Edita's own
     code stays the same.
2. **MSIX package** — Store-signed for you (no certificate to buy), clean install/uninstall. Tauri does not
   make MSIX directly; package `Edita.exe` and its files with the MSIX Packaging Tool or `makeappx`, using the
   `Square*Logo.png` / `StoreLogo.png` images in `src-tauri/icons`. Notes for MSIX:
   - Declare the file types (`.txt .log .ini .md .ino .c .h .cpp .hpp .py .java .js .json .html .htm .css .php
     .rs .vb .asm .s`) as `windows.fileTypeAssociation` in the package manifest. Tools > "Make Edita the
     Default Text Editor" writes per-user registry keys, which MSIX virtualises, so in a Store build that
     command should just open Settings > Default apps.
   - Settings (`%APPDATA%\in.edu.vsa.edita`) are redirected into the package's private folder automatically.

## Store listing

- **Privacy policy URL:** https://github.com/dsvakola/edita/blob/main/PRIVACY.md (also linked in
  Help and About; the URL is `PRIVACY_URL` in `src/help.js`).
- **Publisher / developer:** Vidyasagar Robotics Academy — Prof. Dattaraj S. Vidyasagar & Prof. Yash D. Vidyasagar.
- **Website:** https://vsa.edu.in/software/ · **Support e-mail:** softinquiry@vsa.edu.in
- **Category:** Developer tools (or Education). **Age rating:** questionnaire — no user data, no
  network features, no purchases.
- **Licence:** GPL-3.0 (source at https://github.com/dsvakola/edita).
- Screenshots: `advt/screenshots`.
- Reserve the name "Edita" in Partner Center first (it must be unique in the Store).
