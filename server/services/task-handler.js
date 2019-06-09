'use strict';

const config = require('../lib/config');
const knex = require('../lib/knex');
const {JobState, RunStatus, HandlerMsgType, JobMsgType} = require('../../shared/jobs');
const { TaskType, BuildState, isTransitionState} = require('../../shared/tasks');
const {SignalSetType} = require('../../shared/signal-sets');
const log = require('../lib/log');
const {getFieldName, getIndexName} = require('../lib/indexers/elasticsearch-common');
const moment = require('moment');
const getTaskBuildOutputDir = require('../lib/task-handler').getTaskBuildOutputDir;
const {getAdminContext} = require('../lib/context-helpers');
const createSigSet = require('../models/signal-sets').create;
const createSignal = require('../models/signals').create;

const es = require('../lib/elasticsearch');
const STATE_FIELD = require('../lib/task-handler').esConstants.STATE_FIELD;
const INDEX_JOBS = require('../lib/task-handler').esConstants.INDEX_JOBS;
const TYPE_JOBS = require('../lib/task-handler').esConstants.TYPE_JOBS;

const LOG_ID = 'Task-handler';

// Job handlers
const pythonHandler = require('./jobs/python-handler');

// Stores all incoming messages, meant to be processed
const workQueue = [];
const delayedMap = new Map();
const waitBuildMap = new Map();
const jobRunning = new Map();
let running = false;

const inProcessMsgs = new Map();

// Check interval is in seconds, so here is conversion
const checkInterval = config.tasks.checkInterval * 1000;

const handlers = new Map();
handlers.set(TaskType.PYTHON, pythonHandler);

const numpyHandler = {};
numpyHandler.run = pythonHandler.run;
numpyHandler.remove = pythonHandler.remove;
numpyHandler.stop = pythonHandler.stop;
numpyHandler.build = pythonHandler.build;
numpyHandler.init = (id, code, destDir, onSuccess, onFail) => pythonHandler.initType(TaskType.NUMPY, id, code, destDir, onSuccess, onFail);
handlers.set(TaskType.NUMPY, numpyHandler);

const events = require('events');
const emitter = new events.EventEmitter();

module.exports = class RunFailedError extends Error {
    constructor(msg, data) {
        super(msg);
        this.data = data;
    }
};


class HandlerNotFoundError extends Error {
    constructor(msg, type) {
        super(msg);
        this.type = type;
    }
}

/* Message processing */
process.on('message', handleMsg);

/**
 * The incoming messages logistic.
 */
async function handleMsg(msg) {
    if (msg) {
        try {
            switch (msg.type) {
                case HandlerMsgType.RUN:
                    await handleRunMsg(msg);
                    break;
                case HandlerMsgType.DELETE_JOB:
                case HandlerMsgType.DELETE_TASK:
                case HandlerMsgType.BUILD:
                case HandlerMsgType.INIT:
                    workQueue.push(msg);
                    break;
                case HandlerMsgType.SIGNAL_TRIGGER:
                    await checkSignalTriggers(msg.spec.cid);
                    break;
                case HandlerMsgType.STOP:
                    await stop(msg);
                    break;
                default:
                    log.info(LOG_ID, `Unknown message type received: ${msg.type}`);
            }
            startIfNotRunning();
        } catch (error) {
            log.error(LOG_ID, error)
        }
    }
}

/**
 * Stop running job, if still running.
 * @param msg
 * @returns {Promise<void>}
 */
async function stop(msg) {
    const runId = msg.spec.runId;
    const index = workQueue.findIndex(i => {
        return i.spec.runId === runId;
    });

    const statusUpdate = async (runId) => await checkAndSetMsgRunStatus(runId, RunStatus.FAILED, "Run cancelled.")
        .catch(err => {
            log.warn(LOG_ID, err)
        });

    // If run is still in a queue, remove it otherwise it might be already running so invoke stop on handler
    // all phases of run handling should be exclusive
    if (index !== -1) {
        workQueue.splice(index, 1);
        await statusUpdate(runId);
    } else {
        const handler = inProcessMsgs.get(runId);
        if (handler) {
            try {
                // Update of run in DB is not necessary here as it will be done after interrupting the job
                await handler.stop(runId);
            } catch (err) {
                log.error(LOG_ID, err);
            }
        } else {
            // If the job is not running, it is possible that it has been delayed or is waiting for build to finish
            const waitObj = waitBuildMap.get(msg.spec.jobId);
            if (waitObj && waitObj.runId === runId) {
                const job = await knex('jobs').select('task').where({id: msg.spec.jobId}).first();
                emitter.removeListener(`build-${job.task}`, waitObj.callback);
                await statusUpdate(runId);
            } else {
                const timeout = delayedMap.get(msg.spec.jobId);
                if (timeout) {
                    clearTimeout(timeout);
                    delayedMap.delete(msg.spec.jobId);
                    await statusUpdate(runId);
                }
            }
        }
    }
}

