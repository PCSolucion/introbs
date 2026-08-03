/* ═══════════════════════════════════════════════════════
   ENGINE.JS — Lógica compartida entre script.js y outro-script.js
   Contiene: helpers, caché, Firestore, vídeos, menú, feed, renders comunes
   ═══════════════════════════════════════════════════════ */

import { db } from './firebase.js';
import { collection, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js';
import { RAWG_API_KEY } from './api-keys.js';
import { SCHEDULE } from './schedule.js';

export { SCHEDULE };

// ─── TÍTULOS DE NIVEL ──────────────────────────────────
export const LEVEL_TITLES = {
  1: 'CIVILIAN', 5: 'ROOKIE', 10: 'MERCENARY',
  15: 'SOLO', 20: 'NETRUNNER', 30: 'FIXER',
  40: 'CORPO', 50: 'NIGHT CITY LEGEND', 60: 'CYBERPSYCHO',
  70: 'MAXTAC', 80: 'TRAUMA TEAM', 90: 'AFTERLIFE LEGEND',
  100: 'CHOOMBA SUPREME'
};

export function getTitle(level) {
  const keys = Object.keys(LEVEL_TITLES).map(Number).sort((a, b) => b - a);
  for (const k of keys) { if (level >= k) return LEVEL_TITLES[k]; }
  return `EDGE RUNNER LVL ${level}`;
}

// ─── CONFIGURACIÓN GLOBAL ──────────────────────────────
export const CONFIG = {
  backgrounds: [
    'fondos/isabela.mp4', 'fondos/bloodborne.mp4', 'fondos/ciri.mp4', 'fondos/claire.mp4',
    'fondos/geral.mp4', 'fondos/grace.mp4', 'fondos/gustave.mp4', 'fondos/jill.mp4',
    'fondos/karlach.mp4', 'fondos/laezel.mp4', 'fondos/leon.mp4', 'fondos/lune.mp4',
    'fondos/maelle.mp4', 'fondos/senua.mp4', 'fondos/shadow.mp4', 'fondos/triss.mp4',
    'fondos/yenn.mp4', 'fondos/kratos.mp4', 'fondos/mrx.mp4', 'fondos/panam.mp4',
    'fondos/jynx.mp4', 'fondos/claire2.mp4', 'fondos/sciel.mp4', 'fondos/samu.mp4'
  ].sort(() => Math.random() - 0.5),
  bgInterval: 15000,
  menuInterval: 20000,
  countdownMinutes: 5,
};

// ─── STORAGE UTILITY (localStorage wrapper) ───────────
export const storage = {
  get(key, fallback = null) {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : fallback;
    } catch (e) {
      console.warn(`[Storage] Error al leer '${key}':`, e);
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn(`[Storage] Error al guardar '${key}':`, e);
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[Storage] Error al eliminar '${key}':`, e);
    }
  }
};

const gameImageCache = {};
const RAWG_CACHE_KEY = 'introbs_rawg_image_cache_v1';

function getRawgCache() {
  return storage.get(RAWG_CACHE_KEY, {});
}

function saveRawgCache(cache) {
  storage.set(RAWG_CACHE_KEY, cache);
}

export async function preloadGameImage(gameName) {
  if (!gameName) return;
  const url = await getGameImage(gameName);
  if (url) {
    const img = new Image();
    img.src = url;
  }
}

export const SPECIAL_GAMES = {
  DESCANSO: { image: 'fondos/descanso.png', isDescanso: true },
  INFORMATICA: { image: 'fondos/informatica-bg.jpg' },
};

export function isDescansoGame(gameName) {
  if (!gameName) return false;
  return String(gameName).trim().toUpperCase() === 'DESCANSO';
}

export function getGameImageSync(gameName) {
  if (!gameName) return '';
  const cleanName = gameName.trim();
  const upper = cleanName.toUpperCase();

  if (SPECIAL_GAMES[upper]) return SPECIAL_GAMES[upper].image;

  if (gameImageCache[cleanName]) {
    return gameImageCache[cleanName] === 'NOT_FOUND' ? '' : gameImageCache[cleanName];
  }

  const diskCache = getRawgCache();
  if (diskCache[cleanName]) {
    gameImageCache[cleanName] = diskCache[cleanName];
    return diskCache[cleanName] === 'NOT_FOUND' ? '' : diskCache[cleanName];
  }

  return '';
}

export function bindAsyncGameImage(imgEl, gameName, targetOpacity = '1', targetScale = 'scale(1.08)') {
  if (!imgEl || !gameName) return;
  getGameImage(gameName).then(url => {
    if (url) {
      imgEl.src = url;
      setTimeout(() => {
        imgEl.style.opacity = targetOpacity;
        imgEl.style.transform = targetScale;
      }, 50);
    }
  });
}

export async function getGameImage(gameName) {
  if (!gameName) return '';
  const syncUrl = getGameImageSync(gameName);
  if (syncUrl) return syncUrl;

  const cleanName = gameName.trim();

  try {
    const res = await fetch(`https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(cleanName)}&page_size=1`);
    const data = await res.json();
    if (data.results && data.results.length > 0 && data.results[0].background_image) {
      const imgUrl = data.results[0].background_image;
      gameImageCache[cleanName] = imgUrl;
      const diskCache = getRawgCache();
      diskCache[cleanName] = imgUrl;
      saveRawgCache(diskCache);
      return imgUrl;
    }
  } catch (e) {
    console.error('Error fetching game image from RAWG API', e);
  }

  // Si no se encontró o hubo error, guardar NOT_FOUND para no saturar la API en futuras peticiones
  gameImageCache[cleanName] = 'NOT_FOUND';
  const diskCache = getRawgCache();
  diskCache[cleanName] = 'NOT_FOUND';
  saveRawgCache(diskCache);

  return '';
}

// ─── MENÚ ────────────────────────────────────────────
export const MENU_ITEMS = [
  { id: 'horario',  title: 'HORARIOS',         sub: 'Stream Schedule' },
  { id: 'topcanal', title: 'TOP',              sub: 'Community Feed' },
  { id: 'item1',    title: 'ULTIMOS DIRECTOS', sub: 'Archive' },
];

export const DAY_NAMES = {
  lunes: 'LUNES', martes: 'MARTES', miercoles: 'MIERCOLES',
  jueves: 'JUEVES', viernes: 'VIERNES',
};

export const DAY_KEYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

export function getNormalizedDayIndex(date = new Date()) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

export function getDayKey(date = new Date()) {
  const idx = getNormalizedDayIndex(date);
  return DAY_KEYS[idx - 1] || null;
}

export function getWeekDates(baseDate = new Date()) {
  const todayIdx = getNormalizedDayIndex(baseDate);
  const mondayDate = new Date(baseDate);
  mondayDate.setDate(baseDate.getDate() - (todayIdx - 1));

  return DAY_KEYS.map((key, index) => {
    const d = new Date(mondayDate);
    let dayOffset = index;
    if (index + 1 < todayIdx) dayOffset += 7;
    d.setDate(mondayDate.getDate() + dayOffset);
    const dayStr = d.getDate().toString().padStart(2, '0');
    let monthStr = d.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');
    return { day: dayStr, month: monthStr };
  });
}

// ─── HELPERS ─────────────────────────────────────────
export function getUserId(u) {
  if (!u) return '';
  return String(u._id || u.displayName || 'unknown').toLowerCase().trim();
}

export function formatDisplayName(u) {
  let name = (u.displayName || u._id || 'UNKNOWN').toUpperCase();
  if (name === 'C_H_A_N_D_A_L_F') return 'CHANDALF';
  return name;
}

export function getSubMonths(u) {
  return u.subMonths || u.months || u.sub_months || u.monthsSubscribed
    || u.tenure || u.subCount || u.subscriptionMonths || u.totalMonths
    || u.cumulative_months || u.cumulativeMonths || 0;
}

export function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

export function formatTime(minutes) {
  if (!minutes) return '0h';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function parseStreamTime(timeStr) {
  if (!timeStr) return { startTimeStr: '', endTimeStr: '', startHour: 0, startMin: 0 };
  const [startTimeStr = '', endTimeStr = ''] = String(timeStr).split('-').map(s => s.trim());
  const [startHourStr = '0', startMinStr = '0'] = startTimeStr.split(':');

  return {
    startTimeStr,
    endTimeStr,
    startHour: parseInt(startHourStr, 10) || 0,
    startMin: parseInt(startMinStr, 10) || 0,
  };
}

// ─── SISTEMA DE VÍDEOS DE FONDO ──────────────────────
export function initVideoBackground() {
  const v1 = document.getElementById('bgVideo1');
  const v2 = document.getElementById('bgVideo2');
  if (!v1 || !v2) return;

  let activeV = v1;
  let nextV = v2;
  let bgi = 0;
  let isSwitching = false;

  activeV.src = CONFIG.backgrounds[bgi];
  activeV.playbackRate = CONFIG.backgrounds[bgi] === 'fondos/isabela.mp4' ? 0.5 : 1.0;
  activeV.play().catch(e => console.log('Autoplay blocked initially:', e));
  bgi = (bgi + 1) % CONFIG.backgrounds.length;

  function switchVideo() {
    if (isSwitching) return;
    isSwitching = true;

    const videoFile = CONFIG.backgrounds[bgi];

    const cleanup = () => {
      nextV.removeEventListener('loadeddata', onLoaded);
      nextV.removeEventListener('error', onError);
      isSwitching = false;
    };

    const onError = () => {
      cleanup();
      bgi = (bgi + 1) % CONFIG.backgrounds.length;
      setTimeout(switchVideo, 500);
    };

    const onLoaded = async () => {
      cleanup();
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
    };

    nextV.addEventListener('loadeddata', onLoaded, { once: true });
    nextV.addEventListener('error', onError, { once: true });
    nextV.src = videoFile;
    nextV.load();
  }

  setInterval(switchVideo, CONFIG.bgInterval);
}

// â”€â”€â”€ RENDER: MENÃš â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function renderMenu(menuList, currentMenuIndex) {
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

// â”€â”€â”€ RENDER: FEED (TOP 10) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function renderFeed(contentArea, allUsers) {
  if (allUsers.length === 0) {
    renderPlaceholder(contentArea, 'CARGANDO DATOS...');
    return;
  }

  const filtered = allUsers.filter(u => (u.displayName || u._id || '').toLowerCase() !== 'liiukiin');
  const sorted = [...filtered].sort((a, b) => {
    const lvlDiff = (b.level || 1) - (a.level || 1);
    if (lvlDiff !== 0) return lvlDiff;
    return (b.xp || 0) - (a.xp || 0);
  });
  const top10 = sorted.slice(0, 10);

  const prevRankingArray = storage.get('introbs_prev_ranking', []);

  const feedContainer = document.createElement('div');
  feedContainer.className = 'content-view-container';

  top10.forEach((u, i) => {
    const row = document.createElement('div');
    row.className = `schedule-row top-row feed-enter ${i === 0 ? 'active' : ''}`;
    row.style.animationDelay = `${i * 0.08}s`;
    row.style.marginBottom = '0';

    const name = formatDisplayName(u);
    const lvl = u.level || 1;
    const title = getTitle(lvl);

    const currentUserId = getUserId(u);
    const currentRank = i + 1;
    const prevRankIndex = prevRankingArray.indexOf(currentUserId);

    let changeHTML = '';
    if (prevRankIndex === -1) {
      changeHTML = `<span class="rank-change-indicator rank-new">NEW</span>`;
    } else {
      const prevRank = prevRankIndex + 1;
      const diff = prevRank - currentRank;
      if (diff > 0) {
        changeHTML = `<span class="rank-change-indicator rank-up">&#9650; ${diff}</span>`;
      } else if (diff < 0) {
        changeHTML = `<span class="rank-change-indicator rank-down">&#9660; ${Math.abs(diff)}</span>`;
      } else {
        changeHTML = `<span class="rank-change-indicator rank-equal">EQ</span>`;
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

// â”€â”€â”€ RENDER: ÃšLTIMOS DIRECTOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function renderRecentStreams(contentArea, recentStreams) {
  if (recentStreams.length === 0) {
    renderPlaceholder(contentArea, 'CARGANDO ARCHIVOS...');
    return;
  }
  const container = document.createElement('div');
  container.className = 'content-view-container centered-group';

  recentStreams.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = `schedule-row feed-enter ${i === 0 ? 'active' : ''}`;
    row.style.animationDelay = `${i * 0.1}s`;

    let dateObj = null;
    const rawDate = s.date || s.timestamp || s.createdAt || s.fecha || s._docId;
    if (rawDate?.toDate) dateObj = rawDate.toDate();
    else if (rawDate) dateObj = new Date(rawDate);

    const dateStr = dateObj && !isNaN(dateObj)
      ? dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
      : '--/--';

    const title = (s._resolvedTitle || s.title || s.name || s.nombre || s.titulo || s.streamTitle || s.stream_title || s.label || 'SIN TITULO').toUpperCase();
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
    container.appendChild(row);
  });
  contentArea.appendChild(container);
}

