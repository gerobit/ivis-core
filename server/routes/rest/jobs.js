'use strict';

const passport = require('../../lib/passport');
const jobs = require('../../models/jobs');

const router = require('../../lib/router-async').create();
const {castToInteger} = require('../../lib/helpers');

// JOBS

router.getAsync('/jobs/:jobId', passport.loggedIn, async (req, res) => {
    const job = await jobs.getByIdWithTaskParams(req.context, castToInteger(req.params.jobId));
    job.hash = jobs.hash(job);
    return res.json(job);
});

router.postAsync('/jobs', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    return res.json(await jobs.create(req.context, req.body));
});

router.putAsync('/jobs/:jobId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    const job = req.body;
    job.id = castToInteger(req.params.jobId);

    await jobs.updateWithConsistencyCheck(req.context, job);
    return res.json();
});

router.deleteAsync('/jobs/:jobId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await jobs.remove(req.context, castToInteger(req.params.jobId));
    return res.json();
});

router.postAsync('/jobs-table', passport.loggedIn, async (req, res) => {
    return res.json(await jobs.listDTAjax(req.context, req.body));
});

router.postAsync('/jobs-by-task-table/:taskId', passport.loggedIn, async (req, res) => {
    return res.json(await jobs.listByTaskDTAjax(req.context, castToInteger(req.params.taskId), req.body));
});

// RUNS

router.getAsync('/jobs/:jobId/run/:runId', passport.loggedIn, async (req, res) => {
    const run = await jobs.getRunById(req.context, castToInteger(req.params.jobId), castToInteger(req.params.runId));
    run.hash = jobs.hash(run);
    return res.json(run);
});

router.deleteAsync('/jobs/:jobId/run/:runId', passport.loggedIn, passport.csrfProtection, async (req, res) => {
    await jobs.removeRun(req.context, castToInteger(req.params.jobId), castToInteger(req.params.runId));
    return res.json();
});

router.postAsync('/job-runs-table/:jobId', passport.loggedIn, async (req, res) => {
    return res.json(await jobs.listRunsDTAjax(req.context, castToInteger(req.params.jobId), req.body));
});

router.postAsync('/job-running-table', passport.loggedIn, async (req, res) => {
    return res.json(await jobs.listRunningDTAjax(req.context, req.body));
});

router.postAsync('/job-run/:jobId', passport.loggedIn, async (req, res) => {
    const params = await jobs.run(req.context, castToInteger(req.params.jobId));
    return res.json(params);
});

router.postAsync('/job-stop/:runId', passport.loggedIn, async (req, res) => {
    const params = await jobs.stop(req.context, castToInteger(req.params.runId));
    return res.json(params);
});

module.exports = router;