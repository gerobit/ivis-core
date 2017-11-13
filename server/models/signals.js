'use strict';

const config = require('../lib/config');
const knex = require('../lib/knex');
const hasher = require('node-object-hash')();
const signalStorage = require('./signal-storage');
const { RawSignalTypes, AllSignalTypes } = require('../../shared/signals');
const { enforce, filterObject } = require('../lib/helpers');
const dtHelpers = require('../lib/dt-helpers');
const interoperableErrors = require('../../shared/interoperable-errors');
const namespaceHelpers = require('../lib/namespace-helpers');
const shares = require('./shares');

const allowedKeysCreate = new Set(['cid', 'name', 'description', 'type', 'settings', 'set', 'namespace']);
const allowedKeysUpdate = new Set(['cid', 'name', 'description', 'settings', 'namespace']);

function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeysUpdate));
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

async function listByCidDTAjax(context, signalSetCid, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{ entityTypeId: 'signal', requiredOperations: ['view'] }],
        params,
        builder => builder
            .from('signals')
            .innerJoin('signal_sets', 'signal_sets.id', 'signals.set')
            .where('signal_sets.cid', signalSetCid)
            .innerJoin('namespaces', 'namespaces.id', 'signals.namespace'),
        [ 'signals.id', 'signals.cid', 'signals.name', 'signals.description', 'signals.type', 'signals.created', 'namespaces.name' ]
    );
}

async function listDTAjax(context, signalSetId, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{ entityTypeId: 'signal', requiredOperations: ['view'] }],
        params,
        builder => builder
            .from('signals')
            .where('set', signalSetId)
            .innerJoin('namespaces', 'namespaces.id', 'signals.namespace'),
        [ 'signals.id', 'signals.cid', 'signals.name', 'signals.description', 'signals.type', 'signals.created', 'namespaces.name' ]
    );
}

async function serverValidate(context, signalSetId, data) {
    const result = {};

    if (data.cid) {
        const query = knex('signals').where({cid: data.cid, set: signalSetId});

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

    enforce(AllSignalTypes.has(entity.type), 'Unknown signal type');

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
        await shares.enforceEntityPermissionTx(tx, context, 'signalSet', signalSetId, 'createSignal');

        entity.set = signalSetId;
        await _validateAndPreprocess(tx, entity, true);

        const signalSet = await tx('signal_sets').where('id', signalSetId).first();

        const filteredEntity = filterObject(entity, allowedKeysCreate);
        filteredEntity.settings = JSON.stringify({});
        const ids = await tx('signals').insert(filteredEntity);
        const id = ids[0];

        await shares.rebuildPermissionsTx(tx, { entityTypeId: 'signal', entityId: id });

        if (RawSignalTypes.has(entity.type)) {
            const fieldAdditions = {
                [entity.cid]: entity.type
            };

            await signalStorage.extendSchema(signalSet.cid, signalSet.aggs, fieldAdditions);
        }

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

        const signalSet = await tx('signal_sets').where('id', existing.set).first();

        await namespaceHelpers.validateMove(context, entity, existing, 'signal', 'createSignal', 'delete');

        const filteredEntity = filterObject(entity, allowedKeysUpdate);
        await tx('signals').where('id', entity.id).update(filteredEntity);

        await shares.rebuildPermissionsTx(tx, { entityTypeId: 'signal', entityId: entity.id });

        if (RawSignalTypes.has(entity.type) && existing.cid !== entity.cid) {
            await signalStorage.renameField(signalSet.cid, signalSet.aggs, existing.cid, entity.cid);
        }
    });
}

async function remove(context, id) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'signal', id, 'delete');

        const existing = await tx('signals').where('id', id).first();

        const signalSet = await tx('signal_sets').where('id', existing.set).first();

        if (RawSignalTypes.has(existing.type)) {
            await signalStorage.removeField(signalSet.cid, signalSet.aggs, existing.cid);
        }

        await tx('signals').where('id', id).del();
    });
}


module.exports = {
    hash,
    getById,
    listDTAjax,
    listByCidDTAjax,
    create,
    updateWithConsistencyCheck,
    remove,
    serverValidate
};