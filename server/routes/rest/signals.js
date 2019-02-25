'use strict';

const passport = require('../../lib/passport');
const signals = require('../../models/signals');

const router = require('../../lib/router-async').create();
const {castToInteger} = require('../../lib/helpers');

router.getAsync('/signals/:signalId', passport.loggedIn, async (req, res) => {
    const signal = await signals.getById(req.context, castToInteger(req.params.signalId));
    signal.hash = signals.hash(signal);
    return res.json(signal);
});

router.postAsync('/signals/:signalSetId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    return res.json(await signals.create(req.context, castToInteger(req.params.signalSetId), req.body));
});

router.putAsync('/signals/:signalId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const signal = req.body;
    signal.id = castToInteger(req.params.signalId);

    await signals.updateWithConsistencyCheck(req.context, signal);
    return res.json();
});

router.deleteAsync('/signals/:signalId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await signals.remove(req.context, castToInteger(req.params.signalId));
    return res.json();
});

router.postAsync('/signals-table/:signalSetId', passport.loggedIn, async (req, res) => {
    return res.json(await signals.listDTAjax(req.context, castToInteger(req.params.signalSetId), req.body));
});

router.postAsync('/signals-table-by-cid/:signalSetCid', passport.loggedIn, async (req, res) => {
    return res.json(await signals.listByCidDTAjax(req.context, req.params.signalSetCid, req.body));
});

router.postAsync('/signals-validate/:signalSetId', passport.loggedIn, async (req, res) => {
    return res.json(await signals.serverValidate(req.context, castToInteger(req.params.signalSetId), req.body));
});

router.getAsync('/signals-visible-list/:signalSetId', passport.loggedIn, async (req, res) => {
    return res.json(await signals.listVisibleForList(req.context, castToInteger(req.params.signalSetId)));
});

router.getAsync('/signals-visible-edit/:signalSetId', passport.loggedIn, async (req, res) => {
    return res.json(await signals.listVisibleForEdit(req.context, castToInteger(req.params.signalSetId)));
});

module.exports = router;