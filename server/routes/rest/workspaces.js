'use strict';

const passport = require('../../lib/passport');
const workspaces = require('../../models/workspaces');

const router = require('../../lib/router-async').create();
const {castToInteger} = require('../../lib/helpers');


router.getAsync('/workspaces/:workspaceId', passport.loggedIn, async (req, res) => {
    const workspace = await workspaces.getById(req.context, castToInteger(req.params.workspaceId));
    workspace.hash = workspaces.hash(workspace);
    return res.json(workspace);
});

router.getAsync('/workspaces-visible', passport.loggedIn, async (req, res) => {
    const rows = await workspaces.listVisible(req.context);
    return res.json(rows);
});

router.postAsync('/workspaces', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    return res.json(await workspaces.create(req.context, req.body));
});

router.putAsync('/workspaces/:workspaceId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const workspace = req.body;
    workspace.id = castToInteger(req.params.workspaceId);

    await workspaces.updateWithConsistencyCheck(req.context, workspace);
    return res.json();
});

router.deleteAsync('/workspaces/:workspaceId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await workspaces.remove(req.context, castToInteger(req.params.workspaceId));
    return res.json();
});

router.postAsync('/workspaces-table', passport.loggedIn, async (req, res) => {
    return res.json(await workspaces.listDTAjax(req.context, req.body));
});


module.exports = router;