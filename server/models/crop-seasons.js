'use strict';

const config = require('../lib/config');
const knex = require('../lib/knex');
const hasher = require('node-object-hash')();
const { enforce, filterObject } = require('../lib/helpers');
const dtHelpers = require('../lib/dt-helpers');
const interoperableErrors = require('../../shared/interoperable-errors');
const namespaceHelpers = require('../lib/namespace-helpers');
const shares = require('./shares');

const allowedKeysCreate = new Set(['name', 'description', 'farm', 'crop', 'start', 'end', 'namespace']);
const allowedKeysUpdate = new Set(['name', 'description', 'farm', 'crop', 'start', 'end', 'namespace']);

function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeysUpdate));
}

async function getById(context, id) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'namespace', context.user.namespace, 'viewCropSeason');
        const entity = await tx('crop_seasons').where('id', id).first();
        entity.permissions = await shares.getPermissionsTx(tx, context, 'namespace', context.user.namespace);
        return entity;
    });
}

async function getByFarmId(context, farmId) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'namespace', context.user.namespace, 'viewCropSeason');

        const entities = await tx.select(['crop_seasons.id as id', 'crop_seasons.name as name', 'crop_seasons.description as description', 'farms.name as farm', 'crops.name as crop', 'start', 'end'])
            .from('crop_seasons').where('crop_seasons.farm', farmId)
            .innerJoin('farms', 'farms.id', 'crop_seasons.farm')
            .innerJoin('crops', 'crops.id', 'crop_seasons.crop')

        return entities;
    });
}

/*
        const entities = await tx.select(['crop_seasons.name as name', 'start', 'end',
            'crops.name as crop', 'farms.name as farm', 'event_types.name as event',
            'event_types.unit as unit', knex.raw('sum(events.cost) as costs'),
            knex.raw('sum(events.quantity) as quantities')])
            .from('events')
            .innerJoin('event_types', 'event_types.id', 'events.type')
            .innerJoin('crop_seasons', 'crop_seasons.farm', 'events.farm')
            .innerJoin('farms', 'farms.id', 'crop_seasons.farm')
            .innerJoin('crops', 'crops.id', 'crop_seasons.crop')
            .groupBy('event_types.id', 'crop_seasons.name', 'farms.name', 'start', 'end')
        //https://github.com/tgriesser/knex/issues/1225
        //.whereRaw('date_format(date, \'%Y-%m-%d\') BETWEEN ? AND ?', [date1, date2])

        return entities;
    });
}

async function cropSeasonsStatisticsPut(context, farm, start, end, params) {
    console.log(JSON.stringify(params));

    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{ entityTypeId: 'namespace', requiredOperations: ['viewCropSeason'] }],
        params,
        builder => builder.from('events')
            .where('events.farm', farm)
            .whereBetween('events.happened', [start, end])
            .innerJoin('event_types', 'event_types.id', 'events.type')
            .groupBy('event_types.name')
            .innerJoin('namespaces', 'namespaces.id', 'events.namespace')

        ,
        ['event_types.name', knex.raw('sum(events.cost)'), knex.raw('sum(events.quantity)')]
        //['event_types.name as event', knex.raw('sum(events.cost) as costs'), knex.raw('sum(events.quantity) as quantities')]
    );
} */

async function cropSeasonsStatistics(context, farm, start, end, params) {
    return await knex.transaction(async tx => {
        const entities = await tx.select(['event_types.name as event', knex.raw('sum(events.cost) as costs'), knex.raw('sum(events.quantity) as quantities')])
            .from('events')
            .where('events.farm', farm)
            .whereBetween('events.happened', [start, end])
            .innerJoin('event_types', 'event_types.id', 'events.type')
            .groupBy('event_types.name');
        return entities;
    });
}

async function listDTAjax(context, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{ entityTypeId: 'namespace', requiredOperations: ['viewCropSeason'] }],
        params,
        builder => builder.from('crop_seasons')
            .innerJoin('farms', 'farms.id', 'crop_seasons.farm')
            .innerJoin('crops', 'crops.id', 'crop_seasons.crop')
            .innerJoin('namespaces', 'namespaces.id', 'crop_seasons.namespace')
        ,
        ['crop_seasons.id', 'crop_seasons.name', 'crop_seasons.description', 'farms.name', 'crops.name', 'start', 'end']
    );
}

async function create(context, entity) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'namespace', context.user.namespace, 'createCropSeason');
        const filteredEntity = filterObject(entity, allowedKeysCreate);
        const ids = await tx('crop_seasons').insert(filteredEntity);
        const id = ids[0];

        return id;
    });
}

async function updateWithConsistencyCheck(context, entity) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'namespace', context.user.namespace, 'createCropSeason');

        const existing = await tx('crop_seasons').where('id', entity.id).first();
        if (!existing) {
            throw new interoperableErrors.NotFoundError();
        }

        const existingHash = hash(existing);
        if (existingHash !== entity.originalHash) {
            throw new interoperableErrors.ChangedError();
        }

        const filteredEntity = filterObject(entity, allowedKeysUpdate);
        await tx('crop_seasons').where('id', entity.id).update(filteredEntity);
    });
}

async function remove(context, id) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'namespace', context.user.namespace, 'createCropSeason');

        const existing = await tx('crop_seasons').where('id', id).first();
        await tx('crop_seasons').where('id', id).del();
    });
}

module.exports = {
    hash,
    getById,
    getByFarmId,
    listDTAjax,
    create,
    updateWithConsistencyCheck,
    remove,
    cropSeasonsStatistics
};