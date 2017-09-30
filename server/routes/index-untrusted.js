'use strict';

const config = require('config');
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

router.getAsync('/*', async (req, res) => {
    const ivisConfig = await getAnonymousConfig(req.context);

    res.render('index-untrusted', {
        csrfToken: null,
        ivisConfig: JSON.stringify(ivisConfig)
    });
});

module.exports = router;
