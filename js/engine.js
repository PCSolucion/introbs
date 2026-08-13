import { SCHEDULE } from './schedule.js';

// Core
import { LEVEL_TITLES, getTitle, CONFIG, MENU_ITEMS, MENU_DURATIONS, DAY_NAMES, DAY_KEYS } from './core/constants.js';
import { getNormalizedDayIndex, getDayKey, getWeekDates, getUserId, formatDisplayName, formatNum, formatTime, parseStreamTime } from './core/utils.js';
import { storage, isCacheValid, saveToCache, loadFromCache } from './core/storage.js';
import { initVideoBackground } from './core/video-manager.js';

// Services
import { SPECIAL_GAMES, isDescansoGame, getGameImageSync, getGameImage, preloadGameImage, bindAsyncGameImage } from './services/steam-api.js';
import { processStreamsData, fetchFromFirestore } from './services/firebase-data.js';

// Components
import { renderPlaceholder } from './components/placeholder.js';
import { renderMenu } from './components/menu.js';
import { getRankChangeBadge, getTopRankedUsers, getRankedUserIds, updateRankingHistory, renderFeed, buildFeedQueue } from './components/feed.js';
import { formatStreamDate, renderRecentStreams } from './components/recent-streams.js';

export {
  SCHEDULE,
  LEVEL_TITLES, getTitle, CONFIG, MENU_ITEMS, MENU_DURATIONS, DAY_NAMES, DAY_KEYS,
  getNormalizedDayIndex, getDayKey, getWeekDates, getUserId, formatDisplayName, formatNum, formatTime, parseStreamTime,
  storage, isCacheValid, saveToCache, loadFromCache,
  initVideoBackground,
  SPECIAL_GAMES, isDescansoGame, getGameImageSync, getGameImage, preloadGameImage, bindAsyncGameImage,
  processStreamsData, fetchFromFirestore,
  renderPlaceholder,
  renderMenu,
  getRankChangeBadge, getTopRankedUsers, getRankedUserIds, updateRankingHistory, renderFeed, buildFeedQueue,
  formatStreamDate, renderRecentStreams
};

export function initAppController({ renderScheduleCustom, onBeforeRenderContent }) {
  console.log('[ENGINE] Inicializando controlador principal (Modular)');

  const menuList = document.getElementById('menuList');
  const contentArea = document.getElementById('contentArea');

  let currentMenuIndex = 0;
  let allUsers = [];
  let recentStreams = [];
  let menuTimer = null;

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
    const activeItem = MENU_ITEMS[currentMenuIndex];
    // Evitar parpadeo/doble animación: el horario no depende de Firestore/caché
    if (activeItem && activeItem.id !== 'horario') {
      renderActiveContent();
    }
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
