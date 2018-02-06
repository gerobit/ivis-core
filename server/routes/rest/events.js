'use strict';

const passport = require('../../lib/passport');
const moment = require('moment');
const eventsModel = require('../../models/events');
const router = require('../../lib/router-async').create();

router.getAsync('/events/:id', passport.loggedIn, async (req, res) => {
    const event = await eventsModel.getById(req.context, req.params.id);
    event.hash = eventsModel.hash(event);
    return res.json(event);
});

router.postAsync('/events', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await eventsModel.create(req.context, req.body);
    return res.json();
});

router.putAsync('/events/:id', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const event = req.body;
    event.id = parseInt(req.params.id);

    await eventsModel.updateWithConsistencyCheck(req.context, event);
    return res.json();
});

router.deleteAsync('/events/:id', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await eventsModel.remove(req.context, req.params.id);
    return res.json();
});

router.postAsync('/events-table', passport.loggedIn, async (req, res) => {
    return res.json(await eventsModel.listDTAjax(req.context, req.body));
});

router.getAsync('/events', passport.loggedIn, async (req, res) => {
    return res.json(await eventsModel.getEvents(req.context));
});

//FIXME: to be used in the future
router.postAsync('/events-validate', passport.loggedIn, async (req, res) => {
    return res.json(await eventsModel.serverValidate(req.context, req.body));
});

module.exports = router;