'use strict';

const {getAnonymousConfig, getAuthenticatedConfig} = require('../lib/client-helpers');
const passport = require('../lib/passport');
const routerFactory = require('../lib/router-async');
const { getTrustedUrl, getSandboxUrl } = require('../lib/urls');
const em = require('../lib/extension-manager');

function getRouter(trusted) {
    const router = routerFactory.create();

    router.getAsync('/*', passport.csrfProtection, async (req, res) => {
        const ivisConfig = await getAnonymousConfig(req.context, trusted);
        if (req.user) {
            Object.assign(ivisConfig, await getAuthenticatedConfig(req.context));
        }

        res.render('index', {
            pageTitle: em.get('app.title', 'IVIS'),
            csrfToken: req.csrfToken(),
            ivisConfig: JSON.stringify(ivisConfig),
            indexFile: trusted ? getTrustedUrl('client/index-trusted.js') : getSandboxUrl('client/index-sandbox.js'),
            bodyClass: trusted ? "trusted" : "sandbox"
        });
    });

    return router;
}


module.exports = {
    getRouter
};
