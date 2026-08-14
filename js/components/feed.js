import { storage } from '../core/storage.js';
import { getUserId, formatDisplayName, formatNum, formatTime } from '../core/utils.js';
import { getTitle } from '../core/constants.js';
import { renderPlaceholder } from './placeholder.js';

function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDeltaTime(minutes) {
  if (!minutes || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `+${h}h ${m}m`;
  if (h > 0) return `+${h}h`;
  return `+${m}m`;
}

export function getRankChangeBadge(prevRank, currentRank, hasHistory = true) {
  if (!hasHistory) {
    return `<span class="rank-change-indicator rank-equal">&minus;</span>`;
  }
  if (!prevRank || prevRank === -1) {
    return `<span class="rank-change-indicator rank-new">NEW</span>`;
  }
  const diff = prevRank - currentRank;
  if (diff > 0) return `<span class="rank-change-indicator rank-up">&#9650; ${diff}</span>`;
  if (diff < 0) return `<span class="rank-change-indicator rank-down">&#9660; ${Math.abs(diff)}</span>`;
  return `<span class="rank-change-indicator rank-equal">&minus;</span>`;
}

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

export function getPreviousDailySnapshot() {
  const today = getTodayDateString();
  const snapshots = storage.get('introbs_daily_snapshots', {});
  const dates = Object.keys(snapshots)
    .filter(d => d < today)
    .sort();

  if (dates.length === 0) return null;
  const latestPrevDate = dates[dates.length - 1];
  return snapshots[latestPrevDate] || null;
}

export function updateRankingHistory(users) {
  if (!Array.isArray(users) || users.length === 0) return;

  const today = getTodayDateString();
  const snapshots = storage.get('introbs_daily_snapshots', {});

  // Limpiar snapshots con más de 7 días de antigüedad
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoffStr = sevenDaysAgo.toISOString().slice(0, 10);

  const cleaned = {};
  for (const dateKey of Object.keys(snapshots).sort()) {
    if (dateKey >= cutoffStr) {
      cleaned[dateKey] = snapshots[dateKey];
    }
  }

  // Generar snapshot actual
  const currentSnapshot = {};
  const allRanked = getTopRankedUsers(users, 0);
  allRanked.forEach((u, index) => {
    const uid = getUserId(u);
    currentSnapshot[uid] = {
      rank: index + 1,
      xp: u.xp || 0,
      msgs: u.totalMessages || u.messagesCount || u.messages || 0,
      watch: u.watchTimeMinutes || u.watchTime || 0,
      level: u.level || 1
    };
  });

  cleaned[today] = currentSnapshot;
  storage.set('introbs_daily_snapshots', cleaned);
}

export function renderFeed(contentArea, allUsers) {
  if (allUsers.length === 0) {
    renderPlaceholder(contentArea, 'CARGANDO DATOS...');
    return;
  }

  const top10 = getTopRankedUsers(allUsers, 10);
  const prevSnapshot = getPreviousDailySnapshot();
  const hasHistory = prevSnapshot !== null;

  const feedContainer = document.createElement('div');
  feedContainer.className = 'content-view-container sch-strips-container';

  top10.forEach((u, i) => {
    const name = formatDisplayName(u);
    const lvl = u.level || 1;
    const currentUserId = getUserId(u);
    const currentRank = i + 1;

    const prevUser = prevSnapshot ? prevSnapshot[currentUserId] : null;
    const prevRank = prevUser ? prevUser.rank : -1;
    const changeHTML = getRankChangeBadge(prevRank, currentRank, hasHistory);

    const xp = u.xp || 0;
    const msgs = u.totalMessages || u.messagesCount || u.messages || 0;
    const streak = u.streakDays || u.streak || 0;
    const watch = u.watchTimeMinutes || u.watchTime || 0;
    const boost = (1 + Math.min(1.5, (streak * 0.05) + (lvl * 0.01))).toFixed(1);

    // Comparativa diaria de estadísticas
    const deltaXP = prevUser ? (xp - (prevUser.xp || 0)) : 0;
    const deltaMsgs = prevUser ? (msgs - (prevUser.msgs || 0)) : 0;
    const deltaWatch = prevUser ? (watch - (prevUser.watch || 0)) : 0;
    const deltaLevel = prevUser ? (lvl - (prevUser.level || 1)) : 0;

    const xpDeltaHTML = deltaXP > 0 ? ` <span class="stat-delta stat-delta--up">+${formatNum(deltaXP)}</span>` : '';
    const msgsDeltaHTML = deltaMsgs > 0 ? ` <span class="stat-delta stat-delta--up">+${formatNum(deltaMsgs)}</span>` : '';
    const watchDeltaHTML = deltaWatch > 0 ? ` <span class="stat-delta stat-delta--up">${formatDeltaTime(deltaWatch)}</span>` : '';
    const lvlDeltaHTML = deltaLevel > 0 ? ` <span class="stat-delta stat-delta--lvl">+${deltaLevel}</span>` : '';

    const statsList = [
      `<span class="sch-stat"><span class="sch-stat-lbl">XP</span> <span class="sch-stat-val">${formatNum(xp)}</span>${xpDeltaHTML}</span>`,
      `<span class="sch-stat"><span class="sch-stat-lbl">CHAT</span> <span class="sch-stat-val">${formatNum(msgs)} MSG</span>${msgsDeltaHTML}</span>`,
      `<span class="sch-stat"><span class="sch-stat-lbl">BOOST</span> <span class="sch-stat-val">x${boost}</span></span>`,
    ];
    if (watch > 0) {
      statsList.push(`<span class="sch-stat"><span class="sch-stat-lbl">TIEMPO</span> <span class="sch-stat-val">${formatTime(watch)}</span>${watchDeltaHTML}</span>`);
    }

    const statsHTML = statsList.join('<span class="sch-stat-sep">//</span>');

    const strip = document.createElement('div');
    strip.className = 'sch-strip sch-strip--ranked feed-enter';
    strip.style.animationDelay = `${i * 0.06}s`;

    const intensity = 1 - (i / (top10.length - 1 || 1));
    strip.style.setProperty('--si', intensity.toFixed(3));

    const rankCol = document.createElement('div');
    rankCol.className = 'sch-strip-day';
    rankCol.innerHTML = `
      <span class="sch-strip-dayname">#${currentRank}</span>
      <span class="sch-strip-date">${changeHTML}</span>
    `;
    strip.appendChild(rankCol);

    const divider = document.createElement('div');
    divider.className = 'sch-strip-divider';
    strip.appendChild(divider);

    const content = document.createElement('div');
    content.className = 'sch-strip-content';
    content.innerHTML = `
      <div class="sch-strip-game-row">
        <span class="sch-strip-game">${name}</span>
        <span class="sch-strip-time">LVL ${lvl}${lvlDeltaHTML}</span>
      </div>
      <div class="sch-strip-stats">${statsHTML}</div>
    `;
    strip.appendChild(content);

    feedContainer.appendChild(strip);
  });
  contentArea.appendChild(feedContainer);
}

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
