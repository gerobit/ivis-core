'use strict';

const config = require('../lib/config');
const knex = require('../lib/knex');
const hasher = require('node-object-hash')();
const { enforce, filterObject } = require('../lib/helpers');
const dtHelpers = require('../lib/dt-helpers');
const interoperableErrors = require('../../shared/interoperable-errors');
const namespaceHelpers = require('../lib/namespace-helpers');
const shares = require('./shares');

const allowedKeysCreate = new Set(['name', 'description', 'root', 'max_height', 'namespace']);
const allowedKeysUpdate = new Set(['name', 'description', 'root', 'max_height', 'namespace']);

function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeysUpdate));
}

async function getById(context, id) {
    return await knex.transaction(async tx => {
        //await shares.enforceEntityPermissionTx(tx, context, 'f', id, 'view');
        const entity = await tx('crops').where('id', id).first();
        //entity.permissions = await shares.getPermissionsTx(tx, context, 'namespace', id);
        return entity;
    });
}

async function listDTAjax(context, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{ entityTypeId: 'namespace', requiredOperations: ['manageFarms'] }],
        params,
        builder => builder.from('crops').innerJoin('namespaces', 'namespaces.id', 'crops.namespace'),
        ['crops.id', 'crops.name', 'crops.description', 'crops.root', 'crops.max_height', 'namespaces.name']
    );
}

async function create(context, entity) {
    return await knex.transaction(async tx => {
        //QUESTION
        await shares.enforceEntityPermissionTx(tx, context, 'namespace', entity.namespace, 'manageFarms');

        //await _validateAndPreprocess(tx, entity, true);

        const filteredEntity = filterObject(entity, allowedKeysCreate);
        const ids = await tx('crops').insert(filteredEntity);
        const id = ids[0];

        // FIXME: await shares.rebuildPermissionsTx(tx, { entityTypeId: 'crop', entityId: id });

        return id;
    });
}

async function updateWithConsistencyCheck(context, entity) {
    await knex.transaction(async tx => {
        // FIXME: await shares.enforceEntityPermissionTx(tx, context, 'crop', entity.id, 'edit');
        await shares.enforceEntityPermissionTx(tx, context, 'namespace', entity.namespace, 'manageFarms');

        const existing = await tx('crops').where('id', entity.id).first();
        if (!existing) {
            throw new interoperableErrors.NotFoundError();
        }

        const existingHash = hash(existing);
        if (existingHash !== entity.originalHash) {
            throw new interoperableErrors.ChangedError();
        }

        //await _validateAndPreprocess(tx, entity, false);
        // FIXME: await namespaceHelpers.validateMove(context, entity, existing, 'crop', 'createcrop', 'delete');

        const filteredEntity = filterObject(entity, allowedKeysUpdate);
        await tx('crops').where('id', entity.id).update(filteredEntity);

        // FIXME: await shares.rebuildPermissionsTx(tx, { entityTypeId: 'crop', entityId: entity.id });
    });
}

async function remove(context, id) {
    await knex.transaction(async tx => {
        // FIXME: await shares.enforceEntityPermissionTx(tx, context, 'crop', id, 'delete');
        await shares.enforceEntityPermissionTx(tx, context, 'namespace', context.user.namespace, 'manageFarms');

        const existing = await tx('crops').where('id', id).first();
        await tx('crops').where('id', id).del();
    });
}


//FIXME: to be used in the future
async function serverValidate(context, data) {
    const result = {};

    if (data.name) {
        const query = knex('crops')
            .where('name', data.name)
            .where('namespace', data.namespace);
        
        if (data.id) {
            // Id is not set in entity creation form
            query.andWhereNot('id', data.id);
        }

        const crop = await query.first();

        result.cid = {};
        result.cid.exists = !!crop;
    }

    return result;
}

//FIXME: to be used in the future
async function _validateAndPreprocess(tx, entity, is) {
    await namespaceHelpers.validateEntity(tx, entity);

    const existingWithNameQuery = tx('crops')
        .where('name', entity.name)
        .where('namespace', entity.namespace);

    if (!is) {
        existingWithNameQuery.whereNot('id', entity.id);
    }

    const existingWithName = await existingWithNameQuery.first();
    enforce(!existingWithName, "crop name (name) is already used for another crop in the same namespace.")
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