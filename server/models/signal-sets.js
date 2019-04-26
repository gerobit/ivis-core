'use strict';

const config = require('../lib/config');
const signalStorage = require('./signal-storage');
const indexer = require('../lib/indexers/' + config.indexer);
const knex = require('../lib/knex');
const hasher = require('node-object-hash')();
const {enforce, filterObject} = require('../lib/helpers');
const dtHelpers = require('../lib/dt-helpers');
const interoperableErrors = require('../../shared/interoperable-errors');
const namespaceHelpers = require('../lib/namespace-helpers');
const shares = require('./shares');
const {IndexingStatus, IndexMethod} = require('../../shared/signals');
const signals = require('./signals');
const {SignalSetType} = require('../../shared/signal-sets');
const {parseCardinality, getFieldsetPrefix, resolveAbs} = require('../../shared/templates');
const log = require('../lib/log');
const synchronized = require('../lib/synchronized');
const {SignalType} = require('../../shared/signals');

const contextHelpers = require('../lib/context-helpers');

const allowedKeysCreate = new Set(['cid', 'type', 'name', 'description', 'namespace', 'record_id_template']);
const allowedKeysUpdate = new Set(['name', 'description', 'namespace', 'record_id_template']);

const handlebars = require('handlebars');
const recordIdTemplateHandlebars = handlebars.create();

const moment = require('moment');

recordIdTemplateHandlebars.registerHelper({
    toISOString: function (val) {
        return moment(val).toISOString();
    },
    padStart: function (val, len) {
        return val.toString().padStart(len, 0);
    }
});

function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeysUpdate));
}

async function _getBy(context, key, id, withPermissions, withSignalByCidMap) {
    return await knex.transaction(async tx => {
        const entity = await tx('signal_sets').where(key, id).first();

        if (!entity) {
            shares.throwPermissionDenied();
        }

        await shares.enforceEntityPermissionTx(tx, context, 'signalSet', entity.id, 'view');

        if (withPermissions) {
            entity.permissions = await shares.getPermissionsTx(tx, context, 'signalSet', entity.id);
        }

        if (withSignalByCidMap) {
            entity.signalByCidMap = await getSignalByCidMapTx(tx, entity);
        }

        return entity;
    });
}

async function getById(context, id, withPermissions = true, withSignalByCidMap = false) {
    return await _getBy(context, 'id', id, withPermissions, withSignalByCidMap);
}

async function getByCid(context, id, withPermissions = true, withSignalByCidMap = false) {
    return await _getBy(context, 'cid', id, withPermissions, withSignalByCidMap);
}

async function listDTAjax(context, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{entityTypeId: 'signalSet', requiredOperations: ['view']}],
        params,
        builder => builder.from('signal_sets').innerJoin('namespaces', 'namespaces.id', 'signal_sets.namespace'),
        ['signal_sets.id', 'signal_sets.cid', 'signal_sets.name', 'signal_sets.description', 'signal_sets.type', 'signal_sets.indexing', 'signal_sets.created', 'namespaces.name'],
        {
            mapFun: data => {
                data[5] = JSON.parse(data[5]);
            }
        }
    );
}

async function listRecordsDTAjax(context, sigSetId, params) {
    return await knex.transaction(async tx => {
        // shares.enforceEntityPermissionTx(tx, context, 'signalSet', sigSetId, 'query') is already called inside signals.listVisibleForListTx
        const sigs = await signals.listVisibleForListTx(tx, context, sigSetId);

        const sigSet = await tx('signal_sets').where('id', sigSetId).first();

        if (sigSet.type !== SignalSetType.COMPUTED) {
            return await signalStorage.listRecordsDTAjaxTx(tx, sigSet, sigs.map(sig => sig.id), params);
        } else {
            throw new Error('Not implemented for computed sets yet');
        }
    });
}


async function list() {
    return await knex('signal_sets');
}