/**
 * Start and handle the work queue.
 */
function startIfNotRunning() {
    if (running) {
        return;
    }

    running = true;

    handleAll().catch(err => log.error(LOG_ID, err));
}

/**
 * Function invoked after delayed time has passed.
 * @param msg
 * @param task
 * @param job
 * @returns {Promise<void>}
 */
async function afterDelay(msg, task, job) {
    delayedMap.delete(job.id);
    await processRunMsg(msg, task, job);
}

/**
 * Prepare parameter specification for a job, like transformations from cid to field names in es.
 * @param jobParams Stored job parameters
 * @param taskParams Set task parameters
 * @returns {Promise<void>}
 */
async function getEntitiesFromParams(jobParams, taskParams) {
    const entities = {
        signalSets: {},
        signals: {}
    };

    for (let param of taskParams) {

        /* TODO check whether param can be undefined, if not throw error here for unspecified one
        let paramValue = jobParams[param.id];
        if (paramValue === undefined){
                    throw new Error(`Job doesn't specify parameter ${param.id}.`);
        }
        */

        switch (param.type) {
            // TODO add support for fieldsets
            case 'signalSet': {
                const cid = jobParams[param.id];

                if (!cid) {
                    throw new Error(`Job doesn't specify parameter ${param.id}.`);
                }

                const sigSet = await knex('signal_sets').where({cid: cid}).first();
                if (!sigSet) {
                    throw new Error(`Set with cid ${cid} not found.`);
                }

                entities.signalSets[cid] = {
                    index: getIndexName(sigSet),
                    namespace: sigSet.namespace
                };
                break;
            }

            case 'signal': {
                const signalSetCid = param.signalSetRef ? jobParams[param.signalSetRef] : param.signalSet; // TODO: This is wrong because it does not handle nested params
                                                                                                           // It needs to use resolvAbs (as in models/signal-sets.js
                if (!signalSetCid) {
                    throw new Error(`Signal set's cid for parameter ${param.id} not specified.`);
                }

                const sigCid = jobParams[param.id];
                if (!sigCid) {
                    throw new Error(`Signal's cid for parameter ${param.id} not specified.`);
                }

                const sigSet = await knex('signal_sets').select('id').where({cid: signalSetCid}).first();
                if (!sigSet) {
                    throw new Error(`Signal set with cid ${param.cid} not found.`);
                }
                const sig = await knex('signals').select('id').where({cid: sigCid, set: sigSet.id}).first();
                if (!sig) {
                    throw new Error(`Signal with cid ${sigCid} in set ${sigSet.id} not found.`);
                }

                entities.signals[sigCid] = {
                    field: getFieldName(sig.id),
                    namespace: sig.namespace
                };
                break;
            }

            default:
                break;
        }
    }

    return entities;
}

/**
 * As there are 2 types of possible messages, one with run instance already created and one without, this function checks
 * for it and updates DB accordingly.
 * @param runId
 * @param status
 * @param output
 * @returns {Promise<void>}
 */
async function checkAndSetMsgRunStatus(runId, status, output) {
    if (runId) {
        await updateRun(runId, {
            status: status,
            output: output
        });
    }
}

/**
 * This is a core of run msg handling process, where msg always ends up being in the work queue.
 * @param msg
 * @param task
 * @param job
 * @returns {Promise<void>}
 */
async function processRunMsg(msg, task, job) {
    const spec = msg.spec;
    try {
        spec.params = JSON.parse(job.params);
        spec.entities = await getEntitiesFromParams(spec.params, JSON.parse(task.settings).params);
    } catch (error) {
        return void await onRunFail(job.id, spec.runId, null, error.message);
    }
    spec.taskType = task.type;

    if (!spec.runId) {
        msg.spec.runId = await createRun(job.id, RunStatus.SCHEDULED);
    } else {
        await updateRun(spec.runId, {status: RunStatus.SCHEDULED});
    }

    const lastRun = await knex('job_runs').where({
        job: job.id,
        status: RunStatus.SUCCESS
    }).orderBy('started_at', 'desc').first();

    // Check whether job will join the work queue immediately or will have to wait for the chosen minimal
    // interval between jobs to pass
    if (lastRun && job.min_gap && job.min_gap !== 0) {
        const timeFromLast = moment(Date.now()).diff(moment(lastRun.started_at), 'seconds');
        const gap = job.min_gap - timeFromLast;
        if (gap > 0) {
            setTimeout((msg) => {
                workQueue.push(msg);
                startIfNotRunning()
            }, gap * 1000, msg);
        } else {
            workQueue.push(msg);
        }
    } else {
        workQueue.push(msg);
    }
}

