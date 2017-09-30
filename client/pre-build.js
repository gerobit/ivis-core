'use strict';

const webpackShared = require('../shared/webpack');
const fs = require('fs');
const path = require('path');

let content = '';

for (const lib of webpackShared.libs) {
    const pathPrefix = lib.type === 'internal' ? '../src/' : '';
    content += `global.${lib.id} = require('${pathPrefix + lib.path}');\n`;
}

fs.writeFileSync(path.join(__dirname, 'generated', 'ivis-exports.js'), content);