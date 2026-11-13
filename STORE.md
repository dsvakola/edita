# Publishing Edita on the Microsoft Store

Nothing has been submitted yet. The listing text, screenshots, logos and a step-by-step Partner Center
checklist are in [`store-listing/`](store-listing/).

## Recommendation: submit as MSIX

| | **MSIX (recommended)** | EXE (NSIS installer) |
|---|---|---|
| Code signing | Microsoft signs it for free | You must buy a code-signing certificate (yearly cost) and sign every release |
| Hosting | Uploaded to Partner Center | You host the installer at a fixed HTTPS URL that must never change for that version |
| Install / uninstall | Clean, per user, no administrator prompt; nothing left behind | Runs our installer (administrator prompt for "all users") |
| Updates | Delivered automatically by the Store | Users must run a new installer |
| Store trust | Full Store app: listed and updated like any Store app | Listed, but the Store only launches our installer |

MSIX is cheaper (no certificate), simpler for students and school labs (no admin rights needed) and
updates itself. The only extra work is packaging, which `pnpm run msix` does.

## The three values we need from Partner Center

After reserving the name "Edita", open **Product management › Product identity** and copy:

1. **Package/Identity/Name** → `identityName` in `installer/msix-identity.json`
2. **Package/Identity/Publisher** (starts with `CN=`) → `publisher`
3. **Package/Properties/PublisherDisplayName** → `publisherDisplayName`

The Store rejects a package whose identity does not match these exactly.

## Building the MSIX (once the values are in)

```
pnpm run dist
pnpm run msix
```

This makes `msix/Edita_<version>_x64.msix` (unsigned; the Store signs it). It uses MakeAppx and MakePri
from the Windows SDK (installed here: 10.0.26100). The manifest template is
`installer/AppxManifest.template.xml`: full-trust desktop app, Windows 10 1809 or later, x64, the epsilon
logo in all tile sizes, and file type associations for the files Edita opens (MSIX cannot write the
registry, so in the Store version Tools › Make Edita the Default Text Editor just opens Windows
Settings › Default apps).

## Store technical requirements (policy 10.x) — status

- Works offline, no account needed: **yes** (no network use at all).
- Privacy policy URL, also linked in the app (Help and About): **yes** — https://github.com/dsvakola/edita/blob/main/PRIVACY.md
- Accurate description and screenshots of the current version: **yes** (`store-listing/`).
- Stable: tested editing, tabs, split view, Find, Command Palette, themes, Preferences, Help pages,
  Open and Save As dialogs, single window, files given on the command line, unsaved-changes prompt.
- Windows App Certification Kit: to run on the MSIX before submission (needs an administrator
  prompt): `appcert.exe test -appxpackagepath msix\Edita_1.3.0_x64.msix -reportoutputpath wack.xml`
  — Partner Center runs the same checks on upload.

## If you ever submit the EXE instead

- Host the installer at a versioned HTTPS URL (for example a GitHub Release asset).
- Silent install switch: `/S`.
- Code-sign the installer and Edita.exe (`bundle.windows.signCommand` in `src-tauri/tauri.conf.json`).
- Set `"webviewInstallMode": { "type": "offlineInstaller" }` so installation never needs a download.
