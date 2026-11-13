// Colour swatches: a small square before every hex / rgb() / rgba() / hsl() colour.
// Clicking a swatch opens a colour picker; the picked colour is written back in the same format.
import { ViewPlugin, Decoration, WidgetType } from '@codemirror/view';

const COLOR_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])|\b(?:rgba?|hsla?)\([^()\n]*\)/g;

const ctx = document.createElement('canvas').getContext('2d');

// Returns the browser's normalised form ('#rrggbb' or 'rgba(r, g, b, a)'), or null if not a colour.
function normalize(text) {
  ctx.fillStyle = '#000000';
  ctx.fillStyle = text;
  const a = ctx.fillStyle;
  ctx.fillStyle = '#ffffff';
  ctx.fillStyle = text;
  return a === ctx.fillStyle ? a : null;
}

const hex2 = (n) => n.toString(16).padStart(2, '0');

function toHex(normalized) {
  if (normalized.startsWith('#')) return normalized;
  const [r, g, b] = normalized.match(/[\d.]+/g).map(Number);
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

// Writes the picked '#rrggbb' in the style of the original text, keeping any alpha.
function formatLike(original, picked) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(picked.slice(i, i + 2), 16));
  const upper = /[A-F]/.test(original) && !/[a-f]/.test(original);
  if (/^rgba?\(/i.test(original)) {
    const parts = original.slice(original.indexOf('(') + 1, -1).split(/[\s,/]+/).filter(Boolean);
    const fn = original.slice(0, original.indexOf('('));
    return parts.length > 3 ? `${fn}(${r}, ${g}, ${b}, ${parts[3]})` : `${fn}(${r}, ${g}, ${b})`;
  }
  let out = picked;
  if (original.startsWith('#')) {
    const digits = original.slice(1);
    if (digits.length === 4) out += digits[3] + digits[3];
    if (digits.length === 8) out += digits.slice(6);
  }
  return upper ? out.toUpperCase() : out;
}

let input = null;
function openPicker(view, from, to, anchor) {
  const original = view.state.sliceDoc(from, to);
  const normalized = normalize(original);
  if (!normalized) return;
  if (!input) {
    input = document.createElement('input');
    input.type = 'color';
    input.style.cssText = 'position:fixed;width:0;height:0;opacity:0;border:0;padding:0;';
    document.body.append(input);
  }
  const rect = anchor.getBoundingClientRect();
  input.style.left = `${rect.left}px`;
  input.style.top = `${rect.bottom}px`;
  input.value = toHex(normalized);
  let end = to;
  input.oninput = () => {
    const text = formatLike(original, input.value);
    view.dispatch({ changes: { from, to: end, insert: text }, userEvent: 'input.color' });
    end = from + text.length;
  };
  input.onchange = () => view.focus();
  input.showPicker();
}

class SwatchWidget extends WidgetType {
  constructor(color, from, to) { super(); this.color = color; this.from = from; this.to = to; }
  eq(other) { return other.color === this.color && other.from === this.from && other.to === this.to; }
  toDOM(view) {
    const el = document.createElement('span');
    el.className = 'cm-color-swatch';
    el.style.setProperty('--swatch', this.color);
    el.title = 'Click to pick a colour';
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      openPicker(view, this.from, this.to, el);
    });
    return el;
  }
  ignoreEvent() { return true; }
}

function buildSwatches(view) {
  const ranges = [];
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);
    for (const m of text.matchAll(COLOR_RE)) {
      const color = normalize(m[0]);
      if (!color) continue;
      const start = from + m.index;
      const widget = new SwatchWidget(m[0], start, start + m[0].length);
      ranges.push(Decoration.widget({ widget, side: -1 }).range(start));
    }
  }
  return Decoration.set(ranges);
}

export const colorSwatches = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = buildSwatches(view); }
  update(u) { if (u.docChanged || u.viewportChanged) this.decorations = buildSwatches(u.view); }
}, { decorations: (v) => v.decorations });
