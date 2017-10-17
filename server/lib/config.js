"use strict";

const config = require('config');
const em = require('./extension-manager');

const extraConfigDirs = em.get('config.extraDirs', []);

for (const extraConfig of extraConfigs) {
    const extraConfig = config.util.loadFileConfigs(extraConfig);
    config.util.extendDeep(config, extraConfig);
}

module.exports = config;
