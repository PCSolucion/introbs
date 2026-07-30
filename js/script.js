/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   STREAM INTRO â€” script.js
   Logica exclusiva de la INTRO: renderSchedule() con vista
   de semana completa. El resto viene de engine.js
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

import {
  CONFIG, SCHEDULE, DAY_NAMES, MENU_ITEMS,
  getTitle, getGameImage, formatDisplayName,
  initVideoBackground, renderMenu as engineRenderMenu,
  renderFeed, renderRecentStreams, renderPlaceholder,
  buildFeedQueue, isCacheValid, saveToCache, loadFromCache,
  fetchFromFirestore, updateRankingHistory,
} from './engine.js';

console.log('[ENGINE] Script inicializado');

(function () {
  'use strict';
  console.log('[ENGINE] IIFE en ejecucion');

  // â”€â”€â”€ DOM REFS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const menuList   = document.getElementById('menuList');
  const contentArea = document.getElementById('contentArea');

  // â”€â”€â”€ STATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let currentMenuIndex = 0;
  let allUsers = [];
  let recentStreams = [];

  // â”€â”€â”€ BACKGROUNDS (VIDEO) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  initVideoBackground();

  // â”€â”€â”€ MENU SYSTEM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function renderMenuLocal() {
    engineRenderMenu(menuList, currentMenuIndex);
  }

  function renderActiveContent() {
    contentArea.innerHTML = '';
    const activeItem = MENU_ITEMS[currentMenuIndex];
    switch (activeItem.id) {
      case 'horario':  renderSchedule(); break;
      case 'topcanal': renderFeed(contentArea, allUsers); break;
      case 'item1':    renderRecentStreams(contentArea, recentStreams); break;
      default:         renderPlaceholder(contentArea, activeItem.title);
    }
  }

  // â”€â”€â”€ RENDER: HORARIO (exclusivo de la intro) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function renderSchedule() {
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
      dayRow.className = 'feed-enter';
      dayRow.style.animationDelay = `${i * 0.1}s`;
      dayRow.style.display = 'flex';
      dayRow.style.alignItems = 'center';
      dayRow.style.gap = '30px';
      dayRow.style.flex = '1';
      dayRow.style.paddingBottom = '10px';

      const dayLabel = document.createElement('div');
      dayLabel.style.width = '125px';
      dayLabel.style.textAlign = 'right';
      dayLabel.style.flexShrink = '0';

      const isMiercoles = k === 'miercoles';
      const titleFontSize = isMiercoles ? (active ? '1.4rem' : '1.2rem') : (active ? '1.8rem' : '1.5rem');
      const dateFontSize  = isMiercoles ? (active ? '1.1rem' : '1rem')   : (active ? '1.5rem' : '1.2rem');

      dayLabel.innerHTML = `
        <div style="font-family: var(--font-title); font-size: ${titleFontSize}; font-weight: 800; color: #fff; letter-spacing: 1px; transition: all 0.3s ease; text-transform: uppercase; text-shadow: ${active ? '0 0 15px rgba(255,255,255, 0.5)' : 'none'};">
          ${DAY_NAMES[k]} <span style="font-family: var(--font-mono); font-size: ${dateFontSize}; color: ${active ? '#fff' : 'rgba(255,255,255,0.8)'};">${displayDate}</span>
        </div>
        ${active ? '<div style="font-family: var(--font-mono); font-size: 0.9rem; background: var(--accent-blue); color: #fff; padding: 2px 10px; display: inline-block; margin-top: 4px; font-weight: bold; letter-spacing: 1px; clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);">HOY</div>' : ''}
      `;
      dayRow.appendChild(dayLabel);

      const gamesCol = document.createElement('div');
      gamesCol.style.flex = '1';
      gamesCol.style.display = 'flex';
      gamesCol.style.gap = '30px';

      gamesList.forEach(g => {
        const gameCard = document.createElement('div');
        gameCard.className = `sch-card ${active ? 'active-day' : ''}`;

        const timeParts = g.time.split('-');
        const startTimeStr = timeParts[0] ? timeParts[0].trim() : g.time;
        const endTimeStr   = timeParts[1] ? timeParts[1].trim() : '';

        // Definimos el estilo de posiciÃ³n de la imagen de forma dinÃ¡mica solo para el object-position
        const objectPositionStyle = g.game.trim().toUpperCase() === 'DESCANSO' ? 'center 25%' : 'center';

        gameCard.innerHTML = `
          <img class="sch-card-img sch-new-img" data-game="${g.game}" data-active="${active}" src="" style="object-position: ${objectPositionStyle};">
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
      });

      dayRow.appendChild(gamesCol);
      scheduleContainer.appendChild(dayRow);
    });

    contentArea.appendChild(scheduleContainer);

    // Carga de imagenes async
    scheduleContainer.querySelectorAll('.sch-new-img').forEach(img => {
      const gameName = img.getAttribute('data-game');
      getGameImage(gameName).then(url => {
        if (url) {
          img.src = url;
          setTimeout(() => {
            img.style.opacity = '1';
            img.style.transform = 'scale(1.08)';
          }, 50);
        }
      });
    });
  }

  // â”€â”€â”€ ROTACION DE MENU â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€â”€ DATOS (Firestore + cache) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function applyData(users, streams) {
    allUsers = users;
    updateRankingHistory(users);
    recentStreams = streams;
    renderActiveContent();
  }

  async function loadUsers() {
    try {
      if (isCacheValid()) {
        console.log('[CACHE] Usando datos en cache (no se contacta Firebase)');
        const { users, streams } = loadFromCache();
        if (users.length > 0) { applyData(users, streams); return; }
        console.log('[CACHE] Cache vacia, forzando descarga...');
      }
      const { users, streams } = await fetchFromFirestore();
      saveToCache(users, streams);
      applyData(users, streams);
    } catch (err) {
      console.error('[INTRO] Error de Firestore:', err);
      const { users, streams } = loadFromCache();
      if (users.length > 0) {
        console.log('[CACHE] Usando cache expirada como fallback');
        applyData(users, streams);
      } else {
        renderPlaceholder(contentArea, 'ERROR DE CONEXION');
      }
    }
  }

  // â”€â”€â”€ INIT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  renderMenuLocal();
  renderActiveContent();
  scheduleNextMenuRotation();
  loadUsers();

})();
