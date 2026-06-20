/* ═══════════════════════════════════════════════════════
   CYBERPUNK 2077 STREAM OUTRO — ENGINE + FIRESTORE
   Muestra el siguiente directo programado en la sección de horarios,
   manteniendo el resto del HUD idéntico al index original.
   ═══════════════════════════════════════════════════════ */

import { db } from './firebase.js';
import { collection, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js';
import { RAWG_API_KEY } from './api-keys.js';

console.log('[OUTRO ENGINE] Script inicializado');

(function () {
  'use strict';
  console.log('[OUTRO ENGINE] IIFE en ejecución');

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
    countdownMinutes: 5,
  };

  const gameImageCache = {};

  async function getGameImage(gameName) {
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

  const SCHEDULE = {
    lunes:    [ { game: 'Conan Exiles Enhanced', time: '17:00 - 21:00' }, { game: 'The Witcher 2', time: '22:00 - 01:00' } ],
    martes:   [ { game: 'Conan Exiles Enhanced', time: '17:00 - 21:00' }, { game: 'The Witcher 2', time: '22:00 - 01:00' } ],
    miercoles:[ { game: 'Conan Exiles Enhanced', time: '17:00 - 21:00' }, { game: 'The Witcher 2', time: '22:00 - 01:00' } ],
    jueves:   [ { game: 'Conan Exiles Enhanced', time: '17:00 - 21:00' }, { game: 'The Witcher 2', time: '22:00 - 01:00' } ],
    viernes:  [ { game: 'Conan Exiles Enhanced', time: '17:00 - 21:00' }, { game: 'The Witcher 2', time: '22:00 - 01:00' } ],
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
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    contentArea.innerHTML = '';
    const activeItem = MENU_ITEMS[currentMenuIndex];

    switch (activeItem.id) {
      case 'horario':  renderSchedule(); break;
      case 'topcanal': renderFeed(); break;
      case 'item1':    renderRecentStreams(); break;
      case 'item2':    
        veteransIndex = 0; 
        renderVeterans(); 
        break;
      default: renderPlaceholder(activeItem.title);
    }
  }

  function formatDisplayName(u) {
    let name = (u.displayName || u._id || 'UNKNOWN').toUpperCase();
    if (name === 'C_H_A_N_D_A_L_F') return 'CHANDALF';
    return name;
  }

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
    const filtered = allUsers.filter(u => {
      const name = (u.displayName || u._id || '').toLowerCase();
      return name !== 'liiukiin' && getSubMonths(u) > 0;
    });
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
      
      let dateObj = null;
      const rawDate = s.date || s.timestamp || s.createdAt || s.fecha || s._docId;
      if (rawDate?.toDate) dateObj = rawDate.toDate();
      else if (rawDate) {
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

  // ─── NEXT STREAM SEARCH LOGIC ─────────────────────
  const dayKeys = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

  function findNextStream() {
    const now = new Date();
    const currentDayIndex = now.getDay() === 0 ? 7 : now.getDay();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;

    let foundStream = null;
    let targetDate = null;
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
          
          if (offset === 0) {
            if (streamTimeInMinutes > currentTimeInMinutes) {
              foundStream = stream;
              targetDate = new Date(checkDate);
              targetDate.setHours(startHour, startMin, 0, 0);
              targetOffset = offset;
              break;
            }
          } else {
            foundStream = stream;
            targetDate = new Date(checkDate);
            targetDate.setHours(startHour, startMin, 0, 0);
            targetOffset = offset;
            break;
          }
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
          const stream = dayStreams[0];
          const [startStr] = stream.time.split('-');
          const [startHour, startMin] = startStr.trim().split(':').map(Number);
          
          foundStream = stream;
          targetDate = new Date(checkDate);
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
    if (offset === 1) return 'MAÑANA';
    
    const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
  }

  // ─── RENDER NEXT STREAM CARD ──────────────────────
  let countdownInterval = null;

  function renderSchedule() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    const { stream, date: targetDate, offset } = findNextStream();

    if (!stream) {
      renderPlaceholder('SIN PROGRAMACIÓN');
      return;
    }

    const formattedDay = formatNextStreamDay(targetDate, offset);
    const [startStr] = stream.time.split('-');

    const container = document.createElement('div');
    container.className = 'feed-enter';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '25px';
    container.style.marginTop = '-260px'; // Alinear perfectamente con el menú
    container.style.height = 'calc(100vh - 80px)';
    container.style.justifyContent = 'center';
    container.style.paddingRight = '20px';

    // Cabecera superior
    const headerEl = document.createElement('div');
    headerEl.style.fontFamily = 'var(--font-mono)';
    headerEl.style.fontSize = '1.3rem';
    headerEl.style.color = 'var(--cyber-red)';
    headerEl.style.textShadow = 'var(--glow-red)';
    headerEl.style.letterSpacing = '3px';
    headerEl.style.textTransform = 'uppercase';
    headerEl.textContent = '// ENLACE_NEURAL: SIGUIENTE TRANSMISIÓN';
    container.appendChild(headerEl);

    // Caja de Juego (Game Display)
    const gameDisplay = document.createElement('div');
    gameDisplay.style.position = 'relative';
    gameDisplay.style.width = '100%';
    gameDisplay.style.height = '320px';
    gameDisplay.style.minHeight = '320px';
    gameDisplay.style.overflow = 'hidden';
    gameDisplay.style.border = '1px solid rgba(255,255,255,0.08)';
    gameDisplay.style.clipPath = 'polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)';
    gameDisplay.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';

    const imgFallback = document.createElement('div');
    imgFallback.style.position = 'absolute';
    imgFallback.style.inset = '0';
    imgFallback.style.background = '#0d0d15';
    imgFallback.style.zIndex = '-1';
    gameDisplay.appendChild(imgFallback);

    const img = document.createElement('img');
    img.style.position = 'absolute';
    img.style.inset = '0';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.opacity = '0';
    img.style.transform = 'scale(1)';
    img.style.transition = 'opacity 1.5s ease, transform 25s linear';
    gameDisplay.appendChild(img);

    // Overlay con textos
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.background = 'linear-gradient(0deg, rgba(10,10,15,0.95) 0%, rgba(10,10,15,0.4) 65%, transparent 100%)';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'flex-end';
    overlay.style.padding = '25px';

    overlay.innerHTML = `
      <h2 style="font-family: var(--font-title); font-size: 2.6rem; font-weight: 800; color: #fff; text-transform: uppercase; letter-spacing: 1px; text-shadow: 2px 2px 6px rgba(0,0,0,0.9); line-height: 1.1; margin-bottom: 12px;">
        ${stream.game}
      </h2>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-family: var(--font-ui); font-size: 1.6rem; font-weight: 700; color: #fff; text-shadow: 1px 1px 4px rgba(0,0,0,0.9); text-transform: uppercase; letter-spacing: 1px;">
          ${formattedDay}
        </span>
        <span style="font-family: var(--font-mono); font-size: 2.1rem; font-weight: bold; color: var(--cyber-red); background: rgba(0, 0, 0, 0.75); border: 1px solid var(--cyber-red); padding: 5px 16px; clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px); box-shadow: var(--glow-red);">
          ${startStr.trim()}
        </span>
      </div>
    `;
    gameDisplay.appendChild(overlay);
    container.appendChild(gameDisplay);

    // Cargar imagen de RAWG API
    getGameImage(stream.game).then(url => {
      if (url) {
        img.src = url;
        img.style.opacity = '0.55';
        img.style.transform = 'scale(1.06)';
      }
    });

    // Caja de Cuenta Regresiva (Countdown widget)
    const countdownBox = document.createElement('div');
    countdownBox.style.display = 'flex';
    countdownBox.style.flexDirection = 'column';
    countdownBox.style.alignItems = 'center';
    countdownBox.style.padding = '20px';
    countdownBox.style.background = 'rgba(var(--cyber-red-rgb), 0.08)';
    countdownBox.style.border = '1px solid rgba(var(--cyber-red-rgb), 0.2)';
    countdownBox.style.borderLeft = '4px solid var(--cyber-red)';
    countdownBox.style.clipPath = 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)';
    countdownBox.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';

    countdownBox.innerHTML = `
      <span style="font-family: var(--font-mono); font-size: 1rem; color: rgba(255,255,255,0.4); letter-spacing: 3px; text-transform: uppercase; margin-bottom: 5px;">
        TIEMPO PARA EL ENLACE
      </span>
      <div id="countdownClock" style="font-family: var(--font-mono); font-size: 3.2rem; font-weight: bold; color: #fff; letter-spacing: 2px; text-shadow: 0 0 15px rgba(255,255,255, 0.2), 0 0 10px rgba(var(--cyber-red-rgb), 0.3);">
        00d : 00h : 00m : 00s
      </div>
    `;
    container.appendChild(countdownBox);

    // Texto de despedida inferior
    const bottomLog = document.createElement('div');
    bottomLog.style.fontFamily = 'var(--font-mono)';
    bottomLog.style.fontSize = '1.05rem';
    bottomLog.style.color = 'rgba(255, 255, 255, 0.4)';
    bottomLog.style.display = 'flex';
    bottomLog.style.alignItems = 'center';
    bottomLog.style.gap = '10px';
    bottomLog.style.letterSpacing = '1.5px';
    bottomLog.style.marginTop = '10px';

    const logIndicator = document.createElement('span');
    logIndicator.style.width = '8px';
    logIndicator.style.height = '8px';
    logIndicator.style.backgroundColor = 'var(--cyber-red)';
    logIndicator.style.boxShadow = 'var(--glow-red)';
    logIndicator.style.borderRadius = '50%';
    logIndicator.style.animation = 'logPulse 1.5s infinite ease-in-out';
    
    if (!document.getElementById('outroKeyframes')) {
      const style = document.createElement('style');
      style.id = 'outroKeyframes';
      style.textContent = `
        @keyframes logPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `;
      document.head.appendChild(style);
    }

    bottomLog.appendChild(logIndicator);
    const textSpan = document.createElement('span');
    textSpan.textContent = 'GRACIAS POR ACOMPAÑARME EN EL VIAJE, CHOOMS_';
    bottomLog.appendChild(textSpan);
    container.appendChild(bottomLog);

    contentArea.appendChild(container);

    function updateCountdown() {
      const clock = document.getElementById('countdownClock');
      if (!clock) return;
      
      const now = new Date();
      const diffMs = targetDate - now;
      
      if (diffMs <= 0) {
        clock.textContent = "00d : 00h : 00m : 00s";
        return;
      }
      
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
      
      const dStr = days.toString().padStart(2, '0');
      const hStr = hours.toString().padStart(2, '0');
      const mStr = minutes.toString().padStart(2, '0');
      const sStr = seconds.toString().padStart(2, '0');
      
      clock.textContent = `${dStr}d : ${hStr}h : ${mStr}m : ${sStr}s`;
    }

    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
  }

  // ─── FEED RENDERING ────────────────────────────────
  function renderFeed() {
    if (allUsers.length === 0) {
      renderPlaceholder('CARGANDO DATOS...');
      return;
    }
    const filtered = allUsers.filter(u => (u.displayName || u._id || '').toLowerCase() !== 'liiukiin');
    const top5 = [...filtered].sort((a, b) => (b.level || 1) - (a.level || 1)).slice(0, 5);
    top5.forEach((u, i) => {
      const row = document.createElement('div');
      row.className = `schedule-row feed-enter ${i === 0 ? 'active' : ''}`;
      row.style.animationDelay = `${i * 0.1}s`;
      const name = formatDisplayName(u);
      const lvl = u.level || 1;
      const title = getTitle(lvl);
      row.innerHTML = `
        <div class="sch-day-box">
          <span class="sch-day-short">#${i + 1}</span>
        </div>
        <div class="sch-main-info">
          <div class="sch-header">
            <span class="sch-time">${name}</span>
            <span class="sch-badge">LVL ${lvl}</span>
          </div>
          <span class="sch-game">${title}</span>
        </div>
        <div class="sch-decor">00${i + 1}</div>
      `;
      contentArea.appendChild(row);
    });
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

  // ─── ROTATION LOGIC ───────────────────────────────
  let menuTimer = null;
  function scheduleNextMenuRotation() {
    const activeItem = MENU_ITEMS[currentMenuIndex];
    const duration = activeItem.id === 'horario' ? CONFIG.menuInterval * 3 : CONFIG.menuInterval;
    clearTimeout(menuTimer);
    menuTimer = setTimeout(rotateMenu, duration);
  }

  function rotateMenu() {
    const activeItem = MENU_ITEMS[currentMenuIndex];

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

    currentMenuIndex = (currentMenuIndex + 1) % MENU_ITEMS.length;

    renderMenu();
    renderActiveContent();
    scheduleNextMenuRotation();
  }

  // ─── FIRESTORE LOAD & CACHE ────────────────────────
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

  const CACHE_TTL = 1 * 60 * 60 * 1000;
  const CACHE_KEY_USERS = 'introbs_cache_users_v4';
  const CACHE_KEY_STREAMS = 'introbs_cache_streams_v4';
  const CACHE_KEY_TIMESTAMP = 'introbs_cache_ts_v4';

  function isCacheValid() {
    const ts = localStorage.getItem(CACHE_KEY_TIMESTAMP);
    if (!ts) return false;
    const age = Date.now() - Number(ts);
    return age < CACHE_TTL;
  }

  function saveToCache(users, streams) {
    try {
      localStorage.setItem(CACHE_KEY_USERS, JSON.stringify(users));
      localStorage.setItem(CACHE_KEY_STREAMS, JSON.stringify(streams));
      localStorage.setItem(CACHE_KEY_TIMESTAMP, String(Date.now()));
    } catch (e) {
      console.warn('[CACHE] Error:', e);
    }
  }

  function loadFromCache() {
    try {
      const users = JSON.parse(localStorage.getItem(CACHE_KEY_USERS) || '[]');
      const streams = JSON.parse(localStorage.getItem(CACHE_KEY_STREAMS) || '[]');
      return { users, streams };
    } catch (e) {
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

    const isTitleValid = (str) => {
      if (!str || typeof str !== 'string') return false;
      const s = str.trim();
      if (s === '') return false;
      if (/sqlstate/i.test(s)) return false;
      if (/^[0-9a-f\-]{12,}$/i.test(s)) return false;
      if (/(error|exception|failed|invalid|undefined|null)/i.test(s) && s.length > 40) return false;
      if (s.length > 150) return false;
      return true;
    };

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

    const uniqueMap = new Map();
    streams.forEach(s => {
      const rawTitle = getTitle(s) || 'SIN TÍTULO';
      if (rawTitle.toLowerCase().includes('test')) return;
      const normalizedName = rawTitle.toUpperCase().trim().replace(/\s+/g, ' ');
      const t = getT(s);
      if (!uniqueMap.has(normalizedName) || (t > 0 && t < uniqueMap.get(normalizedName)._t)) {
        uniqueMap.set(normalizedName, { ...s, _docId: s._docId, _t: t, _resolvedTitle: rawTitle });
      }
    });

    return Array.from(uniqueMap.values())
      .sort((a, b) => b._t - a._t)
      .slice(0, 5);
  }

  function applyData(users, streams) {
    allUsers = users;
    feedQueue = buildFeedQueue(allUsers);
    recentStreams = streams;
    renderActiveContent();
  }

  async function fetchFromFirestore() {
    const userSnapshot = await getDocs(collection(db, 'users'));
    const users = [];
    userSnapshot.forEach(d => { const data = d.data(); data._id = d.id; users.push(data); });

    const docRef = doc(db, 'system', 'stream_history');
    const docSnap = await getDoc(docRef);
    let streams = [];
    if (docSnap.exists()) {
      streams = processStreamsData(docSnap.data());
    }
    return { users, streams };
  }

  async function loadUsers() {
    try {
      if (isCacheValid()) {
        const { users, streams } = loadFromCache();
        if (users.length > 0) {
          applyData(users, streams);
          return;
        }
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
        renderPlaceholder('ERROR DE CONEXIÓN');
      }
    }
  }

  // Inicialización
  loadUsers();
  renderMenu();
  renderActiveContent();
  scheduleNextMenuRotation();

})();
