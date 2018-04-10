'use strict';

const config = require('./config');
const shares = require('../models/shares');

async function getAnonymousConfig(context, isSandbox) {
    return {
        language: config.language,
        isAuthenticated: !!context.user,
        urlBase: config.www.urlBase,
        sandboxUrlBase: config.www.sandboxUrlBase,
        port: config.www.port,
        sandboxPort: config.www.sandboxPort,
        isSandbox
    }
}

async function getAuthenticatedConfig(context) {
    return {
        user: {
            id: context.user.id,
            username: context.user.username,
            namespace: context.user.namespace
        },
        globalPermissions: shares.getGlobalPermissions(context),
        //FIXME
        calibrationParametersColumn: config.sensor.calibrationParametersColumn
    }
}

module.exports = {
    getAuthenticatedConfig,
    getAnonymousConfig
};

