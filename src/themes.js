// Edita colour themes: a Monokai-style Dark theme (default) and a colourful Light theme.
import { EditorView } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

export const PALETTES = {
  light: {
    dark: false,
    bg: '#ffffff', fg: '#383a42', gutterBg: '#f7f7f7', gutterFg: '#a0a1a7', gutterActiveFg: '#383a42',
    activeLine: 'rgba(64, 120, 242, 0.07)', activeLineSwatch: '#eef3fd', selection: '#add6ff', cursor: '#526fff', matchBg: '#fff3a6',
    panelBg: '#f3f3f3', panelBorder: '#dddddd',
    keyword: '#a626a4', string: '#50a14f', number: '#986801', comment: '#a0a1a7', func: '#4078f2',
    type: '#c18401', property: '#0184bc', tag: '#e45649', attr: '#986801', operator: '#0184bc',
    variable: '#383a42', special: '#e45649', heading: '#e45649', link: '#4078f2', invalid: '#ff0000',
  },
  dark: {
    dark: true,
    bg: '#272822', fg: '#f8f8f2', gutterBg: '#272822', gutterFg: '#75715e', gutterActiveFg: '#f8f8f2',
    activeLine: 'rgba(255, 255, 255, 0.07)', activeLineSwatch: '#393a34', selection: '#4b5c7a', cursor: '#f9a825', matchBg: '#5a5843', // amber caret like Sublime
    panelBg: '#1e1f1c', panelBorder: '#3b3c35',
    keyword: '#f92672', string: '#e6db74', number: '#ae81ff', comment: '#75715e', func: '#a6e22e',
    type: '#66d9ef', property: '#66d9ef', tag: '#f92672', attr: '#a6e22e', operator: '#f92672',
    variable: '#f8f8f2', special: '#fd971f', heading: '#a6e22e', link: '#66d9ef', invalid: '#f44747',
  },
};

function editorTheme(p) {
  return EditorView.theme({
    '&': { color: p.fg, backgroundColor: p.bg },
    '.cm-content': { caretColor: p.cursor },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: p.cursor, borderLeftWidth: '2.5px' },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection':
      { backgroundColor: p.selection },
    // The current-line highlight is drawn above the selection, so it is translucent to keep selections visible.
    '.cm-activeLine': { backgroundColor: p.activeLine },
    '.cm-gutters': { backgroundColor: p.gutterBg, color: p.gutterFg, border: 'none' },
    '.cm-lineNumbers .cm-gutterElement': { textAlign: 'right', minWidth: '3ch', padding: '0 14px 0 18px' },
    '.cm-activeLineGutter': { backgroundColor: p.activeLine, color: p.gutterActiveFg },
    '.cm-selectionMatch': { backgroundColor: p.matchBg },
    '.cm-searchMatch': { backgroundColor: p.matchBg, outline: `1px solid ${p.gutterFg}` },
    '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: p.selection },
    '.cm-matchingBracket, .cm-nonmatchingBracket': { outline: `1px solid ${p.gutterFg}` },
    // Find bar at the bottom, like Sublime, in the Windows title bar colours (see index.html).
    '.cm-panels': { backgroundColor: 'var(--titlebar-bg)', color: 'var(--titlebar-fg)', fontFamily: '"Segoe UI", sans-serif' },
    '.cm-panels.cm-panels-bottom': { borderTop: '1px solid var(--titlebar-border)' },
    '.cm-search': {
      position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', padding: '6px 40px 6px 10px', fontSize: '13px',
    },
    '.cm-search br': { display: 'none' },
    '.cm-search::after': { content: '""', flexBasis: '100%', order: '4' }, // line break before the Replace row
    '.cm-search label': { order: '1', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', whiteSpace: 'nowrap' },
    '.cm-search input[name=search]': { order: '2', flex: '1 1 200px' },
    '.cm-search button[name=next], .cm-search button[name=prev], .cm-search button[name=select]': { order: '3' },
    '.cm-search input[name=replace]': { order: '5', flex: '1 1 200px' },
    '.cm-search button[name=replace], .cm-search button[name=replaceAll]': { order: '6' },
    '.cm-search button[name=close]': { position: 'absolute', top: '4px', right: '8px', fontSize: '18px', color: 'var(--titlebar-fg)' },
    '.cm-search .cm-button': {
      backgroundImage: 'none', backgroundColor: 'var(--field-bg)', color: 'var(--titlebar-fg)', border: '1px solid var(--field-border)',
      borderRadius: '4px', padding: '3px 14px', margin: '0', fontSize: '12.5px', minWidth: '80px',
    },
    '.cm-search .cm-button:hover': { borderColor: p.cursor },
    '.cm-textfield': {
      backgroundColor: 'var(--field-bg)', color: 'var(--titlebar-fg)', border: '1px solid var(--field-border)',
      borderRadius: '4px', padding: '4px 8px', margin: '0', fontSize: '13px',
    },
    '.cm-textfield:focus': { outline: 'none', borderColor: p.cursor },
    '.cm-tooltip': { backgroundColor: p.panelBg, color: p.fg, border: `1px solid ${p.panelBorder}` },
    '.cm-tooltip-autocomplete > ul > li': { padding: '2px 8px' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: p.selection, color: p.fg },
    '.cm-completionMatchedText': { textDecoration: 'none', fontWeight: 'bold', color: p.func },
  }, { dark: p.dark });
}

