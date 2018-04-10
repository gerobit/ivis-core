'use strict';

const knex = require('../lib/knex');
const hasher = require('node-object-hash')();
const { enforce, filterObject } = require('../lib/helpers');
const dtHelpers = require('../lib/dt-helpers');
const interoperableErrors = require('../../shared/interoperable-errors');
const namespaceHelpers = require('../lib/namespace-helpers');
const shares = require('./shares');
const { TemplateType } = require('../../shared/templates');
const { BuildState } = require('../../shared/build');
const fs = require('fs-extra-promise');
const webpack = require('../lib/builder');
const path = require('path');

const templatesDir = path.join(__dirname, '..', 'files', 'templates');

const allowedKeys = new Set(['name', 'description', 'type', 'settings', 'namespace']);

function getTemplateDir(id){
    return path.join(templatesDir, id.toString());
}

function getTemplateUploadedFilesDir(id){
    return path.join(getTemplateDir(id), 'files')
}

function getFilePath(templateId, filename){
    return path.join(getTemplateUploadedFilesDir(templateId), 'files', filename);
}

function getTemplateBuildOutputDir(id){
    return path.join(getTemplateDir(id), 'build')
}

function hash(entity) {
    return hasher.hash(filterObject(entity, allowedKeys));
}

async function getById(context, id) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'template', id, 'view');
        const entity = await tx('templates').where('id', id).first();
        entity.settings = JSON.parse(entity.settings);
        entity.output = JSON.parse(entity.output);
        entity.permissions = await shares.getPermissionsTx(tx, context, 'template', id);
        return entity;
    });
}

async function listDTAjax(context, params) {
    return await dtHelpers.ajaxListWithPermissions(
        context,
        [{ entityTypeId: 'template', requiredOperations: ['view'] }],
        params,
        builder => builder.from('templates').innerJoin('namespaces', 'namespaces.id', 'templates.namespace'),
        [ 'templates.id', 'templates.name', 'templates.description', 'templates.type', 'templates.created', 'templates.state', 'namespaces.name' ]
    );
}

async function create(context, entity) {
    const id = await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'namespace', entity.namespace, 'createTemplate');
        await namespaceHelpers.validateEntity(tx, entity);

        enforce(Object.values(TemplateType).includes(entity.type), 'Unknown template type')

        const filteredEntity = filterObject(entity, allowedKeys);
        filteredEntity.settings = JSON.stringify(filteredEntity.settings);
        filteredEntity.state = BuildState.SCHEDULED;

        const ids = await tx('templates').insert(filteredEntity);
        const id = ids[0];

        await scheduleBuild(tx, id, entity.settings);

        await shares.rebuildPermissionsTx(tx, { entityTypeId: 'template', entityId: id });

        return id;
    });

    scheduleBuild(id, entity.settings);

    return id;
}

async function updateWithConsistencyCheck(context, entity) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'template', entity.id, 'edit');

        const existing = await tx('templates').where('id', entity.id).first();
        if (!existing) {
            throw new interoperableErrors.NotFoundError();
        }

        existing.settings = JSON.parse(existing.settings);
        const existingHash = hash(existing);
        if (existingHash !== entity.originalHash) {
            throw new interoperableErrors.ChangedError();
        }

        await namespaceHelpers.validateEntity(tx, entity);
        await namespaceHelpers.validateMove(context, entity, existing, 'template', 'createTemplate', 'delete');

        const filteredEntity = filterObject(entity, allowedKeys);
        filteredEntity.settings = JSON.stringify(filteredEntity.settings);
        filteredEntity.state = BuildState.SCHEDULED;
        await tx('templates').where('id', entity.id).update(filteredEntity);

        await shares.rebuildPermissionsTx(tx, { entityTypeId: 'template', entityId: entity.id });
    });

    scheduleBuild(entity.id, entity.settings);
}

async function remove(context, id) {
    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'template', id, 'delete');

        await tx('templates').where('id', id).del();
    });

    // deletes all files of template (including built and uploaded files)
    await fs.remove(getTemplateDir(id));

    // FIXME - get rid of the panels too or prevent delete
}

async function getParamsById(context, id) {
    return await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'template', id, 'view');
        const entity = await tx('templates').select(['settings']).where('id', id).first();
        const settings = JSON.parse(entity.settings);
        return settings.params;
    });
}

async function getModuleById(context, id) {
    await shares.enforceEntityPermission(context, 'template', id, 'execute');
    const module = await fs.readFileAsync(path.join(getTemplateBuildOutputDir(id), 'module.js'), 'utf8');
    return module;
}
async function listFilesDTAjax(context, templateId, params) {
    await shares.enforceEntityPermission(context, 'template', templateId, 'edit');
    return await dtHelpers.ajaxList(
        params,
        builder => builder.from('template_files').where({template: templateId}),
        ['id', 'originalname', 'size', 'created']
    );
}

