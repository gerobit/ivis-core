'use strict';

const passport = require('../../lib/passport');
const moment = require('moment');
const eventTypes = require('../../models/event-types');

const router = require('../../lib/router-async').create();

router.getAsync('/event-types/:id', passport.loggedIn, async (req, res) => {
    const eventType = await eventTypes.getById(req.context, req.params.id);
    eventType.hash = eventTypes.hash(eventType);
    return res.json(eventType);
});

router.postAsync('/event-types', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await eventTypes.create(req.context, req.body);
    return res.json();
});

router.putAsync('/event-types/:id', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const eventType = req.body;
    eventType.id = parseInt(req.params.id);

    await eventTypes.updateWithConsistencyCheck(req.context, eventType);
    return res.json();
});

router.deleteAsync('/event-types/:id', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await eventTypes.remove(req.context, req.params.id);
    return res.json();
});

router.postAsync('/event-types-table', passport.loggedIn, async (req, res) => {
    //console.log(JSON.stringify(req.body));
    return res.json(await eventTypes.listDTAjax(req.context, req.body));
});

//FIXME: to be used in the future
router.postAsync('/event-types-validate', passport.loggedIn, async (req, res) => {
    return res.json(await eventTypes.serverValidate(req.context, req.body));
});

module.exports = router;