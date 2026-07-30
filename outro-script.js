/* ═══════════════════════════════════════════════════════
   CYBERPUNK 2077 STREAM OUTRO — outro-script.js
   Logica exclusiva del OUTRO: busqueda del siguiente
   stream + renderSchedule() con countdown. El resto
   viene de engine.js
   ═══════════════════════════════════════════════════════ */

import {
  CONFIG, SCHEDULE, MENU_ITEMS,
  getGameImage, formatDisplayName,
  initVideoBackground, renderMenu as engineRenderMenu,
  renderFeed, renderRecentStreams, renderPlaceholder,
  buildFeedQueue, isCacheValid, saveToCache, loadFromCache,
  fetchFromFirestore, updateRankingHistory,
} from './engine.js';

console.log('[OUTRO ENGINE] Script inicializado');

(function () {
  'use strict';
  console.log('[OUTRO ENGINE] IIFE en ejecucion');

  // ─── DOM REFS ───────────────────────────
  const menuList    = document.getElementById('menuList');
  const contentArea = document.getElementById('contentArea');

  // ─── STATE ──────────────────────────────
  let currentMenuIndex = 0;
  let allUsers = [];
  let recentStreams = [];
  let feedQueue = [];
  let countdownInterval = null;

  // ─── BACKGROUNDS (VIDEO) ────────────────
  initVideoBackground();

  // ─── MENU SYSTEM ────────────────────────
  function renderMenuLocal() {
    engineRenderMenu(menuList, currentMenuIndex);
  }

  function renderActiveContent() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    contentArea.innerHTML = '';
    const activeItem = MENU_ITEMS[currentMenuIndex];
    switch (activeItem.id) {
      case 'horario':  renderSchedule(); break;
      case 'topcanal': renderFeed(contentArea, allUsers); break;
      case 'item1':    renderRecentStreams(contentArea, recentStreams); break;
      default:         renderPlaceholder(contentArea, activeItem.title);
    }
  }

  // ─── LOGICA DE BUSQUEDA DEL SIGUIENTE STREAM ─────────────
  const dayKeys = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

  function findNextStream() {
    const now = new Date();
    const currentDayIndex = now.getDay() === 0 ? 7 : now.getDay();
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

    // Fallback: buscar en la semana siguiente
    if (!foundStream) {
      for (let offset = 7; offset < 14; offset++) {
        const checkDate = new Date(now);
        checkDate.setDate(now.getDate() + offset);
        const checkDayIndex = checkDate.getDay() === 0 ? 7 : checkDate.getDay();
        const dayKey = dayKeys[checkDayIndex - 1];
        const dayStreams = SCHEDULE[dayKey];

        if (dayStreams && dayStreams.length > 0) {
          const stream = dayStreams[0];
          const [startStr] = stream.time.split('-');
          const [startHour, startMin] = startStr.trim().split(':').map(Number);
          foundStream  = stream;
          targetDate   = new Date(checkDate);
          targetDate.setHours(startHour, startMin, 0, 0);
          targetOffset = offset;
          break;
        }
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
  function renderSchedule() {
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
    headerEl.style.fontFamily    = 'var(--font-mono)';
    headerEl.style.fontSize      = '1.3rem';
    headerEl.style.color         = 'var(--cyber-red)';
    headerEl.style.textShadow    = 'var(--glow-red)';
    headerEl.style.letterSpacing = '3px';
    headerEl.style.textTransform = 'uppercase';
    headerEl.textContent = '// ENLACE_NEURAL: SIGUIENTE TRANSMISION';
    container.appendChild(headerEl);

    // Caja de juego
    const gameDisplay = document.createElement('div');
    gameDisplay.className = 'sch-card active-day outro-version';

    const objectPositionStyle = stream.game.trim().toUpperCase() === 'DESCANSO' ? 'center 25%' : 'center';

    gameDisplay.innerHTML = `
      <img class="sch-card-img sch-new-img" data-game="${stream.game}" src="" style="object-position: ${objectPositionStyle};">
      <div class="sch-card-overlay"></div>
      <div class="sch-card-content">
        <h2 style="font-family: var(--font-title); font-size: 2.6rem; font-weight: 800; color: #fff; text-transform: uppercase; letter-spacing: 1px; text-shadow: 2px 2px 6px rgba(0,0,0,0.9); line-height: 1.1; margin-bottom: 12px; max-width: 65%;">
          ${stream.game}
        </h2>
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px;">
          <span style="font-family: var(--font-ui); font-size: 1.6rem; font-weight: 700; color: #fff; text-shadow: 1px 1px 4px rgba(0,0,0,0.9); text-transform: uppercase; letter-spacing: 1px;">
            ${formattedDay}
          </span>
          <span style="font-family: var(--font-mono); font-size: 2.1rem; font-weight: bold; color: var(--cyber-red); background: rgba(0,0,0,0.75); border: 1px solid var(--cyber-red); padding: 5px 16px; clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px); box-shadow: var(--glow-red);">
            ${startStr.trim()}
          </span>
        </div>
      </div>
    `;
    container.appendChild(gameDisplay);

    // Cargar imagen de RAWG API
    const img = gameDisplay.querySelector('.sch-card-img');
    getGameImage(stream.game).then(url => {
      if (url) {
        img.src = url;
        img.style.opacity = '0.55';
        img.style.transform = 'scale(1.06)';
      }
    });

    // Caja countdown
    const countdownBox = document.createElement('div');
    countdownBox.style.display        = 'flex';
    countdownBox.style.flexDirection  = 'column';
    countdownBox.style.alignItems     = 'center';
    countdownBox.style.padding        = '20px';
    countdownBox.style.background     = 'rgba(var(--cyber-red-rgb), 0.08)';
    countdownBox.style.border         = '1px solid rgba(var(--cyber-red-rgb), 0.2)';
    countdownBox.style.borderLeft     = '4px solid var(--cyber-red)';
    countdownBox.style.clipPath       = 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)';
    countdownBox.style.boxShadow      = '0 5px 15px rgba(0,0,0,0.2)';
    countdownBox.innerHTML = `
      <span style="font-family: var(--font-mono); font-size: 1rem; color: rgba(255,255,255,0.4); letter-spacing: 3px; text-transform: uppercase; margin-bottom: 5px;">
        TIEMPO PARA EL ENLACE
      </span>
      <div id="countdownClock" style="font-family: var(--font-mono); font-size: 3.2rem; font-weight: bold; color: #fff; letter-spacing: 2px; text-shadow: 0 0 15px rgba(255,255,255, 0.2), 0 0 10px rgba(var(--cyber-red-rgb), 0.3);">
        00d : 00h : 00m : 00s
      </div>
    `;
    container.appendChild(countdownBox);

    // Texto de despedida
    const bottomLog = document.createElement('div');
    bottomLog.style.fontFamily    = 'var(--font-mono)';
    bottomLog.style.fontSize      = '1.05rem';
    bottomLog.style.color         = 'rgba(255, 255, 255, 0.4)';
    bottomLog.style.display       = 'flex';
    bottomLog.style.alignItems    = 'center';
    bottomLog.style.gap           = '10px';
    bottomLog.style.letterSpacing = '1.5px';
    bottomLog.style.marginTop     = '10px';

    const logIndicator = document.createElement('span');
    logIndicator.style.width           = '8px';
    logIndicator.style.height          = '8px';
    logIndicator.style.backgroundColor = 'var(--cyber-red)';
    logIndicator.style.boxShadow       = 'var(--glow-red)';
    logIndicator.style.borderRadius    = '50%';
    logIndicator.style.animation       = 'logPulse 1.5s infinite ease-in-out';

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

  // ─── ROTACION DE MENU ────────────────────
  let menuTimer = null;
  function scheduleNextMenuRotation() {
    clearTimeout(menuTimer);
    menuTimer = setTimeout(rotateMenu, CONFIG.menuInterval);
  }

  function rotateMenu() {
    currentMenuIndex = (currentMenuIndex + 1) % MENU_ITEMS.length;
    renderMenuLocal();
    renderActiveContent();
    scheduleNextMenuRotation();
  }

  // ─── DATOS (Firestore + cache) ────────────
  function applyData(users, streams) {
    allUsers = users;
    updateRankingHistory(users);
    feedQueue = buildFeedQueue(allUsers);
    recentStreams = streams;
    renderActiveContent();
  }

  async function loadUsers() {
    try {
      if (isCacheValid()) {
        const { users, streams } = loadFromCache();
        if (users.length > 0) { applyData(users, streams); return; }
      }
      const { users, streams } = await fetchFromFirestore();
      saveToCache(users, streams);
      applyData(users, streams);
    } catch (err) {
      console.error('[OUTRO] Error loading data:', err);
      const { users, streams } = loadFromCache();
      if (users.length > 0) {
        applyData(users, streams);
      } else {
        renderPlaceholder(contentArea, 'ERROR DE CONEXION');
      }
    }
  }

  // ─── INIT ────────────────────────────────
  renderMenuLocal();
  renderActiveContent();
  scheduleNextMenuRotation();
  loadUsers();

})();
