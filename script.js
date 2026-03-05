/* ═══════════════════════════════════════════════════════
   CYBERPUNK 2077 STREAM INTRO — ENGINE + FIRESTORE
   Conecta en tiempo real con Firestore para mostrar
   datos de la comunidad (niveles, XP, rachas, logros)
   ═══════════════════════════════════════════════════════ */

import { db } from './firebase.js';
import { collection, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js';

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

  // ─── CONFIG ─────────────────────────────
  const CONFIG = {
    backgrounds: [
      'fondos/isabela.mp4', 'fondos/bloodborne.mp4', 'fondos/ciri.mp4', 'fondos/claire.mp4',
      'fondos/geral.mp4', 'fondos/grace.mp4', 'fondos/gustave.mp4', 'fondos/jill.mp4',
      'fondos/karlach.mp4', 'fondos/laezel.mp4', 'fondos/leon.mp4', 'fondos/lune.mp4',
      'fondos/maelle.mp4', 'fondos/senua.mp4', 'fondos/shadow.mp4', 'fondos/triss.mp4', 'fondos/yenn.mp4'
    ].sort(() => Math.random() - 0.5),
    bgInterval: 15000,
    menuInterval: 20000, 
  };

  const SCHEDULE = {
    lunes:    { game: 'Red Dead Redemption',     time: '20:00' },
    martes:   { game: 'Red Dead Redemption',     time: '20:00' },
    miercoles:{ game: 'Night of the Dead',       time: '20:00' },
    jueves:   { game: 'Red Dead Redemption',     time: '20:00' },
    viernes:  { game: 'Red Dead Redemption',     time: '19:00' },
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
    { id: 'item3',     title: 'VOTACIONES', sub: 'Community Polls' },
    { id: 'item4',     title: 'PREDICCIONES', sub: 'Top Predictions' },
  ];

  // ─── DOM REFS ───────────────────────────
  const menuList = document.getElementById('menuList');
  const contentArea = document.getElementById('contentArea');

  // ─── STATE ──────────────────────────────
  let currentMenuIndex = 0;
  let allUsers = [];
  let recentStreams = [];
  let veteransIndex = 0;
  let predictionIndex = 0;
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
      case 'item4':    
        predictionIndex = 0;
        renderPredictions(); 
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

  // Helper para obtener aciertos de predicciones (maneja anidamiento como stats.prediction_wins)
  function getPredictionWins(u) {
    if (!u) return 0;
    // 1. Nivel superior
    if (u.prediction_wins !== undefined) return Number(u.prediction_wins);
    if (u.predictions_wins !== undefined) return Number(u.predictions_wins);
    // 2. Anidado en stats (común en este proyecto)
    if (u.stats) {
      if (u.stats.prediction_wins !== undefined) return Number(u.stats.prediction_wins);
      if (u.stats.predictions_wins !== undefined) return Number(u.stats.predictions_wins);
    }
    // 3. Fallback manual por si acaso
    for (let k in u) {
      if (k.toLowerCase().includes('pred') && k.toLowerCase().includes('win')) return Number(u[k]);
    }
    return 0;
  }

  function renderPredictions() {
    if (allUsers.length === 0) {
      renderPlaceholder('CARGANDO DATOS...');
      return;
    }

    const filtered = allUsers.filter(u => {
      const name = (u.displayName || u._id || '').toLowerCase();
      return name !== 'liiukiin' && getPredictionWins(u) > 0;
    });
    
    console.log(`[INTRO] Predicciones: ${filtered.length} usuarios encontrados con aciertos de un total de ${allUsers.length}.`);
    
    const sorted = [...filtered].sort((a, b) => getPredictionWins(b) - getPredictionWins(a));

    if (sorted.length === 0) {
      renderPlaceholder('SIN ACERTANTES REGISTRADOS');
      return;
    }

    const MAX = 5;
    const chunk = sorted.slice(0, MAX); // Siempre los 5 primeros

    chunk.forEach((u, i) => {
      const row = document.createElement('div');
      row.className = `schedule-row feed-enter ${i === 0 ? 'active' : ''}`;
      row.style.animationDelay = `${i * 0.1}s`;
      const name = formatDisplayName(u);
      const wins = getPredictionWins(u);
      const title = getTitle(u.level || 1);

      row.innerHTML = `
        <div class="sch-day-box">
          <span class="sch-day-short">#${predictionIndex + i + 1}</span>
        </div>
        <div class="sch-main-info">
          <div class="sch-header">
            <span class="sch-time">${name}</span>
            <span class="sch-badge">${wins} ACERTADAS</span>
          </div>
          <span class="sch-game">${title}</span>
        </div>
        <div class="sch-decor">PRED_0${predictionIndex + i + 1}</div>
      `;
      contentArea.appendChild(row);
    });
  }

  function renderVeterans() {
    if (allUsers.length === 0) {
      renderPlaceholder('CARGANDO DATOS...');
      return;
    }
    // Todos los que tengan al menos 1 mes (sin liiukiin)
    const filtered = allUsers.filter(u => {
      const name = (u.displayName || u._id || '').toLowerCase();
      return name !== 'liiukiin' && (u.subMonths || u.months || 0) > 0;
    });
    
    // Ordenar por meses
    const sorted = [...filtered].sort((a, b) => (b.subMonths || b.months || 0) - (a.subMonths || a.months || 0));

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
      const months = u.subMonths || u.months || 0;
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

      const title = (s.title || s.name || s.nombre || 'SIN TÍTULO').toUpperCase();
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
    const todayIdx = new Date().getDay();
    const dayKeys = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
    const todayKey = dayKeys[todayIdx - 1] || null;

    Object.entries(SCHEDULE).forEach(([k, d], i) => {
      const active = k === todayKey;
      const el = document.createElement('div');
      el.className = `schedule-row feed-enter ${active ? 'active' : ''}`;
      el.style.animationDelay = `${i * 0.1}s`;
      el.innerHTML = `
        <div class="sch-day-box">
          <span class="sch-day-short">${DAY_NAMES[k].substring(0, 3)}</span>
          <span class="sch-status"></span>
        </div>
        <div class="sch-main-info">
          <div class="sch-header">
            <span class="sch-time">${d.time}</span>
            ${active ? '<span class="sch-badge">ONLINE</span>' : '<span class="sch-badge standby">STANDBY</span>'}
          </div>
          <span class="sch-game">${d.game}</span>
        </div>
        <div class="sch-decor">00${i+1}</div>
      `;
      contentArea.appendChild(el);
    });
  }


  function renderFeed() {
    if (allUsers.length === 0) {
      renderPlaceholder('CARGANDO DATOS...');
      return;
    }
    // Top 5 por nivel (excluir liiukiin)
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
    if (activeItem.id === 'item4') {
      const filtered = allUsers.filter(u => {
        const name = (u.displayName || u._id || '').toLowerCase();
        return name !== 'liiukiin' && getPredictionWins(u) > 0;
      });
      if (filtered.length > 0) {
        predictionIndex = (predictionIndex + 5) % filtered.length;
      }
    }

    // Avanzamos al siguiente elemento del menú principal
    currentMenuIndex = (currentMenuIndex + 1) % MENU_ITEMS.length;

    renderMenu();
    renderActiveContent();
  }

  setInterval(rotateMenu, CONFIG.menuInterval);

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
  // Expiración: 12 horas en milisegundos
  const CACHE_TTL = 12 * 60 * 60 * 1000;
  const CACHE_KEY_USERS = 'introbs_cache_users';
  const CACHE_KEY_STREAMS = 'introbs_cache_streams';
  const CACHE_KEY_TIMESTAMP = 'introbs_cache_ts';

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
    return streams.sort((a, b) => {
      const getT = (obj) => {
        const d = obj.date || obj.timestamp || obj.createdAt || obj.fecha;
        if (d?.seconds) return d.seconds * 1000;
        if (d) return new Date(d).getTime();
        if (obj._docId) { const p = new Date(obj._docId); return isNaN(p) ? 0 : p.getTime(); }
        return 0;
      };
      return getT(b) - getT(a);
    }).slice(0, 5);
  }

  function applyData(users, streams) {
    allUsers = users;
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

})();

