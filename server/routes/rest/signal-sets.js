'use strict';

const passport = require('../../lib/passport');
const moment = require('moment');
const signalSets = require('../../models/signal-sets');
const panels = require('../../models/panels');
const users = require('../../models/users');
const contextHelpers = require('../../lib/context-helpers');
const base64url = require('base64-url');

const router = require('../../lib/router-async').create();
const {castToInteger} = require('../../lib/helpers');

users.registerRestrictedAccessTokenMethod('panel', async ({panelId}) => {
    const panel = await panels.getByIdWithTemplateParams(contextHelpers.getAdminContext(), panelId, false);

    const ret = {
        permissions: {
            template: {
                [panel.template]: new Set(['execute', 'viewFiles'])
            },
            panel: {}
        }
    };

    if (panel.templateElevatedAccess) {
        ret.permissions.signalSet = new Set(['view', 'query']);
        ret.permissions.signal = new Set(['view', 'query']);

        ret.permissions.panel['default'] = new Set(['view']);
        ret.permissions.panel[panel.id] = new Set(['view', 'edit']);

        ret.permissions.template[panel.template].add('view');

        ret.permissions.workspace = new Set(['view', 'createPanel']);
        ret.permissions.namespace = new Set(['view', 'createPanel']);

    } else {
        ret.permissions.panel[panel.id] = new Set(['view']);

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
    const signalSet = await signalSets.getById(req.context, castToInteger(req.params.signalSetId));
    signalSet.hash = signalSets.hash(signalSet);
    return res.json(signalSet);
});

router.getAsync('/signal-sets-by-cid/:signalSetCid', passport.loggedIn, async (req, res) => {
    const signalSet = await signalSets.getByCid(req.context, req.params.signalSetCid, true, false);
    signalSet.hash = signalSets.hash(signalSet);
    return res.json(signalSet);
});

router.postAsync('/signal-sets', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    return res.json(await signalSets.create(req.context, req.body));
});

router.putAsync('/signal-sets/:signalSetId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const signalSet = req.body;
    signalSet.id = castToInteger(req.params.signalSetId);

    await signalSets.updateWithConsistencyCheck(req.context, signalSet);
    return res.json();
});

router.deleteAsync('/signal-sets/:signalSetId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await signalSets.remove(req.context, castToInteger(req.params.signalSetId));
    return res.json();
});

router.postAsync('/signal-sets-table', passport.loggedIn, async (req, res) => {
    return res.json(await signalSets.listDTAjax(req.context, req.body));
});

router.postAsync('/signal-sets-validate', passport.loggedIn, async (req, res) => {
    return res.json(await signalSets.serverValidate(req.context, req.body));
});

router.postAsync('/signal-set-reindex/:signalSetId', passport.loggedIn, async (req, res) => {
    return res.json(await signalSets.index(req.context, castToInteger(req.params.signalSetId)));
});

router.postAsync('/signals-query', passport.loggedIn, async (req, res) => {
    res.json(await signalSets.query(req.context, req.body));
});

function base64Decode(str) {
    return base64url.decode(str);
}

router.postAsync('/signal-set-records-table/:signalSetId', passport.loggedIn, async (req, res) => {
    return res.json(await signalSets.listRecordsDTAjax(req.context, castToInteger(req.params.signalSetId), req.body));
});

router.getAsync('/signal-set-records/:signalSetId/:recordIdBase64', passport.loggedIn, async (req, res) => {
    const sigSetWithSigMap = await signalSets.getById(req.context, castToInteger(req.params.signalSetId), false, true);
    const record = await signalSets.getRecord(req.context, sigSetWithSigMap, base64Decode(req.params.recordIdBase64));

    return res.json(record);
});

router.postAsync('/signal-set-records/:signalSetId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const sigSetWithSigMap = await signalSets.getById(req.context, castToInteger(req.params.signalSetId), false, true);
    await signalSets.insertRecords(req.context, sigSetWithSigMap, [req.body]);
    return res.json();
});

router.putAsync('/signal-set-records/:signalSetId/:recordIdBase64', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const sigSetWithSigMap = await signalSets.getById(req.context, castToInteger(req.params.signalSetId), false, true);

    const record = req.body;
    await signalSets.updateRecord(req.context, sigSetWithSigMap, base64Decode(req.params.recordIdBase64), record);

    return res.json();
});

router.deleteAsync('/signal-set-records/:signalSetId/:recordIdBase64', passport.loggedIn, async (req, res) => {
    const sigSet = await signalSets.getById(req.context, castToInteger(req.params.signalSetId), false);
    await signalSets.removeRecord(req.context, sigSet, base64Decode(req.params.recordIdBase64));
    return res.json();
});

router.postAsync('/signal-set-records-validate/:signalSetId', passport.loggedIn, async (req, res) => {
    return res.json(await signalSets.serverValidateRecord(req.context, castToInteger(req.params.signalSetId), req.body));
});

/* This is for testing. Kept here as long as we are still making bigger changes to ELS query processor
router.getAsync('/test-query', async (req, res) => {
    const body = [
        {
            "bucketGroups": {
                "bbb": {
                    "maxBucketCount": 5
                },
                "ccc": {
                    "maxBucketCount": 5
                }
            },
            "sigSetCid": "tupras",
            "ranges": [
                {
                    "sigCid":"ts",
                    "lt":"2019-01-29T14:35:32.343Z",
                    "gte":"2019-01-25T12:35:32.343Z"
                }
            ],
            "aggs": [
                {
                    "sigCid":"AOP_H2O2_input",
                    "bucketGroup": "bbb",
                    "minDocCount":1
                },
                {
                    "sigCid":"AOP_H2O2_output",
                    "bucketGroup": "ccc",
                    "minDocCount":1
                },
            ]
        }
    ];
    res.json(await signalSets.query(contextHelpers.getAdminContext(), body));
});
*/

module.exports = router;
