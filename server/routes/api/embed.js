'use strict';

const passport = require('../../lib/passport');
const users = require('../../models/users');

const router = require('../../lib/router-async').create();

router.postAsync('/embedded-panel-token', passport.loggedIn, async (req, res) => {
    const panelId = req.body.panelId;
    const renewableBySandbox = !!req.body.renewableBySandbox;

    const restrictedAccessToken = await users.getRestrictedAccessToken(req.context, 'panel', {panelId, renewableBySandbox});
    return res.json(restrictedAccessToken);
});

router.putAsync('/embedded-panel-token', passport.loggedIn, async (req, res) => {
    await users.refreshRestrictedAccessToken(req.context, req.body.token);
    return res.json();
});

module.exports = router;
