// Help dialogs: Documentation, License & Attribution, About.
import licenses from './generated/licenses.json';

const WEBSITE = 'https://vsa.edu.in/software/';
const EMAIL = 'softinquiry@vsa.edu.in';
// Edita's privacy policy (PRIVACY.md in the GitHub repository; change the branch here if it is not main).
export const PRIVACY_URL = 'https://github.com/dsvakola/edita/blob/main/PRIVACY.md';

const DOCS = `
<h3>Files and tabs</h3>
<p>Every open file has its own tab. Click a tab to switch to it; click <b>×</b> or middle-click to close it.
A <b>●</b> on a tab (and <b>•</b> in the title bar) means unsaved changes.</p>
<table>
  <tr><td>New / Open</td><td>Ctrl+N / Ctrl+O</td></tr>
  <tr><td>Save / Save As</td><td>Ctrl+S / Ctrl+Shift+S</td></tr>
  <tr><td>Close tab / Close window</td><td>Ctrl+W / Ctrl+Shift+W</td></tr>
  <tr><td>Next / Previous tab</td><td>Ctrl+Tab / Ctrl+Shift+Tab</td></tr>
</table>
<h3>Editing</h3>
<table>
  <tr><td>Undo / Redo</td><td>Ctrl+Z / Ctrl+Y</td></tr>
  <tr><td>Cut / Copy / Paste / Select All</td><td>Ctrl+X / Ctrl+C / Ctrl+V / Ctrl+A</td></tr>
  <tr><td>Indent / Outdent</td><td>Ctrl+] / Ctrl+[ &nbsp;(or Tab / Shift+Tab)</td></tr>
  <tr><td>Find / Find Next / Find Previous</td><td>Ctrl+F / F3 / Shift+F3</td></tr>
  <tr><td>Bigger / smaller text</td><td>Ctrl + / Ctrl - &nbsp;(or Ctrl + mouse wheel)</td></tr>
</table>
<p>While you type, Edita suggests words already in the file (Enter or Tab accepts, Esc closes the list),
closes brackets <code>( [ {</code> and quotes <code>' "</code> for you, and indents new lines automatically.</p>
<p>Colours such as <code>#ff6600</code> or <code>rgb(0, 128, 255)</code> get a small colour square.
Click it to pick a new colour.</p>
<h3>Languages</h3>
<p>Edita colours code by file extension: Assembly (.asm), C / C++ / Arduino (.c .cpp .h .ino), CSS, HTML, Java,
JavaScript, JSON, Markdown, PHP, Python, Rust and VB.NET. Change it with <b>View › Syntax</b>.</p>
<h3>Side-by-side editing</h3>
<p>Compare two files next to each other with <b>View › Layout › Two Columns</b> (Alt+Shift+2).
Each side has its own tabs. Move a tab to the other side by dragging it there, or with
<b>View › Move Tab to Right Group</b> (Ctrl+Shift+2) / <b>Left Group</b> (Ctrl+Shift+1).
Ctrl+1 and Ctrl+2 jump between the sides. <b>Single</b> layout (Alt+Shift+1) puts all tabs back on one side.</p>
<h3>Themes and Preferences</h3>
<p><b>View › Theme</b> switches between Dark (default) and Light. <b>File › Preferences</b> (Ctrl+,) sets the theme,
font, font size, indent size, editor colours and the editing helpers above. Changes apply at once and are remembered.</p>
<h3>Recent files and sessions</h3>
<p><b>File › Open Recent</b> lists the last ten files you opened or saved. When you start Edita again,
the files that were open last time come back in their tabs (unsaved new files are not kept).</p>
<h3>Tools</h3>
<table>
  <tr><td>Command Palette — search and run any menu command</td><td>Ctrl+Shift+P</td></tr>
</table>
<p><b>Tools › Make Edita the Default Text Editor</b> registers Edita for text and code files and opens
Windows Settings › Default apps, where you confirm the choice.</p>
<h3>Window size</h3>
<p>Edita always opens at its normal size in the middle of the screen. To have it always open maximised,
right-click the Edita shortcut › Properties › Run: <b>Maximised</b>.</p>
<h3>Privacy</h3>
<p>Edita works only with the files you open and keeps its settings on this PC. It collects no personal data and
sends nothing over the internet. Read the <a href="${PRIVACY_URL}">Privacy Policy</a>.</p>
`;

