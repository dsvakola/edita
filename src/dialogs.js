// Edita's own message dialogs (themed Light/Dark), used instead of Windows message boxes.

const ICONS = { warning: '⚠', error: '✖', info: 'ℹ', question: '?' };
let open = 0;

export function messageDialogOpen() { return open > 0; }

// Shows a dialog and resolves with the index of the clicked button (cancelId for Esc / outside click).
export function showDialog({
  type = 'info', title = 'Edita', message, detail = '', buttons = ['OK'], defaultId = 0, cancelId = buttons.length - 1,
}) {
  return new Promise((resolve) => {
    open++;
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    const box = document.createElement('div');
    box.className = 'dialog message-dialog';
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-modal', 'true');

    const head = document.createElement('div');
    head.className = 'dialog-titlebar';
    const headText = document.createElement('span');
    headText.textContent = title;
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'dialog-x';
    x.setAttribute('aria-label', 'Close');
    x.textContent = '✕';
    head.append(headText, x);
    const body = document.createElement('div');
    body.className = 'message-body';
    const icon = document.createElement('div');
    icon.className = `message-icon ${type}`;
    icon.textContent = ICONS[type] || '';
    const text = document.createElement('div');
    const msg = document.createElement('div');
    msg.className = 'message-text';
    msg.textContent = message;
    const det = document.createElement('div');
    det.className = 'message-detail';
    det.textContent = detail;
    text.append(msg, det);
    body.append(icon, text);

    const row = document.createElement('div');
    row.className = 'dialog-buttons';
    row.append(Object.assign(document.createElement('span'), { className: 'spacer' }));
    const finish = (i) => {
      overlay.remove();
      open--;
      resolve(i);
    };
    x.addEventListener('click', () => finish(cancelId));
    const btns = buttons.map((label, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      if (i === defaultId) b.className = 'primary';
      b.addEventListener('click', () => finish(i));
      row.append(b);
      return b;
    });

    box.append(head, body, row);
    overlay.append(box);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) e.preventDefault(); });
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); finish(cancelId); }
      // Left/Right arrows move between buttons, like Windows dialogs.
      const at = btns.indexOf(document.activeElement);
      if (at >= 0 && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        btns[(at + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length].focus();
      }
    });
    document.body.append(overlay);
    btns[defaultId].focus();
  });
}

export const showError = (title, message, detail) =>
  showDialog({ type: 'error', title, message, detail, buttons: ['OK'] });