/**
 * When task is being build, this function is run after the build is finished.
 * @param buildState State of the finished build
 * @param jobId Id of the job waiting
 * @param msg Run msg that should be handled after successful build
 */
function afterBuildListener(buildState, jobId, msg) {
    waitBuildMap.delete(jobId);
    if (buildState === BuildState.FINISHED) {
        handleRunMsg(msg).catch((err) => log.error(LOG_ID, err))
    } else {
        onRunFail(jobId, msg.spec.runId, null, "Task not build.").catch((err) => log.error(LOG_ID, err));
    }
}


/**
 * Check if run conforms to all the necessary condition for run and if so, prepares data for work queue join.
 * @param msg
 * @returns {Promise<void>}
 */
async function handleRunMsg(msg) {
    let job;
    let task;
    const spec = msg.spec;
    const jobId = spec.jobId;

    // Reason for separate functions is that one also deletes running job flags. That,
    // if not used by job currently running, could lead to two jobs running at the same time.
    const failRun = async (errMsg) => await onRunFail(jobId, spec.runId, null, errMsg);
    const failCheckRun = async (errMsg) => await handleRunFail(jobId, spec.runId, null, errMsg);

    await knex.transaction(async tx => {
        job = await tx('jobs').where('id', jobId).first();
        task = await tx('tasks').where('id', job.task).first();
    });

    if (!job) {
        return void await failCheckRun(`Job ${jobId} not found.`);
    }

    if (!task) {
        return void await failCheckRun(`Task ${job.task} not found.`);
    }

    if (job.state === JobState.INVALID_PARAMS) {
        return void await failCheckRun(`Task ${task.name} had parameters changed, please update ${job.name} job's parameters first.`);
    }


    if (task.build_state === BuildState.FINISHED) {

        if (jobRunning.get(jobId)) {
            return void await failCheckRun(`Job ${job.name} already running`);
        }
        jobRunning.set(jobId, true);

        if (job.delay && job.delay > 0) {
            const timeout = setTimeout(afterDelay, job.delay * 1000, msg, task, job);
            delayedMap.set(job.id, timeout);
        } else {
            await processRunMsg(msg, task, job);
        }
    } else {
        // Task isn't built but if it is building, the job will wait for it to finish and try to run again
        if (!isTransitionState(task.build_state)) {
            return void await failRun(`Task ${task.name} is not build.`);
        }

        if (!waitBuildMap.get(jobId)) {
            const cb = (state) => afterBuildListener(state, jobId, msg);
            waitBuildMap.set(jobId, {runId: spec.runId, callback: cb});
            emitter.once(`build-${task.id}`, cb);
        } else {
            await failCheckRun(`Task ${task.name} is being build and job is already queued to run after build.`);
        }
    }


}

/**
 * Handle all requests currently in the work queue.
 * @returns {Promise<void>}
 */
async function handleAll() {

    while (workQueue.length > 0) {
        const workEntry = workQueue.shift();
        const type = workEntry.type;
        try {
            switch (type) {
                case HandlerMsgType.BUILD:
                    await handleBuild(workEntry);
                    break;
                case HandlerMsgType.INIT:
                    await handleInit(workEntry);
                    break;
                case HandlerMsgType.RUN:
                    await handleRun(workEntry);
                    break;
                case HandlerMsgType.DELETE_TASK:
                    await handleTaskDelete(workEntry);
                    break;
                case HandlerMsgType.DELETE_JOB:
                    await handleJobDelete(workEntry);
                    break;
                default:
                    break;
            }

        } catch (err) {
            log.error(LOG_ID, err);
        }
    }

    running = false;
}


/**
 * Store run info in the DB.
 * @param jobId Id of the job.
 * @param status Status of the run.
 * @returns {Promise<void>}
 */
async function createRun(jobId, status) {
    const runId = await knex('job_runs').insert({
        job: jobId,
        status: status,
        started_at: new Date()
    });
    return runId[0];
}

