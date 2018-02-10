"use strict";

const path = require('path');
const confUtil = require('config').util;
const em = require('./extension-manager');

const config = confUtil.loadFileConfigs(path.join(__dirname, '..', 'config'));

const extraConfigDirs = em.get('config.extraDirs', []);
for (const extraConfigDir of extraConfigDirs) {
    const extraConfig = confUtil.loadFileConfigs(extraConfigDir);
    confUtil.extendDeep(config, extraConfig);
}

module.exports = config;
