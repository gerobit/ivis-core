'use strict';

const knex = require('../lib/knex');
const hasher = require('node-object-hash')();
const { enforce, filterObject } = require('../lib/helpers');
const dtHelpers = require('../lib/dt-helpers');
const interoperableErrors = require('../../shared/interoperable-errors');
const namespaceHelpers = require('../lib/namespace-helpers');
const shares = require('./shares');
const entitySettings = require('../lib/entity-settings');
const builtinTemplates = require('./builtin-templates');

const allowedKeys = new Set(['name', 'description', 'workspace', 'template', 'builtin_template', 'params', 'namespace']);

function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeys));
}

async function getByIdWithTemplateParams(context, id, includePermissions = true) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'panel', id, 'view');

        const entity = await tx('panels')
            .where('panels.id', id)
            .leftJoin('templates', 'panels.template', 'templates.id')
            .select(['panels.id', 'panels.name', 'panels.description', 'panels.workspace', 'panels.template', 'panels.builtin_template', 'panels.params', 'panels.namespace', 'panels.order', 'templates.settings', 'templates.elevated_access'])
            .first();

        entity.params = JSON.parse(entity.params);

        if (entity.template) {
            const settings = JSON.parse(entity.settings);
            entity.templateParams = settings.params;
            delete entity.settings;
        } else {
            const builtinTemplatesMap = builtinTemplates.list();
            const builtinTemplate = builtinTemplatesMap[entity.builtin_template];
            entity.templateParams = builtinTemplate && builtinTemplate.params;
        }

        entity.templateElevatedAccess = entity.elevated_access;
        delete entity.elevated_access;

        if (includePermissions) {
            entity.permissions = await shares.getPermissionsTx(tx, context, 'panel', id);
        }

        if (entity.order === null) {
            entity.orderBefore = 'none';
        } else {
            const orderIdRow = await tx('panels').where('order', '>', entity.order).where('workspace', entity.workspace).orderBy('order', 'asc').select(['id']).first();
            if (orderIdRow) {
                entity.orderBefore = orderIdRow.id;
            } else {
                entity.orderBefore = 'end';
            }
        }

        return entity;
    });
}

async function listVisible(context, workspaceId) {
    return await knex.transaction(async tx => {
        if (context.user.admin) {
            return await tx('panels')
                .where('workspace', workspaceId)
                .whereNotNull('order')
                .orderBy('order', 'asc')
                .select('id', 'name', 'description');

        } else {
            const entityType = entitySettings.getEntityType('panel');

            const entities = await tx('panels')
                .innerJoin(
                    function () {
                        return this.from(entityType.permissionsTable).select('entity').where('user', context.user.id).where('operation', 'view').as('permitted__panel');
                    },
                    'permitted__panel.entity', 'panels.id'
                )
                .where('workspace', workspaceId)
                .whereNotNull('order')
                .orderBy('order', 'asc')
                .select('id', 'name', 'description');

            return entities.filter(panel => shares.isAccessibleByRestrictedAccessHandler(context, 'panel', panel.id, ['view'], 'panels.listVisible'));
        }
    });
}

async function listByDTAjax(context, idColumn, id, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{ entityTypeId: 'panel', requiredOperations: ['view'] }],
        params,
        builder => builder
            .from('panels')
            .where(idColumn, id)
            .leftJoin('templates', 'templates.id', 'panels.template')
            .innerJoin('namespaces', 'namespaces.id', 'panels.namespace'),
        [ 'panels.id', 'panels.order', 'panels.name', 'panels.description', 'templates.name', 'panels.builtin_template', 'panels.created', 'namespaces.name' ],
        {
            orderByBuilder: (builder, orderColumn, orderDir) => {
                if (orderColumn === 'panels.order') {
                    builder.orderBy(knex.raw('-panels.order'), orderDir === 'asc' ? 'desc' : 'asc') // This is MySQL speciality. It sorts the rows in ascending order with NULL values coming last
                } else {
                    builder.orderBy(orderColumn, orderDir)
                }
            }
        }
    );
}

async function listByWorkspaceDTAjax(context, workspaceId, params) {
    return await listByDTAjax(context, 'workspace', workspaceId, params);
}

