/* ═══════════════════════════════════════════════════════
   CYBERPUNK 2077 STREAM INTRO — script.js
   Lógica exclusiva de la INTRO: renderSchedule() con vista
   de semana completa. El resto viene de engine.js
   ═══════════════════════════════════════════════════════ */

import {
  SCHEDULE, getDayKey, getWeekDates,
  isDescansoGame, preloadGameImage, parseStreamTime,
  initAppController
} from './engine.js';

console.log('[INTRO] Script inicializado');

(function () {
  'use strict';

  // ─── RENDER: HORARIO (exclusivo de la intro) ──────────────
  const DAY_ABBR = {
    lunes: 'LUN', martes: 'MAR', miercoles: 'MIE',
    jueves: 'JUE', viernes: 'VIE', sabado: 'SAB', domingo: 'DOM',
  };

  function renderSchedule(contentArea) {
    const todayKey = getDayKey();
    const weekDates = getWeekDates();

    const container = document.createElement('div');
    container.className = 'content-view-container sch-strips-container';

    Object.entries(SCHEDULE).forEach(([k, gamesList], i) => {
      const isToday = k === todayKey;
      const dateObj = weekDates[i];
      const isWeekendStart = k === 'sabado';

      // Filter out DESCANSO games — only show actual streams
      const actualGames = gamesList.filter(g => !isDescansoGame(g.game));

      const strip = document.createElement('div');
      strip.className = `sch-strip feed-enter${isToday ? ' sch-strip--active' : ''}${actualGames.length === 0 ? ' sch-strip--rest' : ''}${isWeekendStart ? ' sch-strip--weekend-sep' : ''}`;
      strip.style.animationDelay = `${i * 0.08}s`;

      // ── Day column
      const dayCol = document.createElement('div');
      dayCol.className = 'sch-strip-day';
      dayCol.innerHTML = `
        <span class="sch-strip-dayname">${DAY_ABBR[k] || k.toUpperCase()}</span>
        <span class="sch-strip-date">${dateObj.day} ${dateObj.month}</span>
      `;
      strip.appendChild(dayCol);

      // ── Vertical divider
      const divider = document.createElement('div');
      divider.className = 'sch-strip-divider';
      strip.appendChild(divider);

      // ── Content column
      const content = document.createElement('div');
      content.className = 'sch-strip-content';

      if (actualGames.length === 0) {
        // Rest-only day
        const row = document.createElement('div');
        row.className = 'sch-strip-game-row';
        row.innerHTML = `<span class="sch-strip-game">DESCANSO</span>`;
        content.appendChild(row);
      } else {
        actualGames.forEach(g => {
          const { startTimeStr } = parseStreamTime(g.time);
          const row = document.createElement('div');
          row.className = 'sch-strip-game-row';
          row.innerHTML = `
            <span class="sch-strip-game">${g.game.toUpperCase()}</span>
            <span class="sch-strip-time">${startTimeStr}</span>
          `;
          content.appendChild(row);
        });
      }
      strip.appendChild(content);

      // ── HOY badge (active day only)
      if (isToday) {
        const badge = document.createElement('span');
        badge.className = 'sch-strip-today';
        badge.textContent = 'HOY';
        strip.appendChild(badge);
      }

      container.appendChild(strip);
    });

    contentArea.appendChild(container);
  }


  // ─── INIT ─────────────────────────────────────────
  Object.values(SCHEDULE).flat().forEach(g => {
    if (g && g.game) preloadGameImage(g.game);
  });

  initAppController({
    renderScheduleCustom: (contentArea) => renderSchedule(contentArea)
  });

})();
