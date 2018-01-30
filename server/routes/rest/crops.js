'use strict';

const passport = require('../../lib/passport');
const moment = require('moment');
const crops = require('../../models/crops');

const router = require('../../lib/router-async').create();

router.getAsync('/crops/:id', passport.loggedIn, async (req, res) => {
    const crop = await crops.getById(req.context, req.params.id);
    crop.hash = crops.hash(crop);
    return res.json(crop);
});

router.postAsync('/crops', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await crops.create(req.context, req.body);
    return res.json();
});

router.putAsync('/crops/:id', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const crop = req.body;
    crop.id = parseInt(req.params.id);

    await crops.updateWithConsistencyCheck(req.context, crop);
    return res.json();
});

router.deleteAsync('/crops/:id', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await crops.remove(req.context, req.params.id);
    return res.json();
});

router.postAsync('/crops-table', passport.loggedIn, async (req, res) => {
    //console.log(JSON.stringify(req.body));
    return res.json(await crops.listDTAjax(req.context, req.body));
});

//FIXME: to be used in the future
router.postAsync('/crops-validate', passport.loggedIn, async (req, res) => {
    return res.json(await crops.serverValidate(req.context, req.body));
});

module.exports = router;