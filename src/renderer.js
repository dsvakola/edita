// Edita web view: panes (split view), tabs, the CodeMirror 6 editor, themes, status bar and menu commands.
import './edita-api.js'; // window.edita: the bridge to Edita's Rust side
import { EditorState, Compartment, Prec } from '@codemirror/state';
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection,
} from '@codemirror/view';
import {
  defaultKeymap, history, historyKeymap, undo, redo, selectAll, indentMore, indentLess, indentWithTab,
} from '@codemirror/commands';
import {
  indentService, indentUnit, indentOnInput, matchBrackets, bracketMatching, StreamLanguage,
} from '@codemirror/language';
import {
  search, searchKeymap, openSearchPanel, findNext, findPrevious, highlightSelectionMatches,
} from '@codemirror/search';
import { cpp } from '@codemirror/lang-cpp';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { java } from '@codemirror/lang-java';
import { php } from '@codemirror/lang-php';
import { rust } from '@codemirror/lang-rust';
import { vb } from '@codemirror/legacy-modes/mode/vb';
import {
  autocompletion, completeAnyWord, closeBrackets, closeBracketsKeymap,
} from '@codemirror/autocomplete';
import { asm } from './asm.js';
import { THEMES, colorOverrides } from './themes.js';
import { colorSwatches } from './colors.js';
import {
  loadPrefs, savePrefs, openPreferences, preferencesOpen, closePreferences,
} from './preferences.js';
import { openHelp, helpOpen, closeHelp, PRIVACY_URL } from './help.js';
import { showDialog, showError, messageDialogOpen } from './dialogs.js';
import { openPalette, paletteOpen, closePalette } from './palette.js';

// Syntax ids must match the View > Syntax menu ids in src-tauri/src/main.rs.
const LANGUAGES = {
  plain: { name: 'Plain Text', exts: [] },
  cpp: { name: 'C / C++ / Arduino', exts: ['c', 'h', 'cpp', 'hpp', 'cc', 'cxx', 'ino'], load: () => cpp() },
  python: { name: 'Python', exts: ['py', 'pyw'], load: () => [python(), indentUnit.of('    ')] },
  java: { name: 'Java', exts: ['java'], load: () => [java(), indentUnit.of('    ')] },
  javascript: { name: 'JavaScript', exts: ['js', 'mjs', 'cjs', 'jsx'], load: () => javascript({ jsx: true }) },
  html: { name: 'HTML', exts: ['html', 'htm'], load: () => html() },
  css: { name: 'CSS', exts: ['css'], load: () => css() },
  php: { name: 'PHP', exts: ['php'], load: () => php() },
  json: { name: 'JSON', exts: ['json'], load: () => json() },
  markdown: { name: 'Markdown', exts: ['md', 'markdown'], load: () => markdown() },
  rust: { name: 'Rust', exts: ['rs'], load: () => [rust(), indentUnit.of('    ')] },
  vb: { name: 'VB.NET', exts: ['vb'], load: () => [StreamLanguage.define(vb), indentUnit.of('    ')] },
  asm: { name: 'Assembly (ALP)', exts: ['asm', 's', 'a51', 'inc'], load: () => [StreamLanguage.define(asm), plainIndent] },
};

function detectLanguage(path) {
  const ext = path ? path.split(/[\\/]/).pop().split('.').pop().toLowerCase() : '';
  return Object.keys(LANGUAGES).find((id) => LANGUAGES[id].exts.includes(ext)) || 'plain';
}

const baseName = (path) => path.split(/[\\/]/).pop();

