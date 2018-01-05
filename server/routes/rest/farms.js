'use strict';

const passport = require('../../lib/passport');
const moment = require('moment');
const farms = require('../../models/farms');

const router = require('../../lib/router-async').create();

router.getAsync('/farms/:id', passport.loggedIn, async (req, res) => {
    const farm = await farms.getById(req.context, req.params.id);
    farm.hash = farms.hash(farm);
    return res.json(farm);
});

router.postAsync('/farms', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await farms.create(req.context, req.body);
    return res.json();
});

router.putAsync('/farms/:id', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const farm = req.body;
    farm.id = parseInt(req.params.id);

    await farms.updateWithConsistencyCheck(req.context, farm);
    return res.json();
});

router.deleteAsync('/farms/:id', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await farms.remove(req.context, req.params.id);
    return res.json();
});

router.postAsync('/farms-table', passport.loggedIn, async (req, res) => {
    //console.log(JSON.stringify(req.body));
    return res.json(await farms.listDTAjax(req.context, req.body));
});

/*router.postAsync('/shares-table-by-entity/:entityTypeId/:entityId', passport.loggedIn, async (req, res) => {
    return res.json(await shares.listByEntityDTAjax(req.context, req.params.entityTypeId, req.params.entityId, req.body));
});

router.postAsync('/shares-table-by-user/:entityTypeId/:userId', passport.loggedIn, async (req, res) => {
    return res.json(await shares.listByUserDTAjax(req.context, req.params.entityTypeId, req.params.userId, req.body));
});*/
router.postAsync('/farm-sensor-shares-unassigned-table/:entityId', passport.loggedIn, async (req, res) => {
    return res.json(await farms.listUnassignedSensorsDTAjax(req.context, req.params.entityId, req.body));
});

router.putAsync('/farmsensor', passport.loggedIn, async (req, res) => {
    const body = req.body;
    await farms.addSensor(req.context, body.entityId, body.sensorId);

    return res.json();
});

//FIXME: to be used in the future
router.postAsync('/farms-validate', passport.loggedIn, async (req, res) => {
    return res.json(await farms.serverValidate(req.context, req.body));
});

router.postAsync('/signal-set-reindex/:id', passport.loggedIn, async (req, res) => {
    return res.json(await farms.reindex(req.context, req.params.id));
});

// FIXME - this is kept here only because of SamplePanel
router.postAsync('/signals-query', passport.loggedIn, async (req, res) => {
    const qry = [];

    for (const farmspec of req.body) {
        const from = moment(farmspec.interval.from);
        const to = moment(farmspec.interval.to);
        const aggregationInterval = moment.duration(farmspec.interval.aggregationInterval);

        const entry = {
            cid: farmspec.cid,
            signals: farmspec.signals,
            interval: {
                from,
                to,
                aggregationInterval
            }
        };

        qry.push(entry);
    }

    res.json(await farms.query(req.context, qry));
});

module.exports = router;