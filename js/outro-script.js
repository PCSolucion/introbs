/* ═══════════════════════════════════════════════════════
   CYBERPUNK 2077 STREAM OUTRO — outro-script.js
   Lógica exclusiva del OUTRO: búsqueda del siguiente
   stream + renderSchedule() con countdown. El resto
   viene de engine.js
   ═══════════════════════════════════════════════════════ */

import {
  SCHEDULE, getDayKey,
  getGameImageSync, bindAsyncGameImage, preloadGameImage, parseStreamTime,
  renderPlaceholder, initAppController
} from './engine.js';

console.log('[OUTRO ENGINE] Script inicializado');

(function () {
  'use strict';

  let countdownInterval = null;

  // ─── LOGICA DE BUSQUEDA DEL SIGUIENTE STREAM ─────────────
  function findNextStream() {
    const now = new Date();
    const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();

    for (let offset = 0; offset < 14; offset++) {
      const checkDate = new Date(now);
      checkDate.setDate(now.getDate() + offset);
      const dayKey = getDayKey(checkDate);
      const dayStreams = dayKey ? SCHEDULE[dayKey] : null;

      if (!dayStreams || dayStreams.length === 0) continue;

      for (const stream of dayStreams) {
        if (stream.game && stream.game.trim().toUpperCase() === 'DESCANSO') continue;

        const { startHour, startMin } = parseStreamTime(stream.time);
        const streamTimeInMinutes = startHour * 60 + startMin;

        if (offset === 0 && streamTimeInMinutes <= currentTimeInMinutes) continue;

        const targetDate = new Date(checkDate);
        targetDate.setHours(startHour, startMin, 0, 0);

        return { stream, date: targetDate, offset };
      }
    }

    return { stream: null, date: null, offset: 0 };
  }

  function formatNextStreamDay(date, offset) {
    if (offset === 0) return 'HOY';
    if (offset === 1) return 'MANANA';
    const dayStr   = date.toLocaleDateString('es-ES', { weekday: 'long' }).toUpperCase();
    const monthStr = date.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');
    return `${dayStr} ${date.getDate()} ${monthStr}`;
  }

  // ─── RENDER: HORARIO (exclusivo del outro — muestra el siguiente stream) ──
  function renderScheduleOutro(contentArea) {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }

    const { stream, date: targetDate, offset } = findNextStream();
    if (!stream) { renderPlaceholder(contentArea, 'SIN PROGRAMACION'); return; }

    const formattedDay = formatNextStreamDay(targetDate, offset);
    const { startTimeStr } = parseStreamTime(stream.time);

    const container = document.createElement('div');
    container.className = 'content-view-container feed-enter sch-outro-container';

    // Cabecera
    const headerEl = document.createElement('div');
    headerEl.className = 'sch-outro-header';
    headerEl.textContent = '// ENLACE_NEURAL: SIGUIENTE TRANSMISION';
    container.appendChild(headerEl);

    // Obtener la URL sincrónicamente (sin retardo)
    const syncUrl = getGameImageSync(stream.game);
    const isDescanso = stream.game.trim().toUpperCase() === 'DESCANSO';

    // Caja de juego
    const gameDisplay = document.createElement('div');
    gameDisplay.className = 'sch-card active-day outro-version';

    gameDisplay.innerHTML = `
      <img class="sch-card-img sch-new-img ${isDescanso ? 'descanso' : ''}" data-game="${stream.game}" src="${syncUrl}" style="${syncUrl ? 'opacity: 0.55; transform: scale(1.06);' : ''}">
      <div class="sch-card-overlay"></div>
      <div class="sch-card-content">
        <h2 class="sch-outro-game-title">
          ${stream.game}
        </h2>
        <div class="sch-card-footer">
          <span class="sch-outro-date">
            ${formattedDay}
          </span>
          <span class="sch-outro-time-badge">
            ${startTimeStr}
          </span>
        </div>
      </div>
    `;
    container.appendChild(gameDisplay);

    // Fallback asíncrono si la imagen no estaba en la caché sincrónica inicial
    if (!syncUrl) {
      bindAsyncGameImage(gameDisplay.querySelector('.sch-card-img'), stream.game, '0.55', 'scale(1.06)');
    }

    // Caja countdown
    const countdownBox = document.createElement('div');
    countdownBox.className = 'sch-countdown-container';
    countdownBox.innerHTML = `
      <span class="sch-countdown-label">
        TIEMPO PARA EL ENLACE
      </span>
      <div id="countdownClock" class="sch-countdown-clock">
        00d : 00h : 00m : 00s
      </div>
    `;
    container.appendChild(countdownBox);

    // Texto de despedida
    const bottomLog = document.createElement('div');
    bottomLog.className = 'sch-outro-footer';

    const logIndicator = document.createElement('span');
    logIndicator.className = 'sch-outro-pulse-indicator';

    bottomLog.appendChild(logIndicator);
    const textSpan = document.createElement('span');
    textSpan.textContent = 'GRACIAS POR ACOMPANARME EN EL VIAJE, CHOOMS_';
    bottomLog.appendChild(textSpan);
    container.appendChild(bottomLog);

    contentArea.appendChild(container);

    // Countdown tick
    function updateCountdown() {
      const clock = document.getElementById('countdownClock');
      if (!clock) return;
      const now    = new Date();
      const diffMs = targetDate - now;
      if (diffMs <= 0) { clock.textContent = '00d : 00h : 00m : 00s'; return; }
      const days    = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours   = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
      clock.textContent = `${String(days).padStart(2,'0')}d : ${String(hours).padStart(2,'0')}h : ${String(minutes).padStart(2,'0')}m : ${String(seconds).padStart(2,'0')}s`;
    }

    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
  }

  // ─── INIT ─────────────────────────────────────────
  const nextStreamInfo = findNextStream();
  if (nextStreamInfo && nextStreamInfo.stream) {
    preloadGameImage(nextStreamInfo.stream.game);
  }

  initAppController({
    onBeforeRenderContent: () => {
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
    },
    renderScheduleCustom: (contentArea) => renderScheduleOutro(contentArea)
  });

})();