async function listByTemplateDTAjax(context, templateId, params) {
    return await listByDTAjax(context, 'template', templateId, params);
}

async function _sortIn(tx, workspaceId, entityId, sortInBefore) {
    const ws = await tx('panels').where('workspace', workspaceId).whereNot('id', entityId).whereNotNull('order').orderBy('order', 'asc');

    const order = new Map();

    let sortedIn = false;
    let idx = 1;
    for (const row of ws) {
        if (sortInBefore === row.id) {
            order.set(entityId, idx);
            sortedIn = true;
            idx += 1;
        }

        order.set(row.id, idx);
        idx += 1;
    }

    if (sortInBefore === 'none') {
        order.set(entityId, null);
    } else if (!sortedIn && sortInBefore !== 'none') {
        order.set(entityId, idx);
    }

    for (const [id, val] of order.entries()) {
        await tx('panels').where('id', id).update({order: val});
    }
}

async function _validateAndPreprocess(tx, entity, isCreate) {
    await namespaceHelpers.validateEntity(tx, entity);

    const workspace = await tx('workspaces').where('id', entity.workspace).first();
    enforce(workspace, 'Workspace not found');

    if (entity.builtin_template) {
        const builtinTemplatesMap = builtinTemplates.list();
        enforce(entity.builtin_template in builtinTemplatesMap, 'Builtin template not found');
    }

    entity.params = JSON.stringify(entity.params);
}


async function create(context, workspaceId, entity) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'namespace', entity.namespace, 'createPanel');
        await shares.enforceEntityPermissionTx(tx, context, 'workspace', workspaceId, 'createPanel');

        if (entity.template) {
            await shares.enforceEntityPermissionTx(tx, context, 'template', entity.template, 'view');
        }

        entity.workspace = workspaceId;
        await _validateAndPreprocess(tx, entity, true);

        const filteredEntity = filterObject(entity, allowedKeys);

        const ids = await tx('panels').insert(filteredEntity);
        const id = ids[0];

        await _sortIn(tx, workspaceId, id, entity.orderBefore);

        await shares.rebuildPermissionsTx(tx, { entityTypeId: 'panel', entityId: id });

        return id;
    });
}

async function updateWithConsistencyCheck(context, entity) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'panel', entity.id, 'edit');

        if (entity.template) {
            await shares.enforceEntityPermissionTx(tx, context, 'template', entity.template, 'view');
        }

        const existing = await tx('panels').where('id', entity.id).first();
        if (!existing) {
            throw new interoperableErrors.NotFoundError();
        }
        existing.params = JSON.parse(existing.params);

        const existingHash = hash(existing);
        if (existingHash !== entity.originalHash) {
            throw new interoperableErrors.ChangedError();
        }

        await _validateAndPreprocess(tx, entity, false);

        await namespaceHelpers.validateMove(context, entity, existing, 'panel', 'createPanel', 'delete');
        if (existing.namespace !== entity.namespace) {
            await shares.enforceEntityPermissionTx(tx, context, 'workspace', entity.workspace, 'createPanel');
        }

        const filteredEntity = filterObject(entity, allowedKeys);

        await tx('panels').where('id', entity.id).update(filteredEntity);

        await _sortIn(tx, entity.workspace, entity.id, entity.orderBefore);

        await shares.rebuildPermissionsTx(tx, { entityTypeId: 'panel', entityId: entity.id });
    });
}

async function remove(context, id) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'panel', id, 'delete');

        await tx('panels').where('id', id).del();
    });
}

async function updateConfig(context, panelId, config) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'panel', panelId, 'edit');

        await tx('panels').where('id', panelId).update({
            params: JSON.stringify(config)
        });
    });
}


module.exports.hash = hash;
module.exports.getByIdWithTemplateParams = getByIdWithTemplateParams;
module.exports.listVisible = listVisible;
module.exports.listByWorkspaceDTAjax = listByWorkspaceDTAjax;
module.exports.listByTemplateDTAjax = listByTemplateDTAjax;
module.exports.create = create;
module.exports.updateWithConsistencyCheck = updateWithConsistencyCheck;
module.exports.remove = remove;
module.exports.updateConfig = updateConfig;
