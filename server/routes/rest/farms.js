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

router.getAsync('/farms-sensors', passport.loggedIn, async (req, res) => {
    return res.json(await farms.getFarmsSensors(req.context));
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

router.postAsync('/farms-farmers-table', passport.loggedIn, async (req, res) => {
    return res.json(await farms.listFarmsFarmers(req.context, req.body));
});

router.postAsync('/farmers-farms-table', passport.loggedIn, async (req, res) => {
    return res.json(await farms.listFarmersFarms(req.context, req.body, req.query));
});

router.postAsync('/farm-sensor-shares-unassigned-table/:entityId', passport.loggedIn, async (req, res) => {
    return res.json(await farms.listUnassignedSensorsDTAjax(req.context, req.params.entityId, req.body));
});

router.postAsync('/farmsensor-table/:entityId', passport.loggedIn, async (req, res) => {
    const body = req.body;
    return res.json(await farms.getSensors(req.context, body, req.params.entityId));
});

router.getAsync('/farmsensors/:entityId', passport.loggedIn, async (req, res) => {
    return res.json(await farms.getFarmSensors(req.context, req.params.entityId));
});

router.putAsync('/farmsensor', passport.loggedIn, async (req, res) => {
    const body = req.body;
    await farms.addSensor(req.context, body.entityId, body.sensorId);
    return res.json();
});

router.deleteAsync('/farmsensor/:entityId/:sensorId', passport.loggedIn, async (req, res) => {   
    await farms.deleteSensor(req.context, req.params.entityId, req.params.sensorId);
    return res.json();
});

//FIXME: to be used in the future
router.postAsync('/farms-validate', passport.loggedIn, async (req, res) => {
    return res.json(await farms.serverValidate(req.context, req.body));
});

module.exports = router;