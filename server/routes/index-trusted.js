'use strict';

const {getAnonymousConfig, getAuthenticatedConfig} = require("../lib/client-helpers");
const router = require('../lib/router-async').create();
const passport = require('../lib/passport');

router.getAsync('/*', passport.csrfProtection, async (req, res) => {
    const ivisConfig = await getAnonymousConfig(req.context, false);
    if (req.user) {
        Object.assign(ivisConfig, await getAuthenticatedConfig(req.context));
    }

    res.render('index-trusted', {
        csrfToken: req.csrfToken(),
        ivisConfig: JSON.stringify(ivisConfig)
    });
});

module.exports = router;