/**
 *  Update run
 * @param runId
 * @param columns
 * @returns {Promise<void>}
 */
async function updateRun(runId, columns) {
    try {
        await knex('job_runs').where('id', runId).update(columns);
    } catch (err) {
        log.error(`Run ${runId} couldn't be updated.`, err);
    }
}

/**
 * Update state of a the job.
 * @param id
 * @param state
 * @param output
 * @returns {Promise<void>}
 */
async function setState(id, state, output) {
    const data = {};
    data.build_state = state;
    if (output) {
        data.build_output = JSON.stringify(output);
    }
    await knex('tasks').where('id', id).update(data);
}


/* ---------- DELETE ---------- */
/**
 * Handle removal task.
 * @param workEntry
 * @returns {Promise<void>}
 */
async function handleTaskDelete(workEntry) {
    const spec = workEntry.spec;
    const id = spec.taskId;
    const type = spec.type;

    const handler = getHandlerForType(type);
    if (!handler) {
        log.warn(LOG_ID, 'Handler for type not found');
    } else {
        await handler.remove(id);
    }
}

async function handleJobDelete(workEntry) {
    const spec = workEntry.spec;
    const id = spec.jobId;
    // Remove config of the job
    try {
        await es.delete({
            index: INDEX_JOBS,
            type: TYPE_JOBS,
            id: id
        });
    } catch (err) {
        log.warn(LOG_ID, err);
    }
}

/*--------------------------*/

/* ---------- BUILD ---------- */

/**
 * Callback for successful build.
 * @param id
 * @param warnings
 * @returns {Promise<void>}
 */
async function onBuildSuccess(id, warnings) {
    const output = {};
    output.warnings = warnings ? warnings : [];
    output.errors = [];

    await setState(id, BuildState.FINISHED, output);

    emitter.emit(`build-${id}`, BuildState.FINISHED);
}

/**
 * Callback for failed build.
 * @param id
 * @param warnings
 * @param errors
 * @returns {Promise<void>}
 */
async function onBuildFail(id, warnings, errors) {
    const output = {};
    output.warnings = warnings ? warnings : [];
    output.errors = errors ? errors : [];

    await setState(id, BuildState.FAILED, output);
    emitter.emit(`build-${id}`, BuildState.FAILED);
}

/**
 * Handle build task.
 * @param workEntry
 * @returns {Promise<void>}
 */
async function handleBuild(workEntry) {
    const spec = workEntry.spec;
    const id = spec.taskId;
    const handler = await getHandler(id);
    if (!handler) {
        await onBuildFail(id, null, [`Handler for type not found: ${spec.type}`]);
    } else {
        try {
            await setState(id, BuildState.PROCESSING);

            await handler.build(
                id,
                spec.code,
                spec.destDir,
                (warnings) => onBuildSuccess(id, warnings),
                (warnings, errors) => onBuildFail(id, warnings, errors));
        } catch (err) {
            log.error(`${LOG_ID} build operation`, err);
        }
    }
}


/**
 * Callback for failed build.
 * @param id
 * @param warnings
 * @param errors
 * @returns {Promise<void>}
 */
async function onInitFail(id, warnings, errors) {
    const output = {};
    output.warnings = warnings ? warnings : [];
    output.errors = errors ? errors : [];

    await setState(id, BuildState.UNINITIALIZED, output);
    emitter.emit(`build-${id}`, BuildState.FAILED);
}

/**
 * Handle init task.
 * @param workEntry
 * @returns {Promise<void>}
 */
async function handleInit(workEntry) {
    const spec = workEntry.spec;
    const id = spec.taskId;
    const handler = await getHandler(id);
    if (!handler) {
        await onInitFail(id, null, [`Handler for type not found: ${spec.type}`]);
    } else {
        try {
            await setState(id, BuildState.INITIALIZING);
            await handler.init(
                id,
                spec.code,
                spec.destDir,
                (warnings) => onBuildSuccess(id, warnings),
                (warnings, errors) => onInitFail(id, warnings, errors));
        } catch (err) {
            log.error(`${LOG_ID} init operation`, err);
        }
    }
}

/*--------------------------*/

/* ---------- RUN ---------- */
/**
 * Callback for successful run.
 * @param jobId
 * @param runId
 * @param runData
 * @param output
 * @param config
 * @returns {Promise<void>}
 */
