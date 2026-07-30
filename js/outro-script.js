/* ═══════════════════════════════════════════════════════
   CYBERPUNK 2077 STREAM OUTRO — outro-script.js
   Lógica exclusiva del OUTRO: búsqueda del siguiente
   stream + renderSchedule() con countdown. El resto
   viene de engine.js
   ═══════════════════════════════════════════════════════ */

import {
  SCHEDULE,
  getGameImage, getGameImageSync, preloadGameImage,
  renderPlaceholder, initAppController
} from './engine.js';

console.log('[OUTRO ENGINE] Script inicializado');

(function () {
  'use strict';

  let countdownInterval = null;
  const dayKeys = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

  // ─── LOGICA DE BUSQUEDA DEL SIGUIENTE STREAM ─────────────
  function findNextStream() {
    const now = new Date();
    const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();

    let foundStream = null;
    let targetDate  = null;
    let targetOffset = 0;

    for (let offset = 0; offset < 7; offset++) {
      const checkDate = new Date(now);
      checkDate.setDate(now.getDate() + offset);
      const checkDayIndex = checkDate.getDay() === 0 ? 7 : checkDate.getDay();
      const dayKey = dayKeys[checkDayIndex - 1];
      const dayStreams = SCHEDULE[dayKey];

      if (dayStreams && dayStreams.length > 0) {
        for (const stream of dayStreams) {
          if (stream.game && stream.game.trim().toUpperCase() === 'DESCANSO') continue;

          const [startStr] = stream.time.split('-');
          const [startHour, startMin] = startStr.trim().split(':').map(Number);
          const streamTimeInMinutes = startHour * 60 + startMin;

          if (offset === 0 && streamTimeInMinutes <= currentTimeInMinutes) continue;

          foundStream  = stream;
          targetDate   = new Date(checkDate);
          targetDate.setHours(startHour, startMin, 0, 0);
          targetOffset = offset;
          break;
        }
      }
      if (foundStream) break;
    }

    if (!foundStream) {
      for (let offset = 7; offset < 14; offset++) {
        const checkDate = new Date(now);
        checkDate.setDate(now.getDate() + offset);
        const checkDayIndex = checkDate.getDay() === 0 ? 7 : checkDate.getDay();
        const dayKey = dayKeys[checkDayIndex - 1];
        const dayStreams = SCHEDULE[dayKey];

        if (dayStreams && dayStreams.length > 0) {
          for (const stream of dayStreams) {
            if (stream.game && stream.game.trim().toUpperCase() === 'DESCANSO') continue;

            const [startStr] = stream.time.split('-');
            const [startHour, startMin] = startStr.trim().split(':').map(Number);
            foundStream  = stream;
            targetDate   = new Date(checkDate);
            targetDate.setHours(startHour, startMin, 0, 0);
            targetOffset = offset;
            break;
          }
        }
        if (foundStream) break;
      }
    }

    return { stream: foundStream, date: targetDate, offset: targetOffset };
  }

  function formatNextStreamDay(date, offset) {
    if (offset === 0) return 'HOY';
    if (offset === 1) return 'MANANA';
    const days   = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
    const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
  }

  // ─── RENDER: HORARIO (exclusivo del outro — muestra el siguiente stream) ──
  function renderScheduleOutro(contentArea) {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }

    const { stream, date: targetDate, offset } = findNextStream();
    if (!stream) { renderPlaceholder(contentArea, 'SIN PROGRAMACION'); return; }

    const formattedDay = formatNextStreamDay(targetDate, offset);
    const [startStr]   = stream.time.split('-');

    const container = document.createElement('div');
    container.className = 'content-view-container feed-enter';
    container.style.gap = '25px';
    container.style.justifyContent = 'center';

    // Cabecera
    const headerEl = document.createElement('div');
    headerEl.className = 'sch-outro-header';
    headerEl.textContent = '// ENLACE_NEURAL: SIGUIENTE TRANSMISION';
    container.appendChild(headerEl);

    // Obtener la URL sincrónicamente (sin retardo)
    const syncUrl = getGameImageSync(stream.game);
    const objectPositionStyle = stream.game.trim().toUpperCase() === 'DESCANSO' ? 'center 25%' : 'center';

    // Caja de juego
    const gameDisplay = document.createElement('div');
    gameDisplay.className = 'sch-card active-day outro-version';

    gameDisplay.innerHTML = `
      <img class="sch-card-img sch-new-img" data-game="${stream.game}" src="${syncUrl}" style="object-position: ${objectPositionStyle}; ${syncUrl ? 'opacity: 0.55; transform: scale(1.06);' : ''}">
      <div class="sch-card-overlay"></div>
      <div class="sch-card-content">
        <h2 class="sch-outro-game-title">
          ${stream.game}
        </h2>
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px;">
          <span class="sch-outro-date">
            ${formattedDay}
          </span>
          <span class="sch-outro-time-badge">
            ${startStr.trim()}
          </span>
        </div>
      </div>
    `;
    container.appendChild(gameDisplay);

    // Fallback asíncrono si la imagen no estaba en la caché sincrónica inicial
    if (!syncUrl) {
      const img = gameDisplay.querySelector('.sch-card-img');
      getGameImage(stream.game).then(url => {
        if (url) {
          img.src = url;
          img.style.opacity = '0.55';
          img.style.transform = 'scale(1.06)';
        }
      });
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

    if (!document.getElementById('outroKeyframes')) {
      const style = document.createElement('style');
      style.id          = 'outroKeyframes';
      style.textContent = `
        @keyframes logPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.9); }
          50%       { opacity: 1;   transform: scale(1.1); }
        }
      `;
      document.head.appendChild(style);
    }

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