// Guesses the language of text typed into an Untitled tab (first match wins).
const CONTENT_RULES = [
  ['php', /^\s*<\?php/m],
  ['html', /^\s*<(!doctype html|html|head|body|div|span|p|a|table|ul|ol|h[1-6]|form|img|script|style)\b/im],
  // Java before C: both can contain "void main(".
  ['java', /\bpublic\s+(static\s+)?(final\s+)?(class|void|interface)\b|\bSystem\.out\.print/],
  ['cpp', /#include\s*[<"]|\bvoid\s+(setup|loop|main)\s*\(|\bint\s+main\s*\(|\b(pinMode|digitalWrite|digitalRead|analogRead|Serial\.begin)\s*\(|\bprintf\s*\(|\bstd::|\bcout\s*<</],
  ['rust', /\bfn\s+\w+\s*\([^)]*\)\s*(->[^{]*)?\{|\blet\s+mut\b|\bprintln!\s*\(/],
  ['vb', /^\s*(Public\s+|Private\s+)?(Module|Sub|Function)\s+\w+|^\s*Dim\s+\w+\s+As\b|^\s*End\s+(Sub|Module|Function)\b/im],
  ['json', /^\s*[{[]\s*"[^"\n]*"\s*:/],
  ['css', /^\s*[.#@]?[\w-][\w\s.#:>+~,()*="'[\]-]*\{\s*\n?\s*[\w-]+\s*:\s*[^;{}\n]+;/m],
  ['python', /^\s*(def|class)\s+\w+.*:\s*$|^\s*(elif|except|with)\b.*:\s*$|^\s*(from\s+\w+(\.\w+)*\s+)?import\s+\w+\s*$|^\s*for\s+\w+\s+in\s+.+:\s*$/m],
  ['javascript', /\b(const|let|var)\s+\w+\s*=|\bfunction\s*\w*\s*\(|=>\s*[{(]|\bconsole\.log\s*\(|\bdocument\.\w+/],
  ['asm', /^\s*(\w+:)?\s*(MOV|MVI|LDA|STA|LXI|ADD|ADI|SUB|SUI|INR|DCR|JMP|JNZ|JZ|JC|CALL|RET|HLT|PUSH|POP|INC|DEC|INT|CMP)\s+\S/im],
  ['markdown', /^#{1,6}\s+\S|^```|^\s*[-*]\s+\S.*\n\s*[-*]\s+\S|\*\*\S[^*]*\*\*/m],
];

function detectFromContent(text) {
  const sample = text.slice(0, 5000);
  const hit = CONTENT_RULES.find(([, re]) => re.test(sample));
  return hit ? hit[0] : null;
}

// Plain-text bracket-based auto-indent (most languages bring their own indentation):
// a line after one ending in { ( [ is indented one level deeper, and a line
// starting with } ) ] lines up with the line holding its opening bracket.
const bracketIndent = indentService.of((cx, pos) => {
  const doc = cx.state.doc;
  const after = cx.textAfterPos(pos);
  const closer = /^\s*[}\])]/.exec(after);
  if (closer) {
    const match = matchBrackets(cx.state, pos + closer[0].length, -1);
    if (match && match.matched) return cx.lineIndent(match.end.from);
  }
  let line = doc.lineAt(pos);
  let text = doc.sliceString(line.from, pos);
  while (!text.trim() && line.number > 1) {
    line = doc.line(line.number - 1);
    text = line.text;
  }
  if (!text.trim()) return 0;
  const base = cx.countColumn(/^\s*/.exec(text)[0]);
  return /[{([]\s*$/.test(text) ? base + cx.unit : base;
});

// Re-indent the line when a closing bracket is typed at its start.
const closerReindent = EditorState.languageData.of(() => [{ indentOnInput: /^\s*[}\])]$/ }]);
const plainIndent = [bracketIndent, closerReindent];

// Colour swatches only where '#abc' is likely a colour (not C '#define' or Python '# comments').
const COLOR_LANGUAGES = new Set(['plain', 'css', 'html', 'javascript', 'php', 'json', 'markdown']);

function languageExtension(id) {
  const lang = LANGUAGES[id];
  return [
    lang.load ? lang.load() : plainIndent,
    prefs.colorPicker && COLOR_LANGUAGES.has(id) ? colorSwatches : [],
  ];
}

// Sublime-like wording for the find bar buttons.
const findBarWording = EditorState.phrases.of({
  next: 'Find', previous: 'Find Prev', all: 'Find All', 'match case': 'Match case', regexp: 'Regex',
  'by word': 'Whole word', replace: 'Replace', 'replace all': 'Replace All',
});

// Suggest words already in the file, in every language (plus each language's own suggestions).
const wordSuggestions = EditorState.languageData.of(() => [{ autocomplete: completeAnyWord }]);

// Everything controlled by Preferences.
function prefsExtension() {
  return [
    THEMES[prefs.theme].extension,
    colorOverrides(prefs.colors[prefs.theme] || {}),
    EditorView.theme({
      '.cm-scroller, .cm-tooltip-autocomplete': { fontFamily: `"${prefs.fontFamily}", Consolas, monospace` },
    }),
    prefs.highlightLine ? [highlightActiveLine(), highlightActiveLineGutter()] : [],
    prefs.wordWrap ? EditorView.lineWrapping : [],
    prefs.autocomplete ? [autocompletion(), wordSuggestions] : [],
    prefs.closeBrackets ? [closeBrackets(), keymap.of(closeBracketsKeymap)] : [],
    prefs.indent !== 'auto' ? Prec.highest(indentUnit.of(' '.repeat(Number(prefs.indent)))) : [],
  ];
}

// ---------- state ----------
// The window holds one or two panes (side by side). Each pane has its own tabs and editor view.

const api = window.edita;
const languageConf = new Compartment();
const prefsConf = new Compartment();
const panes = []; // { el, tabBar, view, tabs: [{ filePath, state, dirty, language, scrollTop }], active }
let focused = null; // the pane that menu commands act on
let untitledCount = 0;
let prefs = loadPrefs();

const panesEl = document.getElementById('panes');
const statusPos = document.getElementById('status-pos');
const statusIndent = document.getElementById('status-indent');
const statusLang = document.getElementById('status-lang');

const current = (p = focused) => p.tabs[p.active];
const tabName = (tab) => (tab.filePath ? baseName(tab.filePath) : tab.untitledName);
const paneOf = (view) => panes.find((p) => p.view === view);
const allTabs = () => panes.flatMap((p) => p.tabs);

function makeState(doc, language) {
  return EditorState.create({
    doc,
    extensions: [
      lineNumbers(),
      drawSelection(),
      bracketMatching(),
      history(),
      search(), // find bar at the bottom, like Sublime
      findBarWording,
      highlightSelectionMatches(),
      prefsConf.of(prefsExtension()),
      languageConf.of(languageExtension(language)),
      indentOnInput(),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
      EditorView.updateListener.of((u) => {
        const p = paneOf(u.view);
        if (!p || !current(p)) return;
        if (u.docChanged && !current(p).dirty) { current(p).dirty = true; refresh(p); }
        if (u.docChanged && current(p).autoSyntax) scheduleAutoSyntax(p, current(p));
        if ((u.docChanged || u.selectionSet) && p === focused) updateStatus();
      }),
    ],
  });
}

// ---------- panes ----------

function createPane() {
  const el = document.createElement('div');
  el.className = 'pane';
  const tabBar = document.createElement('div');
  tabBar.className = 'tabs';
  const editorEl = document.createElement('div');
  editorEl.className = 'editor';
  el.append(tabBar, editorEl);
  panesEl.append(el);
  const pane = { el, tabBar, tabs: [], active: -1 };
  pane.view = new EditorView({ state: makeState('', 'plain'), parent: editorEl });
  el.addEventListener('mousedown', () => setFocused(pane), true);
  pane.view.contentDOM.addEventListener('focus', () => setFocused(pane));
  // Drop a tab dragged from the other pane.
  el.addEventListener('dragover', (e) => { if (dragged && dragged.pane !== pane) e.preventDefault(); });
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    if (dragged && dragged.pane !== pane) moveTab(dragged.pane, dragged.index, pane);
    dragged = null;
  });
  panes.push(pane);
  return pane;
}

function setFocused(pane) {
  if (focused === pane) return;
  focused = pane;
  panes.forEach((p) => p.el.classList.toggle('focused', p === pane));
  updateStatus();
  reportState();
}

function setLayout(columns) {
  if (columns === 2 && panes.length === 1) {
    const pane = createPane();
    addTab(pane, '', null);
    setFocused(pane);
  } else if (columns === 1 && panes.length === 2) {
    // Like Sublime: the right pane's tabs move into the left pane.
    const [left, right] = panes;
    saveViewToTab(right);
    for (const tab of right.tabs) {
      if (!tab.filePath && !tab.dirty && tab.state.doc.length === 0) continue; // drop empty Untitled tabs
      insertTab(left, tab);
    }
    right.view.destroy();
    right.el.remove();
    panes.pop();
    focused = null;
    setFocused(left);
    left.view.focus();
  }
  refreshAll();
}

// Moves tab `index` of pane `from` to pane `to` (opening two columns if needed).
function moveTab(from, index, to) {
  if (!to) {
    if (panes.length === 1) setLayout(2);
    to = panes.find((p) => p !== from);
  }
  if (from === to || !from.tabs[index]) return;
  saveViewToTab(from);
  const [tab] = from.tabs.splice(index, 1);
  if (!from.tabs.length) addTab(from, '', null);
  else {
    const next = Math.min(index <= from.active ? from.active - 1 : from.active, from.tabs.length - 1);
    from.active = -1;
    activate(from, Math.max(0, next));
  }
  insertTab(to, tab);
  setFocused(to);
  refreshAll();
  to.view.focus();
}

// Adds an existing tab object to a pane and shows it (replacing an empty, unchanged Untitled tab).
function insertTab(pane, tab) {
  saveViewToTab(pane);
  const cur = current(pane);
  if (cur && !cur.filePath && !cur.dirty && pane.view.state.doc.length === 0) {
    pane.tabs.splice(pane.active, 1);
  }
  pane.tabs.push(tab);
  pane.active = -1;
  activate(pane, pane.tabs.length - 1);
}

// ---------- UI refresh ----------

function reportState() {
  const tab = current();
  if (!tab) return;
  api.setState({
    filePath: tab.filePath, name: tabName(tab), dirty: tab.dirty, language: tab.language, theme: prefs.theme,
    layout: panes.length, anyDirty: allTabs().some((x) => x.dirty),
  });
  saveSession();
}

function updateStatus() {
  if (!focused || !current()) return;
  const state = focused.view.state;
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  statusPos.textContent = `Line ${line.number}, Column ${head - line.from + 1}`;
  statusIndent.textContent = `Spaces: ${state.facet(indentUnit).length}`;
  statusLang.textContent = LANGUAGES[current().language].name;
}

let dragged = null; // { pane, index } while a tab is being dragged

function renderTabs(pane) {
  pane.tabBar.textContent = '';
  pane.tabs.forEach((tab, i) => {
    const el = document.createElement('div');
    el.className = `tab${i === pane.active ? ' active' : ''}${tab.dirty ? ' dirty' : ''}`;
    el.title = tab.filePath || tabName(tab);
    el.draggable = true;
    const label = document.createElement('span');
    label.className = 'tab-label';
    label.textContent = tabName(tab);
    const close = document.createElement('span');
    close.className = 'tab-close';
    close.title = 'Close';
    el.append(label, close);
    el.addEventListener('mousedown', (e) => {
      if (e.button === 1) { e.preventDefault(); closeTab(pane, i); } // middle click closes
      else if (e.button === 0 && e.target !== close) activate(pane, i);
    });
    close.addEventListener('click', (e) => { e.stopPropagation(); closeTab(pane, i); });
    el.addEventListener('dragstart', (e) => {
      dragged = { pane, index: i };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', tabName(tab));
    });
    el.addEventListener('dragend', () => { dragged = null; });
    pane.tabBar.append(el);
  });
  const activeEl = pane.tabBar.children[pane.active];
  if (activeEl) activeEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function refresh(pane = focused) {
  renderTabs(pane);
  updateStatus();
  reportState();
}

function refreshAll() {
  panes.forEach(renderTabs);
  updateStatus();
  reportState();
}

// Applies prefs that live outside CodeMirror: tab bar colours, font size.
function applyChrome() {
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(THEMES[prefs.theme].vars)) root.setProperty(k, v);
  const bg = (prefs.colors[prefs.theme] || {}).background || THEMES[prefs.theme].bg;
  root.setProperty('--tab-active-bg', bg);
  document.body.style.backgroundColor = bg;
  document.body.dataset.theme = prefs.theme;
  root.setProperty('--edita-font-size', `${prefs.fontSize}px`);
}

// ---------- tabs ----------

function saveViewToTab(pane = focused) {
  const tab = current(pane);
  if (!tab) return;
  tab.state = pane.view.state;
  tab.scrollTop = pane.view.scrollDOM.scrollTop;
}

function activate(pane, i) {
  if (i === pane.active || !pane.tabs[i]) return;
  saveViewToTab(pane);
  pane.active = i;
  pane.view.setState(pane.tabs[i].state);
  pane.view.scrollDOM.scrollTop = pane.tabs[i].scrollTop || 0;
  setFocused(pane);
  refresh(pane);
  pane.view.focus();
}

function addTab(pane, text, filePath) {
  const language = detectLanguage(filePath);
  const tab = { filePath, language, dirty: false, scrollTop: 0, state: makeState(text, language) };
  if (!filePath) {
    tab.untitledName = `Untitled${++untitledCount > 1 ? ` ${untitledCount}` : ''}`;
    tab.autoSyntax = true; // guess the language from what is typed, until the user picks one
  }
  saveViewToTab(pane);
  pane.tabs.push(tab);
  pane.active = -1;
  activate(pane, pane.tabs.length - 1);
}

// Asks about unsaved changes in a tab. Returns true when it is OK to close it.
async function confirmTab(pane, i) {
  if (!pane.tabs[i].dirty) return true;
  activate(pane, i);
  const answer = await showDialog({
    type: 'warning',
    title: 'Unsaved changes',
    message: `Do you want to save the changes to ${tabName(pane.tabs[i])}?`,
    detail: "Your changes will be lost if you don't save them.",
    buttons: ['Save', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
  });
  if (answer === 0) return save(false);
  return answer === 1;
}

async function closeTab(pane, i) {
  if (!(await confirmTab(pane, i))) return;
  saveViewToTab(pane);
  pane.tabs.splice(i, 1);
  if (!pane.tabs.length) { pane.active = -1; addTab(pane, '', null); return; }
  const next = i < pane.active ? pane.active - 1 : Math.min(pane.active, pane.tabs.length - 1);
  pane.active = -1;
  activate(pane, next);
}

async function closeWindow() {
  for (const pane of panes) {
    for (let i = 0; i < pane.tabs.length; i++) {
      if (!(await confirmTab(pane, i))) return;
    }
  }
  api.closeWindow();
}

// ---------- file commands ----------

async function save(saveAs) {
  const tab = current();
  const result = await api.saveFile(saveAs ? null : tab.filePath, focused.view.state.doc.toString());
  if (!result) return false; // Save As cancelled
  if (result.error) {
    await showError('Save failed', `Edita could not save ${baseName(result.filePath)}.`, result.error);
    return false;
  }
  const saved = result.filePath;
  const pathChanged = saved !== tab.filePath;
  tab.filePath = saved;
  tab.dirty = false;
  tab.autoSyntax = false;
  if (pathChanged) {
    // The extension decides; an unknown extension keeps the current syntax, and .txt is Plain Text.
    const byExt = detectLanguage(saved);
    if (byExt !== 'plain' || /\.txt$/i.test(saved)) setLanguage(byExt);
  }
  refresh();
  return true;
}

function openInFocusedPane(file) {
  if (file.error) {
    showError('Open failed', `Edita could not open ${file.filePath}.`, file.error);
    return;
  }
  for (const pane of panes) {
    const existing = pane.tabs.findIndex((t) => t.filePath === file.filePath);
    if (existing >= 0) { activate(pane, existing); return; }
  }
  const language = detectLanguage(file.filePath);
  insertTab(focused, { filePath: file.filePath, language, dirty: false, scrollTop: 0, state: makeState(file.content, language) });
}

async function open() {
  const file = await api.openFile();
  if (file) openInFocusedPane(file);
}

function setLanguage(id, pane = focused) {
  if (!LANGUAGES[id]) return;
  current(pane).language = id;
  pane.view.dispatch({ effects: languageConf.reconfigure(languageExtension(id)) });
  refresh(pane);
}

// Auto-detects the syntax of an Untitled tab shortly after typing pauses.
let autoSyntaxTimer = null;
function scheduleAutoSyntax(pane, tab) {
  clearTimeout(autoSyntaxTimer);
  autoSyntaxTimer = setTimeout(() => {
    if (current(pane) !== tab || !tab.autoSyntax) return;
    const id = detectFromContent(pane.view.state.doc.toString());
    if (id && id !== tab.language) setLanguage(id, pane);
  }, 400);
}

// Saves new prefs and applies them to every tab in every pane.
function setPrefs(next, fromDialog = false) {
  prefs = next;
  savePrefs(prefs);
  for (const pane of panes) {
    saveViewToTab(pane);
    pane.tabs.forEach((tab, i) => {
      const effects = [
        prefsConf.reconfigure(prefsExtension()),
        languageConf.reconfigure(languageExtension(tab.language)),
      ];
      if (i === pane.active) pane.view.dispatch({ effects });
      else tab.state = tab.state.update({ effects }).state;
    });
    pane.view.requestMeasure();
  }
  applyChrome();
  updateStatus();
  reportState();
  // Keep an open Preferences dialog in sync with changes made elsewhere (View > Theme, Ctrl +/-).
  if (!fromDialog && preferencesOpen()) showPreferences();
}

function setFontSize(size) {
  setPrefs({ ...prefs, fontSize: Math.min(48, Math.max(8, size)) });
}

function showPreferences() {
  openPreferences(prefs, (next) => setPrefs(next, true), () => focused.view.focus());
}

// ---------- Tools menu ----------

async function showPalette() {
  const list = await api.getCommands();
  openPalette(list, (id) => api.runCommand(id), () => v().focus());
}

async function makeDefault() {
  const answer = await showDialog({
    type: 'question',
    title: 'Make Edita the default text editor',
    message: 'Make Edita the default app for text and code files?',
    detail: 'Edita will register itself for .txt, .ino, .c, .cpp, .py, .java, .html, .css, .js, .json, .md and other '
      + 'code files. Windows then opens Settings › Default apps, where you confirm Edita as the default '
      + '(Windows requires you to choose it there yourself).',
    buttons: ['Continue', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
  });
  if (answer !== 0) return;
  const result = await api.makeDefault();
  if (result.error) {
    await showError('Make Edita the default text editor', 'Edita could not register itself.', result.error);
  } else {
    await showDialog({
      type: 'info',
      title: 'Make Edita the default text editor',
      message: 'Edita is registered. Windows Settings › Default apps is now open.',
      detail: 'In Settings, click "Set default" (or choose Edita for each file type) to finish.',
    });
  }
}

const v = () => focused.view;
const commands = {
  new: () => addTab(focused, '', null),
  open,
  save: () => save(false),
  saveAs: () => save(true),
  closeTab: () => closeTab(focused, focused.active),
  closeWindow,
  nextTab: () => activate(focused, (focused.active + 1) % focused.tabs.length),
  prevTab: () => activate(focused, (focused.active - 1 + focused.tabs.length) % focused.tabs.length),
  layout1: () => setLayout(1),
  layout2: () => setLayout(2),
  focusGroup1: () => activateFocus(0),
  focusGroup2: () => activateFocus(1),
  moveToGroup1: () => panes.length > 1 && moveTab(focused, focused.active, panes[0]),
  moveToGroup2: () => moveTab(focused, focused.active, panes[1]),
  undo: () => undo(v()),
  redo: () => redo(v()),
  selectAll: () => selectAll(v()),
  fontUp: () => setFontSize(prefs.fontSize + 1),
  fontDown: () => setFontSize(prefs.fontSize - 1),
  preferences: showPreferences,
  palette: showPalette,
  makeDefault,
  'help:docs': () => openHelp('docs', api),
  'help:license': () => openHelp('license', api),
  'help:about': () => openHelp('about', api),
  'help:privacy': () => api.openExternal(PRIVACY_URL),
  indentMore: () => indentMore(v()),
  indentLess: () => indentLess(v()),
  find: () => openSearchPanel(v()),
  findNext: () => findNext(v()),
  findPrevious: () => findPrevious(v()),
};

function activateFocus(i) {
  if (!panes[i]) return;
  setFocused(panes[i]);
  panes[i].view.focus();
}

// Commands that keep keyboard focus where it is (dialogs, search panel, font size).
const KEEP_FOCUS = ['find', 'findNext', 'findPrevious', 'preferences', 'fontUp', 'fontDown', 'palette', 'makeDefault',
  'help:docs', 'help:license', 'help:about', 'help:privacy'];

api.onMenu((cmd) => {
  // While a question (e.g. "save changes?") is on screen, it must be answered first.
  if (messageDialogOpen()) return;
  if (paletteOpen()) closePalette();
  if (['cut', 'copy', 'paste'].includes(cmd)) {
    // Edit > Cut / Copy / Paste act on the focused field (the editor unless a dialog is open).
    if (!document.querySelector('.dialog-overlay')) v().focus();
    api.sendKeys(cmd);
    return;
  }
  if (cmd.startsWith('syntax:')) { current().autoSyntax = false; setLanguage(cmd.slice(7)); v().focus(); return; }
  if (cmd.startsWith('theme:')) { setPrefs({ ...prefs, theme: cmd.slice(6) }); return; }
  const run = commands[cmd];
  if (!run) return;
  if (preferencesOpen() || helpOpen()) {
    // Text-editing keys (Ctrl+A, Ctrl+Z...) belong to the dialog while it is open.
    if (['undo', 'redo', 'selectAll', 'indentMore', 'indentLess', 'find', 'findNext', 'findPrevious'].includes(cmd)) return;
    if (!['preferences', 'fontUp', 'fontDown'].includes(cmd)) { closePreferences(); closeHelp(); }
  }
  run();
  if (!KEEP_FOCUS.includes(cmd)) v().focus();
});

// ---------- session: reopen the previous tabs on the next start ----------

const SESSION_KEY = 'edita.session';
let restoring = true; // don't overwrite the saved session until it has been read at start-up

function saveSession() {
  if (restoring) return;
  const session = {
    layout: panes.length,
    focused: panes.indexOf(focused),
    panes: panes.map((p) => ({
      files: p.tabs.filter((t) => t.filePath).map((t) => t.filePath),
      active: current(p) ? current(p).filePath : null,
    })),
  };
  try { api.storeSet(SESSION_KEY, JSON.stringify(session)); } catch {}
}

async function restoreSession() {
  let session = null;
  try { session = JSON.parse(api.storeGet(SESSION_KEY)); } catch {}
  try {
    if (!session || !Array.isArray(session.panes)) return;
    if (session.layout === 2) setLayout(2);
    for (let i = 0; i < Math.min(session.panes.length, panes.length); i++) {
      const pane = panes[i];
      let activeIndex = -1;
      for (const filePath of session.panes[i].files || []) {
        const file = await api.readFile(filePath);
        if (file.error) continue; // moved or deleted since last time: just skip it
        const language = detectLanguage(file.filePath);
        insertTab(pane, { filePath: file.filePath, language, dirty: false, scrollTop: 0, state: makeState(file.content, language) });
        if (filePath === session.panes[i].active) activeIndex = pane.active;
      }
      if (activeIndex >= 0) activate(pane, activeIndex);
    }
    if (panes[session.focused]) activateFocus(session.focused);
  } finally {
    restoring = false;
    saveSession();
  }
}

// Files passed on the command line / "Open with" / File › Open Recent (from the Rust side).
api.onOpenFile((file) => openInFocusedPane(file));

applyChrome();
const first = createPane();
setFocused(first);
addTab(first, '', null);
restoreSession().then(() => api.rendererReady());
