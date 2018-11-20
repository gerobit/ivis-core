'use strict';

const config = require('./config');
const shares = require('../models/shares');
const urls = require('./urls');

async function getAnonymousConfig(context, appType) {
    return {
        language: config.language,
        isAuthenticated: !!context.user,
        trustedUrlBase: urls.getTrustedUrlBase(),
        trustedUrlBaseDir: urls.getTrustedUrlBaseDir(),
        sandboxUrlBase: urls.getSandboxUrlBase(),
        sandboxUrlBaseDir: urls.getSandboxUrlBaseDir(),
        appType
    }
}

async function getAuthenticatedConfig(context) {
    const globalPermissions = {};
    for (const perm of shares.getGlobalPermissions(context)) {
        globalPermissions[perm] = true;
    }

    return {
        user: {
            id: context.user.id,
            username: context.user.username,
            namespace: context.user.namespace
        },
        globalPermissions
    }
}

module.exports = {
    getAuthenticatedConfig,
    getAnonymousConfig
};

