'use strict';

const passport = require('../../lib/passport');
const moment = require('moment');
const signals = require('../../models/signals');

const router = require('../../lib/router-async').create();

router.getAsync('/signals/:signalId', passport.loggedIn, async (req, res) => {
    const signal = await signals.getById(req.context, req.params.signalId);
    signal.hash = signals.hash(signal);
    return res.json(signal);
});

router.postAsync('/signals/:signalSetId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await signals.create(req.context, req.params.signalSetId, req.body);
    return res.json();
});

router.putAsync('/signals/:signalId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const signal = req.body;
    signal.id = parseInt(req.params.signalId);

    await signals.updateWithConsistencyCheck(req.context, signal);
    return res.json();
});

router.deleteAsync('/signals/:signalId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await signals.remove(req.context, req.params.signalId);
    return res.json();
});

router.postAsync('/signals-table/:signalSetId', passport.loggedIn, async (req, res) => {
    return res.json(await signals.listDTAjax(req.context, req.params.signalSetId, req.body));
});

router.postAsync('/signals-validate', passport.loggedIn, async (req, res) => {
    return res.json(await signals.serverValidate(req.context, req.body));
});


// FIXME - this is kept here only because of SamplePanel
router.postAsync('/signals-query', passport.loggedIn, async (req, res) => {
    const qry = [];

    for (const signalSpec of req.body) {
        const from = moment(signalSpec.interval.from);
        const to = moment(signalSpec.interval.to);
        const aggregationInterval = moment.duration(signalSpec.interval.aggregationInterval);

        const entry = {
            cid: signalSpec.cid,
            attrs: signalSpec.attrs,
            interval: {from, to, aggregationInterval}
        };

        qry.push(entry);
    }

    res.json(await signals.query(req.context, qry));
});



module.exports = router;