/* ═══════════════════════════════════════════════════════
   CYBERPUNK 2077 STREAM INTRO — ENGINE + FIRESTORE
   Conecta en tiempo real con Firestore para mostrar
   datos de la comunidad (niveles, XP, rachas, logros)
   ═══════════════════════════════════════════════════════ */

import { db } from './firebase.js';
import { collection, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js';
import { RAWG_API_KEY } from './api-keys.js';

console.log('[ENGINE] Script inicializado');

(function () {
  'use strict';
  console.log('[ENGINE] IIFE en ejecución');

  // ─── TITLES (matching LevelCalculator) ──
  const LEVEL_TITLES = {
    1: 'CIVILIAN', 5: 'ROOKIE', 10: 'MERCENARY',
    15: 'SOLO', 20: 'NETRUNNER', 30: 'FIXER',
    40: 'CORPO', 50: 'NIGHT CITY LEGEND', 60: 'CYBERPSYCHO',
    70: 'MAXTAC', 80: 'TRAUMA TEAM', 90: 'AFTERLIFE LEGEND',
    100: 'CHOOMBA SUPREME'
  };
  function getTitle(level) {
    const keys = Object.keys(LEVEL_TITLES).map(Number).sort((a, b) => b - a);
    for (const k of keys) { if (level >= k) return LEVEL_TITLES[k]; }
    return `EDGE RUNNER LVL ${level}`;
  }

  const CONFIG = {
    backgrounds: [
      'fondos/isabela.mp4', 'fondos/bloodborne.mp4', 'fondos/ciri.mp4', 'fondos/claire.mp4',
      'fondos/geral.mp4', 'fondos/grace.mp4', 'fondos/gustave.mp4', 'fondos/jill.mp4',
      'fondos/karlach.mp4', 'fondos/laezel.mp4', 'fondos/leon.mp4', 'fondos/lune.mp4',
      'fondos/maelle.mp4', 'fondos/senua.mp4', 'fondos/shadow.mp4', 'fondos/triss.mp4', 'fondos/yenn.mp4', 'fondos/kratos.mp4', 'fondos/mrx.mp4', 'fondos/panam.mp4', 'fondos/jynx.mp4', 'fondos/claire2.mp4', 'fondos/sciel.mp4', 'fondos/samu.mp4'
    ].sort(() => Math.random() - 0.5),
    bgInterval: 15000,
    menuInterval: 20000, 
    countdownMinutes: 5, // Duración de la cuenta atrás
  };

  const gameImageCache = {};

  async function getGameImage(gameName) {
    if (!gameName) return '';
    if (gameName.trim().toUpperCase() === 'DESCANSO') {
      return 'fondos/descanso.png';
    }
    if (gameImageCache[gameName]) return gameImageCache[gameName];
    try {
      const res = await fetch(`https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(gameName)}&page_size=1`);
      const data = await res.json();
      if (data.results && data.results.length > 0 && data.results[0].background_image) {
        gameImageCache[gameName] = data.results[0].background_image;
        return data.results[0].background_image;
      }
    } catch (e) {
      console.error('Error fetching game image', e);
    }
    return '';
  }

  // Estructura fácil de modificar: un arreglo de juegos por cada día
  const SCHEDULE = {
    lunes:    [ { game: 'Once Human', time: '15:00' }, { game: 'Assasins Creed Origins', time: '22:00' } ],
    martes:   [ { game: 'Once Human', time: '15:00' }, { game: 'DESCANSO', time: '22:00' } ],
    miercoles:[ { game: 'Once Human', time: '15:00' }, { game: 'Assasins Creed Origins', time: '22:00' } ],
    jueves:   [ { game: 'New World', time: '15:00' }, { game: 'Assasins Creed Origins', time: '22:00' } ],
    viernes:  [ { game: 'DESCANSO', time: '' }, { game: 'Assasins Creed Origins', time: '22:00' } ],
  };
  const DAY_NAMES = {
    lunes: 'LUNES', martes: 'MARTES', miercoles: 'MIÉRCOLES',
    jueves: 'JUEVES', viernes: 'VIERNES',
  };

  const MENU_ITEMS = [
    { id: 'horario',   title: 'HORARIOS',   sub: 'Stream Schedule' },
    { id: 'topcanal',  title: 'TOP',        sub: 'Community Feed' },
    { id: 'item1',     title: 'ÚLTIMOS DIRECTOS', sub: 'Archive' },
    { id: 'item2',     title: 'SUSCRIPTORES', sub: 'VETERANOS' },
  ];

  // ─── DOM REFS ───────────────────────────
  const menuList = document.getElementById('menuList');
  const contentArea = document.getElementById('contentArea');

  // ─── STATE ──────────────────────────────
  let currentMenuIndex = 0;
  let allUsers = [];
  let recentStreams = [];
  let veteransIndex = 0;
  let feedQueue = [];
  let feedIndex = 0;

  // ─── BACKGROUNDS (VIDEO) ────────────────
  const v1 = document.getElementById('bgVideo1');
  const v2 = document.getElementById('bgVideo2');
  let activeV = v1;
  let nextV = v2;
  let bgi = 0;

  activeV.src = CONFIG.backgrounds[bgi];
  activeV.playbackRate = CONFIG.backgrounds[bgi] === 'fondos/isabela.mp4' ? 0.5 : 1.0;
  activeV.play().catch(e => console.log('Autoplay blocked initially:', e));
  bgi = (bgi + 1) % CONFIG.backgrounds.length;

  function switchVideo() {
    const videoFile = CONFIG.backgrounds[bgi];
    nextV.onerror = () => {
      nextV.removeEventListener('loadeddata', onLoaded);
      bgi = (bgi + 1) % CONFIG.backgrounds.length;
      setTimeout(switchVideo, 500);
    };
    async function onLoaded() {
      nextV.removeEventListener('loadeddata', onLoaded);
      nextV.onerror = null;
      try {
        nextV.playbackRate = videoFile === 'fondos/isabela.mp4' ? 0.5 : 1.0;
        await nextV.play();
        nextV.style.opacity = '1';
        activeV.style.opacity = '0';
        const oldV = activeV;
        setTimeout(() => { if (oldV !== activeV) oldV.pause(); }, 1600);
        [activeV, nextV] = [nextV, activeV];
        bgi = (bgi + 1) % CONFIG.backgrounds.length;
      } catch (err) {
        bgi = (bgi + 1) % CONFIG.backgrounds.length;
        setTimeout(switchVideo, 1000);
      }
    }
    nextV.addEventListener('loadeddata', onLoaded);
    nextV.src = videoFile;
    nextV.load();
  }
  setInterval(switchVideo, CONFIG.bgInterval);

  // ─── MENU SYSTEM ────────────────────────
  function renderMenu() {
    menuList.innerHTML = '';
    MENU_ITEMS.forEach((item, idx) => {
      const active = idx === currentMenuIndex;
      const el = document.createElement('div');
      el.className = `card-item${active ? ' active' : ''}`;
      el.innerHTML = `
        <div class="card-info">
          <span class="card-title">${item.title}</span>
          <span class="card-sub">${item.sub}</span>
        </div>
      `;

      menuList.appendChild(el);
    });
  }

  function renderActiveContent() {
    contentArea.innerHTML = '';
    const activeItem = MENU_ITEMS[currentMenuIndex];

    switch (activeItem.id) {
      case 'horario':  renderSchedule(); break;
      case 'topcanal': renderFeed(); break;
      case 'item1':    renderRecentStreams(); break;
      case 'item2':    
        // Al entrar en la sección, reiniciamos el índice para que empiece desde el principio
        // Nota: Si quieres que rote MIENTRAS está la sección fija, no lo reinicies aquí. 
        // Pero como el menú rota, al volver siempre empezará de cero.
        veteransIndex = 0; 
        renderVeterans(); 
        break;
      default: renderPlaceholder(activeItem.title);
    }
  }

  // Helper para formatear nombres (limpieza de guiones bajos específicos y mayúsculas)
  function formatDisplayName(u) {
    let name = (u.displayName || u._id || 'UNKNOWN').toUpperCase();
    if (name === 'C_H_A_N_D_A_L_F') return 'CHANDALF';
    return name;
  }



  // Helper para extraer los meses de suscripción probando múltiples nombres de campo
  function getSubMonths(u) {
    return u.subMonths || u.months || u.sub_months || u.monthsSubscribed
      || u.tenure || u.subCount || u.subscriptionMonths || u.totalMonths
      || u.cumulative_months || u.cumulativeMonths || 0;
  }

  function renderVeterans() {
    if (allUsers.length === 0) {
      renderPlaceholder('CARGANDO DATOS...');
      return;
    }
    // Todos los que tengan al menos 1 mes (sin liiukiin)
    const filtered = allUsers.filter(u => {
      const name = (u.displayName || u._id || '').toLowerCase();
      return name !== 'liiukiin' && getSubMonths(u) > 0;
    });
    
    // Ordenar por meses
    const sorted = [...filtered].sort((a, b) => getSubMonths(b) - getSubMonths(a));

    if (sorted.length === 0) {
      renderPlaceholder('SIN DATOS DE SUBS');
      return;
    }

    const MAX = 5;
    const chunk = sorted.slice(veteransIndex, veteransIndex + MAX);

    chunk.forEach((u, i) => {
      const row = document.createElement('div');
      row.className = `schedule-row feed-enter ${i === 0 ? 'active' : ''}`;
      row.style.animationDelay = `${i * 0.1}s`;
      const name = formatDisplayName(u);
      const months = getSubMonths(u);
      const title = getTitle(u.level || 1);

      row.innerHTML = `
        <div class="sch-day-box">
          <span class="sch-day-short">#${veteransIndex + i + 1}</span>
        </div>
        <div class="sch-main-info">
          <div class="sch-header">
            <span class="sch-time">${name}</span>
            <span class="sch-badge">${months} MESES</span>
          </div>
          <span class="sch-game">${title}</span>
        </div>
        <div class="sch-decor">SUB_0${veteransIndex + i + 1}</div>
      `;
      contentArea.appendChild(row);
    });
  }

  function renderRecentStreams() {
    if (recentStreams.length === 0) {
      renderPlaceholder('CARGANDO ARCHIVOS...');
      return;
    }
    recentStreams.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = `schedule-row feed-enter ${i === 0 ? 'active' : ''}`;
      row.style.animationDelay = `${i * 0.1}s`;
      
      // Intentamos obtener la fecha de varios posibles campos
      let dateObj = null;
      const rawDate = s.date || s.timestamp || s.createdAt || s.fecha || s._docId;
      if (rawDate?.toDate) dateObj = rawDate.toDate();
      else if (rawDate) {
        // Si el formato es por ejemplo "2024-03-05", Date lo entenderá
        dateObj = new Date(rawDate);
      }
      
      const dateStr = dateObj && !isNaN(dateObj) 
        ? dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) 
        : '--/--';

      const title = (s._resolvedTitle || s.title || s.name || s.nombre || s.titulo || s.streamTitle || s.stream_title || s.label || 'SIN TÍTULO').toUpperCase();
      const category = (s.category || s.game || s.categoria || 'VARIEDAD').toUpperCase();

      row.innerHTML = `
        <div class="sch-day-box">
          <span class="sch-day-short">${dateStr}</span>
        </div>
        <div class="sch-main-info">
          <div class="sch-header">
            <span class="sch-time">${title}</span>
            <span class="sch-badge">ARCHIVE</span>
          </div>
          <span class="sch-game">${category}</span>
        </div>
        <div class="sch-decor">DB_X${i + 1}</div>
      `;
      contentArea.appendChild(row);
    });
  }

  function renderSchedule() {
    const today = new Date();
    let todayIdx = today.getDay(); // 0 is Sunday, 1 is Monday...
    if (todayIdx === 0) todayIdx = 7; // Si es domingo, lo contamos como 7 para la lógica de la semana

    // Calculamos el lunes de esta semana
    const mondayDate = new Date(today);
    mondayDate.setDate(today.getDate() - (todayIdx - 1));

    const dayKeys = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
    const todayKey = dayKeys[todayIdx - 1] || null;

    // Obtenemos los números de día del mes y el nombre del mes para cada día
    // Si el día de la semana ya ha pasado, mostramos la fecha de la semana siguiente (+7 días)
    const weekDates = dayKeys.map((key, index) => {
       const d = new Date(mondayDate);
       let dayOffset = index;
       if (index + 1 < todayIdx) {
         dayOffset += 7;
       }
       d.setDate(mondayDate.getDate() + dayOffset);
       const dayStr = d.getDate().toString().padStart(2, '0');
       let monthStr = d.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');
       return { day: dayStr, month: monthStr };
    });

    // Contenedor maestro con un nuevo diseño que ocupa todo el alto
    const scheduleContainer = document.createElement('div');
    scheduleContainer.style.display = 'flex';
    scheduleContainer.style.flexDirection = 'column';
    scheduleContainer.style.padding = '0 20px 20px 0';
    
    // TRUCO: Subimos el contenedor para aprovechar todo el alto de la pantalla
    scheduleContainer.style.marginTop = '-260px'; // Subido mucho mas para ganar espacio
    scheduleContainer.style.height = 'calc(100vh - 80px)'; // Aumentamos el alto disponible
    scheduleContainer.style.justifyContent = 'space-between'; // Distribuir filas uniformemente

    Object.entries(SCHEDULE).forEach(([k, gamesList], i) => {
      const active = k === todayKey;
      const dateObj = weekDates[i]; 
      // Mostramos solo el número si es HOY, y el número + mes si es otro día
      const displayDate = active ? dateObj.day : `${dateObj.day} ${dateObj.month}`;
      
      const dayRow = document.createElement('div');
      dayRow.className = 'feed-enter';
      dayRow.style.animationDelay = `${i * 0.1}s`;
      dayRow.style.display = 'flex';
      dayRow.style.alignItems = 'center';
      dayRow.style.gap = '30px'; // Separación horizontal entre etiqueta y cartas
      dayRow.style.flex = '1'; // Hace que cada día ocupe una fracción del alto total
      dayRow.style.paddingBottom = '10px'; // Reducimos la separación vertical para que quepan todos los días

      // Etiqueta del día (Izquierda)
      const dayLabel = document.createElement('div');
      dayLabel.style.width = '125px'; // Reducido de 140px
      dayLabel.style.textAlign = 'right';
      dayLabel.style.flexShrink = '0';

      // Ajustar dinámicamente el tamaño de fuente. Miércoles es más largo y necesita letra más pequeña.
      const isMiercoles = k === 'miercoles';
      const titleFontSize = isMiercoles ? (active ? '1.4rem' : '1.2rem') : (active ? '1.8rem' : '1.5rem');
      const dateFontSize = isMiercoles ? (active ? '1.1rem' : '1rem') : (active ? '1.5rem' : '1.2rem');

      dayLabel.innerHTML = `
        <div style="font-family: var(--font-title); font-size: ${titleFontSize}; font-weight: 800; color: #fff; letter-spacing: 1px; transition: all 0.3s ease; text-transform: uppercase; text-shadow: ${active ? '0 0 15px rgba(255,255,255, 0.5)' : 'none'};">
          ${DAY_NAMES[k]} <span style="font-family: var(--font-mono); font-size: ${dateFontSize}; color: ${active ? '#fff' : 'rgba(255,255,255,0.8)'};">${displayDate}</span>
        </div>
        ${active ? '<div style="font-family: var(--font-mono); font-size: 0.9rem; background: var(--cyber-red); color: #fff; padding: 2px 10px; display: inline-block; margin-top: 4px; font-weight: bold; letter-spacing: 1px; clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);">HOY</div>' : ''}
      `;
      dayRow.appendChild(dayLabel);

      // Contenedor de juegos (Derecha)
      const gamesCol = document.createElement('div');
      gamesCol.style.flex = '1';
      gamesCol.style.display = 'flex';
      gamesCol.style.gap = '30px'; // Separación horizontal entre cartas del mismo día

      gamesList.forEach(g => {
        const gameCard = document.createElement('div');
        gameCard.style.flex = '1';
        gameCard.style.height = '100%'; // Ocupa toda la altura disponible de su fila
        gameCard.style.minHeight = '180px'; // Un poco menos de 200px para asegurar que quepan 5 días en 1080p
        gameCard.style.position = 'relative';
        gameCard.style.background = 'transparent'; // Quitamos el fondo negro
        gameCard.style.boxShadow = active ? '0 0 25px rgba(var(--cyber-red-rgb), 0.2)' : 'none'; // Sin sombra oscura artificial en los inactivos
        // Esquinas biseladas para toque tech
        gameCard.style.clipPath = 'polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px)';

        const timeParts = g.time.split('-');
        const startTimeStr = timeParts[0] ? timeParts[0].trim() : g.time;
        const endTimeStr = timeParts[1] ? timeParts[1].trim() : '';

        gameCard.innerHTML = `
          <!-- Imagen con efecto de zoom suave al cargar -->
          <img class="sch-new-img" data-game="${g.game}" data-active="${active}" src="" style="
            position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: ${g.game.trim().toUpperCase() === 'DESCANSO' ? 'center 25%' : 'center'}; opacity: 0; transition: opacity 0.8s ease, transform 15s linear; transform: scale(1);
          ">
          <!-- Degradado inferior para resaltar texto -->
          <div style="
            position: absolute; inset: 0;
            background: linear-gradient(0deg, rgba(5,5,10,0.95) 0%, rgba(5,5,10,0.4) 50%, transparent 100%);
          "></div>
          
          <!-- Contenido -->
          <div style="
            position: absolute; bottom: 0; left: 0; right: 0; padding: 10px 20px;
            display: flex; justify-content: space-between; align-items: flex-end;
          ">
            <!-- Título -->
            <div style="display: flex; flex-direction: column; max-width: 65%;">
              <span style="font-family: var(--font-title); font-size: 1.5rem; font-weight: 800; color: #fff; text-shadow: 2px 2px 5px rgba(0,0,0,1); letter-spacing: 1px; line-height: 1.1;">
                ${g.game}
              </span>
            </div>
            <!-- Etiqueta de Hora -->
            <div style="
              background: rgba(0, 0, 0, 0.7);
              border: 1px solid ${active ? 'var(--cyber-red)' : 'rgba(255,255,255,0.4)'};
              padding: 6px 14px;
              font-family: var(--font-mono);
              color: ${active ? 'var(--cyber-red)' : '#fff'};
              backdrop-filter: blur(8px);
              clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
              box-shadow: ${active ? '0 0 12px rgba(var(--cyber-red-rgb), 0.4)' : 'none'};
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              line-height: 1;
            ">
              <span style="font-size: 1.8rem; font-weight: bold;">${startTimeStr}</span>
              ${endTimeStr ? `<span style="font-size: 0.9rem; font-weight: bold; opacity: 0.8; margin-top: 3px; letter-spacing: 2px;">${endTimeStr}</span>` : ''}
            </div>
          </div>
          <!-- Borde decorativo superior -->
          <div style="position: absolute; top: 0; left: 0; width: 100%; height: 3px; background: ${active ? 'var(--cyber-red)' : 'rgba(255,255,255,0.1)'};"></div>
        `;
        gamesCol.appendChild(gameCard);
      });

      dayRow.appendChild(gamesCol);
      scheduleContainer.appendChild(dayRow);
    });

    contentArea.appendChild(scheduleContainer);

    const imgElements = scheduleContainer.querySelectorAll('.sch-new-img');
    imgElements.forEach(img => {
      const gameName = img.getAttribute('data-game');
      const isActiveDay = img.getAttribute('data-active') === 'true';
      getGameImage(gameName).then(url => {
        if (url) {
          img.src = url;
          // Pequeño truco para que haga zoom muy lento continuamente
          setTimeout(() => {
            img.style.opacity = '1'; // Todas las imágenes totalmente visibles
            img.style.transform = 'scale(1.08)';
          }, 50);
        }
      });
    });
  }


  function renderFeed() {
    if (allUsers.length === 0) {
      renderPlaceholder('CARGANDO DATOS...');
      return;
    }
    
    // Top 10 por nivel y XP (excluir liiukiin)
    const filtered = allUsers.filter(u => (u.displayName || u._id || '').toLowerCase() !== 'liiukiin');
    const sorted = [...filtered].sort((a, b) => {
      const lvlDiff = (b.level || 1) - (a.level || 1);
      if (lvlDiff !== 0) return lvlDiff;
      return (b.xp || 0) - (a.xp || 0);
    });
    const top10 = sorted.slice(0, 10);
    
    let prevRankingArray = [];
    try {
      const storedPrev = localStorage.getItem('introbs_prev_ranking');
      if (storedPrev) {
        prevRankingArray = JSON.parse(storedPrev);
      }
    } catch (e) {
      console.error('Error parsing prev ranking in renderFeed:', e);
    }
    
    // Contenedor maestro para subir el TOP verticalmente y ocupar el mismo espacio que el horario
    const feedContainer = document.createElement('div');
    feedContainer.style.display = 'flex';
    feedContainer.style.flexDirection = 'column';
    feedContainer.style.padding = '0 20px 20px 0';
    feedContainer.style.marginTop = '-260px'; // TRUCO: Subimos el contenedor para aprovechar todo el alto
    feedContainer.style.height = 'calc(100vh - 80px)';
    feedContainer.style.justifyContent = 'space-between';

    top10.forEach((u, i) => {
      const row = document.createElement('div');
      row.className = `schedule-row top-row feed-enter ${i === 0 ? 'active' : ''}`;
      row.style.animationDelay = `${i * 0.08}s`;
      row.style.marginBottom = '0'; // Sin margen inferior porque usamos space-between
      
      const name = formatDisplayName(u);
      const lvl = u.level || 1;
      const title = getTitle(lvl);
      
      // Calcular cambios de rango
      const currentUserId = u._id || u.displayName;
      const currentRank = i + 1;
      const prevRankIndex = prevRankingArray.indexOf(currentUserId);
      
      let changeHTML = '';
      if (prevRankIndex === -1) {
        changeHTML = `<span class="rank-change-indicator rank-new">NEW</span>`;
      } else {
        const prevRank = prevRankIndex + 1;
        const diff = prevRank - currentRank;
        if (diff > 0) {
          changeHTML = `<span class="rank-change-indicator rank-up">▲ ${diff}</span>`;
        } else if (diff < 0) {
          changeHTML = `<span class="rank-change-indicator rank-down">▼ ${Math.abs(diff)}</span>`;
        } else {
          changeHTML = `<span class="rank-change-indicator rank-equal">▪</span>`;
        }
      }
      
      row.innerHTML = `
        <div class="top-rank-col">
          <span class="top-rank-num">#${i + 1}</span>
          ${changeHTML}
        </div>
        <div class="top-info-col">
          <span class="top-name">${name}</span>
          <span class="top-title">${title}</span>
        </div>
        <div class="top-level-col">
          <span class="top-level-val">LVL ${lvl}</span>
          <span class="top-level-lbl">STATUS DATA</span>
        </div>
      `;
      feedContainer.appendChild(row);
    });
    contentArea.appendChild(feedContainer);
  }

  function renderPlaceholder(title) {
    const el = document.createElement('div');
    el.className = 'placeholder-card feed-enter';
    el.innerHTML = `
      <div class="ph-header">
        <span class="ph-code">OFFSET_ERR // ${Math.random().toString(16).substring(2,6).toUpperCase()}</span>
        <span class="ph-title">${title}</span>
      </div>
      <div class="ph-body">
        <div class="ph-glitch-line"></div>
        <p>ENLACE NEURAL INTERRUMPIDO. RECONECTANDO CON EL SECTOR...</p>
      </div>
    `;
    contentArea.appendChild(el);
  }


  let menuTimer = null;
  function scheduleNextMenuRotation() {
    clearTimeout(menuTimer);
    menuTimer = setTimeout(rotateMenu, CONFIG.menuInterval);
  }

  function rotateMenu() {
    const activeItem = MENU_ITEMS[currentMenuIndex];

    // Incrementamos los índices de paginación AL SALIR de la sección,
    // así la próxima vez que volvamos mostrará el siguiente grupo.
    if (activeItem.id === 'topcanal') {
      feedIndex = (feedIndex + 5) % feedQueue.length;
    }
    if (activeItem.id === 'item2') {
      const filtered = allUsers.filter(u => {
        const name = (u.displayName || u._id || '').toLowerCase();
        return name !== 'liiukiin' && (u.subMonths || u.months || 0) > 0;
      });
      if (filtered.length > 0) {
        veteransIndex = (veteransIndex + 5) % filtered.length;
      }
    }

    // Avanzamos al siguiente elemento del menú principal
    currentMenuIndex = (currentMenuIndex + 1) % MENU_ITEMS.length;

    renderMenu();
    renderActiveContent();
    scheduleNextMenuRotation();
  }

  scheduleNextMenuRotation();

  // ─── FIRESTORE LOGIC ───────────────────
  const PHRASES = {
    topXP: ['El mercenario con más XP en Night City', 'Nadie acumula más datos que este choom', 'Leyenda cargada en el sistema'],
    topMessages: ['Feed del chat sobrecalentado por', 'Máxima actividad neural detectada', 'Señal más fuerte en la red'],
    topStreak: ['Racha imparable en la red neural', 'Conexión ininterrumpida al sistema', 'Enlace más estable del sector'],
    topLevel: ['Rango más alto registrado en el sistema', 'Implantes al máximo nivel', 'Netrunner de élite confirmado'],
    topWatchTime: ['Vigilante permanente del feed', 'Conexión prolongada al satélite', 'Tiempo de enlace máximo registrado'],
    userCard: ['Perfil escaneado vía Kiroshi MK.V', 'Datos del agente extraídos', 'Identidad verificada por NetWatch', 'Implante neural sincronizado', 'Archivo de operativo recuperado'],
  };
  function randPhrase(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function formatNum(n) { if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'; if (n >= 1000) return (n / 1000).toFixed(1) + 'K'; return n.toString(); }
  function formatTime(minutes) { if (!minutes) return '0h'; const h = Math.floor(minutes / 60); const m = minutes % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; }

  function buildFeedQueue(users) {
    const queue = [];
    if (users.length === 0) return queue;
    const byXP = [...users].sort((a, b) => (b.xp || 0) - (a.xp || 0));
    const byMsgs = [...users].sort((a, b) => (b.totalMessages || 0) - (a.totalMessages || 0));
    const byStreak = [...users].sort((a, b) => (b.streakDays || 0) - (a.streakDays || 0));
    const byLevel = [...users].sort((a, b) => (b.level || 1) - (a.level || 1));
    const byWatch = [...users].sort((a, b) => (b.watchTimeMinutes || 0) - (a.watchTimeMinutes || 0));
    if (byXP[0] && byXP[0].xp > 0) queue.push({ title: formatDisplayName(byXP[0]), sub: randPhrase(PHRASES.topXP), value: formatNum(byXP[0].xp) + ' XP', highlight: true, badgeText: 'TOP 1 XP' });
    if (byMsgs[0] && byMsgs[0].totalMessages > 0) queue.push({ title: formatDisplayName(byMsgs[0]), sub: randPhrase(PHRASES.topMessages), value: formatNum(byMsgs[0].totalMessages) + ' MSG', highlight: false, badgeText: 'TOP CHAT' });
    if (byStreak[0] && byStreak[0].streakDays > 0) queue.push({ title: formatDisplayName(byStreak[0]), sub: randPhrase(PHRASES.topStreak), value: byStreak[0].streakDays + ' DÍAS', highlight: false, badgeText: 'RACHA' });
    if (byLevel[0] && byLevel[0].level > 1) queue.push({ title: formatDisplayName(byLevel[0]), sub: getTitle(byLevel[0].level) + ' — ' + randPhrase(PHRASES.topLevel), value: 'LVL ' + byLevel[0].level, highlight: true, badgeText: 'MAX RANK' });
    if (byWatch[0] && byWatch[0].watchTimeMinutes > 0) queue.push({ title: formatDisplayName(byWatch[0]), sub: randPhrase(PHRASES.topWatchTime), value: formatTime(byWatch[0].watchTimeMinutes), highlight: false, badgeText: 'LURKER' });
    const shuffled = [...users].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(5, shuffled.length); i++) {
      const u = shuffled[i]; if (!u || (u.level || 1) < 2) continue;
      queue.push({ title: formatDisplayName(u), sub: getTitle(u.level || 1) + ' · ' + randPhrase(PHRASES.userCard), value: 'LVL ' + (u.level || 1), highlight: false, badgeText: null });
    }
    return queue;
  }

  // ─── CACHE SYSTEM (localStorage) ──────
  // Expiración: 1 hora en milisegundos (para mantener datos de subs actualizados)
  const CACHE_TTL = 1 * 60 * 60 * 1000;
  const CACHE_KEY_USERS = 'introbs_cache_users_v4';
  const CACHE_KEY_STREAMS = 'introbs_cache_streams_v4';
  const CACHE_KEY_TIMESTAMP = 'introbs_cache_ts_v4';

  function isCacheValid() {
    const ts = localStorage.getItem(CACHE_KEY_TIMESTAMP);
    if (!ts) return false;
    const age = Date.now() - Number(ts);
    console.log(`[CACHE] Antigüedad: ${(age / 3600000).toFixed(1)}h — TTL: ${CACHE_TTL / 3600000}h`);
    return age < CACHE_TTL;
  }

  function saveToCache(users, streams) {
    try {
      localStorage.setItem(CACHE_KEY_USERS, JSON.stringify(users));
      localStorage.setItem(CACHE_KEY_STREAMS, JSON.stringify(streams));
      localStorage.setItem(CACHE_KEY_TIMESTAMP, String(Date.now()));
      console.log(`[CACHE] Datos guardados — ${users.length} usuarios, ${streams.length} streams`);
    } catch (e) {
      console.warn('[CACHE] Error al guardar en localStorage:', e);
    }
  }

  function loadFromCache() {
    try {
      const users = JSON.parse(localStorage.getItem(CACHE_KEY_USERS) || '[]');
      const streams = JSON.parse(localStorage.getItem(CACHE_KEY_STREAMS) || '[]');
      console.log(`[CACHE] Datos recuperados — ${users.length} usuarios, ${streams.length} streams`);
      return { users, streams };
    } catch (e) {
      console.warn('[CACHE] Error al leer caché:', e);
      return { users: [], streams: [] };
    }
  }

  function processStreamsData(data) {
    const possibleHistory = data.history || data.streams || data.list || data;
    let streams = [];
    if (Array.isArray(possibleHistory)) {
      streams = possibleHistory;
    } else if (typeof possibleHistory === 'object') {
      streams = Object.keys(possibleHistory).map(key => ({ _docId: key, ...possibleHistory[key] }));
    }

    // Log de depuración: muestra las claves del primer stream para detectar el nombre del campo
    if (streams.length > 0) {
      console.log('[ENGINE] Campos disponibles en el primer stream:', Object.keys(streams[0]));
      console.log('[ENGINE] Primer stream completo:', JSON.stringify(streams[0]));
    }

    // Detecta si un string parece un título válido (descarta IDs, errores SQL, códigos largos)
    const isTitleValid = (str) => {
      if (!str || typeof str !== 'string') return false;
      const s = str.trim();
      if (s === '') return false;
      // Rechazar si parece un código SQL (ej: "HY000", "08S01", "SQLSTATE ...", etc.)
      if (/sqlstate/i.test(s)) return false;
      // Rechazar si parece un UUID o hash largo (solo hex/guiones, >12 chars)
      if (/^[0-9a-f\-]{12,}$/i.test(s)) return false;
      // Rechazar si contiene mensajes de error típicos de BD
      if (/(error|exception|failed|invalid|undefined|null)/i.test(s) && s.length > 40) return false;
      // Rechazar strings extremadamente largos que no son títulos
      if (s.length > 150) return false;
      return true;
    };

    // Función auxiliar para extraer el título del stream probando múltiples campos posibles
    const getTitle = (obj) => {
      const candidates = [
        obj.title, obj.name, obj.nombre, obj.titulo, obj.streamTitle,
        obj.stream_title, obj.gameName, obj.game_name, obj.label, obj.descripcion
      ];
      for (const c of candidates) {
        if (isTitleValid(c)) return c.trim();
      }
      return null;
    };

    const getT = (obj) => {
      const d = obj.date || obj.timestamp || obj.createdAt || obj.fecha;
      if (d?.seconds) return d.seconds * 1000;
      if (d) { 
        const t = new Date(d).getTime(); 
        if (!isNaN(t)) return t; 
      }
      if (obj._docId) { 
        const t = new Date(obj._docId).getTime(); 
        if (!isNaN(t)) return t; 
      }
      return 0;
    };

    // Filtrar duplicados por nombre, manteniendo únicamente el de la fecha más antigua (apertura)
    const uniqueMap = new Map();
    streams.forEach(s => {
      const rawTitle = getTitle(s) || 'SIN TÍTULO';
      
      // Filtrar directos que contengan "test" (insensible a mayúsculas)
      if (rawTitle.toLowerCase().includes('test')) return;

      const normalizedName = rawTitle.toUpperCase().trim().replace(/\s+/g, ' ');
      const t = getT(s);
      
      // Si no existe el nombre o si encontramos una fecha más antigua, actualizamos el mapa
      if (!uniqueMap.has(normalizedName) || (t > 0 && t < uniqueMap.get(normalizedName)._t)) {
        uniqueMap.set(normalizedName, { ...s, _docId: s._docId, _t: t, _resolvedTitle: rawTitle });
      }
    });

    const result = Array.from(uniqueMap.values())
      .sort((a, b) => b._t - a._t)
      .slice(0, 5);

    console.log('[ENGINE] Streams procesados (sin duplicados, fecha apertura):', result.length);
    return result;
  }

  function getRankedUserIds(users) {
    const filtered = users.filter(u => (u.displayName || u._id || '').toLowerCase() !== 'liiukiin');
    const sorted = [...filtered].sort((a, b) => {
      const lvlDiff = (b.level || 1) - (a.level || 1);
      if (lvlDiff !== 0) return lvlDiff;
      return (b.xp || 0) - (a.xp || 0);
    });
    return sorted.map(u => u._id || u.displayName);
  }

  function applyData(users, streams) {
    allUsers = users;
    
    // Manage ranking history for top level canal
    try {
      const currentRankedIds = getRankedUserIds(users);
      let storedCurr = localStorage.getItem('introbs_curr_ranking');
      
      if (!storedCurr) {
        // First run or no history: initialize current and simulate a previous ranking to show the feature working immediately!
        const initialCurr = currentRankedIds;
        const initialPrev = [...initialCurr];
        
        // Let's swap some elements to simulate recent changes on first boot so it looks dynamic
        if (initialPrev.length >= 4) {
          const temp0 = initialPrev[0];
          initialPrev[0] = initialPrev[1];
          initialPrev[1] = temp0;
          
          if (initialPrev.length >= 6) {
            const temp3 = initialPrev[3];
            initialPrev[3] = initialPrev[4];
            initialPrev[4] = temp3;
          }
        }
        
        localStorage.setItem('introbs_curr_ranking', JSON.stringify(initialCurr));
        localStorage.setItem('introbs_prev_ranking', JSON.stringify(initialPrev));
      } else {
        const parsedCurr = JSON.parse(storedCurr);
        
        // Check if the current ranking has actually changed compared to the stored current ranking
        const isDifferent = parsedCurr.length !== currentRankedIds.length || 
                            currentRankedIds.some((id, idx) => id !== parsedCurr[idx]);
                            
        if (isDifferent) {
          // If the ranking changed, shift stored current to stored previous, and set current to new
          localStorage.setItem('introbs_prev_ranking', JSON.stringify(parsedCurr));
          localStorage.setItem('introbs_curr_ranking', JSON.stringify(currentRankedIds));
        }
      }
    } catch (e) {
      console.error('Error handling rank history:', e);
    }

    feedQueue = buildFeedQueue(allUsers);
    recentStreams = streams;
    renderActiveContent();
  }

  async function fetchFromFirestore() {
    console.log('[FIREBASE] Descargando datos frescos de Firestore...');
    const userSnapshot = await getDocs(collection(db, 'users'));
    const users = [];
    userSnapshot.forEach(d => { const data = d.data(); data._id = d.id; users.push(data); });
    console.log(`[FIREBASE] ${users.length} usuarios descargados`);
    // Log de depuración: muestra campos del primer usuario con meses de sub
    const firstSub = users.find(u => {
      const keys = Object.keys(u);
      return keys.some(k => /month|sub|tenure/i.test(k));
    });
    if (firstSub) {
      console.log('[SUB DEBUG] Campos del primer usuario con sub:', Object.keys(firstSub));
      console.log('[SUB DEBUG] Datos completos:', JSON.stringify(firstSub));
    } else {
      console.warn('[SUB DEBUG] Ningún usuario tiene campos de tipo mes/sub/tenure');
    }

    const docRef = doc(db, 'system', 'stream_history');
    const docSnap = await getDoc(docRef);
    let streams = [];
    if (docSnap.exists()) {
      streams = processStreamsData(docSnap.data());
    } else {
      console.warn('[FIREBASE] stream_history no existe');
    }
    console.log(`[FIREBASE] ${streams.length} streams descargados`);
    return { users, streams };
  }

  async function loadUsers() {
    try {
      // 1. Si la caché es válida, usar datos locales
      if (isCacheValid()) {
        console.log('[CACHE] ✅ Usando datos en caché (no se contacta Firebase)');
        const { users, streams } = loadFromCache();
        if (users.length > 0) {
          applyData(users, streams);
          return;
        }
        console.log('[CACHE] Caché vacía, forzando descarga...');
      }

      // 2. Si no hay caché o expiró, descargar de Firebase
      const { users, streams } = await fetchFromFirestore();
      saveToCache(users, streams);
      applyData(users, streams);

    } catch (err) {
      console.error('[INTRO] Error de Firestore:', err);
      // 3. Fallback: intentar caché aunque esté expirada
      const { users, streams } = loadFromCache();
      if (users.length > 0) {
        console.log('[CACHE] ⚠️ Usando caché expirada como fallback');
        applyData(users, streams);
      } else {
        renderPlaceholder('ERROR DE CONEXIÓN');
      }
    }
  }



  // Init
  loadUsers();
  renderMenu();
  renderActiveContent();
  scheduleNextMenuRotation();


})();

