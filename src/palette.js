// Command palette (Tools > Command Palette, Ctrl+Shift+P): type to search every menu command.

let overlay = null;

export function paletteOpen() { return !!overlay; }

export function closePalette() {
  if (overlay) { overlay.remove(); overlay = null; }
}

// commands: [{ id, label: 'File › Save', accelerator }]; onRun(id) runs the chosen one.
export function openPalette(commands, onRun, onClose) {
  closePalette();
  overlay = document.createElement('div');
  overlay.className = 'palette-overlay';
  const box = document.createElement('div');
  box.className = 'dialog palette';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Type a command…';
  input.setAttribute('aria-label', 'Command');
  const list = document.createElement('div');
  list.className = 'palette-list';
  list.setAttribute('role', 'listbox');
  box.append(input, list);
  overlay.append(box);
  document.body.append(overlay);

  let shown = [];
  let selected = 0;

  const close = () => { closePalette(); onClose(); };
  const run = (cmd) => { closePalette(); onRun(cmd.id); };

  function render() {
    const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    shown = commands.filter((c) => words.every((w) => c.label.toLowerCase().includes(w)));
    selected = Math.min(selected, Math.max(0, shown.length - 1));
    list.textContent = '';
    shown.forEach((c, i) => {
      const row = document.createElement('div');
      row.className = `palette-item${i === selected ? ' selected' : ''}`;
      row.setAttribute('role', 'option');
      const label = document.createElement('span');
      label.textContent = c.label;
      const key = document.createElement('span');
      key.className = 'palette-key';
      key.textContent = c.accelerator || '';
      row.append(label, key);
      row.addEventListener('mousedown', (e) => { e.preventDefault(); run(c); });
      list.append(row);
    });
    if (!shown.length) {
      const none = document.createElement('div');
      none.className = 'palette-empty';
      none.textContent = 'No matching commands';
      list.append(none);
    }
    const sel = list.children[selected];
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('input', () => { selected = 0; render(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); selected = Math.min(selected + 1, shown.length - 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); selected = Math.max(selected - 1, 0); render(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[selected]) run(shown[selected]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  render();
  input.focus();
}
