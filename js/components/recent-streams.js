import { renderPlaceholder } from './placeholder.js';

export function formatStreamDate(rawDate) {
  if (!rawDate) return '--/--';
  const dateObj = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate);
  return !isNaN(dateObj)
    ? dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
    : '--/--';
}

export function renderRecentStreams(contentArea, recentStreams) {
  if (recentStreams.length === 0) {
    renderPlaceholder(contentArea, 'CARGANDO ARCHIVOS...');
    return;
  }
  const container = document.createElement('div');
  container.className = 'content-view-container sch-strips-container';

  recentStreams.forEach((s, i) => {
    const rawDate = s.date || s.timestamp || s.createdAt || s.fecha || s._docId;
    const dateStr = formatStreamDate(rawDate);

    const title = (s._resolvedTitle || s.title || s.name || s.nombre || s.titulo || s.streamTitle || s.stream_title || s.label || 'SIN TITULO').toUpperCase();
    const category = (s.category || s.game || s.categoria || 'VARIEDAD').toUpperCase();

    const strip = document.createElement('div');
    strip.className = `sch-strip feed-enter${i === 0 ? ' sch-strip--active' : ''}`;
    strip.style.animationDelay = `${i * 0.08}s`;

    const dateCol = document.createElement('div');
    dateCol.className = 'sch-strip-day';
    dateCol.innerHTML = `
      <span class="sch-strip-dayname">${dateStr}</span>
      <span class="sch-strip-date">ARCHIVE</span>
    `;
    strip.appendChild(dateCol);

    const divider = document.createElement('div');
    divider.className = 'sch-strip-divider';
    strip.appendChild(divider);

    const content = document.createElement('div');
    content.className = 'sch-strip-content';
    content.innerHTML = `
      <div class="sch-strip-game-row">
        <span class="sch-strip-game">${title}</span>
      </div>
      <span class="sch-strip-subtitle">${category}</span>
    `;
    strip.appendChild(content);

    container.appendChild(strip);
  });
  contentArea.appendChild(container);
}