async function onRunSuccess(jobId, runId, runData, output, config) {

    inProcessMsgs.delete(runId);
    jobRunning.delete(jobId);
    runData.finished_at = new Date();
    runData.status = RunStatus.SUCCESS;
    runData.output = output ? output : '';
    try {
        await updateRun(runId, runData);
        if (config) {
            await storeRunState(config);
        }
    } catch (err) {
        log.error(LOG_ID, err);
    }
}

/**
 * Run fail handler. Used as the exit point for run msg handling process.
 * @param jobId
 * @param runId
 * @param runData
 * @param errMsg Error description
 * @returns {Promise<void>}
 */
async function onRunFail(jobId, runId, runData, errMsg) {

    jobRunning.delete(jobId);
    inProcessMsgs.delete(runId);

    await handleRunFail(jobId, runId, runData, errMsg);

}

async function handleRunFail(jobId, runId, runData, errMsg) {
    if (runId) {
        if (!runData) {
            runData = {};
        }

        runData.finished_at = new Date();
        runData.status = RunStatus.FAILED;
        runData.output = errMsg ? errMsg : '';
        try {
            await updateRun(runId, runData);
        } catch (err) {
            log.error(LOG_ID, err);
        }
    } else {
        if (errMsg) {
            log.error(LOG_ID, `Job ${jobId} run failed: ` + errMsg);
        }
    }
}


function parseRequest(req) {
    return JSON.parse(req);
}

/**
 * This function processes all requests coming from the type handlers.
 * @param jobId
 * @param request
 * @returns {Promise<Object>}
 */
async function onRunRequest(jobId, request) {
    let response = {};
    if (request) {
        let req = {};
        try {
            req = parseRequest(request);
        } catch (err) {
            response.error = `Request parsing failed: ${err.message}`;
            return response;
        }

        if (req.type) {
            switch (req.type) {
                case JobMsgType.CREATE_SIGNALS:
                    if (req.sigSet) {
                        return await processSetReq(jobId, req.sigSet);
                    }
                    break;
                case  JobMsgType.STORE_STATE:
                    if (req.config) {
                        await storeRunState(jobId, req.config);
                    }
                    break;
                default:
                    break;
            }
        }
    }
    return response;
}

/**
 * @typedef {Object} IndexInfo
 * @property {string} index - Created index name.
 * @property {Object[]} fields - map of signal cid to his field name in created index
 */

// TODO - we would need something similar for signals

/**
 * Process request for signal set and signals creation
 * Signals are specified in sigSet.signals
 * Uses same data format as web creation
 * @param jobId
 * @param sigSet
 * @returns {Promise<IndexInfo>} Created indices and mapping
 */
async function processSetReq(jobId, sigSet) {
    const indexInfo = {};

    const signals = sigSet.signals;
    delete sigSet.signals;

    sigSet.type = SignalSetType.COMPUTED;

    try {
        await knex.transaction(async (tx) => {
                sigSet.id = await createSigSet(getAdminContext(), sigSet);
                indexInfo.index = getIndexName(sigSet);
                indexInfo.type = '_doc';

                indexInfo.fields = {};
                for (const signal of signals) {
                    signal.weight_list = 0;
                    signal.weight_edit = null;
                    const sigId = await createSignal(getAdminContext(), sigSet.id, signal, false);
                    indexInfo.fields[signal.cid] = getFieldName(sigId);
                }

                await tx('signal_sets_owners').insert({job: jobId, set: sigSet.id});
            }
        );
    } catch (error) {
        log.warn(LOG_ID, error);
        indexInfo.error = error.message;
    }

    return indexInfo;
}

/**
 * Load saved config from elasticsearch
 * @param id
 * @returns {Promise<void>} config field retrieved from ES
 */
async function loadJobState(id) {
    let jobState = null;
    try {
        const jobState = await es.get({index: INDEX_JOBS, type: TYPE_JOBS, id: id, filter_path: ['_source']});
        jobState['_source'][STATE_FIELD];

        return jobState['_source'][STATE_FIELD];

    } catch (err) {
        if (err.status === 404 && err.displayName === 'NotFound') {
            log.info(LOG_ID, `State for job ${id} not found`);
        } else {
            log.error(LOG_ID, err);
        }
        
        return null;
    }
}

/**
 * Store config from job, overwrites old config
 * @param id ID of the job config belongs to
 * @param state Config to store, JSON format
 * @returns {Promise<void>}
 */
async function storeRunState(id, state) {
    const jobBody = {};
    jobBody[STATE_FIELD] = state;
    try {
        await es.index({index: INDEX_JOBS, type: TYPE_JOBS, id: id, body: jobBody});
    } catch (error) {
        log.warn(LOG_ID, error);
    }
}

