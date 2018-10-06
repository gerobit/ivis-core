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
const { IndexingStatus, SignalType } = require('../../shared/signals');
const {parseCardinality, getFieldsetPrefix, resolveAbs} = require('../../shared/templates');
const moment = require('moment');

const allowedKeysCreate = new Set(['cid', 'name', 'description', 'namespace']);
const allowedKeysUpdate = new Set(['name', 'description', 'namespace']);
const invalidCidCharacters = /[A-Z#*?" ,<>|\\/]/; // Characters not allowed by elasticsearch
const maxCidLength = 53; // mysql limit for table names is 64

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
        [ 'signal_sets.id', 'signal_sets.cid', 'signal_sets.name', 'signal_sets.description', 'signal_sets.indexing', 'signal_sets.created', 'namespaces.name' ],
        {
            mapFun: data => {
                data[4] = JSON.parse(data[4]);
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
        result.cid.tooLong = data.cid.length > 53;
        result.cid.invalidCharacter = invalidCidCharacters.test(data.cid);
    }

    return result;
}

async function _validateAndPreprocess(tx, entity, isCreate) {
    await namespaceHelpers.validateEntity(tx, entity);

    enforce(entity.cid.length <= maxCidLength, "Signal set's machine name (cid) is too long.")
    enforce(!invalidCidCharacters.test(entity.cid), "Signal set's machine name (cid) contains invalid characters.")

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
       status: IndexingStatus.READY
    });

    const ids = await tx('signal_sets').insert(filteredEntity);
    const id = ids[0];

    await signalStorage.createStorage(entity.cid);

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
async function ensure(context, cid, schema, defaultName, defaultDescription, defaultNamespace) {

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
                await signalStorage.extendSchema(cid, fieldAdditions);
            }
        });

        ensurePromise = null;

        return signalSet;
    })();

    return await ensurePromise;
}

async function insertRecords(context, sigSet, records) {
    await shares.enforceEntityPermission(context, 'signalSet', sigSet.id, 'insert');

    await signalStorage.insertRecords(sigSet.cid, records);
}

async function getLastTs(context, sigSet) {
    await shares.enforceEntityPermission(context, 'signalSet', sigSet.id, 'query');

    const lastTs = await signalStorage.getLastTs(sigSet.cid);
    return lastTs && moment(lastTs);
}

async function query(context, qry  /* [{cid, signals: {cid: [agg]}, interval: {from, to, aggregationInterval}}]  =>  [{prev: {ts, count, [{xxx: {min: 1, max: 3, avg: 2}}], main: ..., next: ...}] */) {
    return await knex.transaction(async tx => {
        for (const sigSetSpec of qry) {
            const sigSet = await tx('signal_sets').where('cid', sigSetSpec.cid).first();
            if (!sigSet) {
                shares.throwPermissionDenied();
            }

            await shares.enforceEntityPermissionTx(tx, context, 'signalSet', sigSet.id, 'query');

            // Map from signal cid to unique id
            const sigUniqueIds = Object.create(null);
            // Map from signal cid to signal type and settings
            const signalInfo = Object.create(null);

            let needAllSignals = false;

            for (const sigCid in sigSetSpec.signals) {
                const sig = await tx('signals').where({cid: sigCid, set: sigSet.id}).first();
                if (!sig) {
                    shares.throwPermissionDenied();
                }

                await shares.enforceEntityPermissionTx(tx, context, 'signal', sig.id, 'query');

                sigUniqueIds[sigCid] = sig.id;
                signalInfo[sigCid] = {settings: JSON.parse(sig.settings), type: sig.type};

                if(sig.type == SignalType.PAINLESS){
                    needAllSignals = true;
                }
            }

            if(needAllSignals){
                // Painless script can access any signal in the signal set
                const sigs = await tx('signals').where({set: sigSet.id});
                for(const sig of sigs){
                    await shares.enforceEntityPermissionTx(tx, context, 'signal', sig.id, 'query');
                    sigUniqueIds[sig.cid] = sig.id;
                }
            }

            sigSetSpec.uniqueIds = sigUniqueIds;
            sigSetSpec.signalInfo = signalInfo;
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
        indexing.status = IndexingStatus.SCHEDULED;
        await tx('signal_sets').where('id', signalSetId).update('indexing', JSON.stringify(indexing));

        cid = existing.cid;
    });

    return await indexer.reindex(cid);
}

async function getAllowedSignals(templateParams, params) {

    const allowedSigSets = new Map();
    const sigSetsPathMap = new Map();

    function computeSetsPathMap(templateParams, params, prefix = '/') {
        for (const spec of templateParams) {
            if (spec.type === 'signalSet') {
                sigSetsPathMap.set(resolveAbs(prefix, spec.id), params[spec.id]);
                allowedSigSets.set(params[spec.id], new Set());

            } else if (spec.type === 'fieldset') {
                const card = parseCardinality(spec.cardinality);
                if (spec.children) {
                    if (card.max === 1) {
                        computeSetsPathMap(spec.children, params[spec.id], getFieldsetPrefix(prefix, spec));
                    } else {
                        let entryIdx = 0;
                        for (const childParams of params[spec.id]) {
                            computeSetsPathMap(spec.children, childParams, getFieldsetPrefix(prefix, spec, entryIdx));
                            entryIdx +=1;
                        }
                    }
                }
            }
        }
    }

    function computeAllowedSignals(templateParams, params, prefix = '/') {
        for (const spec of templateParams) {
            if (spec.type === 'signal') {
                if (spec.signalSetRef) {
                    const sigSetCid = sigSetsPathMap.get(resolveAbs(prefix, spec.signalSetRef));

                    let sigSet = allowedSigSets.get(sigSetCid);
                    if (!sigSet) {
                        sigSet = new Set();
                        allowedSigSets.set(sigSetCid, sigSet);
                    }

                    sigSet.add(params[spec.id]);
                }
            } else if (spec.type === 'fieldset') {
                const card = parseCardinality(spec.cardinality);
                if (spec.children) {
                    if (card.max === 1) {
                        computeAllowedSignals(spec.children, params[spec.id], getFieldsetPrefix(prefix, spec));
                    } else {
                        let entryIdx = 0;
                        for (const childParams of params[spec.id]) {
                            computeAllowedSignals(spec.children, childParams, getFieldsetPrefix(prefix, spec, entryIdx));
                            entryIdx +=1;
                        }
                    }
                }
            }
        }
    }

    computeSetsPathMap(templateParams, params);
    computeAllowedSignals(templateParams, params);

    if (allowedSigSets.size > 0) {
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

    } else {
        return new Map();
    }
}


module.exports.hash = hash;
module.exports.getById = getById;
module.exports.listDTAjax = listDTAjax;
module.exports.create = create;
module.exports.updateWithConsistencyCheck = updateWithConsistencyCheck;
module.exports.remove = remove;
module.exports.serverValidate = serverValidate;
module.exports.ensure = ensure;
module.exports.insertRecords = insertRecords;
module.exports.reindex = reindex;
module.exports.query = query;
module.exports.getAllowedSignals = getAllowedSignals;
module.exports.getLastTs = getLastTs;
