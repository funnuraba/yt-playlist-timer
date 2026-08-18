(() => {
  // ==========================================
  // ここにお好きなカラーコードを設定してください
  // ==========================================
  const THEME_COLOR = '#4a5455'; // Edgeのティール色
  const SUB_TEXT_COLOR = '#a1b7ba';

  function parseSeconds(str) {
    if (!str) return 0;
    const clean = str.replace(/[^\d:]/g, '');
    const parts = clean.split(':').map(Number);
    if (parts.some(isNaN)) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }

  function formatTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const parts = [];
    if (h > 0) parts.push(`${h}時間`);
    if (m > 0 || h > 0) parts.push(`${m}分`);
    parts.push(`${s}秒`);
    return parts.join('') || '0秒';
  }

  function isFullscreen() {
    return Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.querySelector('.html5-video-player.ytp-fullscreen')
    );
  }

  function extractDuration(element) {
    const timeNode = element.querySelector(
      'ytd-thumbnail-overlay-time-status-renderer span, badge-shape span, #time, #text'
    );
    if (timeNode) {
      const match = timeNode.textContent.match(/\b(?:\d+:)?\d{1,2}:\d{2}\b/);
      if (match) return parseSeconds(match[0]);
    }
    const match = element.textContent.match(/\b(?:\d+:)?\d{1,2}:\d{2}\b/);
    return match ? parseSeconds(match[0]) : 0;
  }

  function getOrCreateBadge() {
    let badge = document.getElementById('yt-playlist-badge-fixed');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'yt-playlist-badge-fixed';
      badge.style.cssText = `
        position: fixed !important;
        bottom: 24px !important;
        right: 24px !important;
        background-color: #ffffff !important;
        color: ${SUB_TEXT_COLOR} !important;
        border: 2px solid ${SUB_TEXT_COLOR} !important;
        padding: 10px 16px !important;
        border-radius: 10px !important;
        font-size: 13px !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15) !important;
        z-index: 2147483647 !important;
        pointer-events: none !important;
        line-height: 1.5 !important;
      `;
      document.body.appendChild(badge);
    }
    return badge;
  }

  let lastState = { url: '', itemCount: 0, currentIndex: -1 };

  function update() {
    const badge = document.getElementById('yt-playlist-badge-fixed');
    const isPlaylistPage = location.pathname.includes('/playlist');
    const isWatchPlaylist = location.pathname.includes('/watch') && location.search.includes('list=');

    if (isFullscreen() || (!isPlaylistPage && !isWatchPlaylist)) {
      if (badge) badge.style.display = 'none';
      return;
    }

    if (isWatchPlaylist) {
      const items = Array.from(document.querySelectorAll('ytd-playlist-panel-video-renderer'));
      if (items.length === 0) return;

      const currentVideoId = new URLSearchParams(location.search).get('v');
      let currentIndex = items.findIndex(item => {
        return item.hasAttribute('selected') || 
               item.classList.contains('selected') ||
               (currentVideoId && item.querySelector(`a[href*="${currentVideoId}"]`));
      });
      if (currentIndex === -1) currentIndex = 0;

      if (
        lastState.url === location.href &&
        lastState.itemCount === items.length &&
        lastState.currentIndex === currentIndex &&
        badge && badge.style.display === 'block'
      ) {
        return;
      }

      let totalSec = 0;
      let remainingSec = 0;

      items.forEach((item, index) => {
        const sec = extractDuration(item);
        totalSec += sec;
        if (index >= currentIndex) remainingSec += sec;
      });

      const remainingCount = items.length - currentIndex;
      const targetBadge = getOrCreateBadge();
      targetBadge.style.display = 'block';
      targetBadge.innerHTML = `
        <div style="font-weight: bold; color: ${THEME_COLOR};">⏱ 残り時間: ${formatTime(remainingSec)} <span style="font-size: 11px; color: ${SUB_TEXT_COLOR}; font-weight: normal;">(${remainingCount}本)</span></div>
        <div style="font-size: 11px; color: ${SUB_TEXT_COLOR}; margin-top: 2px;">全体: ${formatTime(totalSec)} (${items.length}本中 ${currentIndex + 1}本目を再生中)</div>
      `;

      lastState = { url: location.href, itemCount: items.length, currentIndex };

    } else if (isPlaylistPage) {
      const items = Array.from(document.querySelectorAll('ytd-playlist-video-renderer'));
      if (items.length === 0) return;

      if (
        lastState.url === location.href &&
        lastState.itemCount === items.length &&
        badge && badge.style.display === 'block'
      ) {
        return;
      }

      let totalSec = 0;
      items.forEach(item => { totalSec += extractDuration(item); });

      const targetBadge = getOrCreateBadge();
      targetBadge.style.display = 'block';
      targetBadge.innerHTML = `
        <div style="font-weight: bold; color: ${THEME_COLOR};">⏱ 合計再生時間: ${formatTime(totalSec)}</div>
        <div style="font-size: 11px; color: ${THEME_COLOR}; margin-top: 2px;">読み込み済み: ${items.length}本</div>
      `;

      lastState = { url: location.href, itemCount: items.length, currentIndex: -1 };
    }
  }

  document.addEventListener('fullscreenchange', () => {
    const badge = document.getElementById('yt-playlist-badge-fixed');
    if (!badge) return;
    if (isFullscreen()) {
      badge.style.display = 'none';
    } else {
      update();
    }
  });

  setInterval(update, 1000);
})();