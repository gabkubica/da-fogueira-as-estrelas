const fs = require('fs'), vm = require('vm'), path = require('path');
globalThis.window = globalThis;
for (const f of ['util', 'data', 'world', 'galaxy', 'game']) vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../js/' + f + '.js'), 'utf8'), { filename: f });
module.exports = globalThis.G;
