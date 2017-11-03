'use strict';

const config = require('../lib/config');
const knex = require('../lib/knex');
const hasher = require('node-object-hash')();
const { DerivedSignalType } = require('../lib/signals-helpers');
const { enforce, filterObject } = require('../lib/helpers');
const dtHelpers = require('../lib/dt-helpers');
const interoperableErrors = require('../../shared/interoperable-errors');
const namespaceHelpers = require('../lib/namespace-helpers');
const shares = require('./shares');

const allowedKeys = new Set(['cid', 'name', 'description', 'type', 'settings', 'set', 'namespace']);

function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeys));
}

async function getById(context, id) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'signal', id, 'view');
        const entity = await tx('signals').where('id', id).first();
        entity.settings = JSON.parse(entity.settings);
        entity.permissions = await shares.getPermissionsTx(tx, context, 'signal', id);
        return entity;
    });
}

async function listDTAjax(context, signalSetId, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{ entityTypeId: 'signal', requiredOperations: ['view'] }],
        params,
        builder => builder
            .from('signals')
            .where('signal_sets', signalSetId)
            .innerJoin('namespaces', 'namespaces.id', 'signals.namespace'),
        [ 'signals.id', 'signals.cid', 'signals.name', 'signals.description', 'signals.type', 'signal_sets.cid', 'signal_sets.name', 'signals.created', 'namespaces.name' ]
    );
}

async function serverValidate(context, data) {
    const result = {};

    if (data.cid) {
        const query = knex('signals').where({cid: data.cid, set: data.set});

        if (data.id) {
            // Id is not set in entity creation form
            query.andWhereNot('id', data.id);
        }

        const signal = await query.first();

        result.cid = {};
        result.cid.exists = !!signal;
    }

    return result;
}

async function _validateAndPreprocess(tx, entity, isCreate) {
    await namespaceHelpers.validateEntity(tx, entity);

    enforce(entity.type in DerivedSignalType, 'Only derived signals can be created / updated.');

    const signalSet = await tx('signal_sets').where('id', entity.set).first();
    enforce(signalSet, 'Signal set not found');

    const existingWithCidQuery = tx('signals').where({cid: entity.cid, set: entity.set});
    if (!isCreate) {
        existingWithCidQuery.whereNot('id', entity.id);
    }

    const existingWithCid = await existingWithCidQuery.first();
    enforce(!existingWithCid, "Signal's machine name (cid) is already used for another signal.")

    entity.settings = JSON.stringify(entity.settings);
}


async function create(context, signalSetId, entity) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'namespace', entity.namespace, 'createSignal');
        await shares.enforceEntityPermissionTx(tx, context, 'signalSet', entity.set, 'createDerivedSignal');

        entity.set = signalSetId;
        await _validateAndPreprocess(tx, entity, true);

        const filteredEntity = filterObject(entity, allowedKeys);
        const ids = await tx('signals').insert(filteredEntity);
        const id = ids[0];

        await shares.rebuildPermissionsTx(tx, { entityTypeId: 'signal', entityId: id });

        return id;
    });
}

async function updateWithConsistencyCheck(context, entity) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'signal', entity.id, 'edit');

        const existing = await tx('signals').where('id', entity.id).first();
        if (!existing) {
            throw new interoperableErrors.NotFoundError();
        }

        existing.settings = JSON.parse(existing.settings);

        const existingHash = hash(existing);
        if (existingHash !== entity.originalHash) {
            throw new interoperableErrors.ChangedError();
        }

        await _validateAndPreprocess(tx, entity, false);

        await namespaceHelpers.validateMove(context, entity, existing, 'signal', 'createSignal', 'delete');

        if (existing.set !== entity.set) {
            await shares.enforceEntityPermissionTx(tx, context, 'signal', entity.id, 'delete');
            await shares.enforceEntityPermissionTx(tx, context, 'signalSet', entity.set, 'createDerivedSignal');
        }

        const filteredEntity = filterObject(entity, allowedKeys);
        await tx('signals').where('id', entity.id).update(filteredEntity);

        await shares.rebuildPermissionsTx(tx, { entityTypeId: 'signal', entityId: entity.id });
    });
}

async function remove(context, id) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'signal', id, 'delete');

        const existing = await tx('signals').where('id', id).first();
        enforce(existing.type in DerivedSignalType, 'Only derived signals can be deleted');
        await tx('signals').where('id', id).del();
    });
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