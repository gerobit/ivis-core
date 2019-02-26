'use strict';

const passport = require('../../lib/passport');
const panels = require('../../models/panels');

const router = require('../../lib/router-async').create();
const {castToInteger} = require('../../lib/helpers');

const pdfExport = require('../../lib/pdf-export');

router.getAsync('/panels/:panelId', passport.loggedIn, async (req, res) => {
    const panel = await panels.getByIdWithTemplateParams(req.context, castToInteger(req.params.panelId));
    panel.hash = panels.hash(panel);
    return res.json(panel);
});

router.getAsync('/panels-visible/:workspaceId', passport.loggedIn, async (req, res) => {
    const rows = await panels.listVisible(req.context, castToInteger(req.params.workspaceId));
    return res.json(rows);
});

router.postAsync('/panels/:workspaceId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    return res.json(await panels.create(req.context, req.params.workspaceId, req.body));
});

router.putAsync('/panels/:panelId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const panel = req.body;
    panel.id = parseInt(castToInteger(req.params.panelId));

    await panels.updateWithConsistencyCheck(req.context, panel);
    return res.json();
});

router.putAsync('/panels-config/:panelId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const config = req.body;
    const panelId = castToInteger(req.params.panelId);

    await panels.updateConfig(req.context, panelId, config);
    return res.json();
});

router.deleteAsync('/panels/:panelId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await panels.remove(req.context, castToInteger(req.params.panelId));
    return res.json();
});

router.postAsync('/panels-table/:workspaceId', passport.loggedIn, async (req, res) => {
    return res.json(await panels.listByWorkspaceDTAjax(req.context, castToInteger(req.params.workspaceId), req.body));
});

router.postAsync('/panels-by-template-table/:templateId', passport.loggedIn, async (req, res) => {
    return res.json(await panels.listByTemplateDTAjax(req.context, castToInteger(req.params.templateId), req.body));
});

router.postAsync('/panel-pdf/:panelId', passport.loggedIn, async (req, res) => {
    return res.json(await pdfExport.panel(req.context, req.params.panelId, req.body.permanentLinkConfig, req.body.timeZone));
});

module.exports = router;