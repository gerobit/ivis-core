'use strict';

const knex = require('../lib/knex');
const hasher = require('node-object-hash')();
const { enforce, filterObject } = require('../lib/helpers');
const dtHelpers = require('../lib/dt-helpers');
const interoperableErrors = require('../../shared/interoperable-errors');
const namespaceHelpers = require('../lib/namespace-helpers');
const shares = require('./shares');
const { TemplateType } = require('../../shared/templates');
const { BuildState } = require('../../shared/build');
const fs = require('fs-extra-promise');
const webpack = require('../lib/builder');
const path = require('path');
const files = require('./files');
const dependencyHelpers = require('../lib/dependency-helpers');

const allowedKeys = new Set(['name', 'description', 'type', 'settings', 'elevated_access', 'namespace']);

const templatesDir = path.join(__dirname, '..', 'files', 'template-content');

function getTemplateDir(id){
    return path.join(templatesDir, id.toString());
}

function getTemplateBuildOutputDir(id){
    return path.join(getTemplateDir(id), 'build')
}

function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeys));
}

async function getById(context, id) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'template', id, 'view');
        const entity = await tx('templates').where('id', id).first();
        entity.settings = JSON.parse(entity.settings);
        entity.output = JSON.parse(entity.output);
        entity.permissions = await shares.getPermissionsTx(tx, context, 'template', id);
        return entity;
    });
}

async function listDTAjax(context, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{ entityTypeId: 'template', requiredOperations: ['view'] }],
        params,
        builder => builder.from('templates').innerJoin('namespaces', 'namespaces.id', 'templates.namespace'),
        [ 'templates.id', 'templates.name', 'templates.description', 'templates.type', 'templates.elevated_access', 'templates.created', 'templates.state', 'namespaces.name' ]
    );
}

async function create(context, entity) {
    const id = await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'namespace', entity.namespace, 'createTemplate');
        await namespaceHelpers.validateEntity(tx, entity);

        if (entity.elevated_access) {
            shares.enforceGlobalPermission(context, 'editTemplatesWithElevatedAccess');
        }

        enforce(Object.values(TemplateType).includes(entity.type), 'Unknown template type');

        const filteredEntity = filterObject(entity, allowedKeys);
        filteredEntity.settings = JSON.stringify(filteredEntity.settings);
        filteredEntity.state = BuildState.SCHEDULED;

        const ids = await tx('templates').insert(filteredEntity);
        const id = ids[0];

        await shares.rebuildPermissionsTx(tx, { entityTypeId: 'template', entityId: id });

        return id;
    });

    scheduleBuild(id, entity.settings);

    return id;
}

async function updateWithConsistencyCheck(context, entity) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'template', entity.id, 'edit');

        if (entity.elevated_access) {
            shares.enforceGlobalPermission(context, 'editTemplatesWithElevatedAccess');
        }

        const existing = await tx('templates').where('id', entity.id).first();
        if (!existing) {
            throw new interoperableErrors.NotFoundError();
        }

        existing.settings = JSON.parse(existing.settings);
        const existingHash = hash(existing);
        if (existingHash !== entity.originalHash) {
            throw new interoperableErrors.ChangedError();
        }

        await namespaceHelpers.validateEntity(tx, entity);
        await namespaceHelpers.validateMove(context, entity, existing, 'template', 'createTemplate', 'delete');

        const filteredEntity = filterObject(entity, allowedKeys);
        filteredEntity.settings = JSON.stringify(filteredEntity.settings);
        filteredEntity.state = BuildState.SCHEDULED;
        await tx('templates').where('id', entity.id).update(filteredEntity);

        await shares.rebuildPermissionsTx(tx, { entityTypeId: 'template', entityId: entity.id });
    });

    scheduleBuild(entity.id, entity.settings);
}

async function remove(context, id) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'template', id, 'delete');

        await dependencyHelpers.ensureNoDependencies(tx, context, id, [
            { entityTypeId: 'panel', column: 'template' }
        ]);

        await files.removeAllTx(tx, context, 'template', 'file', id);

        await tx('templates').where('id', id).del();

        // deletes the built files of the template
        await fs.remove(getTemplateDir(id));
    });
}

async function getParamsById(context, id) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'template', id, 'view');
        const entity = await tx('templates').select(['settings']).where('id', id).first();
        const settings = JSON.parse(entity.settings);
        return settings.params;
    });
}

async function getModuleById(context, id) {
    await shares.enforceEntityPermission(context, 'template', id, 'execute');
    const module = await fs.readFileAsync(path.join(getTemplateBuildOutputDir(id), 'module.js'), 'utf8');
    return module;
}
function scheduleBuild(id, settings) {
    webpack.scheduleBuild('template_' + id, settings.jsx, settings.scss, getTemplateBuildOutputDir(id), {table: 'templates', rowId: id});
}

async function compile(context, id) {
    let entity;

    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'template', id, 'edit');

        entity = await tx('templates').where('id', id).first();

        await tx('templates').where('id', id).update({state: BuildState.SCHEDULED});
    });

    const settings = JSON.parse(entity.settings);
    scheduleBuild(id, settings);
}

async function compileAll() {
    await knex('templates').update({state: BuildState.SCHEDULED});
    const entities = await knex('templates');

    for (const entity of entities) {
        const settings = JSON.parse(entity.settings);
        scheduleBuild(entity.id, settings);
    }
}

module.exports.hash = hash;
module.exports.getById = getById;
module.exports.listDTAjax = listDTAjax;
module.exports.create = create;
module.exports.updateWithConsistencyCheck = updateWithConsistencyCheck;
module.exports.remove = remove;
module.exports.getParamsById = getParamsById;
module.exports.getModuleById = getModuleById;
module.exports.compile = compile;
module.exports.compileAll = compileAll;