// â”€â”€â”€ RENDER: VETERANOS (SUBS) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function renderVeterans(contentArea, allUsers, veteransIndex = 0) {
  if (allUsers.length === 0) {
    renderPlaceholder(contentArea, 'CARGANDO DATOS...');
    return;
  }
  const filtered = allUsers.filter(u => {
    const name = (u.displayName || u._id || '').toLowerCase();
    return name !== 'liiukiin' && getSubMonths(u) > 0;
  });
  const sorted = [...filtered].sort((a, b) => getSubMonths(b) - getSubMonths(a));

  if (sorted.length === 0) {
    renderPlaceholder(contentArea, 'SIN DATOS DE SUBS');
    return;
  }

  const container = document.createElement('div');
  container.className = 'content-view-container centered-group';

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
    container.appendChild(row);
  });
  contentArea.appendChild(container);
}

// ─── RENDER: PLACEHOLDER ─────────────────────────────
export function renderPlaceholder(contentArea, title) {
  const el = document.createElement('div');
  el.className = 'placeholder-card feed-enter';
  el.innerHTML = `
    <div class="ph-header">
      <span class="ph-code">OFFSET_ERR // ${Math.random().toString(16).substring(2, 6).toUpperCase()}</span>
      <span class="ph-title">${title}</span>
    </div>
    <div class="ph-body">
      <div class="ph-glitch-line"></div>
      <p>ENLACE NEURAL INTERRUMPIDO. RECONECTANDO CON EL SECTOR...</p>
    </div>
  `;
  contentArea.appendChild(el);
}

