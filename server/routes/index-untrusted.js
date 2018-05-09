'use strict';

const config = require('../lib/config');
const router = require('../lib/router-async').create();
const passport = require('../lib/passport');
const shares = require('../models/shares');
const em = require('../lib/extension-manager');

async function getAnonymousConfig(context) {
    return {
        language: config.language,
        isAuthenticated: !!context.user,
        serverUrl: config.server.url,
        serverUrlUntrusted: config.server.urlUntrusted
    }
}

router.getAsync('/*', async (req, res) => {
    const ivisConfig = await getAnonymousConfig(req.context);

    res.render('index-untrusted', {
        pageTitle: em.get('app.title', 'IVIS'),
        csrfToken: null,
        ivisConfig: JSON.stringify(ivisConfig)
    });
});

module.exports = router;