async function serverValidate(context, data) {
    const result = {};

    if (data.cid) {
        await shares.enforceTypePermission(context, 'namespace', 'createSignalSet');

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
        status: IndexingStatus.READY
    });

    const ids = await tx('signal_sets').insert(filteredEntity);
    const id = ids[0];

    entity.id = id;
    if (!entity.type || entity.type !== SignalSetType.COMPUTED) {
        await signalStorage.createStorage(entity);
    } else {
        await indexer.onCreateStorage(entity);
    }


    await shares.rebuildPermissionsTx(tx, {entityTypeId: 'signalSet', entityId: id});

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

        await shares.rebuildPermissionsTx(tx, {entityTypeId: 'signalSet', entityId: entity.id});
    });
}

async function remove(context, id) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'signalSet', id, 'delete');

        const existing = await tx('signal_sets').where('id', id).first();

        await tx('signals').where('set', id).del();
        await tx('signal_sets').where('id', id).del();

        if (existing.type !== SignalSetType.COMPUTED) {
            await signalStorage.removeStorage(existing);
        } else {
            return await indexer.onRemoveStorage(existing);
        }
    });
}

// Thought this method modifies the storage schema, it can be called concurrently from async. This is meant to simplify coding of intake endpoints.
async function _ensure(context, cid, schema, defaultName, defaultDescription, defaultNamespace) {
    return await knex.transaction(async tx => {
        let signalSet = await tx('signal_sets').where('cid', cid).first();
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

        const signalByCidMap = {};
        signalSet.signalByCidMap = signalByCidMap;

        const existingSignals = await tx('signals').where('set', signalSet.id);

        const existingSignalTypes = {};
        for (const row of existingSignals) {
            existingSignalTypes[row.cid] = row.type;
            signalByCidMap[row.cid] = row;
        }

        const fieldAdditions = {};
        let schemaExtendNeeded = false;

        for (const fieldCid in schema) {
            let fieldSpec;

            if (typeof schema[fieldCid] === 'string') {
                fieldSpec = {
                    name: fieldCid,
                    type: schema[fieldCid],
                    settings: {},
                    indexed: true
                }
            } else {
                fieldSpec = schema[fieldCid];
            }

            const existingSignalType = existingSignalTypes[fieldCid];

            if (existingSignalType) {
                enforce(existingSignalType === fieldSpec.type, `Signal "${fieldCid}" is already present with another type.`);

            } else {
                await shares.enforceEntityPermissionTx(tx, context, 'namespace', defaultNamespace, 'createSignal');
                await shares.enforceEntityPermissionTx(tx, context, 'signalSet', signalSet.id, 'createSignal');

                const signal = {
                    cid: fieldCid,
                    ...fieldSpec,
                    set: signalSet.id,
                    namespace: defaultNamespace
                };

                signal.settings = JSON.stringify(signal.settings);

                const signalIds = await tx('signals').insert(signal);
                const signalId = signalIds[0];
                signal.id = signalId;

                await shares.rebuildPermissionsTx(tx, {entityTypeId: 'signal', entityId: signalId});

                fieldAdditions[signalId] = fieldSpec.type;
                existingSignalTypes[fieldCid] = fieldSpec.type;
                schemaExtendNeeded = true;

                signalByCidMap[fieldCid] = signal;
            }
        }

        if (schemaExtendNeeded) {
            await signalStorage.extendSchema(signalSet, fieldAdditions);
        }

        return signalSet;
    });
}

const ensure = synchronized(_ensure);


async function getSignalByCidMapTx(tx, sigSet) {
    const sigs = await tx('signals').where('set', sigSet.id);

    const mapping = {};
    for (const sig of sigs) {
        mapping[sig.cid] = sig;
    }

    return mapping;
}

function getRecordIdTemplate(sigSet) {
    const recordIdTemplateSource = sigSet.record_id_template;
    if (recordIdTemplateSource) {
        return recordIdTemplateHandlebars.compile(recordIdTemplateSource, {noEscape: true});
    } else {
        return null;
    }
}

async function getRecord(context, sigSetWithSigMap, recordId) {
    const sigs = await signals.listVisibleForEdit(context, sigSetWithSigMap.id, true);
    const record = await signalStorage.getRecord(sigSetWithSigMap, recordId);

    const filteredSignals = {};

    for (const sig of sigs) {
        filteredSignals[sig.cid] = record.signals[sig.cid];
    }

    return {
        id: record.id,
        signals: filteredSignals
    };
}