// ─── FEED QUEUE ───────────────────────────────────────
const PHRASES = {
  topXP:        ['El mercenario con mas XP en Night City', 'Nadie acumula mas datos que este choom', 'Leyenda cargada en el sistema'],
  topMessages:  ['Feed del chat sobrecalentado por', 'Maxima actividad neural detectada', 'Senal mas fuerte en la red'],
  topStreak:    ['Racha imparable en la red neural', 'Conexion ininterrumpida al sistema', 'Enlace mas estable del sector'],
  topLevel:     ['Rango mas alto registrado en el sistema', 'Implantes al maximo nivel', 'Netrunner de elite confirmado'],
  topWatchTime: ['Vigilante permanente del feed', 'Conexion prolongada al satelite', 'Tiempo de enlace maximo registrado'],
  userCard:     ['Perfil escaneado via Kiroshi MK.V', 'Datos del agente extraidos', 'Identidad verificada por NetWatch', 'Implante neural sincronizado', 'Archivo de operativo recuperado'],
};
function randPhrase(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function buildFeedQueue(users) {
  const queue = [];
  if (users.length === 0) return queue;
  const byXP     = [...users].sort((a, b) => (b.xp || 0) - (a.xp || 0));
  const byMsgs   = [...users].sort((a, b) => (b.totalMessages || 0) - (a.totalMessages || 0));
  const byStreak = [...users].sort((a, b) => (b.streakDays || 0) - (a.streakDays || 0));
  const byLevel  = [...users].sort((a, b) => (b.level || 1) - (a.level || 1));
  const byWatch  = [...users].sort((a, b) => (b.watchTimeMinutes || 0) - (a.watchTimeMinutes || 0));

  if (byXP[0] && byXP[0].xp > 0)
    queue.push({ title: formatDisplayName(byXP[0]), sub: randPhrase(PHRASES.topXP), value: formatNum(byXP[0].xp) + ' XP', highlight: true, badgeText: 'TOP 1 XP' });
  if (byMsgs[0] && byMsgs[0].totalMessages > 0)
    queue.push({ title: formatDisplayName(byMsgs[0]), sub: randPhrase(PHRASES.topMessages), value: formatNum(byMsgs[0].totalMessages) + ' MSG', highlight: false, badgeText: 'TOP CHAT' });
  if (byStreak[0] && byStreak[0].streakDays > 0)
    queue.push({ title: formatDisplayName(byStreak[0]), sub: randPhrase(PHRASES.topStreak), value: byStreak[0].streakDays + ' DIAS', highlight: false, badgeText: 'RACHA' });
  if (byLevel[0] && byLevel[0].level > 1)
    queue.push({ title: formatDisplayName(byLevel[0]), sub: getTitle(byLevel[0].level) + ' - ' + randPhrase(PHRASES.topLevel), value: 'LVL ' + byLevel[0].level, highlight: true, badgeText: 'MAX RANK' });
  if (byWatch[0] && byWatch[0].watchTimeMinutes > 0)
    queue.push({ title: formatDisplayName(byWatch[0]), sub: randPhrase(PHRASES.topWatchTime), value: formatTime(byWatch[0].watchTimeMinutes), highlight: false, badgeText: 'LURKER' });

  const shuffled = [...users].sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(5, shuffled.length); i++) {
    const u = shuffled[i];
    if (!u || (u.level || 1) < 2) continue;
    queue.push({ title: formatDisplayName(u), sub: getTitle(u.level || 1) + ' - ' + randPhrase(PHRASES.userCard), value: 'LVL ' + (u.level || 1), highlight: false, badgeText: null });
  }
  return queue;
}

