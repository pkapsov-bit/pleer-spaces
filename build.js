/* Сборка однострочной версии для закладки: node build.js */
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/float-player.js', 'utf8');
if (/^\s*\/\/|[;{}]\s\/\/\s/m.test(src)) throw new Error('Найден // комментарий: однострочная сборка сломается');
const out = src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map((l) => l.trim()).filter(Boolean).join(' ');
fs.writeFileSync(__dirname + '/float-player.min.js', out + '\n');
console.log('float-player.min.js:', out.length, 'байт');