async function insertRecords(context, sigSetWithSigMap, records) {
    await shares.enforceEntityPermission(context, 'signalSet', sigSetWithSigMap.id, 'insertRecord');
    await signalStorage.insertRecords(sigSetWithSigMap, records);
}

async function updateRecord(context, sigSetWithSigMap, existingRecordId, record) {
    await shares.enforceEntityPermission(context, 'signalSet', sigSetWithSigMap.id, 'editRecord');
    await signalStorage.updateRecord(sigSetWithSigMap, existingRecordId, record);
}

async function removeRecord(context, sigSet, recordId) {
    await shares.enforceEntityPermission(context, 'signalSet', sigSet.id, 'deleteRecord');
    await signalStorage.removeRecord(sigSet, recordId);
}


async function serverValidateRecord(context, sigSetId, data) {
    const result = {};

    await shares.enforceEntityPermission(context, 'signalSet', sigSetId, ['insertRecord', 'editRecord']);
    const sigSetWithSigMap = await getById(context, sigSetId, false, true);

    result.id = {};

    if (sigSetWithSigMap.record_id_template) {
        const recordIdTemplate = getRecordIdTemplate(sigSetWithSigMap);

        const recordId = recordIdTemplate(data.signals);

        result.id.exists = await signalStorage.idExists(sigSetWithSigMap, recordId, data.existingId);

    } else if (data.id) {
        result.id.exists = await signalStorage.idExists(sigSetWithSigMap, data.id, data.existingId);
    }

    return result;
}


async function getLastId(context, sigSet) {
    await shares.enforceEntityPermission(context, 'signalSet', sigSet.id, 'query');

    const lastId = await signalStorage.getLastId(sigSet);
    return lastId;
}

/* queries = [
    {
        sigSetCid: <sigSetCid>,

        signals: [<sigCid>, ...],

        ranges: [
            {
                sigCid: <sigCid>,
                lte / lt: <value or date>,
                gte / gt: <value or date>
            }
        ],

        mustExist: [<sigCid>, ...],

        aggs: [
            {
                sigCid: <sigCid>,
                buckets: [{gte/gt, lte/lt}] / step: <value or time interval>, offset: <offset in ms>
                signals: [sigCid: ['min', 'max', 'avg']] / aggs,
                order: 'asc'/'desc',
                limit: <max no. of records>
            }
        ]

        <OR>

        sample: { // TODO: Not implemented yet
            limit: <max no. of records>,
            sort: [
                {
                    sigCid: 'ts',
                    order: 'asc'
                }
            ]
        }

        <OR>

        docs: { // TODO: Not implemented yet
            limit: <max no. of records>,
            sort: [
                {
                    sigCid: 'ts',
                    order: 'asc'
                }
            ]
        }

        <OR>

        summary: {
            signals: [sigCid: ['min', 'max', 'avg']]
        ]
    }

*/

