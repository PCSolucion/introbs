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
