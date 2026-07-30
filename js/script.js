/* ═══════════════════════════════════════════════════════
   CYBERPUNK 2077 STREAM INTRO — script.js
   Lógica exclusiva de la INTRO: renderSchedule() con vista
   de semana completa. El resto viene de engine.js
   ═══════════════════════════════════════════════════════ */

import {
  SCHEDULE, DAY_NAMES,
  getGameImage, getGameImageSync, preloadGameImage, parseStreamTime,
  initAppController
} from './engine.js';

console.log('[INTRO] Script inicializado');

(function () {
  'use strict';

  // ─── RENDER: HORARIO (exclusivo de la intro) ──────────────
  function renderSchedule(contentArea) {
    const today = new Date();
    let todayIdx = today.getDay();
    if (todayIdx === 0) todayIdx = 7;

    const mondayDate = new Date(today);
    mondayDate.setDate(today.getDate() - (todayIdx - 1));

    const dayKeys = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
    const todayKey = dayKeys[todayIdx - 1] || null;

    const weekDates = dayKeys.map((key, index) => {
      const d = new Date(mondayDate);
      let dayOffset = index;
      if (index + 1 < todayIdx) dayOffset += 7;
      d.setDate(mondayDate.getDate() + dayOffset);
      const dayStr = d.getDate().toString().padStart(2, '0');
      let monthStr = d.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');
      return { day: dayStr, month: monthStr };
    });

    const scheduleContainer = document.createElement('div');
    scheduleContainer.className = 'content-view-container';

    Object.entries(SCHEDULE).forEach(([k, gamesList], i) => {
      const active = k === todayKey;
      const dateObj = weekDates[i];
      const displayDate = active ? dateObj.day : `${dateObj.day} ${dateObj.month}`;

      const dayRow = document.createElement('div');
      dayRow.className = `sch-day-row feed-enter ${active ? 'active-day-row' : ''}`;
      dayRow.style.animationDelay = `${i * 0.1}s`;
      dayRow.style.display = 'flex';
      dayRow.style.alignItems = 'center';
      dayRow.style.gap = '30px';
      dayRow.style.flex = '1';
      dayRow.style.paddingBottom = '10px';

      const dayLabel = document.createElement('div');
      dayLabel.className = 'sch-day-label';

      const isMiercoles = k === 'miercoles';
      const titleFontSize = isMiercoles ? (active ? '1.5rem' : '1.1rem') : (active ? '1.8rem' : '1.3rem');
      const dateFontSize  = isMiercoles ? (active ? '1.2rem' : '0.9rem') : (active ? '1.5rem' : '1.1rem');

      dayLabel.innerHTML = `
        <div style="font-family: var(--font-title); font-size: ${titleFontSize}; font-weight: 800; color: ${active ? '#fff' : 'rgba(255,255,255,0.6)'}; letter-spacing: 1px; transition: all 0.3s ease; text-transform: uppercase; text-shadow: ${active ? '0 0 15px rgba(var(--cyber-red-rgb), 0.7)' : 'none'};">
          ${DAY_NAMES[k]} <span style="font-family: var(--font-mono); font-size: ${dateFontSize}; color: ${active ? '#fff' : 'rgba(255,255,255,0.4)'}; text-shadow: ${active ? '0 0 10px rgba(255,255,255,0.8)' : 'none'};">${displayDate}</span>
        </div>
        ${active ? '<div class="sch-badge-today">HOY</div>' : ''}
      `;
      dayRow.appendChild(dayLabel);

      const gamesCol = document.createElement('div');
      gamesCol.style.flex = '1';
      gamesCol.style.display = 'flex';
      gamesCol.style.gap = '30px';

      gamesList.forEach(g => {
        const gameCard = document.createElement('div');
        gameCard.className = `sch-card ${active ? 'active-day' : ''}`;

        const { startTimeStr, endTimeStr } = parseStreamTime(g.time);

        const syncUrl = getGameImageSync(g.game);
        const objectPositionStyle = g.game.trim().toUpperCase() === 'DESCANSO' ? 'center 25%' : 'center';

        gameCard.innerHTML = `
          <img class="sch-card-img sch-new-img" data-game="${g.game}" data-active="${active}" src="${syncUrl}" style="object-position: ${objectPositionStyle}; ${syncUrl ? 'opacity: 1; transform: scale(1.08);' : ''}">
          <div class="sch-card-overlay"></div>
          <div class="sch-card-content">
            <div class="sch-card-title">${g.game}</div>
            <div class="sch-card-badge">
              <span class="sch-card-badge-time">${startTimeStr}</span>
              ${endTimeStr ? `<span class="sch-card-badge-endtime">${endTimeStr}</span>` : ''}
            </div>
          </div>
        `;
        gamesCol.appendChild(gameCard);

        if (!syncUrl) {
          const img = gameCard.querySelector('.sch-card-img');
          getGameImage(g.game).then(url => {
            if (url) {
              img.src = url;
              setTimeout(() => {
                img.style.opacity = '1';
                img.style.transform = 'scale(1.08)';
              }, 50);
            }
          });
        }
      });

      dayRow.appendChild(gamesCol);
      scheduleContainer.appendChild(dayRow);
    });

    contentArea.appendChild(scheduleContainer);
  }

  // ─── INIT ─────────────────────────────────────────
  Object.values(SCHEDULE).flat().forEach(g => {
    if (g && g.game) preloadGameImage(g.game);
  });

  initAppController({
    renderScheduleCustom: (contentArea) => renderSchedule(contentArea)
  });

})();
