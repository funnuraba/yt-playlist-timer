(() => {
  'use strict';

  const BADGE_ID = 'yt-playlist-duration-badge';
  const THEME_COLOR = '#4a5455';
  const SUB_TEXT_COLOR = '#789094';
  const WATCH_ITEM_SELECTOR = 'ytd-playlist-panel-video-renderer';
  const PLAYLIST_ITEM_SELECTOR = 'ytd-playlist-video-renderer';
  const WATCH_CONTAINER_SELECTOR = 'ytd-playlist-panel-renderer';
  const PLAYLIST_CONTAINER_SELECTOR = 'ytd-playlist-video-list-renderer';
  const DURATION_SELECTOR = [
    'ytd-thumbnail-overlay-time-status-renderer #text',
    'ytd-thumbnail-overlay-time-status-renderer span',
    'badge-shape .yt-badge-shape__text',
    'badge-shape span',
    '#time',
  ].join(',');
  const RELEVANT_SELECTOR = [
    WATCH_ITEM_SELECTOR,
    PLAYLIST_ITEM_SELECTOR,
    WATCH_CONTAINER_SELECTOR,
    PLAYLIST_CONTAINER_SELECTOR,
  ].join(',');

  let lastRenderSignature = '';
  let lastKnownUrl = location.href;
  let observedContainer = null;
  let updateScheduled = false;

  function parseDuration(text) {
    if (!text) return null;

    const match = text.replace(/\u00a0/g, ' ').match(/\b(?:(\d+):)?([0-5]?\d):([0-5]\d)\b/);
    if (!match) return null;

    const hours = Number(match[1] || 0);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    return hours * 3600 + minutes * 60 + seconds;
  }

  function formatDuration(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [];

    if (hours > 0) parts.push(`${hours}時間`);
    if (minutes > 0 || hours > 0) parts.push(`${minutes}分`);
    parts.push(`${seconds}秒`);
    return parts.join(' ');
  }

  function isFullscreen() {
    return Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.querySelector('.html5-video-player.ytp-fullscreen')
    );
  }

  function getPageMode() {
    if (location.pathname === '/playlist') return 'playlist';
    if (location.pathname === '/watch' && new URLSearchParams(location.search).has('list')) {
      return 'watch';
    }
    return null;
  }

  function extractDuration(element) {
    for (const node of element.querySelectorAll(DURATION_SELECTOR)) {
      const duration = parseDuration(node.textContent);
      if (duration !== null) return duration;
    }

    return parseDuration(element.textContent) ?? 0;
  }

  function getOrCreateBadge() {
    let badge = document.getElementById(BADGE_ID);
    if (badge) return badge;

    badge = document.createElement('aside');
    badge.id = BADGE_ID;
    badge.setAttribute('aria-label', '再生リストの再生時間');
    badge.style.cssText = `
      position: fixed !important;
      right: 24px !important;
      bottom: 24px !important;
      max-width: calc(100vw - 48px) !important;
      box-sizing: border-box !important;
      padding: 10px 16px !important;
      border: 2px solid ${SUB_TEXT_COLOR} !important;
      border-radius: 10px !important;
      background: #ffffff !important;
      color: ${SUB_TEXT_COLOR} !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15) !important;
      font: 13px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      pointer-events: none !important;
      z-index: 2147483647 !important;
    `;
    document.body.appendChild(badge);
    return badge;
  }

  function hideBadge() {
    const badge = document.getElementById(BADGE_ID);
    if (badge) badge.style.setProperty('display', 'none', 'important');
  }

  function renderBadge(signature, primaryText, secondaryText) {
    const badge = getOrCreateBadge();
    badge.style.setProperty('display', 'block', 'important');

    if (signature === lastRenderSignature && badge.childElementCount > 0) return;

    const primary = document.createElement('div');
    primary.textContent = primaryText;
    primary.style.cssText = `font-weight: 700 !important; color: ${THEME_COLOR} !important;`;

    const secondary = document.createElement('div');
    secondary.textContent = secondaryText;
    secondary.style.cssText = `margin-top: 2px !important; color: ${SUB_TEXT_COLOR} !important; font-size: 11px !important;`;

    badge.replaceChildren(primary, secondary);
    lastRenderSignature = signature;
  }

  function getCurrentIndex(items) {
    const selectedIndex = items.findIndex((item) =>
      item.hasAttribute('selected') ||
      item.classList.contains('selected') ||
      item.getAttribute('aria-current') === 'true'
    );
    if (selectedIndex >= 0) return selectedIndex;

    const currentVideoId = new URLSearchParams(location.search).get('v');
    if (!currentVideoId) return 0;

    const urlIndex = items.findIndex((item) => {
      const link = item.querySelector('a[href*="/watch"]');
      if (!link) return false;

      try {
        return new URL(link.href, location.origin).searchParams.get('v') === currentVideoId;
      } catch {
        return false;
      }
    });
    return Math.max(urlIndex, 0);
  }

  function update() {
    updateScheduled = false;
    lastKnownUrl = location.href;

    const mode = getPageMode();
    if (!mode || isFullscreen()) {
      observePlaylistContainer(null);
      hideBadge();
      return;
    }

    const selector = mode === 'watch' ? WATCH_ITEM_SELECTOR : PLAYLIST_ITEM_SELECTOR;
    const items = Array.from(document.querySelectorAll(selector));
    observePlaylistContainer(mode, items);
    if (items.length === 0) {
      hideBadge();
      lastRenderSignature = '';
      return;
    }

    const durations = items.map(extractDuration);
    const totalSeconds = durations.reduce((total, duration) => total + duration, 0);
    const measuredCount = durations.filter((duration) => duration > 0).length;
    const loadedLabel = measuredCount === items.length
      ? `${items.length}本を読み込み済み`
      : `${measuredCount}/${items.length}本の時間を取得済み`;

    if (mode === 'playlist') {
      const signature = `playlist:${durations.join(',')}`;
      renderBadge(
        signature,
        `合計再生時間: ${formatDuration(totalSeconds)}`,
        loadedLabel
      );
      return;
    }

    const currentIndex = getCurrentIndex(items);
    const remainingSeconds = durations
      .slice(currentIndex)
      .reduce((total, duration) => total + duration, 0);
    const remainingCount = items.length - currentIndex;
    const signature = `watch:${currentIndex}:${durations.join(',')}`;

    renderBadge(
      signature,
      `残り時間: ${formatDuration(remainingSeconds)}（${remainingCount}本）`,
      `合計: ${formatDuration(totalSeconds)} / ${items.length}本中 ${currentIndex + 1}本目を再生中`
    );
  }

  function scheduleUpdate() {
    if (updateScheduled) return;
    updateScheduled = true;
    window.setTimeout(update, 200);
  }

  function observePlaylistContainer(mode, items = []) {
    const containerSelector = mode === 'watch'
      ? WATCH_CONTAINER_SELECTOR
      : mode === 'playlist'
        ? PLAYLIST_CONTAINER_SELECTOR
        : null;
    const container = containerSelector
      ? document.querySelector(containerSelector) || items[0]?.parentElement || null
      : null;

    if (container === observedContainer) return;

    playlistObserver.disconnect();
    observedContainer = container;
    if (!container) return;

    playlistObserver.observe(container, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['selected', 'aria-current'],
    });
  }

  const playlistObserver = new MutationObserver(scheduleUpdate);

  const pageObserver = new MutationObserver((mutations) => {
    const playlistWasAdded = mutations.some((mutation) =>
      Array.from(mutation.addedNodes).some((node) =>
        node.nodeType === Node.ELEMENT_NODE &&
        (node.matches(RELEVANT_SELECTOR) || node.querySelector(RELEVANT_SELECTOR))
      )
    );
    if (playlistWasAdded) scheduleUpdate();
  });

  // ページ全体ではコンテナの追加だけを監視し、詳細な監視は再生リスト内に限定する。
  pageObserver.observe(document.documentElement, {
    subtree: true,
    childList: true,
  });

  document.addEventListener('yt-navigate-start', hideBadge);
  document.addEventListener('yt-navigate-finish', scheduleUpdate);
  document.addEventListener('yt-page-data-updated', scheduleUpdate);
  document.addEventListener('fullscreenchange', scheduleUpdate);
  document.addEventListener('webkitfullscreenchange', scheduleUpdate);
  window.addEventListener('popstate', scheduleUpdate);

  // YouTube側のイベント仕様変更に備え、URLだけを低コストで監視する。
  window.setInterval(() => {
    if (location.href !== lastKnownUrl) scheduleUpdate();
  }, 2000);

  scheduleUpdate();
})();
