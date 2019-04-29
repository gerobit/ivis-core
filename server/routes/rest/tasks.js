'use strict';

const passport = require('../../lib/passport');
const tasks = require('../../models/tasks');

const router = require('../../lib/router-async').create();
const {castToInteger} = require('../../lib/helpers');

router.getAsync('/tasks/:taskId', passport.loggedIn, async (req, res) => {
    const task = await tasks.getById(req.context, castToInteger(req.params.taskId));
    task.hash = tasks.hash(task);
    return res.json(task);
});

router.postAsync('/tasks', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    return res.json(await tasks.create(req.context, req.body));
});

router.putAsync('/tasks/:taskId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const task = req.body;
    task.id = castToInteger(req.params.taskId);

    await tasks.updateWithConsistencyCheck(req.context, task);
    return res.json();
});

router.deleteAsync('/tasks/:taskId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await tasks.remove(req.context, castToInteger(req.params.taskId));
    return res.json();
});

router.postAsync('/tasks-table', passport.loggedIn, async (req, res) => {
    return res.json(await tasks.listDTAjax(req.context, req.body));
});

router.getAsync('/task-params/:taskId', passport.loggedIn, async (req, res) => {
    const params = await tasks.getParamsById(req.context, castToInteger(req.params.taskId));
    return res.json(params);
});

router.postAsync('/task-build/:taskId', passport.loggedIn, async (req, res) => {
    const params = await tasks.compile(req.context, castToInteger(req.params.taskId));
    return res.json(params);
});

module.exports = router;