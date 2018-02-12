'use strict';

const passport = require('../../lib/passport');
const templates = require('../../models/templates');

const router = require('../../lib/router-async').create();

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