export function renderPlaceholder(contentArea, title) {
  const el = document.createElement('div');
  el.className = 'placeholder-card feed-enter';
  el.innerHTML = `
    <div class="ph-header">
      <span class="ph-code">OFFSET_ERR // ${Math.random().toString(16).substring(2, 6).toUpperCase()}</span>
      <span class="ph-title">${title}</span>
    </div>
    <div class="ph-body">
      <div class="ph-glitch-line"></div>
      <p>ENLACE NEURAL INTERRUMPIDO. RECONECTANDO CON EL SECTOR...</p>
    </div>
  `;
  contentArea.appendChild(el);
}
