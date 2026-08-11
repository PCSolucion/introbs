/* ═══════════════════════════════════════════════════════
   ENGINE.JS — Lógica compartida entre script.js y outro-script.js
   Contiene: helpers, caché, Firestore, vídeos, menú, feed, renders comunes
   ═══════════════════════════════════════════════════════ */

import { db } from './firebase.js';
import { collection, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js';
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
const STEAM_CACHE_KEY = 'introbs_steam_image_cache_v1';
const STEAM_NOT_FOUND_TTL = 24 * 60 * 60 * 1000; // 24h — reintenta después

const IGDB_CLIENT_ID = 'o2nod5eq628ebxttkeqo50ljyonim9';
const IGDB_SECRET = 'o2nod5eq628ebxttkeqo50ljyonim9';
let igdbToken = null;

async function getIgdbToken() {
  if (igdbToken) return igdbToken;
  try {
    const authUrl = `https://id.twitch.tv/oauth2/token?client_id=${IGDB_CLIENT_ID}&client_secret=${IGDB_SECRET}&grant_type=client_credentials`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(authUrl)}`;
    const res = await fetch(proxyUrl, { method: 'POST' });
    const data = await res.json();
    if (data && data.access_token) {
      igdbToken = data.access_token;
      return igdbToken;
    }
  } catch (e) {
    console.warn('[IGDB] Error obteniendo token:', e);
  }
  return null;
}

async function fetchIgdbCover(gameName) {
  try {
    const token = await getIgdbToken();
    if (!token) return null;

    const apiUrl = 'https://api.igdb.com/v4/games';
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`;
    const body = `search "${gameName}"; fields name,cover.image_id; limit 5;`;

    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Client-ID': IGDB_CLIENT_ID,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/plain'
      },
      body: body
    });

    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const cleanTarget = gameName.toLowerCase().trim();
      // Coincidencia exacta por nombre primero para evitar juegos equivocados de la saga
      let best = data.find(g => g.name && g.name.toLowerCase() === cleanTarget && g.cover && g.cover.image_id);
      if (!best) best = data.find(g => g.cover && g.cover.image_id);

      if (best && best.cover && best.cover.image_id) {
        return `https://images.igdb.com/igdb/image/upload/t_1080p/${best.cover.image_id}.jpg`;
      }
    }
  } catch (e) {
    console.warn('[IGDB] Error buscando carátula:', e);
  }
  return null;
}

function getSteamCache() {
  return storage.get(STEAM_CACHE_KEY, {});
}

function saveSteamCache(cache) {
  storage.set(STEAM_CACHE_KEY, cache);
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
  DESCANSO:    { image: 'fondos/descanso.png', isDescanso: true },
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

  const diskCache = getSteamCache();
  const entry = diskCache[cleanName];
  if (entry) {
    if (typeof entry === 'object') {
      if (entry.url === 'NOT_FOUND') {
        if (Date.now() - (entry.ts || 0) > STEAM_NOT_FOUND_TTL) return '';
        gameImageCache[cleanName] = 'NOT_FOUND';
        return '';
      }
      gameImageCache[cleanName] = entry.url;
      return entry.url;
    } else {
      if (entry === 'NOT_FOUND') return '';
      gameImageCache[cleanName] = entry;
      return entry;
    }
  }

  return '';
}

export function bindAsyncGameImage(imgEl, gameName, targetOpacity = '1', targetScale = 'scale(1.08)') {
  if (!imgEl || !gameName) return;
  getGameImage(gameName).then(url => {
    if (url) {
      imgEl.src = url;
      imgEl.style.opacity = targetOpacity;
      imgEl.style.transform = targetScale;
    }
  });
}

export async function getGameImage(gameName) {
  if (!gameName) return '';
  const syncUrl = getGameImageSync(gameName);
  if (syncUrl) return syncUrl;

  const cleanName = gameName.trim();
  if (gameImageCache[cleanName] === 'NOT_FOUND') return '';

  // 1. Steam Store Search vía api.allorigins.win (Proxy fiable de Cloudflare)
  try {
    const steamUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(cleanName)}&l=spanish&cc=ES`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(steamUrl)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && data.contents) {
        const parsed = JSON.parse(data.contents);
        if (parsed && parsed.items && parsed.items.length > 0) {
          const appId = parsed.items[0].id;
          // library_600x900_2x.jpg = Carátula vertical oficial de alta resolución en Steam
          const imgUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`;
          gameImageCache[cleanName] = imgUrl;
          const diskCache = getSteamCache();
          diskCache[cleanName] = { url: imgUrl, ts: Date.now() };
          saveSteamCache(diskCache);
          console.log(`[STEAM COVER] "${cleanName}" → AppID ${appId} → ${imgUrl}`);
          return imgUrl;
        }
      }
    }
  } catch (e) {
    console.warn(`[STEAM COVER] Error para "${cleanName}":`, e);
  }

  // 2. Fallback: Wikipedia API (origin=* nativo sin proxies)
  try {
    const wikiUrl = `https://es.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(cleanName + ' videojuego')}&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=1000`;
    const res = await fetch(wikiUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && data.query && data.query.pages) {
        const pages = Object.values(data.query.pages);
        if (pages.length > 0 && pages[0].thumbnail && pages[0].thumbnail.source) {
          const imgUrl = pages[0].thumbnail.source;
          gameImageCache[cleanName] = imgUrl;
          const diskCache = getSteamCache();
          diskCache[cleanName] = { url: imgUrl, ts: Date.now() };
          saveSteamCache(diskCache);
          console.log(`[WIKI COVER] "${cleanName}" → ${imgUrl}`);
          return imgUrl;
        }
      }
    }
  } catch (e) {
    console.warn(`[WIKI COVER] Error para "${cleanName}":`, e);
  }

  // Marcar como NOT_FOUND
  gameImageCache[cleanName] = 'NOT_FOUND';
  const diskCache = getSteamCache();
  diskCache[cleanName] = { url: 'NOT_FOUND', ts: Date.now() };
  saveSteamCache(diskCache);

  return '';
}


