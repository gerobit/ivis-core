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
        ['farms.id', 'farms.name', 'farms.description', 'farms.address', 'farms.created', 'namespaces.name']
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
        await tx('farms').where('id', id).del();
    });
}

async function listUnassignedSensorsDTAjax(context, entityId, params) {
    return await knex.transaction(async (tx) => {
        await shares.enforceEntityPermissionTx(tx, context, 'farm', entityId, 'edit');

        return await dtHelpers.ajaxListTx(
            tx,
            params,
            builder => builder
                .from('signal_sets').innerJoin('namespaces', 'namespaces.id', 'signal_sets.namespace')
                .whereNotExists(function () {
                    return this
                        .select('sensor')
                        .from('farm_sensors')
                        .whereRaw(`signal_sets.id = farm_sensors.sensor`)
                        .andWhere(`farm_sensors.farm`, entityId);
                }),
            ['signal_sets.id', 'signal_sets.name', 'signal_sets.description', 'signal_sets.created', 'namespaces.name', 'signal_sets.cid']
        );
    });
}

async function addSensor(context, entityId, sensorId) {
    //const entityType = permissions.getEntityType(entityTypeId);
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'farm', entityId, 'edit');

        //fixme enforce(await tx('users').where('id', userId).select('id').first(), 'Invalid user id');
        //enforce(await tx(entityType.entitiesTable).where('id', entityId).select('id').first(), 'Invalid entity id');
        await tx('farm_sensors').insert({
            farm: entityId,
            sensor: sensorId
        });
    });
}

async function getSensors(context, params, entityId) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'farm', entityId, 'edit');

        return await dtHelpers.ajaxListTx(
            tx,
            params,
            builder => builder.from('farm_sensors').where('farm', entityId)
                .innerJoin('signal_sets', 'signal_sets.id', 'farm_sensors.sensor')
                .innerJoin('namespaces', 'namespaces.id', 'signal_sets.namespace'),
            ['signal_sets.id', 'signal_sets.name', 'signal_sets.description', 'signal_sets.created', 'namespaces.name', 'signal_sets.cid']
        );

    });
}

async function getFarmSensors(context, entityId) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'farm', entityId, 'view');

        const entities = await tx.select(['signal_sets.id', 'signal_sets.name', 'signal_sets.description', 'signal_sets.created', 'signal_sets.cid as ssCid', 'signals.cid as sCid'])
            .from('farm_sensors').where('farm', entityId)
            .innerJoin('signal_sets', 'signal_sets.id', 'farm_sensors.sensor')
            .innerJoin('signals', 'signals.set', 'signal_sets.id')

        return entities;
    });
}


async function deleteSensor(context, entityId, sensorId) {
    //console.log(context, entityId, sensorId);
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'farm', entityId, 'edit');
        //await tx('farm_sensors').where('farm', entityId).where('sensor', sensorId).del();
        await tx('farm_sensors').del().where({
            'farm': entityId,
            'sensor': sensorId
        });
    });
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
    getSensors,
    deleteSensor,
    serverValidate,
    getFarmSensors
};