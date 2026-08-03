/* ═══════════════════════════════════════════════════════
   CYBERPUNK 2077 STREAM INTRO — script.js
   Lógica exclusiva de la INTRO: renderSchedule() con vista
   de semana completa. El resto viene de engine.js
   ═══════════════════════════════════════════════════════ */

import {
  SCHEDULE, DAY_NAMES, getDayKey, getWeekDates,
  getGameImageSync, bindAsyncGameImage, isDescansoGame, preloadGameImage, parseStreamTime,
  initAppController
} from './engine.js';

console.log('[INTRO] Script inicializado');

(function () {
  'use strict';

  // ─── RENDER: HORARIO (exclusivo de la intro) ──────────────
  function renderSchedule(contentArea) {
    const todayKey = getDayKey();
    const weekDates = getWeekDates();

    const scheduleContainer = document.createElement('div');
    scheduleContainer.className = 'content-view-container';

    Object.entries(SCHEDULE).forEach(([k, gamesList], i) => {
      const active = k === todayKey;
      const dateObj = weekDates[i];
      const displayDate = active ? dateObj.day : `${dateObj.day} ${dateObj.month}`;

      const dayRow = document.createElement('div');
      dayRow.className = `sch-day-row feed-enter ${active ? 'active-day-row' : ''}`;
      dayRow.style.animationDelay = `${i * 0.1}s`;

      const dayLabel = document.createElement('div');
      dayLabel.className = 'sch-day-label';

      const isMiercoles = k === 'miercoles';

      dayLabel.innerHTML = `
        <div class="sch-day-title ${isMiercoles ? 'is-miercoles' : ''}">
          ${DAY_NAMES[k]} <span class="sch-day-date">${displayDate}</span>
        </div>
        ${active ? '<div class="sch-badge-today">HOY</div>' : ''}
      `;
      dayRow.appendChild(dayLabel);

      const gamesCol = document.createElement('div');
      gamesCol.className = 'sch-games-col';

      gamesList.forEach(g => {
        const gameCard = document.createElement('div');
        gameCard.className = `sch-card ${active ? 'active-day' : ''}`;

        const { startTimeStr, endTimeStr } = parseStreamTime(g.time);

        const syncUrl = getGameImageSync(g.game);
        const isDescanso = isDescansoGame(g.game);

        gameCard.innerHTML = `
          <img class="sch-card-img sch-new-img ${isDescanso ? 'descanso' : ''}" data-game="${g.game}" data-active="${active}" src="${syncUrl}" style="${syncUrl ? 'opacity: 1; transform: scale(1.08);' : ''}">
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
          bindAsyncGameImage(gameCard.querySelector('.sch-card-img'), g.game);
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
