'use strict';

const passport = require('../../lib/passport');
const moment = require('moment');
const cropSeasonsModel = require('../../models/crop-seasons');

const router = require('../../lib/router-async').create();

router.getAsync('/crop-seasons/:id', passport.loggedIn, async (req, res) => {
    const cropSeason = await cropSeasonsModel.getById(req.context, req.params.id);
    cropSeason.hash = cropSeasonsModel.hash(cropSeason);
    return res.json(cropSeason);
});

router.getAsync('/crop-seasons/farm/:farmId', passport.loggedIn, async (req, res) => {
    const cropSeasons = await cropSeasonsModel.getByFarmId(req.context, req.params.farmId);
    return res.json(cropSeasons);
});

/*router.getAsync('/crop-seasons-analysis', passport.loggedIn, async (req, res) => {
    const cropSeasonAnalysis = await cropSeasonsModel.cropSeasonsStatistics(req.context, req.query);
    return res.json(cropSeasonAnalysis);
});*/

router.postAsync('/crop-seasons-analysis/:farm/:start/:end', passport.loggedIn, async (req, res) => {
    const cropSeasonAnalysis = await cropSeasonsModel.cropSeasonsStatistics(req.context, req.params.farm,
        req.params.start, req.params.end, req.body); //, req.query
    return res.json(cropSeasonAnalysis);
});
/*router.postAsync(`/crop-seasons-farm`, passport.loggedIn, async (req, res) => {
    console.log(req.query.farmId);
    const cropSeasons = await cropSeasonsModel.getByFarmId(req.context, req.params, req.query.farmId);
    console.log(cropSeasons);
    return res.json(cropSeasons);
});*/

router.postAsync('/crop-seasons', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await cropSeasonsModel.create(req.context, req.body);
    return res.json();
});

router.putAsync('/crop-seasons/:id', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const cropSeason = req.body;
    cropSeason.id = parseInt(req.params.id);

    await cropSeasonsModel.updateWithConsistencyCheck(req.context, crop);
    return res.json();
});

router.deleteAsync('/crop-seasons/:id', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await cropSeasonsModel.remove(req.context, req.params.id);
    return res.json();
});

router.postAsync('/crop-seasons-table', passport.loggedIn, async (req, res) => {
    return res.json(await cropSeasonsModel.listDTAjax(req.context, req.body));
});

module.exports = router;