let overlay = null;

export function helpOpen() { return !!overlay; }

export function closeHelp() {
  if (overlay) { overlay.remove(); overlay = null; }
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function licenseHtml() {
  const { edita, packages, crates, texts } = licenses;
  const item = (l, kind) => `
    <details>
      <summary><b>${escapeHtml(l.name)}</b> ${escapeHtml(l.version)} — ${escapeHtml(l.license)}</summary>
      ${l.homepage ? `<p><a href="${escapeHtml(l.homepage)}">${escapeHtml(l.homepage)}</a></p>` : ''}
      <pre>${escapeHtml(l.text || texts[l.textId] || `See the ${kind} licence named above.`)}</pre>
    </details>`;
  return `
    <p><b>Edita</b> is free and open-source software: you can redistribute it and/or modify it under the terms of the
    <a href="https://www.gnu.org/licenses/gpl-3.0.html">GNU General Public License, version 3</a>, published by the
    Free Software Foundation. It comes with ABSOLUTELY NO WARRANTY.</p>
    <pre class="notice">${escapeHtml(edita.notice)}</pre>
    <details>
      <summary><b>Edita</b> — full licence text (${escapeHtml(edita.license)})</summary>
      <pre>${escapeHtml(edita.text)}</pre>
    </details>
    <h3>Third-party components</h3>
    <p>Edita is built on the open-source projects below. Each is used under its own licence;
    click a name to read it. On Windows, Edita shows its window with Microsoft Edge WebView2, which is part of Windows.</p>
    <h4>Editor (JavaScript)</h4>
    ${packages.map((l) => item(l, 'package')).join('')}
    <h4>Application (Rust)</h4>
    ${crates.map((l) => item(l, 'crate')).join('')}`;
}

async function aboutHtml(api) {
  const version = await api.getVersion();
  return `
    <div class="about">
      <img src="assets/icon.png" alt="" width="96" height="96">
      <div>
        <div class="about-name">Edita</div>
        <div>Version ${escapeHtml(version)}</div>
        <p>A simple text/code editor for students, teachers and developers.</p>
        <p>Developed by: Prof. Dattaraj S. Vidyasagar &amp; Prof. Yash D. Vidyasagar,
        for Vidyasagar Robotics Academy.</p>
        <p>Website: <a href="${WEBSITE}">${WEBSITE}</a><br>
        Email: <a href="mailto:${EMAIL}">${EMAIL}</a></p>
        <p>© 2026 Vidyasagar Robotics Academy</p>
        <p>Free and open source under the GNU General Public License v3.0.<br>See Help › License &amp; Attribution.</p>
        <p><a href="${PRIVACY_URL}">Privacy Policy</a></p>
      </div>
    </div>`;
}

export async function openHelp(kind, api) {
  closeHelp();
  const titles = { docs: 'Edita Documentation', license: 'License & Attribution', about: 'About Edita' };
  const body = kind === 'docs' ? DOCS : kind === 'license' ? licenseHtml() : await aboutHtml(api);
  overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = `
    <div class="dialog help-dialog help-${kind}" role="dialog" aria-modal="true" aria-label="${titles[kind]}">
      <div class="dialog-titlebar"><span>${titles[kind]}</span><button type="button" class="dialog-x" aria-label="Close">✕</button></div>
      <div class="help-body">${body}</div>
      <div class="dialog-buttons">
        <a class="vra-brand" href="${WEBSITE}" title="${WEBSITE}"><img src="assets/vra-logo.png" alt="">
          <span>Vidyasagar Robotics Academy<br><small>vsa.edu.in/software</small></span></a>
        <span class="spacer"></span><button type="button" class="help-close">Close</button>
      </div>
    </div>`;
  document.body.append(overlay);
  const close = () => closeHelp();
  overlay.querySelector('.help-close').addEventListener('click', close);
  overlay.querySelector('.dialog-x').addEventListener('click', close);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } });
  // Links open in the normal web browser.
  overlay.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (a) { e.preventDefault(); api.openExternal(a.getAttribute('href')); }
  });
  overlay.querySelector('.help-close').focus({ preventScroll: true });
}
