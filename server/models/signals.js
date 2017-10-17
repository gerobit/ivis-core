'use strict';

const config = require('../lib/config');
const signalsStorage = require('./signals-storage/' + config.signalStorage);
const knex = require('../lib/knex');
const hasher = require('node-object-hash')();
const { enforce, filterObject } = require('../lib/helpers');
const dtHelpers = require('../lib/dt-helpers');
const interoperableErrors = require('../../shared/interoperable-errors');
const namespaceHelpers = require('../lib/namespace-helpers');
const shares = require('./shares');

const allowedKeys = new Set(['cid', 'name', 'description', 'has_agg', 'has_val', 'namespace']);

function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeys));
}

async function getById(context, id) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'signal', id, 'view');
        const entity = await tx('signals').where('id', id).first();
        entity.permissions = await shares.getPermissionsTx(tx, context, 'signal', id);
        return entity;
    });
}

async function listDTAjax(context, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{ entityTypeId: 'signal', requiredOperations: ['view'] }],
        params,
        builder => builder.from('signals').innerJoin('namespaces', 'namespaces.id', 'signals.namespace'),
        [ 'signals.id', 'signals.cid', 'signals.name', 'signals.description', 'signals.has_agg', 'signals.has_val', 'signals.created', 'namespaces.name' ]
    );
}

async function serverValidate(context, data) {
    const result = {};

    if (data.cid) {
        const query = knex('signals').where('cid', data.cid);

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

    const existingWithCidQuery = tx('signals').where('cid', entity.cid);
    if (!isCreate) {
        existingWithCidQuery.whereNot('id', entity.id);
    }

    const existingWithCid = await existingWithCidQuery.first();
    enforce(!existingWithCid, "Signal's machine name (cid) is already used for another signal.")
}


async function create(context, entity) {
    return await knex.transaction(async tx => {
        shares.enforceGlobalPermission(context, 'allocateSignal');
        await shares.enforceEntityPermissionTx(tx, context, 'namespace', entity.namespace, 'createSignal');

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

        const existingHash = hash(existing);
        if (existingHash !== entity.originalHash) {
            throw new interoperableErrors.ChangedError();
        }

        await _validateAndPreprocess(tx, entity, false);

        await namespaceHelpers.validateMove(context, entity, existing, 'signal', 'createSignal', 'delete');

        const filteredEntity = filterObject(entity, allowedKeys);
        await tx('signals').where('id', entity.id).update(filteredEntity);

        await shares.rebuildPermissionsTx(tx, { entityTypeId: 'signal', entityId: entity.id });
    });
}

async function remove(context, id) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'signal', id, 'delete');

        const existing = await tx('signals').where('id', id).first();
        await tx('signals').where('id', id).del();

        await signalsStorage.remove(existing.cid);
    });
}

async function getByCidOrCreate(context, entity) {
    return await knex.transaction(async tx => {
        const existing = await tx('signals').where('cid', entity.cid).first();
        if (!existing) {
            const id = create(context, entity);
            entity.id = id;

            return entity;
        } else {
            return existing;
        }
    });
}

async function insertVals(context, entity, vals /* [{ts, val}] */) {
    await shares.enforceEntityPermission(context, 'signal', entity.id, 'insert');
    if (!entity.has_val) {
        shares.throwPermissionDenied();
    }

    await signalsStorage.insertVals(entity.cid, vals);
}

async function insertAggs(context, entity, aggs /* [{firstTS, lastTS, max, min, avg }] */) {
    await shares.enforceEntityPermission(context, 'signal', entity.id, 'insert');
    if (!entity.has_agg) {
        shares.throwPermissionDenied();
    }

    const aggsWithTs = aggs.map(x => Object.assign({ ts: Math.floor((x.lastTS - x.firstTS) / 2) }, x));
    await signalsStorage.insertAggs(entity.cid, aggsWithTs);
}

async function query(context, qry  /* [{cid, attrs: [ names ], interval: {from, to, aggregationInterval}}] */) { // FIXME - add support for vals
    return await knex.transaction(async tx => {
        for (const sigSpec of qry) {
            const signal = await tx('signals').where('cid', sigSpec.cid).first();
            if (!signal) {
                shares.throwPermissionDenied();
            }

            await shares.enforceEntityPermissionTx(tx, context, 'signal', signal.id, 'query');
        }

        return await signalsStorage.query(qry);
    });
}


module.exports = {
    hash,
    getById,
    listDTAjax,
    create,
    updateWithConsistencyCheck,
    remove,
    serverValidate,
    getByCidOrCreate,
    insertVals,
    insertAggs,
    query
};