import { storage } from '../core/storage.js';

const gameImageCache = {};
const STEAM_CACHE_KEY = 'introbs_steam_image_cache_v1';
const STEAM_NOT_FOUND_TTL = 24 * 60 * 60 * 1000; // 24h — reintenta después

export const SPECIAL_GAMES = {
  DESCANSO:    { image: 'fondos/descanso.png', isDescanso: true },
  INFORMATICA: { image: 'fondos/informatica-bg.jpg' },
};

function getSteamCache() {
  return storage.get(STEAM_CACHE_KEY, {});
}

function saveSteamCache(cache) {
  storage.set(STEAM_CACHE_KEY, cache);
}

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

export async function getGameImage(gameName) {
  if (!gameName) return '';
  const syncUrl = getGameImageSync(gameName);
  if (syncUrl) return syncUrl;

  const cleanName = gameName.trim();
  if (gameImageCache[cleanName] === 'NOT_FOUND') return '';

  // 1. Steam Store Search vía api.allorigins.win
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

  // 2. Fallback: Wikipedia API
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

export async function preloadGameImage(gameName) {
  if (!gameName) return;
  const url = await getGameImage(gameName);
  if (url) {
    const img = new Image();
    img.src = url;
  }
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
