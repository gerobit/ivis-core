'use strict';

const config = require('../lib/config');
const signalStorage = require('./signal-storage');
const indexer = require('../lib/indexers/' + config.indexer);
const knex = require('../lib/knex');
const hasher = require('node-object-hash')();
const { enforce, filterObject } = require('../lib/helpers');
const dtHelpers = require('../lib/dt-helpers');
const interoperableErrors = require('../../shared/interoperable-errors');
const namespaceHelpers = require('../lib/namespace-helpers');
const shares = require('./shares');
const { IndexingStatus } = require('../../shared/signals');

const allowedKeysCreate = new Set(['name', 'description', 'address', 'user', 'namespace']);
const allowedKeysUpdate = new Set(['name', 'description', 'address', 'user', 'namespace']);

function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeysUpdate));
}

async function getById(context, id) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'farm', id, 'view');
        const entity = await tx('farms').where('id', id).first();
        entity.permissions = await shares.getPermissionsTx(tx, context, 'farm', id);
        return entity;
    });
}

//.innerJoin('users', 'users.id', 'farms.user')
async function listDTAjax(context, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{ entityTypeId: 'farm', requiredOperations: ['view'] }],
        params,
        builder => builder.from('farms').innerJoin('namespaces', 'namespaces.id', 'farms.namespace'),
        ['farms.id', 'farms.name', 'farms.description', 'farms.address', 'farms.user', 'farms.created', 'namespaces.name']
    );
}

//FIXME: to be used in the future
async function serverValidate(context, data) {
    const result = {};

    if (data.name) {
        const query = knex('farms').where('cid', data.cid);

        if (data.id) {
            // Id is not set in entity creation form
            query.andWhereNot('id', data.id);
        }

        const farm = await query.first();

        result.cid = {};
        result.cid.exists = !!farm;
    }

    return result;
}

//FIXME: to be used in the future
async function _validateAndPreprocess(tx, entity, is) {
    await namespaceHelpers.validateEntity(tx, entity);

    const existingWithNameQuery = tx('farms').where('name', entity.name);
    if (!is) {
        existingWithNameQuery.whereNot('id', entity.id);
    }

    const existingWithName = await existingWithNameQuery.first();
    enforce(!existingWithCid, "Farm name (name) is already used for another farm.")
}

async function create(context, entity) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'namespace', entity.namespace, 'createFarm');

        //await _validateAndPreprocess(tx, entity, true);

        const filteredEntity = filterObject(entity, allowedKeysCreate);
        const ids = await tx('farms').insert(filteredEntity);
        const id = ids[0];

        await shares.rebuildPermissionsTx(tx, { entityTypeId: 'farm', entityId: id });

        return id;
    });
}

async function updateWithConsistencyCheck(context, entity) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'farm', entity.id, 'edit');

        const existing = await tx('farms').where('id', entity.id).first();
        if (!existing) {
            throw new interoperableErrors.NotFoundError();
        }

        const existingHash = hash(existing);
        if (existingHash !== entity.originalHash) {
            throw new interoperableErrors.ChangedError();
        }

        //await _validateAndPreprocess(tx, entity, false);

        await namespaceHelpers.validateMove(context, entity, existing, 'farm', 'createFarm', 'delete');

        const filteredEntity = filterObject(entity, allowedKeysUpdate);
        await tx('farms').where('id', entity.id).update(filteredEntity);

        await shares.rebuildPermissionsTx(tx, { entityTypeId: 'farm', entityId: entity.id });
    });
}

async function remove(context, id) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'farm', id, 'delete');

        const existing = await tx('farms').where('id', id).first();

        //await tx('signals').where('set', id).del();
        await tx('farms').where('id', id).del();

        //await signalStorage.removeStorage(existing.cid);
    });
}

async function listUnassignedSensorsDTAjax(context, entityId, params) {
    return await knex.transaction(async (tx) => {
        await shares.enforceEntityPermissionTx(tx, context, 'farm', entityId, 'edit');

        return await dtHelpers.ajaxListTx(
            tx,
            params,
            builder => builder
                .from('signal_sets')
                .whereNotExists(function () {
                    return this
                        .select('sensor')
                        .from('farm_sensors')
                        .whereRaw(`signal_sets.id = farm_sensors.sensor`)
                        .andWhere(`farm_sensors.farm`, entityId);
                }),
            ['signal_sets.id', 'signal_sets.name', 'signal_sets.description', 'signal_sets.created', 'signal_sets.namespace','signal_sets.cid']
        );
    });
}