// ─── MENÚ ────────────────────────────────────────────
export const MENU_ITEMS = [
  { id: 'horario',  title: 'HORARIOS',         sub: 'Stream Schedule' },
  { id: 'topcanal', title: 'TOP',              sub: 'Community Feed' },
  { id: 'item1',    title: 'ULTIMOS DIRECTOS', sub: 'Archive' },
];

export const MENU_DURATIONS = {
  horario: 15000,   // 15 segundos (un poco menos de 20s)
  topcanal: 40000,  // 40 segundos (el doble de 20s)
  item1: 10000,     // 10 segundos (la mitad de 20s)
};

export const DAY_NAMES = {
  lunes: 'LUNES', martes: 'MARTES', miercoles: 'MIERCOLES',
  jueves: 'JUEVES', viernes: 'VIERNES', sabado: 'SABADO', domingo: 'DOMINGO',
};

export const DAY_KEYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

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
const VIDEO_RATES = {
  'fondos/isabela.mp4': 0.5
};

function getVideoPlaybackRate(videoFile) {
  return VIDEO_RATES[videoFile] || 1.0;
}

export function initVideoBackground() {
  const v1 = document.getElementById('bgVideo1');
  const v2 = document.getElementById('bgVideo2');
  if (!v1 || !v2) return;

  let activeV = v1;
  let nextV = v2;
  let bgi = 0;
  let isSwitching = false;

  activeV.src = CONFIG.backgrounds[bgi];
  activeV.playbackRate = getVideoPlaybackRate(CONFIG.backgrounds[bgi]);
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
        nextV.playbackRate = getVideoPlaybackRate(videoFile);
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

// ─── RENDER: MENÚ ────────────────────────────────────────────
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

export function getRankChangeBadge(prevRankIndex, currentRank) {
  if (prevRankIndex === -1) {
    return `<span class="rank-change-indicator rank-new">NEW</span>`;
  }
  const diff = (prevRankIndex + 1) - currentRank;
  if (diff > 0) return `<span class="rank-change-indicator rank-up">&#9650; ${diff}</span>`;
  if (diff < 0) return `<span class="rank-change-indicator rank-down">&#9660; ${Math.abs(diff)}</span>`;
  return `<span class="rank-change-indicator rank-equal">EQ</span>`;
}

// ─── RENDER: FEED (TOP 10) ───────────────────────────
export function renderFeed(contentArea, allUsers) {
  if (allUsers.length === 0) {
    renderPlaceholder(contentArea, 'CARGANDO DATOS...');
    return;
  }

  const top10 = getTopRankedUsers(allUsers, 10);
  const prevRankingArray = storage.get('introbs_prev_ranking', []);

  const feedContainer = document.createElement('div');
  feedContainer.className = 'content-view-container sch-strips-container';

  top10.forEach((u, i) => {
    const name = formatDisplayName(u);
    const lvl = u.level || 1;

    const currentUserId = getUserId(u);
    const currentRank = i + 1;
    const prevRankIndex = prevRankingArray.indexOf(currentUserId);
    const changeHTML = getRankChangeBadge(prevRankIndex, currentRank);

    // ── Useful side-by-side stats from Firestore
    const xp = u.xp || 0;
    const msgs = u.totalMessages || u.messagesCount || u.messages || 0;
    const streak = u.streakDays || u.streak || 0;
    const watch = u.watchTimeMinutes || u.watchTime || 0;
    const boost = (1 + Math.min(1.5, (streak * 0.05) + (lvl * 0.01))).toFixed(1);

    const statsList = [
      `<span class="sch-stat"><span class="sch-stat-lbl">XP</span> <span class="sch-stat-val">${formatNum(xp)}</span></span>`,
      `<span class="sch-stat"><span class="sch-stat-lbl">CHAT</span> <span class="sch-stat-val">${formatNum(msgs)} MSG</span></span>`,
      `<span class="sch-stat"><span class="sch-stat-lbl">BOOST</span> <span class="sch-stat-val">x${boost}</span></span>`,
    ];
    if (watch > 0) {
      statsList.push(`<span class="sch-stat"><span class="sch-stat-lbl">TIEMPO</span> <span class="sch-stat-val">${formatTime(watch)}</span></span>`);
    }

    const statsHTML = statsList.join('<span class="sch-stat-sep">//</span>');

    const strip = document.createElement('div');
    strip.className = 'sch-strip sch-strip--ranked feed-enter';
    strip.style.animationDelay = `${i * 0.06}s`;

    // ── Smooth gradient: --si goes from 1.0 (#1) to 0.0 (#10)
    const intensity = 1 - (i / (top10.length - 1 || 1));
    strip.style.setProperty('--si', intensity.toFixed(3));

    // ── Rank column
    const rankCol = document.createElement('div');
    rankCol.className = 'sch-strip-day';
    rankCol.innerHTML = `
      <span class="sch-strip-dayname">#${currentRank}</span>
      <span class="sch-strip-date">${changeHTML}</span>
    `;
    strip.appendChild(rankCol);

    // ── Divider
    const divider = document.createElement('div');
    divider.className = 'sch-strip-divider';
    strip.appendChild(divider);

    // ── Content: name + side-by-side stats
    const content = document.createElement('div');
    content.className = 'sch-strip-content';
    content.innerHTML = `
      <div class="sch-strip-game-row">
        <span class="sch-strip-game">${name}</span>
        <span class="sch-strip-time">LVL ${lvl}</span>
      </div>
      <div class="sch-strip-stats">${statsHTML}</div>
    `;
    strip.appendChild(content);

    feedContainer.appendChild(strip);
  });
  contentArea.appendChild(feedContainer);
}


export function formatStreamDate(rawDate) {
  if (!rawDate) return '--/--';
  const dateObj = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate);
  return !isNaN(dateObj)
    ? dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
    : '--/--';
}

