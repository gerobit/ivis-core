'use strict';

const passport = require('../../lib/passport');
const panels = require('../../models/panels');

const router = require('../../lib/router-async').create();


router.getAsync('/panels/:panelId', passport.loggedIn, async (req, res) => {
    const panel = await panels.getByIdWithTemplateParams(req.context, req.params.panelId);
    panel.hash = panels.hash(panel);
    return res.json(panel);
});

router.getAsync('/panels-visible/:workspaceId', passport.loggedIn, async (req, res) => {
    const rows = await panels.listVisible(req.context, req.params.workspaceId);
    return res.json(rows);
});

router.postAsync('/panels/:workspaceId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await panels.create(req.context, req.params.workspaceId, req.body);
    return res.json();
});

router.putAsync('/panels/:panelId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const panel = req.body;
    panel.id = parseInt(req.params.panelId);

    await panels.updateWithConsistencyCheck(req.context, panel);
    return res.json();
});

router.deleteAsync('/panels/:panelId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await panels.remove(req.context, req.params.panelId);
    return res.json();
});

router.postAsync('/panels-table/:workspaceId', passport.loggedIn, async (req, res) => {
    return res.json(await panels.listByWorkspaceDTAjax(req.context, req.params.workspaceId, req.body));
});

router.postAsync('/panels-by-template-table/:templateId', passport.loggedIn, async (req, res) => {
    return res.json(await panels.listByTemplateDTAjax(req.context, req.params.templateId, req.body));
});

module.exports = router;