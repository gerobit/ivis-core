'use strict';

const passport = require('../../lib/passport');
const moment = require('moment');
const signals = require('../../models/signals');
const shares = require('../../models/shares');
const panels = require('../../models/panels');

const router = require('../../lib/router-async').create();
const {parseCardinality} = require('../../../shared/templates');


function getSignalsSet(templateParams, params, signals = new Set()) {
    for (const spec of templateParams) {
        let value;

        if (spec.type === 'signal') {
            signals.add(params[spec.id]);

        } else if (spec.type === 'fieldset') {
            const card = parseCardinality(spec.cardinality);
            if (spec.children) {
                if (card.max === 1) {
                    getSignalsSet(spec.children, params[spec.id], signals);
                } else {
                    for (const childParams of params[spec.id]) {
                        getSignalsSet(spec.children, childParams, signals);
                    }
                }
            }

        }
    }

    return signals;
}


router.postAsync('/signals-query', passport.loggedIn, async (req, res) => {
    const panel = await panels.getByIdWithTemplateParams(req.context, req.panelId);

    const signalsSet = getSignalsSet(panel.templateParams, panel.params);

    const qry = [];

    for (const signalSpec of req.body) {
        if (!signalsSet.has(signalSpec.cid)) {
            shares.throwPermissionDenied();

        } else {
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
    }

    res.json(await signals.query(req.context, qry));
});

module.exports = router;