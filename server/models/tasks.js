'use strict';

const knex = require('../lib/knex');
const hasher = require('node-object-hash')();
const {enforce, filterObject} = require('../lib/helpers');
const dtHelpers = require('../lib/dt-helpers');
const interoperableErrors = require('../../shared/interoperable-errors');
const namespaceHelpers = require('../lib/namespace-helpers');
const shares = require('./shares');
const {BuildState, TaskType} = require('../../shared/tasks');
const {JobState} = require('../../shared/jobs');
const fs = require('fs-extra-promise');
const taskHandler = require('../lib/task-handler');
const files = require('./files');
const dependencyHelpers = require('../lib/dependency-helpers');

const allowedKeys = new Set(['name', 'description', 'type', 'settings', 'namespace']);



function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeys));
}

/**
 * Returns task.
 * @param context
 * @param id the primary key of the task
 * @returns {Promise<any>}
 */
async function getById(context, id) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'task', id, 'view');
        const task = await tx('tasks').where('id', id).first();
        task.settings = JSON.parse(task.settings);
        task.build_output = JSON.parse(task.build_output);
        task.permissions = await shares.getPermissionsTx(tx, context, 'task', id);
        return task;
    });
}

async function listDTAjax(context, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{entityTypeId: 'task', requiredOperations: ['view']}],
        params,
        builder => builder.from('tasks').innerJoin('namespaces', 'namespaces.id', 'tasks.namespace'),
        ['tasks.id', 'tasks.name', 'tasks.description', 'tasks.type', 'tasks.created', 'tasks.build_state', 'namespaces.name']
    );
}

/**
 * Create task.
 * @param context
 * @param task
 * @returns {Promise<any>} the primary key of the task
 */
async function create(context, task) {
    const id = await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'namespace', task.namespace, 'createTask');
        await namespaceHelpers.validateEntity(tx, task);

        enforce(Object.values(TaskType).includes(task.type), 'Unknown task type');

        const filteredEntity = filterObject(task, allowedKeys);
        filteredEntity.settings = JSON.stringify(filteredEntity.settings);
        filteredEntity.build_state = BuildState.SCHEDULED;

        const ids = await tx('tasks').insert(filteredEntity);
        const id = ids[0];

        await shares.rebuildPermissionsTx(tx, {entityTypeId: 'task', entityId: id});

        return id;
    });

    scheduleCreate(id, task.settings);

    return id;
}

/**
 * On task param change invalidate all jobs of that task.
 * @param tx
 * @param taskId the primary key of the task
 * @returns {Promise<void>}
 */
async function invalidateJobs(tx,taskId){
    await tx('jobs').where('task', taskId).update('state', JobState.INVALID_PARAMS);
}

/**
 * Update task if it hadn't changed on the server.
 * @param context
 * @param task
 * @returns {Promise<void>}
 */
async function updateWithConsistencyCheck(context, task) {
    let uninitialized = false;
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'task', task.id, 'edit');

        const existing = await tx('tasks').where('id', task.id).first();
        if (!existing) {
            throw new interoperableErrors.NotFoundError();
        }

        uninitialized = (existing.build_state === BuildState.UNINITIALIZED);

        existing.settings = JSON.parse(existing.settings);
        const existingHash = hash(existing);
        if (existingHash !== task.originalHash) {
            throw new interoperableErrors.ChangedError();
        }

        await namespaceHelpers.validateEntity(tx, task);
        await namespaceHelpers.validateMove(context, task, existing, 'task', 'createTask', 'delete');

        const filteredEntity = filterObject(task, allowedKeys);
        filteredEntity.settings = JSON.stringify(filteredEntity.settings);

        if(hasher.hash(task.settings.params) !== hasher.hash(existing.settings.params)){
            await invalidateJobs(tx, task.id);
        }

        await tx('tasks').where('id', task.id).update(filteredEntity);

        await shares.rebuildPermissionsTx(tx, {entityTypeId: 'task', entityId: task.id});
    });

    scheduleBuildOrCreate(uninitialized, task.id, task.settings)
}

/**
 * Remove task.
 * @param context
 * @param id the primary key of the task
 * @returns {Promise<void>}
 */
async function remove(context, id) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'task', id, 'delete');

        await dependencyHelpers.ensureNoDependencies(tx, context, id, [
            {entityTypeId: 'job', column: 'task'}
        ]);

        const task = await tx('tasks').where('id', id).first();

        taskHandler.scheduleTaskDelete(id, task.type);

        // deletes the built files of the task
        await files.removeAllTx(tx, context, 'task', 'file', id);

        await tx('tasks').where('id', id).del();

        // Remove task dir
        await fs.remove(taskHandler.getTaskDir(id));
    });
}

/**
 * Returns parameters of the task
 * @param context
 * @param id the primary key of the task
 * @returns {Promise<any>}
 */
async function getParamsById(context, id) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'task', id, 'view');
        const entity = await tx('tasks').select(['settings']).where('id', id).first();
        const settings = JSON.parse(entity.settings);
        return settings.params;
    });
}

/**
 * Helper for deciding if initialization is needed or build is sufficient.
 * @param uninitialized whether task is in uninitilized state
 * @param id the primary key of the task
 * @param settings
 */
function scheduleBuildOrCreate(uninitialized, id, settings) {
    if (uninitialized) {
        scheduleCreate(id, settings);
    } else {
        scheduleBuild(id, settings);
    }
}

function scheduleBuild(id, settings) {
    taskHandler.scheduleBuild(id, settings.code, taskHandler.getTaskBuildOutputDir(id));
}

function scheduleCreate(id, settings) {
    taskHandler.scheduleInit(id, settings.code, taskHandler.getTaskBuildOutputDir(id));
}

/**
 * Prepare task for use.
 * @param context
 * @param id the primary key of the task
 * @returns {Promise<void>}
 */
async function compile(context, id) {
    let task;
    let uninitialized = true;
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'task', id, 'edit');

        task = await tx('tasks').where('id', id).first();
        if(!task){
            throw new Error(`Task not found`);
        }

        uninitialized = (task.build_state === BuildState.UNINITIALIZED);

        await tx('tasks').where('id', id).update({build_state: BuildState.SCHEDULED});
    });

    const settings = JSON.parse(task.settings);
    scheduleBuildOrCreate(uninitialized, id, settings);
}

async function compileAll() {
    const tasks = await knex('tasks');

    for (const task of tasks) {
        const settings = JSON.parse(task.settings);
        const uninitialized = (task.build_state === BuildState.UNINITIALIZED);
        await knex('tasks').update({build_state: BuildState.SCHEDULED}).where('id', task.id);
        scheduleBuildOrCreate(uninitialized, task.id, settings);
    }
}

module.exports.hash = hash;
module.exports.getById = getById;
module.exports.listDTAjax = listDTAjax;
module.exports.create = create;
module.exports.updateWithConsistencyCheck = updateWithConsistencyCheck;
module.exports.remove = remove;
module.exports.getParamsById = getParamsById;
module.exports.compile = compile;
module.exports.compileAll = compileAll;
