'use strict';

const {getAnonymousConfig, getAuthenticatedConfig} = require('../lib/client-helpers');
const passport = require('../lib/passport');
const routerFactory = require('../lib/router-async');
const { getTrustedUrl, getSandboxUrl } = require('../lib/urls');
const em = require('../lib/extension-manager');
const { AppType } = require('../../shared/app');

function getRouter(appType) {
    const router = routerFactory.create();

    // FIXME - Remove this, it is for debuggin only
    if (appType === AppType.TRUSTED) {
        const {castToInteger} = require('../lib/helpers');
        const {getSandboxUrl} = require('../lib/urls');
        const users = require('../models/users');

        router.getAsync('/print-panel/:panelId', passport.csrfProtection, async (req, res) => {
            const panelId = castToInteger(req.params.panelId);
            const restrictedAccessToken = await users.getRestrictedAccessToken(req.context, 'panel', {panelId});

            res.redirect(getSandboxUrl('panel/' + panelId, req.context, {restrictedAccessToken}));
        });
    }


    if (appType === AppType.TRUSTED || appType === AppType.SANDBOXED) {
        router.getAsync('/*', passport.csrfProtection, async (req, res) => {
            const ivisConfig = await getAnonymousConfig(req.context, appType);
            if (req.user) {
                Object.assign(ivisConfig, await getAuthenticatedConfig(req.context));
            }

            res.render('index', {
                pageTitle: em.get('app.title'),
                csrfToken: req.csrfToken(),
                ivisConfig: JSON.stringify(ivisConfig),
                indexFile: appType === AppType.TRUSTED ? getTrustedUrl('client/index-trusted.js') : getSandboxUrl('client/index-sandbox.js'),
                bodyClass: appType === AppType.TRUSTED ? "trusted" : "sandbox",
                publicPath: appType === AppType.TRUSTED ? getTrustedUrl() : getSandboxUrl()
            });
        });
    }

    return router;
}


module.exports = {
    getRouter
};