// ─── RENDER: ÚLTIMOS DIRECTOS ─────────────────────────
export function renderRecentStreams(contentArea, recentStreams) {
  if (recentStreams.length === 0) {
    renderPlaceholder(contentArea, 'CARGANDO ARCHIVOS...');
    return;
  }
  const container = document.createElement('div');
  container.className = 'content-view-container sch-strips-container';

  recentStreams.forEach((s, i) => {
    const rawDate = s.date || s.timestamp || s.createdAt || s.fecha || s._docId;
    const dateStr = formatStreamDate(rawDate);

    const title = (s._resolvedTitle || s.title || s.name || s.nombre || s.titulo || s.streamTitle || s.stream_title || s.label || 'SIN TITULO').toUpperCase();
    const category = (s.category || s.game || s.categoria || 'VARIEDAD').toUpperCase();

    const strip = document.createElement('div');
    strip.className = `sch-strip feed-enter${i === 0 ? ' sch-strip--active' : ''}`;
    strip.style.animationDelay = `${i * 0.08}s`;

    // ── Date column
    const dateCol = document.createElement('div');
    dateCol.className = 'sch-strip-day';
    dateCol.innerHTML = `
      <span class="sch-strip-dayname">${dateStr}</span>
      <span class="sch-strip-date">ARCHIVE</span>
    `;
    strip.appendChild(dateCol);

    // ── Divider
    const divider = document.createElement('div');
    divider.className = 'sch-strip-divider';
    strip.appendChild(divider);

    // ── Content: title + category
    const content = document.createElement('div');
    content.className = 'sch-strip-content';
    content.innerHTML = `
      <div class="sch-strip-game-row">
        <span class="sch-strip-game">${title}</span>
      </div>
      <span class="sch-strip-subtitle">${category}</span>
    `;
    strip.appendChild(content);

    container.appendChild(strip);
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
export function getTopRankedUsers(users, limit = 10) {
  if (!Array.isArray(users)) return [];
  const filtered = users.filter(u => getUserId(u) !== 'liiukiin');
  const sorted = [...filtered].sort((a, b) => {
    const lvlDiff = (b.level || 1) - (a.level || 1);
    if (lvlDiff !== 0) return lvlDiff;
    return (b.xp || 0) - (a.xp || 0);
  });
  return limit > 0 ? sorted.slice(0, limit) : sorted;
}

export function getRankedUserIds(users) {
  return getTopRankedUsers(users, 0).map(u => getUserId(u));
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
    const activeItem = MENU_ITEMS[currentMenuIndex];
    const duration = MENU_DURATIONS[activeItem.id] || CONFIG.menuInterval;
    menuTimer = setTimeout(rotateMenu, duration);
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

