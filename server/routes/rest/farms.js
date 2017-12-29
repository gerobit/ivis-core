'use strict';

const passport = require('../../lib/passport');
const moment = require('moment');
const farms = require('../../models/farms');

const router = require('../../lib/router-async').create();

router.getAsync('/farms/:signalSetId', passport.loggedIn, async (req, res) => {
    const signalSet = await farms.getById(req.context, req.params.signalSetId);
    signalSet.hash = farms.hash(signalSet);
    return res.json(signalSet);
});

router.postAsync('/farms', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await farms.create(req.context, req.body);
    return res.json();
});

router.putAsync('/farms/:signalSetId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const signalSet = req.body;
    signalSet.id = parseInt(req.params.signalSetId);

    await farms.updateWithConsistencyCheck(req.context, signalSet);
    return res.json();
});

router.deleteAsync('/farms/:signalSetId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await farms.remove(req.context, req.params.signalSetId);
    return res.json();
});

router.postAsync('/farms-table', passport.loggedIn, async (req, res) => {
    return res.json(await farms.listDTAjax(req.context, req.body));
});

router.postAsync('/farms-validate', passport.loggedIn, async (req, res) => {
    return res.json(await farms.serverValidate(req.context, req.body));
});

router.postAsync('/signal-set-reindex/:signalSetId', passport.loggedIn, async (req, res) => {
    return res.json(await farms.reindex(req.context, req.params.signalSetId));
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