function highlightStyle(p) {
  return HighlightStyle.define([
    { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.definitionKeyword, t.moduleKeyword, t.modifier, t.self],
      color: p.keyword },
    { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: p.comment, fontStyle: 'italic' },
    { tag: [t.string, t.special(t.string), t.character, t.docString], color: p.string },
    { tag: [t.regexp, t.escape], color: p.special },
    { tag: [t.number, t.integer, t.float, t.bool, t.null, t.atom, t.unit, t.color], color: p.number },
    { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], color: p.func },
    { tag: [t.definition(t.variableName), t.definition(t.function(t.variableName))], color: p.func },
    { tag: [t.typeName, t.className, t.namespace, t.standard(t.typeName)], color: p.type },
    { tag: [t.propertyName, t.definition(t.propertyName)], color: p.property },
    { tag: [t.tagName, t.angleBracket], color: p.tag },
    { tag: t.attributeName, color: p.attr },
    { tag: t.attributeValue, color: p.string },
    { tag: [t.operator, t.derefOperator, t.arithmeticOperator, t.logicOperator, t.compareOperator], color: p.operator },
    { tag: [t.meta, t.processingInstruction, t.annotation], color: p.keyword },
    { tag: [t.labelName, t.constant(t.variableName), t.special(t.variableName)], color: p.special },
    { tag: t.variableName, color: p.variable },
    { tag: [t.heading, t.heading1, t.heading2, t.heading3], color: p.heading, fontWeight: 'bold' },
    { tag: t.strong, fontWeight: 'bold' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: [t.link, t.url], color: p.link, textDecoration: 'underline' },
    { tag: t.invalid, color: p.invalid },
  ]);
}

// Editor colours the user can override in Preferences (empty = theme default).
export const COLOR_PREFS = [
  ['background', 'Background', 'bg'],
  ['text', 'Text', 'fg'],
  ['caret', 'Cursor', 'cursor'],
  ['selection', 'Selection', 'selection'],
  ['lineHighlight', 'Current line', 'activeLineSwatch'], // the real highlight is translucent
];

export function colorOverrides(c) {
  const rules = {};
  if (c.background) {
    rules['&'] = { backgroundColor: c.background };
    rules['.cm-gutters'] = { backgroundColor: c.background };
  }
  if (c.text) rules['&'] = { ...rules['&'], color: c.text };
  if (c.caret) {
    rules['.cm-content'] = { caretColor: c.caret };
    rules['.cm-cursor, .cm-dropCursor'] = { borderLeftColor: c.caret };
  }
  if (c.selection) {
    rules['&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection'] =
      { backgroundColor: c.selection };
  }
  // Translucent, so a selection on the current line stays visible.
  if (c.lineHighlight) {
    rules['.cm-activeLine, .cm-activeLineGutter'] = { backgroundColor: `color-mix(in srgb, ${c.lineHighlight} 45%, transparent)` };
  }
  return Prec.highest(EditorView.theme(rules));
}

// CSS variables used by the tab bar and status bar (see index.html).
function chromeVars(p) {
  return p.dark
    ? { '--bar-bg': '#1e1f1c', '--bar-fg': '#a8a8a0', '--tab-bg': '#2d2e28', '--tab-active-bg': p.bg,
      '--tab-active-fg': '#ffffff', '--accent': '#fd971f', '--border': '#141411' }
    : { '--bar-bg': '#e8e8e8', '--bar-fg': '#555555', '--tab-bg': '#dcdcdc', '--tab-active-bg': p.bg,
      '--tab-active-fg': '#222222', '--accent': '#4078f2', '--border': '#cccccc' };
}

export const THEMES = Object.fromEntries(Object.entries(PALETTES).map(([id, p]) => [id, {
  extension: [editorTheme(p), syntaxHighlighting(highlightStyle(p))],
  vars: chromeVars(p),
  bg: p.bg,
}]));