async function addSensor(context, entityId, sensorId) {
    //const entityType = permissions.getEntityType(entityTypeId);
    await knex.transaction(async tx => {
        //await enforceEntityPermissionTx(tx, context, entityTypeId, entityId, 'share');

        //fixme enforce(await tx('users').where('id', userId).select('id').first(), 'Invalid user id');
        //enforce(await tx(entityType.entitiesTable).where('id', entityId).select('id').first(), 'Invalid entity id');
        await tx('farm_sensors').insert({
            farm: entityId,
            sensor: sensorId
        });
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
        let farm;

        await knex.transaction(async tx => {
            farm = await tx('farms').where('cid', cid).first();
            if (!farm) {
                farm = {
                    cid,
                    aggs,
                    name: defaultName,
                    description: defaultDescription,
                    namespace: defaultNamespace
                };

                const id = await create(context, farm);
                farm.id = id;
            }


            const existingSignals = await tx('signals').where('set', farm.id);

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
                    await shares.enforceEntityPermissionTx(tx, context, 'farm', farm.id, ['manageSignals', 'createRawSignal']);

                    const signal = {
                        cid: fieldCid,
                        name: fieldCid,
                        type,
                        set: farm.id,
                        namespace: defaultNamespace
                    };

                    const signalIds = await tx('signals').insert(signal);
                    const signalId = signalIds[0];
                    await shares.rebuildPermissionsTx(tx, { entityTypeId: 'signal', entityId: signalId });

                    fieldAdditions[fieldCid] = type;
                    existingSignalTypes[fieldCid] = type;
                    schemaExtendNeeded = true;
                }
            }

            if (schemaExtendNeeded) {
                await signalStorage.extendSchema(cid, aggs, fieldAdditions)
            }
        });

        ensurePromise = null;

        return farm;
    })();

    return await ensurePromise;
}

async function insertRecords(context, entity, records) {
    await shares.enforceEntityPermission(context, 'farms', entity.id, 'insert');

    await signalStorage.insertRecords(entity.cid, entity.aggs, records);
}

async function query(context, qry  /* [{cid, signals: {cid: [agg]}, interval: {from, to, aggregationInterval}}]  =>  [{prev: {ts, count, [{xxx: {min: 1, max: 3, avg: 2}}], main: ..., next: ...}] */) {
    return await knex.transaction(async tx => {
        for (const sigSetSpec of qry) {
            const sigSet = await tx('farms').where('cid', sigSetSpec.cid).first();
            if (!sigSet) {
                shares.throwPermissionDenied();
            }

            sigSetSpec.aggs = sigSet.aggs;

            await shares.enforceEntityPermissionTx(tx, context, 'farm', sigSet.id, 'query');

            for (const sigCid in sigSetSpec.signals) {
                const sig = await tx('signals').where({ cid: sigCid, set: sigSet.id }).first();
                if (!sig) {
                    shares.throwPermissionDenied();
                }

                await shares.enforceEntityPermissionTx(tx, context, 'signal', sig.id, 'query');
            }
        }

        return await indexer.query(qry);
    });
}

async function reindex(context, farmId) {
    let cid;

    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'farm', farmId, 'reindex');
        const existing = await tx('farms').where('id', farmId).first();

        const indexing = JSON.parse(existing.indexing);
        indexing.status = IndexingStatus.PENDING;
        await tx('farms').where('id', farmId).update('indexing', JSON.stringify(indexing));

        cid = existing.cid;
    });

    return await indexer.reindex(cid);
}


module.exports = {
    hash,
    getById,
    listDTAjax,
    create,
    updateWithConsistencyCheck,
    remove,
    listUnassignedSensorsDTAjax,
    addSensor,
    serverValidate,
    ensure,
    insertRecords,
    reindex,
    query
};