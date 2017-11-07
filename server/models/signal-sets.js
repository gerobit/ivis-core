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

const allowedKeysCreate = new Set(['cid', 'name', 'description', 'aggs', 'namespace']);
const allowedKeysUpdate = new Set(['name', 'description', 'namespace']);

function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeys));
}

async function getById(context, id) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'signalSet', id, 'view');
        const entity = await tx('signal_sets').where('id', id).first();
        entity.permissions = await shares.getPermissionsTx(tx, context, 'signalSet', id);
        return entity;
    });
}

async function listDTAjax(context, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{ entityTypeId: 'signalSet', requiredOperations: ['view'] }],
        params,
        builder => builder.from('signal_sets').innerJoin('namespaces', 'namespaces.id', 'signal_sets.namespace'),
        [ 'signal_sets.id', 'signal_sets.cid', 'signal_sets.name', 'signal_sets.description', 'signal_sets.aggs', 'signal_sets.created', 'namespaces.name' ]
    );
}

async function serverValidate(context, data) {
    const result = {};

    if (data.cid) {
        const query = knex('signal_sets').where('cid', data.cid);

        if (data.id) {
            // Id is not set in entity creation form
            query.andWhereNot('id', data.id);
        }

        const signalSet = await query.first();

        result.cid = {};
        result.cid.exists = !!signalSet;
    }

    return result;
}

async function _validateAndPreprocess(tx, entity, isCreate) {
    await namespaceHelpers.validateEntity(tx, entity);

    const existingWithCidQuery = tx('signal_sets').where('cid', entity.cid);
    if (!isCreate) {
        existingWithCidQuery.whereNot('id', entity.id);
    }

    const existingWithCid = await existingWithCidQuery.first();
    enforce(!existingWithCid, "Signal set's machine name (cid) is already used for another signal set.")
}


async function create(context, entity) {
    return await knex.transaction(async tx => {
        shares.enforceGlobalPermission(context, 'allocateSignalSet');
        await shares.enforceEntityPermissionTx(tx, context, 'namespace', entity.namespace, 'createSignalSet');

        await _validateAndPreprocess(tx, entity, true);

        const filteredEntity = filterObject(entity, allowedKeysCreate);
        const ids = await tx('signal_sets').insert(filteredEntity);
        const id = ids[0];

        await signalsStorage.createStorage(entity.cid, entity.aggs);

        await shares.rebuildPermissionsTx(tx, { entityTypeId: 'signalSet', entityId: id });

        return id;
    });
}

async function updateWithConsistencyCheck(context, entity) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'signalSet', entity.id, 'edit');

        const existing = await tx('signal_sets').where('id', entity.id).first();
        if (!existing) {
            throw new interoperableErrors.NotFoundError();
        }

        const existingHash = hash(existing);
        if (existingHash !== entity.originalHash) {
            throw new interoperableErrors.ChangedError();
        }

        await _validateAndPreprocess(tx, entity, false);

        await namespaceHelpers.validateMove(context, entity, existing, 'signalSet', 'createSignalSet', 'delete');

        const filteredEntity = filterObject(entity, allowedKeysUpdate);
        await tx('signal_sets').where('id', entity.id).update(filteredEntity);

        await shares.rebuildPermissionsTx(tx, { entityTypeId: 'signal_set', entityId: entity.id });
    });
}

async function remove(context, id) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'signalSet', id, 'delete');

        const existing = await tx('signal_sets').where('id', id).first();

        await tx('signals').where('set', id).del();
        await tx('signal_sets').where('id', id).del();

        await signalsStorage.removeStorage(existing.cid);
    });
}

// Thought this method modifies the storage schema, it can be called concurrently from async. This is meant to simplify coding of intake endpoints.
let ensurePromise = null;
async function ensure(context, cid, aggs, schema, defaultName, defaultDescription, defaultNamespace) {

    // This implements a simple mutex to make sure that the lambda function below always completes before it is started again from another async call
    while (ensurePromise) {
        await ensurePromise;
    }

    ensurePromise = (async () => {

        await knex.transaction(async tx => {
            let signalSet = await tx('signal_set').where('cid', cid).first();
            if (!signalSet) {
                const signalSet = {
                    cid,
                    aggs,
                    name: defaultName,
                    description: defaultDescription,
                    namespace: defaultNamespace
                };

                const id = await create(context, signalSet);
                signalSet.id = id;
            }


            const existingSignals = await tx('signals').where('set', signalSet.id);

            const existingSignalTypes = {};
            for (const row of existingSignals) {
                existingSignalTypes[row.cid] = row.type;
            }

            const fieldAdditions = {};
            let schemaExtendNeeded = false;

            for (const fieldCid in schema) {
                const type = schema[fieldCid];
                const existingSignalType = existingSignalTypes[fieldCid];

                if (existingSignalType) {
                    enforce(existingSignalType === type, `Signal "${fieldCid}" is already present with another type.`);

                } else {
                    await shares.enforceEntityPermissionTx(tx, context, 'namespace', defaultNamespace, 'createSignal');
                    await shares.enforceEntityPermissionTx(tx, context, 'signalSet', signalSet.id, ['manageSignals', 'createRawSignal']);

                    const signal = {
                        cid: fieldCid,
                        name: fieldCid,
                        type,
                        set: signalSet.id,
                        namespace: defaultNamespace
                    };

                    const signalId = await tx('signals').insert(signal);
                    await shares.rebuildPermissionsTx(tx, { entityTypeId: 'signal', entityId: signalId });

                    fieldAdditions[fieldCid] = type;
                    existingSignalType[fieldCid] = type;
                    schemaExtendNeeded = true;
                }
            }

            if (schemaExtendNeeded) {
                await signalsStorage.extendSchema(cid, aggs, fieldAdditions)
            }
        });


        ensurePromise = null;
    })();

    await ensurePromise;
}

async function insertRecords(context, entity, records) {
    await shares.enforceEntityPermission(context, 'signalSet', entity.id, 'insert');

    if (entity.aggs) {
        records = records.map(x => Object.assign({ ts: new Date(Math.floor((x.lastTS.valueOf() + x.firstTS.valueOf()) / 2)) }, x));
    }

    await signalsStorage.insertRecords(entity.cid, records);
}

async function query(context, qry  /* [{cid, signals: {cid: [agg]}, interval: {from, to, aggregationInterval}}]  =>  [{prev: {ts, count, [{xxx: {min: 1, max: 3, avg: 2}}], main: ..., next: ...}] */) {
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
    ensure,
    insertRecords,
    query
};