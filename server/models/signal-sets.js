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
const {parseCardinality} = require('../../shared/templates');

const allowedKeysCreate = new Set(['cid', 'name', 'description', 'aggs', 'namespace']);
const allowedKeysUpdate = new Set(['name', 'description', 'namespace']);

function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeysUpdate));
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
        [ 'signal_sets.id', 'signal_sets.cid', 'signal_sets.name', 'signal_sets.description', 'signal_sets.aggs', 'signal_sets.indexing', 'signal_sets.created', 'namespaces.name' ],
        {
            mapFun: data => {
                data[5] = JSON.parse(data[5]);
            }
        }
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


async function _createTx(tx, context, entity) {
    shares.enforceGlobalPermission(context, 'allocateSignalSet');
    await shares.enforceEntityPermissionTx(tx, context, 'namespace', entity.namespace, 'createSignalSet');

    await _validateAndPreprocess(tx, entity, true);

    const filteredEntity = filterObject(entity, allowedKeysCreate);

    filteredEntity.indexing = JSON.stringify({
       status: IndexingStatus.PENDING
    });

    const ids = await tx('signal_sets').insert(filteredEntity);
    const id = ids[0];

    await signalStorage.createStorage(entity.cid, entity.aggs);

    await shares.rebuildPermissionsTx(tx, { entityTypeId: 'signalSet', entityId: id });

    return id;
}

async function create(context, entity) {
    return await knex.transaction(async tx => {
        return await _createTx(tx, context, entity);
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

        await shares.rebuildPermissionsTx(tx, { entityTypeId: 'signalSet', entityId: entity.id });
    });
}

async function remove(context, id) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'signalSet', id, 'delete');

        const existing = await tx('signal_sets').where('id', id).first();

        await tx('signals').where('set', id).del();
        await tx('signal_sets').where('id', id).del();

        await signalStorage.removeStorage(existing.cid);
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
        let signalSet;

        await knex.transaction(async tx => {
            signalSet = await tx('signal_sets').where('cid', cid).first();
            if (!signalSet) {
                signalSet = {
                    cid,
                    aggs,
                    name: defaultName,
                    description: defaultDescription,
                    namespace: defaultNamespace
                };

                const id = await _createTx(tx, context, signalSet);
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

        return signalSet;
    })();

    return await ensurePromise;
}

async function insertRecords(context, entity, records) {
    await shares.enforceEntityPermission(context, 'signalSet', entity.id, 'insert');

    await signalStorage.insertRecords(entity.cid, entity.aggs, records);
}

async function query(context, qry  /* [{cid, signals: {cid: [agg]}, interval: {from, to, aggregationInterval}}]  =>  [{prev: {ts, count, [{xxx: {min: 1, max: 3, avg: 2}}], main: ..., next: ...}] */) {
    return await knex.transaction(async tx => {
        for (const sigSetSpec of qry) {
            const sigSet = await tx('signal_sets').where('cid', sigSetSpec.cid).first();
            if (!sigSet) {
                shares.throwPermissionDenied();
            }

            sigSetSpec.aggs = sigSet.aggs;

            await shares.enforceEntityPermissionTx(tx, context, 'signalSet', sigSet.id, 'query');

            for (const sigCid in sigSetSpec.signals) {
                const sig = await tx('signals').where({cid: sigCid, set: sigSet.id}).first();
                if (!sig) {
                    shares.throwPermissionDenied();
                }

                await shares.enforceEntityPermissionTx(tx, context, 'signal', sig.id, 'query');
            }
        }

        return await indexer.query(qry);
    });
}

async function reindex(context, signalSetId) {
    let cid;

    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'signalSet', signalSetId, 'reindex');
        const existing = await tx('signal_sets').where('id', signalSetId).first();

        const indexing = JSON.parse(existing.indexing);
        indexing.status = IndexingStatus.PENDING;
        await tx('signal_sets').where('id', signalSetId).update('indexing', JSON.stringify(indexing));

        cid = existing.cid;
    });

    return await indexer.reindex(cid);
}

async function getAllowedSignals(templateParams, params) {

    const allowedSigSets = new Map();
    const selectedSigSets = new Map();

    function computeSelectedSigSets(templateParams, params, prefix = '') {
        for (const spec of templateParams) {
            if (spec.type === 'signalSet') {
                selectedSigSets.set(prefix + spec.id, params[spec.id]);
                allowedSigSets.set(params[spec.id], new Set());

            } else if (spec.type === 'fieldset') {
                const card = parseCardinality(spec.cardinality);
                if (spec.children) {
                    if (card.max === 1) {
                        computeSelectedSigSets(spec.children, params[spec.id], prefix + spec.id + '.');
                    } else {
                        for (const childParams of params[spec.id]) {
                            computeSelectedSigSets(spec.children, childParams, prefix + spec.id + '.');
                        }
                    }
                }
            }
        }
    }

    function computeAllowedSignals(templateParams, params) {
        for (const spec of templateParams) {
            if (spec.type === 'signal') {
                const sigSetCid = selectedSigSets.get(spec.signalSet);
                const sigSet = allowedSigSets.get(sigSetCid);
                sigSet.add(params[spec.id]);

            } else if (spec.type === 'fieldset') {
                const card = parseCardinality(spec.cardinality);
                if (spec.children) {
                    if (card.max === 1) {
                        computeAllowedSignals(spec.children, params[spec.id]);
                    } else {
                        for (const childParams of params[spec.id]) {
                            computeAllowedSignals(spec.children, childParams);
                        }
                    }
                }
            }
        }
    }

    computeSelectedSigSets(templateParams, params);
    computeAllowedSignals(templateParams, params);


    const query = knex('signal_sets').innerJoin('signals', 'signal_sets.id', 'signals.set').select(['signal_sets.cid AS setCid', 'signal_sets.id as setId', 'signals.cid AS signalCid', 'signals.id AS signalId']);

    for (const [key, sigs] of allowedSigSets.entries()) {
        const whereFun = function() {
            this.where('signal_sets.cid', key).whereIn('signals.cid', [...sigs.values()]);
        };

        query.orWhere(whereFun);
    }

    const rows = await query;

    const result = new Map();
    for (const row of rows) {
        if (!result.has(row.setCid)) {
            result.set(row.setCid, {
               id: row.setId,
               sigs: new Map()
            });
        }

        const sigMap = result.get(row.setCid).sigs;
        if (!sigMap.has(row.signalCid)) {
            sigMap.set(row.signalCid, row.signalId);
        }
    }

    return result;
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
    reindex,
    query,
    getAllowedSignals
};