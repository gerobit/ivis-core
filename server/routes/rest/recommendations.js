'use strict';

const passport = require('../../lib/passport');
const moment = require('moment');
const recommendationsModel = require('../../models/recommendations');
const router = require('../../lib/router-async').create();

router.getAsync('/recommendations/:id', passport.loggedIn, async (req, res) => {
    const recommendation = await recommendationsModel.getById(req.context, req.params.id);
    recommendation.hash = recommendationsModel.hash(recommendation);
    return res.json(recommendation);
});

router.getAsync('/recommendations/', passport.loggedIn, async (req, res) => {
    return res.json(await recommendationsModel.getRecommendations(req.context));
});

router.postAsync('/recommendations', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await recommendationsModel.create(req.context, req.body);
    return res.json();
});

router.putAsync('/recommendations/:id', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const recommendation = req.body;
    recommendation.id = parseInt(req.params.id);

    await recommendationsModel.updateWithConsistencyCheck(req.context, recommendation);
    return res.json();
});

router.deleteAsync('/recommendations/:id', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await recommendationsModel.remove(req.context, req.params.id);
    return res.json();
});

router.postAsync('/recommendations-table', passport.loggedIn, async (req, res) => {
    //console.log(JSON.stringify(req.body));
    return res.json(await recommendationsModel.listDTAjax(req.context, req.body));
});

//FIXME: to be used in the future
router.postAsync('/recommendations-validate', passport.loggedIn, async (req, res) => {
    return res.json(await recommendationsModel.serverValidate(req.context, req.body));
});

module.exports = router;