async function query(context, queries) {
    return await knex.transaction(async tx => {
        for (const sigSetQry of queries) {
            const sigSet = await tx('signal_sets').where('cid', sigSetQry.sigSetCid).first();
            if (!sigSet) {
                shares.throwPermissionDenied();
            }

            await shares.enforceEntityPermissionTx(tx, context, 'signalSet', sigSet.id, 'query');

            // Map from signal cid to signal
            const signalMap = {};

            const sigs = await tx('signals').where('set', sigSet.id);
            for (const sig of sigs) {
                sig.settings = JSON.parse(sig.settings);
                signalMap[sig.cid] = sig;
            }

            const signalsToCheck = new Set();

            for (const rng of sigSetQry.ranges || []) {
                const sig = signalMap[rng.sigCid];
                if (!sig) {
                    shares.throwPermissionDenied();
                }

                signalsToCheck.add(sig.id);
            }

            for (const sigCid of sigSetQry.mustExist || []) {
                const sig = signalMap[sigCid];
                if (!sig) {
                    shares.throwPermissionDenied();
                }

                signalsToCheck.add(sig.id);
            }

            const checkSignals = signals => {
                for (const sigCid of signals) {
                    const sig = signalMap[sigCid];
                    if (!sig) {
                        log.verbose(`unknown signal ${sigSet.cid}.${sigCid}`);
                        shares.throwPermissionDenied();
                    }

                    signalsToCheck.add(sig.id);
                }
            };

            const checkAggs = aggs => {
                for (const agg of aggs) {
                    const sig = signalMap[agg.sigCid];
                    if (!sig) {
                        shares.throwPermissionDenied();
                    }

                    signalsToCheck.add(sig.id);

                    if (agg.signals) {
                        checkSignals(Object.keys(agg.signals));
                    } else if (agg.aggs) {
                        checkAggs(agg.aggs);
                    }
                }
            };

            const checkSort = sort => {
                if (sort) {
                    for (const srt of sort) {
                        const sig = signalMap[srt.sigCid];
                        if (!sig) {
                            shares.throwPermissionDenied();
                        }

                        signalsToCheck.add(sig.id);
                    }
                }
            };

            if (sigSetQry.aggs) {
                checkAggs(sigSetQry.aggs);
            } else if (sigSetQry.docs) {
                checkSignals(sigSetQry.docs.signals);
                checkSort(sigSetQry.docs.sort);
            } else if (sigSetQry.sample) {
                checkSignals(sigSetQry.sample.signals);
                checkSort(sigSetQry.sample.sort);
            } else if (sigSetQry.summary) {
                checkSignals(Object.keys(sigSetQry.summary.signals));
            } else {
                throw new Error('None of "aggs", "docs", "sample", "summary" query part has been specified');
            }

            for (const sigId of signalsToCheck) {
                await shares.enforceEntityPermissionTx(tx, context, 'signal', sigId, 'query');
            }

            sigSetQry.sigSet = sigSet;
            sigSetQry.signalMap = signalMap;
        }

        return await indexer.query(queries);
    });
}

async function index(context, signalSetId, method = IndexMethod.FULL) {
    let existing;

    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'signalSet', signalSetId, 'reindex');
        existing = await tx('signal_sets').where('id', signalSetId).first();

        const indexing = JSON.parse(existing.indexing);
        indexing.status = IndexingStatus.SCHEDULED;
        await tx('signal_sets').where('id', signalSetId).update('indexing', JSON.stringify(indexing));
    });

    return await indexer.index(existing, method);
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
                            entryIdx += 1;
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
                    const sigCid = params[spec.id]; // If a parameter is not selected (e.g. because the config has not been updated after params change), this is empty
                    if (sigCid) {
                        const sigSetCid = sigSetsPathMap.get(resolveAbs(prefix, spec.signalSetRef));

                        let sigSet = allowedSigSets.get(sigSetCid);
                        if (!sigSet) {
                            sigSet = new Set();
                            allowedSigSets.set(sigSetCid, sigSet);
                        }

                        sigSet.add(sigCid);
                    }
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
                            entryIdx += 1;
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
            const whereFun = function () {
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
module.exports.getByCid = getByCid;
module.exports.listDTAjax = listDTAjax;
module.exports.list = list;
module.exports.create = create;
module.exports.updateWithConsistencyCheck = updateWithConsistencyCheck;
module.exports.remove = remove;
module.exports.serverValidate = serverValidate;
module.exports.ensure = ensure;
module.exports.getRecord = getRecord;
module.exports.insertRecords = insertRecords;
module.exports.updateRecord = updateRecord;
module.exports.removeRecord = removeRecord;
module.exports.serverValidateRecord = serverValidateRecord;
module.exports.index = index;
module.exports.query = query;
module.exports.getAllowedSignals = getAllowedSignals;
module.exports.getLastId = getLastId;
module.exports.getSignalByCidMapTx = getSignalByCidMapTx;
module.exports.getRecordIdTemplate = getRecordIdTemplate;
module.exports.listRecordsDTAjax = listRecordsDTAjax;