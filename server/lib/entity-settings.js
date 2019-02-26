'use strict';
const em = require('./extension-manager');

const ReplacementBehavior = {
    NONE: 1,
    REPLACE: 2,
    RENAME: 3
};


const entityTypes = {
    namespace: {
        entitiesTable: 'namespaces',
        sharesTable: 'shares_namespace',
        permissionsTable: 'permissions_namespace',
        clientLink: ({id}) => `/settings/namespaces/${id}`
    },
    template: {
        entitiesTable: 'templates',
        sharesTable: 'shares_template',
        permissionsTable: 'permissions_template',
        files: {
            file: {
                table: 'files_template_file',
                permissions: {
                    view: 'viewFiles',
                    manage: 'manageFiles'
                },
                defaultReplacementBehavior: ReplacementBehavior.REPLACE
            }
        },
        clientLink: ({id}) => `/settings/templates/${id}`
    },
    workspace: {
        entitiesTable: 'workspaces',
        sharesTable: 'shares_workspace',
        permissionsTable: 'permissions_workspace',
        clientLink: ({id}) => `/settings/workspaces/${id}`
    },
    panel: {
        entitiesTable: 'panels',
        sharesTable: 'shares_panel',
        permissionsTable: 'permissions_panel',
        clientLink: ({id, workspace}) => `/settings/workspaces/${workspace}/panels/${id}`
    },
    signal: {
        entitiesTable: 'signals',
        sharesTable: 'shares_signal',
        permissionsTable: 'permissions_signal',
        clientLink: ({id, set}) => `/settings/signal-sets/${set}/signals/${id}`
    },
    signalSet: {
        entitiesTable: 'signal_sets',
        sharesTable: 'shares_signal_set',
        permissionsTable: 'permissions_signal_set',
        clientLink: ({id}) => `/settings/signal-sets/${id}`
    },
    user: {
        entitiesTable: 'users',
        clientLink: ({id}) => `/settings/users/${id}`
    }
};

em.invoke('entitySettings.updateEntities', entityTypes);

const entityTypesWithPermissions = {};
for (const key in entityTypes) {
    if (entityTypes[key].permissionsTable) {
        entityTypesWithPermissions[key] = entityTypes[key];
    }
}


function getEntityTypes() {
    return entityTypes;
}

function getEntityTypesWithPermissions() {
    return entityTypesWithPermissions;
}

function getEntityType(entityTypeId) {
    const entityType = entityTypes[entityTypeId];

    if (!entityType) {
        throw new Error(`Unknown entity type ${entityTypeId}`);
    }

    return entityType
}


module.exports = {
    getEntityTypes,
    getEntityTypesWithPermissions,
    getEntityType,
    ReplacementBehavior
}