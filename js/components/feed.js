import { storage } from '../core/storage.js';
import { getUserId, formatDisplayName, formatNum, formatTime } from '../core/utils.js';
import { getTitle } from '../core/constants.js';
import { renderPlaceholder } from './placeholder.js';

export function getRankChangeBadge(prevRankIndex, currentRank) {
  if (prevRankIndex === -1) {
    return `<span class="rank-change-indicator rank-new">NEW</span>`;
  }
  const diff = (prevRankIndex + 1) - currentRank;
  if (diff > 0) return `<span class="rank-change-indicator rank-up">&#9650; ${diff}</span>`;
  if (diff < 0) return `<span class="rank-change-indicator rank-down">&#9660; ${Math.abs(diff)}</span>`;
  return `<span class="rank-change-indicator rank-equal">EQ</span>`;
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
        <span class="sch-strip-time">LVL ${lvl}</span>
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
