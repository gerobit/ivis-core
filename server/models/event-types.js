'use strict';

const config = require('../lib/config');
const knex = require('../lib/knex');
const hasher = require('node-object-hash')();
const { enforce, filterObject } = require('../lib/helpers');
const dtHelpers = require('../lib/dt-helpers');
const interoperableErrors = require('../../shared/interoperable-errors');
const namespaceHelpers = require('../lib/namespace-helpers');
const shares = require('./shares');

const allowedKeysCreate = new Set(['name', 'description', 'unit', 'namespace']);
const allowedKeysUpdate = new Set(['name', 'description', 'unit', 'namespace']);

function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeysUpdate));
}

async function getById(context, id) {
    return await knex.transaction(async tx => {
        //await shares.enforceEntityPermissionTx(tx, context, 'f', id, 'view');
        const entity = await tx('event_types').where('id', id).first();
        //entity.permissions = await shares.getPermissionsTx(tx, context, 'namespace', id);
        return entity;
    });
}

async function listDTAjax(context, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{ entityTypeId: 'namespace', requiredOperations: ['viewEventTypes'] }],
        params,
        builder => builder.from('event_types').innerJoin('namespaces', 'namespaces.id', 'event_types.namespace'),
        ['event_types.id', 'event_types.name', 'event_types.description', 'event_types.unit', 'namespaces.name']
    );
}

async function create(context, entity) {
    return await knex.transaction(async tx => {
        //QUESTION
        //await shares.enforceEntityPermissionTx(tx, context, 'namespace', entity.namespace, 'manageFarms');

        //await _validateAndPreprocess(tx, entity, true);

        const filteredEntity = filterObject(entity, allowedKeysCreate);
        const ids = await tx('event_types').insert(filteredEntity);
        const id = ids[0];

        // FIXME: await shares.rebuildPermissionsTx(tx, { entityTypeId: 'eventType', entityId: id });

        return id;
    });
}

async function updateWithConsistencyCheck(context, entity) {
    await knex.transaction(async tx => {
        // FIXME: await shares.enforceEntityPermissionTx(tx, context, 'eventType', entity.id, 'edit');
        //await shares.enforceEntityPermissionTx(tx, context, 'namespace', entity.namespace, 'manageFarms');

        const existing = await tx('event_types').where('id', entity.id).first();
        if (!existing) {
            throw new interoperableErrors.NotFoundError();
        }

        const existingHash = hash(existing);
        if (existingHash !== entity.originalHash) {
            throw new interoperableErrors.ChangedError();
        }

        //await _validateAndPreprocess(tx, entity, false);
        // FIXME: await namespaceHelpers.validateMove(context, entity, existing, 'eventType', 'createeventType', 'delete');

        const filteredEntity = filterObject(entity, allowedKeysUpdate);
        await tx('event_types').where('id', entity.id).update(filteredEntity);

        // FIXME: await shares.rebuildPermissionsTx(tx, { entityTypeId: 'eventType', entityId: entity.id });
    });
}

async function remove(context, id) {
    await knex.transaction(async tx => {
        // FIXME: await shares.enforceEntityPermissionTx(tx, context, 'eventType', id, 'delete');
        //await shares.enforceEntityPermissionTx(tx, context, 'namespace', context.user.namespace, 'manageFarms');

        const existing = await tx('event_types').where('id', id).first();
        await tx('event_types').where('id', id).del();
    });
}


//FIXME: to be used in the future
async function serverValidate(context, data) {
    const result = {};

    if (data.name) {
        const query = knex('event_types')
            .where('name', data.name)
            .where('namespace', data.namespace);
        
        if (data.id) {
            // Id is not set in entity creation form
            query.andWhereNot('id', data.id);
        }

        const eventType = await query.first();

        result.cid = {};
        result.cid.exists = !!eventType;
    }

    return result;
}

//FIXME: to be used in the future
async function _validateAndPreprocess(tx, entity, is) {
    await namespaceHelpers.validateEntity(tx, entity);

    const existingWithNameQuery = tx('event_types')
        .where('name', entity.name)
        .where('namespace', entity.namespace);

    if (!is) {
        existingWithNameQuery.whereNot('id', entity.id);
    }

    const existingWithName = await existingWithNameQuery.first();
    enforce(!existingWithName, "eventType name (name) is already used for another eventType in the same namespace.")
}
module.exports = {
    hash,
    getById,
    listDTAjax,
    create,
    updateWithConsistencyCheck,
    remove,
    serverValidate
};