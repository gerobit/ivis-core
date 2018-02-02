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

async function getByFarmIdDATjax(context, params, farmId) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{ entityTypeId: 'namespace', requiredOperations: ['viewCropSeason'] }],
        params,
        builder => builder.from('crop_seasons')
            .where('crop_seasons.farm', farmId)
            .innerJoin('farms', 'farms.id', 'crop_seasons.farm')
            .innerJoin('crops', 'crops.id', 'crop_seasons.crop')
            .innerJoin('namespaces', 'namespaces.id', 'crop_seasons.namespace')
        ,
        ['crop_seasons.id', 'crop_seasons.name', 'crop_seasons.description', 'farms.name', 'crops.name', 'start', 'end']
    );
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
    remove
};