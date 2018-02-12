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

const allowedKeysCreate = new Set(['farmer', 'farm', 'type', 'description', 'happened', 'quantity', 'cost', 'namespace']);
const allowedKeysUpdate = new Set(['farmer', 'farm', 'type', 'description', 'happened', 'quantity', 'cost']);

function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeysUpdate));
}

async function getById(context, id) {
    return await knex.transaction(async tx => {
        //await shares.enforceEntityPermissionTx(tx, context, 'f', id, 'view');
        const entity = await tx('events').where('id', id).first();
        //entity.permissions = await shares.getPermissionsTx(tx, context, 'namespace', id);
        return entity;
    });
}

async function getEvents(context) {
    const user = await knex('users').select('role').where('id', context.user.id).first();
    if (!user) {
        if (context) {
            shares.throwPermissionDenied();
        } else {
            throw new interoperableErrors.NotFoundError();
        }
    }

    return await knex.transaction(async tx => {
        if (user.role === 'farmer') {
            return await tx.select(['events.id', 'users.name as user', 'farms.name as farm', 'event_types.name as event', 'events.description', 'events.happened', 'events.quantity', 'events.cost'])
                .from('events')
                .where('events.farmer', context.user.id)
                .innerJoin('users', 'users.id', 'events.farmer')
                .innerJoin('farms', 'farms.id', 'events.farm')
                .innerJoin('event_types', 'event_types.id', 'events.type')
        }
        else if (user.role === 'advisor') {
            return await tx.select(['events.id', 'users.name as user', 'farms.name as farm', 'event_types.name as event', 'events.description', 'events.happened', 'events.quantity', 'events.cost'])
                .from('events')
                .innerJoin('shares_farm', 'shares_farm.entity', 'events.farm')
                .where('shares_farm.user', context.user.id)
                .innerJoin('users', 'users.id', 'events.farmer')
                .innerJoin('farms', 'farms.id', 'events.farm')
                .innerJoin('event_types', 'event_types.id', 'events.type')
        }
        else if (user.role === 'master') {
            return await tx.select(['events.id', 'users.name as user', 'farms.name as farm', 'event_types.name as event', 'events.description', 'events.happened', 'events.quantity', 'events.cost'])
                .from('events')
                .innerJoin('users', 'users.id', 'events.farmer')
                .innerJoin('farms', 'farms.id', 'events.farm')
                .innerJoin('event_types', 'event_types.id', 'events.type')
        } else
            return;
    });
}

async function listDTAjax(context, params) {
                /*return await dtHelpers.ajaxListWithPermissions(
                    context,
                    [{ entityTypeId: 'namespace', requiredOperations: ['viewEvents'] }],
                    params,
                    builder => builder.from('events')
                        .innerJoin('users', 'users.id', 'events.farmer')
                        .innerJoin('farms', 'farms.id', 'events.farm')
                        .innerJoin('event_types', 'event_types.id', 'events.type')
                    ,
                    ['events.id', 'users.name', 'farms.name', 'event_types.name', 'events.description', 'events.happened', 'events.quantity', 'events.cost']
                );*/
                //usersModel.getById(context, id)
                const user = await knex('users').select('role').where('id', context.user.id).first();
                if (!user) {
                    if (context) {
                        shares.throwPermissionDenied();
                    } else {
                        throw new interoperableErrors.NotFoundError();
                    }
                }

                let builder;

                if (user.role === 'farmer')
                    builder = builder => builder
                        .from('events')
                        .where('events.farmer', context.user.id)
                        .innerJoin('users', 'users.id', 'events.farmer')
                        .innerJoin('farms', 'farms.id', 'events.farm')
                        .innerJoin('event_types', 'event_types.id', 'events.type')
                else if (user.role === 'advisor') {
                    builder = builder => builder
                        .from('events')
                        .innerJoin('shares_farm', 'shares_farm.entity', 'events.farm')
                        .where('shares_farm.user', context.user.id)
                        .innerJoin('users', 'users.id', 'events.farmer')
                        .innerJoin('farms', 'farms.id', 'events.farm')
                        .innerJoin('event_types', 'event_types.id', 'events.type')
                }
                else if (user.role === 'master') {
                    builder = builder => builder
                        .from('events')
                        .innerJoin('users', 'users.id', 'events.farmer')
                        .innerJoin('farms', 'farms.id', 'events.farm')
                        .innerJoin('event_types', 'event_types.id', 'events.type')
                } else
                    return;


                return await knex.transaction(async tx => {
                    return await dtHelpers.ajaxListTx(
                        tx,
                        params,
                        builder,
                        ['events.id', 'users.name', 'farms.name', 'event_types.name', 'events.description', 'events.happened', 'events.quantity', 'events.cost']
                    );
                }
                );
            }

