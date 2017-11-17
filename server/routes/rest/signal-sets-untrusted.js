'use strict';

const passport = require('../../lib/passport');
const moment = require('moment');
const signalSets = require('../../models/signal-sets');
const shares = require('../../models/shares');
const panels = require('../../models/panels');

const router = require('../../lib/router-async').create();
const {parseCardinality} = require('../../../shared/templates');

function getAllowedSignals(templateParams, params) {

    const allowedSigSets = new Map();
    const selectedSigSets = new Map();

    function computeSelectedSigSets(templateParams, params, prefix = '') {
        for (const spec of templateParams) {
            if (spec.type === 'signalSet') {
                selectedSigSets.set(prefix + spec.id, params[spec.id]);
                allowedSigSets.set(params[spec.id], new Set());

            } else if (spec.type === 'fieldset') {
                const card = parseCardinality(spec.cardinality);
                if (spec.children) {
                    if (card.max === 1) {
                        computeSelectedSigSets(spec.children, params[spec.id], prefix + spec.id + '.');
                    } else {
                        for (const childParams of params[spec.id]) {
                            computeSelectedSigSets(spec.children, childParams, prefix + spec.id + '.');
                        }
                    }
                }
            }
        }
    }

    function computeAllowedSignals(templateParams, params) {
        for (const spec of templateParams) {
            if (spec.type === 'signal') {
                const sigSetCid = selectedSigSets.get(spec.signalSet);
                const sigSet = allowedSigSets.get(sigSetCid);
                sigSet.add(params[spec.id]);

            } else if (spec.type === 'fieldset') {
                const card = parseCardinality(spec.cardinality);
                if (spec.children) {
                    if (card.max === 1) {
                        computeAllowedSignals(spec.children, params[spec.id]);
                    } else {
                        for (const childParams of params[spec.id]) {
                            computeAllowedSignals(spec.children, childParams);
                        }
                    }
                }
            }
        }
    }

    computeSelectedSigSets(templateParams, params);
    computeAllowedSignals(templateParams, params);

    return allowedSigSets;
}


router.postAsync('/signals-query', passport.loggedIn, async (req, res) => {
    const panel = await panels.getByIdWithTemplateParams(req.context, req.panelId);

    const allowedSigSets = getAllowedSignals(panel.templateParams, panel.params);

    const qry = [];

    for (const signalSetSpec of req.body) {
        const from = moment(signalSetSpec.interval.from);
        const to = moment(signalSetSpec.interval.to);
        const aggregationInterval = moment.duration(signalSetSpec.interval.aggregationInterval);

        if (!allowedSigSets.has(signalSetSpec.cid)) {
            shares.throwPermissionDenied();
        }

        const allowedSigs = allowedSigSets.get(signalSetSpec.cid);

        const signals = {};
        for (const sigSpecKey in signalSetSpec.signals) {
            if (!allowedSigs.has(sigSpecKey)) {
                shares.throwPermissionDenied();
            }

            signals[sigSpecKey] = signalSetSpec.signals[sigSpecKey];
        }

        const entry = {
            cid: signalSetSpec.cid,
            signals,
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