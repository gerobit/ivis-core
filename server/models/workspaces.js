'use strict';

const knex = require('../lib/knex');
const hasher = require('node-object-hash')();
const { enforce, filterObject } = require('../lib/helpers');
const dtHelpers = require('../lib/dt-helpers');
const interoperableErrors = require('../../shared/interoperable-errors');
const namespaceHelpers = require('../lib/namespace-helpers');
const shares = require('./shares');
const entitySettings = require('../lib/entity-settings');
const dependencyHelpers = require('../lib/dependency-helpers');

const allowedKeys = new Set(['name', 'description', 'default_panel', 'namespace']);

function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeys));
}

async function getById(context, id) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'workspace', id, 'view');

        const entity = await tx('workspaces').where('id', id).first();
        entity.permissions = await shares.getPermissionsTx(tx, context, 'workspace', id);

        const orderIdRow = await tx('workspaces').where('order', '>', entity.order).orderBy('order', 'asc').select(['id']).first();
        if (orderIdRow) {
            entity.orderBefore = orderIdRow.id;
        } else {
            entity.orderBefore = 'end';
        }

        return entity;
    });
}

async function listVisible(context) {
    return await knex.transaction(async tx => {
        if (context.user.admin) {
            return await tx('workspaces')
                .whereNotNull('order')
                .orderBy('order', 'asc')
                .select('id', 'name', 'description', 'default_panel');

        } else {
            const entityType = entitySettings.getEntityType('workspace');

            const entities = await tx('workspaces')
                .innerJoin(
                    function () {
                        return this.from(entityType.permissionsTable).select('entity').where('user', context.user.id).where('operation', 'view').as('permitted__workspace');
                    },
                    'permitted__workspace.entity', 'workspaces.id'
                )
                .whereNotNull('order')
                .orderBy('order', 'asc')
                .select('id', 'name', 'description', 'default_panel');

            return entities.filter(panel => shares.isAccessibleByRestrictedAccessHandler(context, 'workspace', panel.id, ['view'], 'workspaces.listVisible'));
        }
    });
}

async function listDTAjax(context, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{ entityTypeId: 'workspace', requiredOperations: ['view'] }],
        params,
        builder => builder.from('workspaces').innerJoin('namespaces', 'namespaces.id', 'workspaces.namespace'),
        [ 'workspaces.id', 'workspaces.order', 'workspaces.name', 'workspaces.description', 'workspaces.created', 'namespaces.name', 'workspaces.default_panel' ],
        {
            orderByBuilder: (builder, orderColumn, orderDir) => {
                if (orderColumn === 'workspaces.order') {
                    builder.orderBy(knex.raw('-workspaces.order'), orderDir === 'asc' ? 'desc' : 'asc') // This is MySQL speciality. It sorts the rows in ascending order with NULL values coming last
                } else {
                    builder.orderBy(orderColumn, orderDir)
                }
            }
        }
    );
}

async function _sortIn(tx, entityId, sortInBefore) {
    const ws = await tx('workspaces').whereNot('id', entityId).whereNotNull('order').orderBy('order', 'asc');

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
        await tx('workspaces').where('id', id).update({order: order[id]});
    }
}

async function _validateAndPreprocess(tx, context, entity, isCreate) {
    await namespaceHelpers.validateEntity(tx, entity);

    if (entity.default_panel) {
        await shares.enforceEntityPermissionTx(tx, context, 'panel', entity.default_panel, 'view');
    }
}


async function create(context, entity) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'namespace', entity.namespace, 'createWorkspace');

        await _validateAndPreprocess(tx, context, entity, true);

        const filteredEntity = filterObject(entity, allowedKeys);

        const ids = await tx('workspaces').insert(filteredEntity);
        const id = ids[0];

        await _sortIn(tx, id, entity.orderBefore);

        await shares.rebuildPermissionsTx(tx, { entityTypeId: 'workspace', entityId: id });

        return id;
    });
}

async function updateWithConsistencyCheck(context, entity) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'workspace', entity.id, 'edit');

        const existing = await tx('workspaces').where('id', entity.id).first();
        if (!existing) {
            throw new interoperableErrors.NotFoundError();
        }

        const existingHash = hash(existing);
        if (existingHash !== entity.originalHash) {
            throw new interoperableErrors.ChangedError();
        }

        await _validateAndPreprocess(tx, context, entity, false);

        await namespaceHelpers.validateMove(context, entity, existing, 'workspace', 'createWorkspace', 'delete');

        const filteredEntity = filterObject(entity, allowedKeys);

        await tx('workspaces').where('id', entity.id).update(filteredEntity);

        await _sortIn(tx, entity.id, entity.orderBefore);

        await shares.rebuildPermissionsTx(tx, { entityTypeId: 'workspace', entityId: entity.id });
    });
}

async function remove(context, id) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'workspace', id, 'delete');

        await dependencyHelpers.ensureNoDependencies(tx, context, id, [
            { entityTypeId: 'panel', column: 'workspace' }
        ]);

        await tx('workspaces').where('id', id).del();
    });
}

module.exports.hash = hash;
module.exports.getById = getById;
module.exports.listVisible = listVisible;
module.exports.listDTAjax = listDTAjax;
module.exports.create = create;
module.exports.updateWithConsistencyCheck = updateWithConsistencyCheck;
module.exports.remove = remove;