/**
 * Handle run task.
 * @returns {Promise<void>}
 * @param workEntry
 */
async function handleRun(workEntry) {
    const spec = workEntry.spec;
    const runId = spec.runId;
    const jobId = spec.jobId;
    const handler = await getHandlerForJob(jobId);
    try {
        if (!handler) {
            throw new HandlerNotFoundError('Handler for type not found', spec.id);
        }

        const runData = {};
        await updateRun(runId, {status: RunStatus.RUNNING});
        runData.started_at = new Date();
        inProcessMsgs.set(runId, handler);
        handler.run(
            jobId,
            runId,
            spec.params,
            spec.entities,
            await loadJobState(jobId),
            spec.taskDir,
            async (request) => {
                return await onRunRequest(jobId, request);
            },
            (output, config) => onRunSuccess(jobId, runId, runData, output, config),
            (error) => onRunFail(jobId, runId, runData, error)
        );

    } catch (err) {
        log.error(LOG_ID, err);
        await updateRun(spec.runId, {status: RunStatus.FAILED});
    }

}

/*--------------------------*/

/**
 * Return handler for type or null if none is found.
 * @param id the primary key of the job
 * @returns {Promise<null>}
 */
async function getHandlerForJob(id) {
    const job = await knex('jobs').where('id', id).first();
    if (job) {
        return await getHandler(job.task);
    } else {
        return null;
    }
}

/**
 * Returns handle for the type or null if none exists.
 * @param type of the task
 * @returns {Promise<null>}
 */
function getHandlerForType(type) {
    if (type) {
        return handlers.get(type);
    } else {
        return null;
    }
}

/**
 * Returns handler for the type of the task.
 * @param id the primary key of the task
 * @returns {Promise<null>}
 */
async function getHandler(id) {
    const task = await knex('tasks').where('id', id).first();
    return task ? handlers.get(task.type) : null;
}

/**
 * Returns run message for job.
 * @param job the job to run
 * @returns {Promise<{type: number, spec: {jobId: *, taskDir: string}}>}
 */
async function createRunMsg(job) {
    const task = await knex('tasks').select('id').where('id', job.task).first();
    return {
        type: HandlerMsgType.RUN,
        spec: {
            jobId: job.id,
            taskDir: getTaskBuildOutputDir(task.id)
        }
    };
}

/**
 * Find all jobs with specified signal set trigger.
 * @param cid
 */
async function checkSignalTriggers(cid) {
    let triggers = [];
    await knex.transaction(async tx => {
        let id = await tx('signal_sets').select('id').where('cid', cid).first();
        triggers = await tx('job_triggers').select('job').where('signal_set', id.id);
    });

    for (let trigger of triggers) {
        const job = await knex('jobs').where('id', trigger.job).first();
        if (job.state === JobState.ENABLED) {
            const msg = await createRunMsg(job);
            handleRunMsg(msg).catch(logErr);
        }
    }
}

/**
 * Check and if time trigger is due on a job, run it.
 * @param job Job to check time trigger for.
 * @returns {Promise<void>}
 */
async function runTimeTrigger(job) {
    // If there is time trigger set check for it
    if (job.trigger !== null && job.trigger !== 0) {

        const last_run = await knex('job_runs').where({
            job: job.id,
            status: RunStatus.SUCCESS
        }).orderBy('started_at', 'desc').first();

        // If job haven't run yet, run.
        if (last_run && last_run.started_at) {
            let timeFromLast = moment(Date.now()).diff(moment(last_run.started_at), 'seconds');
            if (timeFromLast > job.trigger) {
                await handleRunMsg(await createRunMsg(job));
            }
        } else {
            await handleRunMsg(await createRunMsg(job));
        }

    }
}

/**
 * For all jobs check if it should be time triggered and run accordingly.
 * @returns {Promise<void>}
 */
async function runTimeTriggers() {
    try {
        const jobs = await knex.select().table('jobs');

        if (jobs) {
            for (let i = 0; i < jobs.length; i++) {
                if (jobs[i].state === JobState.ENABLED) {
                    await runTimeTrigger(jobs[i]).catch(logErr);
                }
            }
        }
        startIfNotRunning();
    } catch (err) {
        log.error(LOG_ID, err);
    }
}

function logErr(err) {
    log.info(LOG_ID, err.stack);
}

// This line starts the time trigger functionality
setInterval(runTimeTriggers, checkInterval);
log.info(LOG_ID, 'Job handler process started');

