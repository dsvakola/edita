// Preferences: defaults, load/save (kept by Edita's Rust side) and the Preferences dialog.
import { PALETTES, COLOR_PREFS } from './themes.js';

export const FONT_FAMILIES = ['Consolas', 'Cascadia Mono', 'Cascadia Code', 'Courier New', 'Lucida Console'];

export const DEFAULT_PREFS = {
  theme: 'dark',
  fontFamily: 'Consolas',
  fontSize: 21,
  indent: 'auto', // 'auto' = language default, or '2' / '4' / '8'
  wordWrap: false,
  highlightLine: true,
  autocomplete: true,
  closeBrackets: true,
  colorPicker: true,
  colors: {}, // per-theme overrides: { light: { background: '#...' }, dark: {...} }
};

const KEY = 'edita.prefs';

export function loadPrefs() {
  let saved = {};
  try { saved = JSON.parse(window.edita.storeGet(KEY)) || {}; } catch {}
  return { ...DEFAULT_PREFS, ...saved, colors: { ...(saved.colors || {}) } };
}

export function savePrefs(prefs) {
  try { window.edita.storeSet(KEY, JSON.stringify(prefs)); } catch {}
}

const CHECKBOXES = [
  ['autocomplete', 'Show word suggestions while typing'],
  ['closeBrackets', 'Auto-close brackets ( [ { and quotes \' "'],
  ['colorPicker', 'Show colour swatches / picker for #hex and rgb() colours'],
  ['highlightLine', 'Highlight the current line'],
  ['wordWrap', 'Wrap long lines'],
];

let overlay = null;

export function closePreferences() {
  if (overlay) { overlay.remove(); overlay = null; }
}

// Opens the dialog. Every change is applied immediately through onChange(newPrefs).
export function openPreferences(prefs, onChange, onClose) {
  closePreferences();
  let p = structuredClone(prefs);
  overlay = document.createElement('div');
  overlay.id = 'prefs-overlay';
  overlay.innerHTML = `
    <div id="prefs" class="dialog" role="dialog" aria-modal="true" aria-labelledby="prefs-title">
      <div class="dialog-titlebar"><span id="prefs-title">Preferences</span><button type="button" class="dialog-x" aria-label="Close">✕</button></div>
      <div class="prefs-content">
      <div class="prefs-grid">
        <label for="pref-theme">Theme</label>
        <select id="pref-theme"><option value="light">Light</option><option value="dark">Dark (default)</option></select>
        <label for="pref-font">Font</label>
        <select id="pref-font">${FONT_FAMILIES.map((f) => `<option>${f}</option>`).join('')}</select>
        <label for="pref-size">Font size</label>
        <input id="pref-size" type="number" min="8" max="48">
        <label for="pref-indent">Indent size</label>
        <select id="pref-indent">
          <option value="auto">Language default</option><option value="2">2 spaces</option>
          <option value="4">4 spaces</option><option value="8">8 spaces</option>
        </select>
      </div>
      <h3>Editor colours <span class="prefs-note">(for the current theme)</span></h3>
      <div class="prefs-grid" id="pref-colors"></div>
      <h3>Editing</h3>
      <div id="pref-checks"></div>
      </div>
      <div class="prefs-buttons">
        <button id="pref-reset" type="button">Reset all to defaults</button>
        <span class="spacer"></span>
        <button id="pref-close" type="button">Close</button>
      </div>
    </div>`;
  document.body.append(overlay);
  const $ = (sel) => overlay.querySelector(sel);

  const changed = () => onChange(structuredClone(p));

  function render() {
    $('#pref-theme').value = p.theme;
    $('#pref-font').value = p.fontFamily;
    $('#pref-size').value = p.fontSize;
    $('#pref-indent').value = p.indent;

    const colors = $('#pref-colors');
    colors.textContent = '';
    const own = p.colors[p.theme] || {};
    for (const [key, label, paletteKey] of COLOR_PREFS) {
      const lab = document.createElement('label');
      lab.textContent = label;
      lab.htmlFor = `pref-color-${key}`;
      const row = document.createElement('div');
      row.className = 'prefs-color-row';
      const input = document.createElement('input');
      input.type = 'color';
      input.id = `pref-color-${key}`;
      input.value = own[key] || PALETTES[p.theme][paletteKey];
      input.addEventListener('input', () => {
        p.colors[p.theme] = { ...(p.colors[p.theme] || {}), [key]: input.value };
        reset.disabled = false;
        changed();
      });
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.textContent = 'Default';
      reset.disabled = !own[key];
      reset.addEventListener('click', () => {
        if (p.colors[p.theme]) delete p.colors[p.theme][key];
        changed();
        render();
      });
      row.append(input, reset);
      colors.append(lab, row);
    }

    const checks = $('#pref-checks');
    checks.textContent = '';
    for (const [key, label] of CHECKBOXES) {
      const lab = document.createElement('label');
      lab.className = 'prefs-check';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = p[key];
      box.addEventListener('change', () => { p[key] = box.checked; changed(); });
      lab.append(box, ` ${label}`);
      checks.append(lab);
    }
  }

  $('#pref-theme').addEventListener('change', (e) => { p.theme = e.target.value; changed(); render(); });
  $('#pref-font').addEventListener('change', (e) => { p.fontFamily = e.target.value; changed(); });
  $('#pref-size').addEventListener('change', (e) => {
    p.fontSize = Math.min(48, Math.max(8, Number(e.target.value) || DEFAULT_PREFS.fontSize));
    e.target.value = p.fontSize;
    changed();
  });
  $('#pref-indent').addEventListener('change', (e) => { p.indent = e.target.value; changed(); });
  $('#pref-reset').addEventListener('click', () => { p = structuredClone(DEFAULT_PREFS); changed(); render(); });

  const close = () => { closePreferences(); onClose(); };
  $('#pref-close').addEventListener('click', close);
  $('.dialog-x').addEventListener('click', close);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } });

  render();
  $('#pref-theme').focus();
}

// Lets the main window keep the dialog in sync when prefs change elsewhere (View > Theme, Ctrl +/-).
export function preferencesOpen() { return !!overlay; }
