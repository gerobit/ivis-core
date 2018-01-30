'use strict';

const config = require('../lib/config');
const knex = require('../lib/knex');
const hasher = require('node-object-hash')();
const { enforce, filterObject } = require('../lib/helpers');
const dtHelpers = require('../lib/dt-helpers');
const interoperableErrors = require('../../shared/interoperable-errors');
const namespaceHelpers = require('../lib/namespace-helpers');
const shares = require('./shares');
const moment = require("moment");

//const usersModel = require('./users');
const allowedKeysCreate = new Set(['advisor', 'farmer', 'farm', 'type', 'description', 'to_be_happened', 'quantity', 'cost']);
const allowedKeysUpdate = new Set(['advisor', 'farmer', 'farm', 'type', 'description', 'to_be_happened', 'quantity', 'cost']);

function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeysUpdate));
}

async function getById(context, id) {
    return await knex.transaction(async tx => {
        //await shares.enforceEntityPermissionTx(tx, context, 'f', id, 'view');
        const entity = await tx('recommendations').where('id', id).first();
        //entity.permissions = await shares.getPermissionsTx(tx, context, 'namespace', id);
        return entity;
    });
}

async function listDTAjax(context, params) {
    const user = await knex('users').select('role').where('id', context.user.id).first();
    if (!user) {
        if (context) {
            shares.throwPermissionDenied();
        } else {
            throw new interoperableErrors.NotFoundError();
        }
    }

    let builder;

    if(user.role === 'farmer')
        builder = builder => builder
                .from('recommendations')
                .where('recommendations.farmer', context.user.id)
                .innerJoin('users as farmer', 'farmer.id', 'recommendations.farmer')
                .innerJoin('users as advisor', 'advisor.id', 'recommendations.advisor')
                .innerJoin('farms', 'farms.id', 'recommendations.farm')
                .innerJoin('event_types', 'event_types.id', 'recommendations.type')
    else if(user.role === 'advisor') {
        builder = builder => builder
                .from('recommendations')
                .where('recommendations.advisor', context.user.id)
                .innerJoin('users as farmer', 'farmer.id', 'recommendations.farmer')
                .innerJoin('users as advisor', 'advisor.id', 'recommendations.advisor')
                .innerJoin('farms', 'farms.id', 'recommendations.farm')
                .innerJoin('event_types', 'event_types.id', 'recommendations.type')
    }
    else if(user.role === 'master') {
        builder = builder => builder
                .from('recommendations')
                .innerJoin('users as farmer', 'farmer.id', 'recommendations.farmer')
                .innerJoin('users as advisor', 'advisor.id', 'recommendations.advisor')
                .innerJoin('farms', 'farms.id', 'recommendations.farm')
                .innerJoin('event_types', 'event_types.id', 'recommendations.type')
    } else
        return;
    

    return await knex.transaction(async tx => {
        return await dtHelpers.ajaxListTx(
            tx,
            params,
            builder,
            ['recommendations.id', 'advisor.name', 'farmer.name', 'farms.name', 'event_types.name', 'recommendations.description', 'recommendations.to_be_happened', 'recommendations.quantity', 'recommendations.cost']
        );
    });
}

//.where('shares_farm.user', context.user.id)
//.innerJoin('shares_farm', 'shares_farm.entity', 'recommendations.farm')
async function create(context, entity) {
    return await knex.transaction(async tx => {
        //QUESTION
        //await shares.enforceEntityPermissionTx(tx, context, 'namespace', entity.namespace, 'manageFarms');

        //await _validateAndPreprocess(tx, entity, true);

        const filteredEntity = filterObject(entity, allowedKeysCreate);
        const ids = await tx('recommendations').insert(filteredEntity);
        const id = ids[0];

        // FIXME: await shares.rebuildPermissionsTx(tx, { entityTypeId: 'eventType', entityId: id });

        return id;
    });
}

async function updateWithConsistencyCheck(context, entity) {
    await knex.transaction(async tx => {
        // FIXME: await shares.enforceEntityPermissionTx(tx, context, 'eventType', entity.id, 'edit');
        //await shares.enforceEntityPermissionTx(tx, context, 'namespace', entity.namespace, 'manageFarms');

        const existing = await tx('recommendations').where('id', entity.id).first();
        if (!existing) {
            throw new interoperableErrors.NotFoundError();
        }

        const existingHash = hash(existing);
        if (existingHash !== entity.originalHash) {
            throw new interoperableErrors.ChangedError();
        }

        //await _validateAndPreprocess(tx, entity, false);
        // FIXME: await namespaceHelpers.validateMove(context, entity, existing, 'eventType', 'createeventType', 'delete');

        //console.log(entity);
        entity.to_be_happened = moment.utc(entity.to_be_happened).format('YYYY-MM-DD') + ' 00:00:00'

        const filteredEntity = filterObject(entity, allowedKeysUpdate);
        //FIXME: to resolve update problem with datetime

        await tx('recommendations').where('id', entity.id).update(filteredEntity);

        // FIXME: await shares.rebuildPermissionsTx(tx, { entityTypeId: 'eventType', entityId: entity.id });
    });
}

async function remove(context, id) {
    await knex.transaction(async tx => {
        // FIXME: await shares.enforceEntityPermissionTx(tx, context, 'eventType', id, 'delete');
        //await shares.enforceEntityPermissionTx(tx, context, 'namespace', context.user.namespace, 'manageFarms');

        const existing = await tx('recommendations').where('id', id).first();
        await tx('recommendations').where('id', id).del();
    });
}


//FIXME: to be used in the future
async function serverValidate(context, data) {
    const result = {};

    //table.unique(['farmer', 'farm', 'type', 'happened']);

    if (data.name) {
        const query = knex('recommendations')
            .where('farmer', data.farmer)
            .where('farm', data.farm);

        if (data.id) {
            // Id is not set in entity creation form
            query.andWhereNot('id', data.id);
        }

        const recommendation = await query.first();

        result.cid = {};
        result.cid.exists = !!recommendation ;
    }

    return result;
}

//FIXME: to be used in the future
async function _validateAndPreprocess(tx, entity, is) {
    await namespaceHelpers.validateEntity(tx, entity);

    const existingWithNameQuery = tx('recommendations')
        .where('farmer', data.farmer)
        .where('farm', data.farm);

    if (!is) {
        existingWithNameQuery.whereNot('id', entity.id);
    }

    const existingWithName = await existingWithNameQuery.first();
    enforce(!existingWithName, "recommendation entry (farmer, farm, type, happened) is already used for another recommendation in the same context.")
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