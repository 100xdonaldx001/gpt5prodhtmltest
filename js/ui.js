import {
  settingsPanel,
  settingsHandle,
  builder,
  builderHandle,
  worldgenPanel,
  worldHandle,
  debugPanel,
  debugHandle,
} from './core/index.js';

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
makeDraggable(worldgenPanel, worldHandle, 'ui.worldgen.pos');
makeDraggable(debugPanel, debugHandle, 'ui.debug.pos');

// Set default positions so panels don't overlap on first load
if (!localStorage.getItem('ui.settings.pos')) {
  settingsPanel.style.left = '12px';
  settingsPanel.style.top = '60px';
}
if (!localStorage.getItem('ui.builder.pos')) {
  builder.style.left = '12px';
  builder.style.top = '248px';
}
if (!localStorage.getItem('ui.worldgen.pos')) {
  worldgenPanel.style.left = '12px';
  worldgenPanel.style.top = '436px';
}
if (!localStorage.getItem('ui.debug.pos')) {
  debugPanel.style.left = '12px';
  debugPanel.style.top = '624px';
}