// ─── CACHE (localStorage) ─────────────────────────────
const CACHE_TTL           = 1 * 60 * 60 * 1000; // 1 hora
const CACHE_KEY_USERS     = 'introbs_cache_users_v4';
const CACHE_KEY_STREAMS   = 'introbs_cache_streams_v4';
const CACHE_KEY_TIMESTAMP = 'introbs_cache_ts_v4';

export function isCacheValid() {
  const ts = storage.get(CACHE_KEY_TIMESTAMP, null);
  if (!ts) return false;
  const age = Date.now() - Number(ts);
  console.log(`[CACHE] Antiguedad: ${(age / 3600000).toFixed(1)}h - TTL: ${CACHE_TTL / 3600000}h`);
  return age < CACHE_TTL;
}

export function saveToCache(users, streams) {
  const successUsers = storage.set(CACHE_KEY_USERS, users);
  const successStreams = storage.set(CACHE_KEY_STREAMS, streams);
  const successTs = storage.set(CACHE_KEY_TIMESTAMP, Date.now());
  if (successUsers && successStreams && successTs) {
    console.log(`[CACHE] Datos guardados - ${users.length} usuarios, ${streams.length} streams`);
  }
}

export function loadFromCache() {
  const users   = storage.get(CACHE_KEY_USERS, []);
  const streams = storage.get(CACHE_KEY_STREAMS, []);
  console.log(`[CACHE] Datos recuperados - ${users.length} usuarios, ${streams.length} streams`);
  return { users, streams };
}

