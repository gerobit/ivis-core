'use strict';
const slugify = require('slugify');

const externalsLibs = [
    'react',
    'moment',
    'prop-types',
    'd3-color',
];

const internalLibs = {
    'axios': 'lib/axios',
    'ivis': 'ivis/ivis'
};

const libs = [];

for (const lib of externalsLibs) {
    const id = 'ivisExports_' + slugify(lib, '_');
    libs.push({
        id,
        lib,
        path: lib,
        type: 'external'
    });
}

for (const lib in internalLibs) {
    const id = 'ivisExports_' + slugify(lib, '_');
    libs.push({
        id,
        lib,
        path: internalLibs[lib],
        type: 'internal'
    });
}

module.exports.libs = libs;



