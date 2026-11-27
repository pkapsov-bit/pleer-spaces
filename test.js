'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const root = __dirname;
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const main = read('float-player.js');
const min = read('float-player.min.js');
const sw = read('service-worker.js');
new vm.Script(main, { filename: 'float-player.js' });
new vm.Script(min, { filename: 'float-player.min.js' });
new vm.Script(sw, { filename: 'service-worker.js' });
const ext = JSON.parse(read('manifest.json'));
const pwa = JSON.parse(read('manifest.webmanifest'));
assert.strictEqual(ext.version, '2.1.0');
assert.strictEqual(pwa.display, 'standalone');
assert(main.includes("VERSION = '2.1.0'"));
for (const feature of [
  'captureStream', 'createBiquadFilter', 'bassBoost ? 7 : 0',
  'function beginCrossfade', 'function startCrossfadeIfReady',
  'performance.getEntriesByType', 'navigator.mediaSession',
  "navigator.wakeLock.request('screen')", 'function setSleep',
  'listRendered + 60', 'function pjaxGo', '.sheet.immersive'
]) assert(main.includes(feature), `Missing feature: ${feature}`);
assert(main.includes('data-act="dsp"'));
assert(main.includes('data-act="bass"'));
assert(main.includes('data-act="crossfade"'));
assert(main.includes('data-act="wake"'));
assert(read('index.html').includes('manifest.webmanifest'));
assert(read('index.html').includes("register('./service-worker.js')"));
assert(sw.includes("self.addEventListener('fetch'"));
for (const size of [192, 512]) {
  const b = fs.readFileSync(path.join(root, `icon-${size}.png`));
  assert.strictEqual(b.readUInt32BE(16), size);
  assert.strictEqual(b.readUInt32BE(20), size);
}
console.log('T-PLAYER 2.1 static checks: OK');