// â”€â”€â”€ PROCESO DE STREAMS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function processStreamsData(data) {
  const possibleHistory = data.history || data.streams || data.list || data;
  let streams = [];
  if (Array.isArray(possibleHistory)) {
    streams = possibleHistory;
  } else if (typeof possibleHistory === 'object') {
    streams = Object.keys(possibleHistory).map(key => ({ _docId: key, ...possibleHistory[key] }));
  }

  if (streams.length > 0) {
    console.log('[ENGINE] Campos disponibles en el primer stream:', Object.keys(streams[0]));
    console.log('[ENGINE] Primer stream completo:', JSON.stringify(streams[0]));
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

  // Renombrada para no colisionar con getTitle() del scope exterior
  const resolveStreamTitle = (obj) => {
    const candidates = [
      obj.title, obj.name, obj.nombre, obj.titulo, obj.streamTitle,
      obj.stream_title, obj.gameName, obj.game_name, obj.label, obj.descripcion
    ];
    for (const c of candidates) {
      if (isTitleValid(c)) return c.trim();
    }
    return null;
  };

  const getTimestamp = (obj) => {
    const d = obj.date || obj.timestamp || obj.createdAt || obj.fecha;
    if (d?.seconds) return d.seconds * 1000;
    if (d) { const t = new Date(d).getTime(); if (!isNaN(t)) return t; }
    if (obj._docId) { const t = new Date(obj._docId).getTime(); if (!isNaN(t)) return t; }
    return 0;
  };

  const uniqueMap = new Map();
  streams.forEach(s => {
    const rawTitle = resolveStreamTitle(s) || 'SIN TITULO';
    if (rawTitle.toLowerCase().includes('test')) return;
    const normalizedName = rawTitle.toUpperCase().trim().replace(/\s+/g, ' ');
    const t = getTimestamp(s);
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

// ─── RANKING ─────────────────────────────────────────
export function getRankedUserIds(users) {
  const filtered = users.filter(u => getUserId(u) !== 'liiukiin');
  const sorted = [...filtered].sort((a, b) => {
    const lvlDiff = (b.level || 1) - (a.level || 1);
    if (lvlDiff !== 0) return lvlDiff;
    return (b.xp || 0) - (a.xp || 0);
  });
  return sorted.map(u => getUserId(u));
}

export function updateRankingHistory(users) {
  const currentRankedIds = getRankedUserIds(users);
  const storedCurr = storage.get('introbs_curr_ranking', null);

  if (!storedCurr) {
    storage.set('introbs_curr_ranking', currentRankedIds);
    storage.set('introbs_prev_ranking', currentRankedIds);
  } else {
    const isDifferent = storedCurr.length !== currentRankedIds.length ||
      currentRankedIds.some((id, idx) => id !== storedCurr[idx]);
    if (isDifferent) {
      storage.set('introbs_prev_ranking', storedCurr);
      storage.set('introbs_curr_ranking', currentRankedIds);
    }
  }
}

// ─── FIRESTORE ───────────────────────────────────────
export async function fetchFromFirestore() {
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

// ─── CONTROLADOR PRINCIPAL DE APLICACIÓN ──────────────────
export function initAppController({ renderScheduleCustom, onBeforeRenderContent }) {
  console.log('[ENGINE] Inicializando controlador principal');

  const menuList = document.getElementById('menuList');
  const contentArea = document.getElementById('contentArea');

  let currentMenuIndex = 0;
  let allUsers = [];
  let recentStreams = [];
  let menuTimer = null;

  // Iniciar vídeo de fondo
  initVideoBackground();

  function renderMenuLocal() {
    renderMenu(menuList, currentMenuIndex);
  }

  function renderActiveContent() {
    if (typeof onBeforeRenderContent === 'function') {
      onBeforeRenderContent();
    }
    contentArea.innerHTML = '';
    const activeItem = MENU_ITEMS[currentMenuIndex];
    switch (activeItem.id) {
      case 'horario':
        if (typeof renderScheduleCustom === 'function') {
          renderScheduleCustom(contentArea, { allUsers, recentStreams });
        }
        break;
      case 'topcanal':
        renderFeed(contentArea, allUsers);
        break;
      case 'item1':
        renderRecentStreams(contentArea, recentStreams);
        break;
      default:
        renderPlaceholder(contentArea, activeItem.title);
    }
  }

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

  function applyData(users, streams) {
    allUsers = users;
    updateRankingHistory(users);
    recentStreams = streams;
    renderActiveContent();
  }

  async function loadUsers() {
    try {
      if (isCacheValid()) {
        console.log('[CACHE] Usando datos en caché');
        const { users, streams } = loadFromCache();
        if (users.length > 0) {
          applyData(users, streams);
          return;
        }
        console.log('[CACHE] Caché vacía, forzando descarga...');
      }
      const { users, streams } = await fetchFromFirestore();
      saveToCache(users, streams);
      applyData(users, streams);
    } catch (err) {
      console.error('[ENGINE] Error de Firestore:', err);
      const { users, streams } = loadFromCache();
      if (users.length > 0) {
        console.log('[CACHE] Usando caché expirada como fallback');
        applyData(users, streams);
      } else {
        renderPlaceholder(contentArea, 'ERROR DE CONEXION');
      }
    }
  }

  renderMenuLocal();
  renderActiveContent();
  scheduleNextMenuRotation();
  loadUsers();
}

