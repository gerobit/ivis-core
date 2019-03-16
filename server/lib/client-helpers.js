'use strict';

const config = require('./config');
const shares = require('../models/shares');
const builtinTemplates = require('../models/builtin-templates');
const urls = require('./urls');

async function getAnonymousConfig(context, appType) {
    return {
        defaultLanguage: config.defaultLanguage,
        enabledLanguages: config.enabledLanguages,
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
        globalPermissions,
        builtinTemplates: builtinTemplates.list()
    }
}

module.exports = {
    getAuthenticatedConfig,
    getAnonymousConfig
};

