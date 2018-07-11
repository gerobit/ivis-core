'use strict';

const passport = require('../../lib/passport');
const moment = require('moment');
const signalSets = require('../../models/signal-sets');
const panels = require('../../models/panels');
const users = require('../../models/users');
const contextHelpers = require('../../lib/context-helpers');

const router = require('../../lib/router-async').create();

users.registerRestrictedAccessTokenMethod('panel', async ({panelId}) => {
    const panel = await panels.getByIdWithTemplateParams(contextHelpers.getAdminContext(), panelId, false);

    const ret = {
        permissions: {
            template: {
                [panel.template]: new Set(['execute'])
            }
        }
    };

    if (panel.templateElevatedAccess) {
        ret.permissions.signalSet = new Set(['query']);
        ret.permissions.signal = new Set(['query']);

        ret.permissions.panel = {
            [panel.id]: new Set(['edit'])
        };

        ret.permissions.template[panel.template].add('view');

        ret.permissions.workspace = new Set(['createPanel']);
        ret.permissions.namespace = new Set(['createPanel']);

    } else {
        const allowedSignalsMap = await signalSets.getAllowedSignals(panel.templateParams, panel.params);

        const signalSetsPermissions = {};
        const signalsPermissions = {};

        for (const setEntry of allowedSignalsMap.values()) {
            signalSetsPermissions[setEntry.id] = new Set(['query']);
            for (const sigId of setEntry.sigs.values()) {
                signalsPermissions[sigId] = new Set(['query']);
            }
        }

        ret.permissions.signalSet = signalSetsPermissions;
        ret.permissions.signal = signalsPermissions;
    }

    return ret;
});


router.getAsync('/signal-sets/:signalSetId', passport.loggedIn, async (req, res) => {
    const signalSet = await signalSets.getById(req.context, req.params.signalSetId);
    signalSet.hash = signalSets.hash(signalSet);
    return res.json(signalSet);
});

router.postAsync('/signal-sets', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    return res.json(await signalSets.create(req.context, req.body));
});

router.putAsync('/signal-sets/:signalSetId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const signalSet = req.body;
    signalSet.id = parseInt(req.params.signalSetId);

    await signalSets.updateWithConsistencyCheck(req.context, signalSet);
    return res.json();
});

router.deleteAsync('/signal-sets/:signalSetId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await signalSets.remove(req.context, req.params.signalSetId);
    return res.json();
});

router.postAsync('/signal-sets-table', passport.loggedIn, async (req, res) => {
    return res.json(await signalSets.listDTAjax(req.context, req.body));
});

router.postAsync('/signal-sets-validate', passport.loggedIn, async (req, res) => {
    return res.json(await signalSets.serverValidate(req.context, req.body));
});

router.postAsync('/signal-set-reindex/:signalSetId', passport.loggedIn, async (req, res) => {
    return res.json(await signalSets.reindex(req.context, req.params.signalSetId));
});

router.postAsync('/signals-query', passport.loggedIn, async (req, res) => {
    const qry = [];

    for (const signalSetSpec of req.body) {
        const from = moment(signalSetSpec.interval.from);
        const to = moment(signalSetSpec.interval.to);
        const aggregationInterval = moment.duration(signalSetSpec.interval.aggregationInterval);

        const entry = {
            cid: signalSetSpec.cid,
            signals: signalSetSpec.signals,
            interval: {
                from,
                to,
                aggregationInterval
            }
        };

        qry.push(entry);
    }

    res.json(await signalSets.query(req.context, qry));
});

module.exports = router;