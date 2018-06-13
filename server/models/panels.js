'use strict';

const knex = require('../lib/knex');
const hasher = require('node-object-hash')();
const { enforce, filterObject } = require('../lib/helpers');
const dtHelpers = require('../lib/dt-helpers');
const interoperableErrors = require('../../shared/interoperable-errors');
const namespaceHelpers = require('../lib/namespace-helpers');
const shares = require('./shares');
const permissions = require('../lib/permissions');
const crypto = require('crypto');
const templates = require('./templates');

const allowedKeys = new Set(['name', 'description', 'workspace', 'template', 'params', 'namespace']);

function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeys));
}

async function getByIdWithTemplateParams(context, id, includePermissions = true) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'panel', id, 'view');

        const entity = await tx('panels')
            .where('panels.id', id)
            .innerJoin('templates', 'panels.template', 'templates.id')
            .select(['panels.id', 'panels.name', 'panels.description', 'panels.workspace', 'panels.template', 'panels.params', 'panels.namespace', 'panels.order', 'templates.settings', 'templates.can_edit_panel'])
            .first();

        entity.params = JSON.parse(entity.params);
        const settings = JSON.parse(entity.settings);
        entity.templateParams = settings.params;
        delete entity.settings;

        entity.templateCanEditPanel = entity.can_edit_panel;
        delete entity.can_edit_panel;

        if (includePermissions) {
            entity.permissions = await shares.getPermissionsTx(tx, context, 'panel', id);
        }

        const orderIdRow = await tx('panels').where('order', '>', entity.order).where('workspace', entity.workspace).orderBy('order', 'asc').select(['id']).first();
        if (orderIdRow) {
            entity.orderBefore = orderIdRow.id;
        } else {
            entity.orderBefore = 'end';
        }

        return entity;
    });
}

async function listVisible(context, workspaceId) {
    return await knex.transaction(async tx => {
        const entityType = permissions.getEntityType('panel');

        return await tx('panels')
            .innerJoin(
                function () {
                    return this.from(entityType.permissionsTable).select('entity').where('user', context.user.id).where('operation', 'view').as('permitted__panel');
                },
                'permitted__panel.entity', 'panels.id'
            )
            .where('workspace', workspaceId)
            .whereNotNull('order')
            .orderBy('order', 'asc')
            .select('id', 'name');

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
            .innerJoin('templates', 'templates.id', 'panels.template')
            .innerJoin('namespaces', 'namespaces.id', 'panels.namespace'),
        [ 'panels.id', 'panels.order', 'panels.name', 'panels.description', 'templates.name', 'panels.created', 'namespaces.name' ],
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

    const order = {};

    let sortedIn = false;
    let idx = 1;
    for (const row of ws) {
        if (sortInBefore === row.id) {
            order[entityId] = idx;
            sortedIn = true;
            idx += 1;
        }

        order[row.id] = idx;
        idx += 1;
    }

    if (!sortedIn && sortInBefore !== 'none') {
        order[entityId] = idx;
    }

    for (const id in order) {
        await tx('panels').where('id', id).update({order: order[id]});
    }
}

async function _validateAndPreprocess(tx, entity, isCreate) {
    await namespaceHelpers.validateEntity(tx, entity);

    const workspace = await tx('workspaces').where('id', entity.workspace).first();
    enforce(workspace, 'Workspace not found');

    entity.params = JSON.stringify(entity.params);
}


async function create(context, workspaceId, entity) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'namespace', entity.namespace, 'createPanel');
        await shares.enforceEntityPermissionTx(tx, context, 'workspace', workspaceId, 'createPanel');
        await shares.enforceEntityPermissionTx(tx, context, 'template', entity.template, 'view');

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
        await shares.enforceEntityPermissionTx(tx, context, 'template', entity.template, 'view');

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

        // FIXME - Cleanup file assets
        await shares.rebuildPermissionsTx(tx, { entityTypeId: 'panel', entityId: entity.id });
    });
}

async function remove(context, id) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'panel', id, 'delete');

        // FIXME - Cleanup file assets
        await tx('panels').where('id', id).del();
    });
}

module.exports = {
    hash,
    getByIdWithTemplateParams,
    listVisible,
    listByWorkspaceDTAjax,
    listByTemplateDTAjax,
    create,
    updateWithConsistencyCheck,
    remove
};