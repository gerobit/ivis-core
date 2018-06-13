'use strict';

const config = require('./config');
const shares = require('../models/shares');
const urls = require('./urls');

async function getAnonymousConfig(context, trusted) {
    return {
        language: config.language,
        isAuthenticated: !!context.user,
        trustedUrlBase: urls.getTrustedUrlBase(),
        trustedUrlBaseDir: urls.getTrustedUrlBaseDir(),
        sandboxUrlBase: urls.getSandboxUrlBase(),
        sandboxUrlBaseDir: urls.getSandboxUrlBaseDir(),
        trusted
    }
}

async function getAuthenticatedConfig(context) {
    return {
        user: {
            id: context.user.id,
            username: context.user.username,
            namespace: context.user.namespace
        },
        globalPermissions: shares.getGlobalPermissions(context)
    }
}

module.exports = {
    getAuthenticatedConfig,
    getAnonymousConfig
};

