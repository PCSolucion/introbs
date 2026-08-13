import { DAY_KEYS } from './constants.js';

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
