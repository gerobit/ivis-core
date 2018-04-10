'use strict';

const config = require('../lib/config');
const router = require('../lib/router-async').create();
const passport = require('../lib/passport');
const shares = require('../models/shares');

async function getAnonymousConfig(context) {
    return {
        language: config.language,
        isAuthenticated: !!context.user,
        serverUrl: config.server.url,
        serverUrlUntrusted: config.server.urlUntrusted
    }
}

async function getAuthenticatedConfig(context) {
    return {
        user: {
            id: context.user.id,
            namespace: context.user.namespace
        },
        globalPermissions: shares.getGlobalPermissions(context),
        //FIXME
        calibrationParametersColumn: config.sensor.calibrationParametersColumn
    }
}

router.getAsync('/*', passport.csrfProtection, async (req, res) => {
    const ivisConfig = await getAnonymousConfig(req.context);
    if (req.user) {
        Object.assign(ivisConfig, await getAuthenticatedConfig(req.context));
    }

    res.render('index', {
        csfrToken: req.csrfToken(),
        ivisConfig: JSON.stringify(ivisConfig)
    });
});

module.exports = router;
