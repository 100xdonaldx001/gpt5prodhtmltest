import { settingsPanel, settingsHandle, builder, builderHandle } from './core/index.js';

function constrainPanel(panel) {
  const rect = panel.getBoundingClientRect();
  let x = rect.left,
    y = rect.top;
  const maxX = window.innerWidth - rect.width;
  const maxY = window.innerHeight - rect.height;
  x = Math.max(0, Math.min(x, Math.max(0, maxX)));
  y = Math.max(0, Math.min(y, Math.max(0, maxY)));
  panel.style.left = x + 'px';
  panel.style.top = y + 'px';
}
export { constrainPanel };

function makeDraggable(panel, handle, storageKey) {
  let sx = 0,
    sy = 0,
    px = 0,
    py = 0,
    dragging = false;
  const bringToFront = () => {
    panel.style.zIndex = (+new Date()).toString();
  };
  handle.addEventListener('mousedown', (e) => {
    dragging = true;
    bringToFront();
    sx = e.clientX;
    sy = e.clientY;
    const r = panel.getBoundingClientRect();
    px = r.left;
    py = r.top;
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - sx,
      dy = e.clientY - sy;
    panel.style.left = px + dx + 'px';
    panel.style.top = py + dy + 'px';
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    constrainPanel(panel);
    if (storageKey) {
      const r = panel.getBoundingClientRect();
      localStorage.setItem(storageKey, JSON.stringify({ x: r.left, y: r.top }));
    }
  });
  if (storageKey) {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
          panel.style.left = p.x + 'px';
          panel.style.top = p.y + 'px';
          constrainPanel(panel);
        }
      } catch {}
    }
  }
}

makeDraggable(settingsPanel, settingsHandle, 'ui.settings.pos');
makeDraggable(builder, builderHandle, 'ui.builder.pos');