async function getFileById(context, id) {
    const file = await knex.transaction(async tx => {
        const file = await tx('template_files').where('id', id).first();
        await shares.enforceEntityPermissionTx(tx, context, 'template', file.template, 'edit');
        return file;
    });

    return {
        mimetype: file.mimetype,
        name: file.originalname,
        path: getFilePath(file.template, file.filename)
    };
}

async function getFileByName(context, templateId, name) {
    const file = await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'template', templateId, 'execute');
        const file = await tx('template_files').where({template: templateId, originalname: name}).first();
        return file;
    });

    return {
        mimetype: file.mimetype,
        name: file.originalname,
        path: getFilePath(file.template, file.filename)
    };
}

async function createFiles(context, templateId, files) {
    if(files.length == 0){
        // No files uploaded
        return {uploaded: 0};
    }

    const originalNameSet = new Set()
    const fileEntities = new Array()
    const filesToMove = new Array()
    const ignoredFiles = new Array()

    // Create entities for files
    for(const file of files){
        if(originalNameSet.has(file.originalname)){
            // The file has an original name same as another file
            ignoredFiles.push(file);
        }
        else{
            originalNameSet.add(file.originalname);

            const fileEntity = {
                template: templateId,
                filename: file.filename,
                originalname: file.originalname,
                mimetype: file.mimetype,
                encoding: file.encoding,
                size: file.size
            };

            fileEntities.push(fileEntity);
            filesToMove.push(file);
        }
    }

    const originalNameArray = Array.from(originalNameSet);

    const removedFiles = await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'template', templateId, 'edit');
        const removedFiles = await tx('template_files').where('template', templateId).whereIn('originalname', originalNameArray).select(['filename', 'originalname']);
        await tx('template_files').where('template', templateId).whereIn('originalname', originalNameArray).del();
        if(fileEntities){
            await tx('template_files').insert(fileEntities);
        }
        return removedFiles;
    });

    const removedNameSet = new Set();

    // Move new files from upload directory to template directory
    for(const file of filesToMove){
        const filePath = getFilePath(templateId, file.filename)
        // The names should be unique, so overwrite is disabled
        // The directory is created if it does not exist
        // Empty options argument is passed, otherwise fails
        await fs.move(file.path, filePath, {});
    }
    // Remove replaced files from template directory
    for(const file of removedFiles){
        removedNameSet.add(file.originalname);
        const filePath = getFilePath(templateId, file.filename);
        await fs.remove(filePath);
    }
    // Remove ignored files from upload directory
    for(const file of ignoredFiles){
        await fs.remove(file.path);
    }

    return {
        uploaded: files.length,
        added: fileEntities.length - removedNameSet.size,
        replaced: removedFiles.length,
        ignored: ignoredFiles.length
    };
}

async function removeFile(context, id) {
    const file = await knex.transaction(async tx => {
        const file = await tx('template_files').where('id', id).select('template', 'filename').first();
        await shares.enforceEntityPermissionTx(tx, context, 'template', file.template, 'edit');
        await tx('template_files').where('id', id).del();
        return {filename: file.filename, template: file.template};
    });

    const filePath = getFilePath(file.template, file.filename);
    await fs.remove(filePath);
}

function scheduleBuild(id, settings) {
    webpack.scheduleBuild('template_' + id, settings.jsx, settings.scss, getTemplateBuildOutputDir(id), {table: 'templates', rowId: id});
}

async function compile(context, id) {
    let entity;

    await knex.transaction(async tx => {
        await shares.enforceEntityPermissionTx(tx, context, 'template', id, 'edit');

        entity = await tx('templates').where('id', id).first();

        await tx('templates').where('id', id).update({state: BuildState.SCHEDULED});
    });

    const settings = JSON.parse(entity.settings);
    scheduleBuild(id, settings);
}

async function compileAllPending() {
    await knex('templates').where('state', BuildState.PROCESSING).update({state: BuildState.SCHEDULED});
    const entities = await knex('templates').where('state', BuildState.SCHEDULED);

    for (const entity of entities) {
        const settings = JSON.parse(entity.settings);
        scheduleBuild(entity.id, settings);
    }
}

module.exports = {
    hash,
    getById,
    listDTAjax,
    create,
    updateWithConsistencyCheck,
    remove,
    getParamsById,
    getModuleById,
    compile,
    compileAllPending,
    listFilesDTAjax,
    getFileById,
    getFileByName,
    createFiles,
    removeFile
};