'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const contentPath = path.join(__dirname, '..', 'content.js');
const originalSource = fs.readFileSync(contentPath, 'utf8');
const instrumentedSource = originalSource.replace(
  /\s+scheduleUpdate\(\);\s*\}\)\(\);\s*$/,
  '\n  globalThis.testApi = { parseDuration, formatDuration, getPageMode };\n})();'
);

assert.notEqual(instrumentedSource, originalSource, 'テスト用APIを公開できませんでした');

const context = {
  URL,
  URLSearchParams,
  Node: { ELEMENT_NODE: 1 },
  MutationObserver: class {
    observe() {}
  },
  document: {
    documentElement: {},
    fullscreenElement: null,
    webkitFullscreenElement: null,
    querySelector: () => null,
    getElementById: () => null,
    addEventListener: () => {},
  },
  location: {
    href: 'https://www.youtube.com/playlist?list=test',
    origin: 'https://www.youtube.com',
    pathname: '/playlist',
    search: '?list=test',
  },
  window: {
    addEventListener: () => {},
    setInterval: () => 0,
    setTimeout: () => 0,
  },
};

vm.runInNewContext(instrumentedSource, context, { filename: contentPath });

const { parseDuration, formatDuration, getPageMode } = context.testApi;

assert.equal(parseDuration('3:25'), 205);
assert.equal(parseDuration('1:02:03'), 3723);
assert.equal(parseDuration('  0:00\n'), 0);
assert.equal(parseDuration('ライブ'), null);
assert.equal(parseDuration('1:99'), null);

assert.equal(formatDuration(0), '0秒');
assert.equal(formatDuration(65), '1分 5秒');
assert.equal(formatDuration(3723), '1時間 2分 3秒');

assert.equal(getPageMode(), 'playlist');
context.location.pathname = '/watch';
assert.equal(getPageMode(), 'watch');
context.location.search = '?v=video';
assert.equal(getPageMode(), null);

console.log('content.js: all tests passed');
