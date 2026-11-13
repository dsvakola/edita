// window.edita: the bridge between the editor (renderer.js) and Edita's Rust side (src-tauri/src/main.rs).
// Also handles the keyboard shortcuts shown in the menus, Ctrl + mouse wheel and the right-click menu.
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

const store = window.__EDITA_STORE || {};
let menuHandler = () => {};

const api = {
  onMenu: (fn) => { menuHandler = fn; listen('menu', (e) => fn(e.payload)); },
  onOpenFile: (fn) => listen('open-file', (e) => fn(e.payload)),
  rendererReady: () => invoke('renderer_ready'),
  setState: (state) => invoke('set_state', { state }),
  openFile: () => invoke('open_file'),
  readFile: (path) => invoke('read_file', { path }),
  saveFile: (path, content) => invoke('save_file', { path, content }),
  closeWindow: () => invoke('close_window'),
  getVersion: () => Promise.resolve(window.__EDITA_VERSION || ''),
  getCommands: () => invoke('get_commands'),
  runCommand: (id) => invoke('run_command', { id }),
  makeDefault: () => invoke('make_default'),
  openExternal: (url) => invoke('open_external', { url }),
  sendKeys: (which) => invoke('send_keys', { which }),
  // Settings and the open-tabs session, kept by the Rust side in Edita's settings folder.
  storeGet: (key) => (key in store ? store[key] : null),
  storeSet: (key, value) => { store[key] = value; invoke('store_set', { key, value }); },
};
window.edita = api;

// ---------- keyboard shortcuts (the same as shown in the menus) ----------

const SHORTCUTS = {
  'Ctrl+N': 'new', 'Ctrl+O': 'open', 'Ctrl+S': 'save', 'Ctrl+Shift+S': 'saveAs', 'Ctrl+,': 'preferences',
  'Ctrl+W': 'closeTab', 'Ctrl+Shift+W': 'closeWindowMenu',
  'Ctrl+Z': 'undo', 'Ctrl+Y': 'redo', 'Ctrl+Shift+Z': 'redo', 'Ctrl+A': 'selectAll',
  'Ctrl+=': 'fontUp', 'Ctrl++': 'fontUp', 'Ctrl+Shift+=': 'fontUp', 'Ctrl+Shift++': 'fontUp', 'Ctrl+NumpadAdd': 'fontUp',
  'Ctrl+-': 'fontDown', 'Ctrl+Shift+-': 'fontDown', 'Ctrl+Shift+_': 'fontDown', 'Ctrl+NumpadSubtract': 'fontDown',
  'Ctrl+]': 'indentMore', 'Ctrl+[': 'indentLess',
  'Ctrl+F': 'find', F3: 'findNext', 'Shift+F3': 'findPrevious',
  'Alt+Shift+1': 'layout1', 'Alt+Shift+2': 'layout2',
  'Ctrl+1': 'focusGroup1', 'Ctrl+2': 'focusGroup2', 'Ctrl+Shift+1': 'moveToGroup1', 'Ctrl+Shift+2': 'moveToGroup2',
  'Ctrl+Tab': 'nextTab', 'Ctrl+Shift+Tab': 'prevTab',
  'Ctrl+Shift+P': 'palette', F1: 'help:docs',
};
// Web-browser keys that make no sense in an editor (print, reload, page find, zoom reset, history...).
const BLOCKED = new Set(['Ctrl+P', 'Ctrl+Shift+P', 'Ctrl+R', 'Ctrl+Shift+R', 'F5', 'Ctrl+F5', 'Ctrl+G', 'Ctrl+Shift+G',
  'Ctrl+0', 'Ctrl+U', 'Ctrl+J', 'Ctrl+H', 'Ctrl+D', 'Ctrl+E', 'Ctrl+L', 'Ctrl+T', 'Ctrl+Shift+T', 'Ctrl+Shift+N',
  'F7', 'F11', 'F12', 'Ctrl+Shift+I', 'Ctrl+Shift+J', 'Ctrl+Shift+C', 'Ctrl+Shift+Delete', 'Alt+ArrowLeft',
  'Alt+ArrowRight', 'BrowserBack', 'BrowserForward', 'BrowserRefresh']);
// In a dialog's text field these keep their normal meaning there.
const FIELD_KEYS = new Set(['undo', 'redo', 'selectAll']);

function keyName(e) {
  let key;
  if (/^(Digit|Numpad)\d$/.test(e.code) && !e.code.startsWith('Numpad')) key = e.code.slice(5);
  else if (e.code === 'NumpadAdd' || e.code === 'NumpadSubtract') key = e.code;
  else key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  return `${e.ctrlKey ? 'Ctrl+' : ''}${e.altKey ? 'Alt+' : ''}${e.shiftKey ? 'Shift+' : ''}${key}`;
}

window.addEventListener('keydown', (e) => {
  if (e.metaKey || ['Control', 'Shift', 'Alt'].includes(e.key)) return;
  const name = keyName(e);
  const cmd = SHORTCUTS[name];
  if (cmd) {
    const t = e.target;
    const field = t instanceof HTMLElement && t.matches('input, textarea, select');
    if (field && FIELD_KEYS.has(cmd)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat && !['fontUp', 'fontDown', 'undo', 'redo', 'findNext', 'findPrevious', 'nextTab', 'prevTab'].includes(cmd)) return;
    if (cmd === 'closeWindowMenu') invoke('run_command', { id: cmd });
    else menuHandler(cmd);
  } else if (BLOCKED.has(name)) {
    e.preventDefault();
  }
}, true);

// Ctrl + mouse wheel changes the editor font size (the window itself never zooms).
window.addEventListener('wheel', (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  if (e.deltaY) menuHandler(e.deltaY < 0 ? 'fontUp' : 'fontDown');
}, { passive: false, capture: true });

// Right-click menu in the editor and text fields; nothing elsewhere (no web-browser menu).
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const t = e.target instanceof Element ? e.target : null;
  const editable = !!(t && t.closest('.cm-content, input, textarea'));
  const selection = window.getSelection();
  const canCopy = !!(selection && selection.toString())
    || !!(t && t.closest('.cm-editor') && document.querySelector('.pane.focused .cm-selectionBackground'));
  if (!editable && !canCopy) return;
  invoke('context_menu', { editable, canCopy });
});

// Dropped files or links never replace the editor page.
window.addEventListener('dragover', (e) => { if (e.dataTransfer && e.dataTransfer.types.includes('Files')) e.preventDefault(); });
window.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.types.includes('Files')) e.preventDefault(); });