async function create(context, entity) {
                return await knex.transaction(async tx => {
                    //QUESTION
                    //await shares.enforceEntityPermissionTx(tx, context, 'namespace', entity.namespace, 'manageFarms');

                    //await _validateAndPreprocess(tx, entity, true);
                    entity.namespace = context.user.namespace;
                    const filteredEntity = filterObject(entity, allowedKeysCreate);
                    const ids = await tx('events').insert(filteredEntity);
                    const id = ids[0];

                    // FIXME: await shares.rebuildPermissionsTx(tx, { entityTypeId: 'eventType', entityId: id });

                    return id;
                });
}

async function updateWithConsistencyCheck(context, entity) {
                await knex.transaction(async tx => {
                    // FIXME: await shares.enforceEntityPermissionTx(tx, context, 'eventType', entity.id, 'edit');
                    //await shares.enforceEntityPermissionTx(tx, context, 'namespace', entity.namespace, 'manageFarms');

                    const existing = await tx('events').where('id', entity.id).first();
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
                    entity.happened = moment.utc(entity.happened).format('YYYY-MM-DD') + ' 00:00:00'

                    const filteredEntity = filterObject(entity, allowedKeysUpdate);
                    //FIXME: to resolve update problem with datetime

                    await tx('events').where('id', entity.id).update(filteredEntity);

                    // FIXME: await shares.rebuildPermissionsTx(tx, { entityTypeId: 'eventType', entityId: entity.id });
                });
            }

async function remove(context, id) {
                await knex.transaction(async tx => {
                    // FIXME: await shares.enforceEntityPermissionTx(tx, context, 'eventType', id, 'delete');
                    //await shares.enforceEntityPermissionTx(tx, context, 'namespace', context.user.namespace, 'manageFarms');

                    const existing = await tx('events').where('id', id).first();
                    await tx('events').where('id', id).del();
                });
            }


//FIXME: to be used in the future
async function serverValidate(context, data) {
                const result = {};

                //table.unique(['farmer', 'farm', 'type', 'happened']);

                if (data.name) {
                    const query = knex('events')
                        .where('farmer', data.farmer)
                        .where('farm', data.farm);

                    if (data.id) {
                        // Id is not set in entity creation form
                        query.andWhereNot('id', data.id);
                    }

                    const event = await query.first();

                    result.cid = {};
                    result.cid.exists = !!event;
                }

                return result;
            }

//FIXME: to be used in the future
async function _validateAndPreprocess(tx, entity, is) {
                await namespaceHelpers.validateEntity(tx, entity);

                const existingWithNameQuery = tx('events')
                    .where('farmer', data.farmer)
                    .where('farm', data.farm);

                if (!is) {
                    existingWithNameQuery.whereNot('id', entity.id);
                }

                const existingWithName = await existingWithNameQuery.first();
                enforce(!existingWithName, "event entry (farmer, farm, type, happened) is already used for another event in the same context.")
            }
module.exports = {
                hash,
                getById,
                listDTAjax,
                create,
                updateWithConsistencyCheck,
                remove,
                serverValidate,
                getEvents
            };