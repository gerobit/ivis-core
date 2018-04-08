'use strict';

const passport = require('../../lib/passport');
const templates = require('../../models/templates');

const router = require('../../lib/router-async').create();
const multer = require('../../lib/multer');

router.getAsync('/templates/:templateId', passport.loggedIn, async (req, res) => {
    const template = await templates.getById(req.context, req.params.templateId);
    template.hash = templates.hash(template);
    return res.json(template);
});

router.postAsync('/templates', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await templates.create(req.context, req.body);
    return res.json();
});

router.putAsync('/templates/:templateId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const template = req.body;
    template.id = parseInt(req.params.templateId);

    await templates.updateWithConsistencyCheck(req.context, template);
    return res.json();
});

router.deleteAsync('/templates/:templateId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await templates.remove(req.context, req.params.templateId);
    return res.json();
});

router.postAsync('/templates-table', passport.loggedIn, async (req, res) => {
    return res.json(await templates.listDTAjax(req.context, req.body));
});

router.getAsync('/template-params/:templateId', passport.loggedIn, async (req, res) => {
    const params = await templates.getParamsById(req.context, req.params.templateId);
    return res.json(params);
});

router.postAsync('/template-build/:templateId', passport.loggedIn, async (req, res) => {
    const params = await templates.compile(req.context, req.params.templateId);
    return res.json(params);
});

router.postAsync('/template-files-table/:templateId', passport.loggedIn, async (req, res) => {
    const files = await templates.listFilesDTAjax(req.context, req.params.templateId, req.body);
    return res.json(files);
});

router.getAsync('/template-file-download/:fileId', passport.loggedIn, async (req, res) => {
    const file = await templates.getFileById(req.context, req.params.fileId);
    res.type(file.mimetype);
    return res.download(file.path, file.name);
});

router.putAsync('/template-file-upload/:templateId', passport.loggedIn, multer.array('file'), async (req, res) => {
    const summary = await templates.createFiles(req.context, req.params.templateId, req.files);
    return res.json(summary);
});

router.deleteAsync('/template-files/:fileId', passport.loggedIn, async (req, res) => {
    await templates.removeFile(req.context, req.params.fileId);
    return res.json();
});

router.getAsync('/template-module/:templateId', passport.loggedIn, async (req, res) => {
    const module = await templates.getModuleById(req.context, req.params.templateId);
    res.type('text/javascript');
    return res.send(module);
});

router.getAsync('/template-file/:templateId/:fileName', passport.loggedIn, async (req, res) => {
    const file = await templates.getFileByName(req.context, req.params.templateId, req.params.fileName);
    res.type(file.mimetype);
    return res.sendFile(file.path);
});

module.exports = router;